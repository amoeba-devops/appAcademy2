import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  AttachmentCategory,
  AttachmentMime,
  AttachmentTypeormEntity,
  AttachmentVisibility,
} from '../infrastructure/typeorm/attachment.typeorm-entity';
import { ObjectStoreClient } from '../infrastructure/external/object-store.client';

/**
 * REQ-260626 T-06 / ADR-008 — CSL attachment service.
 *
 * Workflow (3-step):
 *   1. Browser → POST /:inqId/attachments/presigned-upload
 *      Server validates declared metadata (size/mime/count), inserts
 *      a row with status implicit-pending (no `att_uploaded_by` yet),
 *      returns presigned PUT URL + att_id + key.
 *   2. Browser PUTs the file directly to MinIO/S3.
 *   3. Browser → POST /:inqId/attachments/:attId/confirm
 *      Server HEADs the object, verifies size matches, stamps
 *      `att_uploaded_by` to mark the row active.
 *
 * Visibility:
 *   - TRANSCRIPT  → STAFF_ONLY  (POL-CSL-203)
 *   - MATERIAL    → TEACHER_STUDENT
 *   - RESULT_PDF  → STAFF_ONLY (cached PDF, internal)
 *
 * Caps (Q-CSL-106): ≤10MB × ≤10 rows / (inq, category).
 */
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_PER_INQ_CATEGORY = 10;
const ALLOWED_MIMES: AttachmentMime[] = ['application/pdf', 'image/jpeg', 'image/png'];

interface PresignedUploadOpts {
  category: AttachmentCategory;
  filename: string;
  mime: string;
  sizeBytes: number;
  refId?: string | null;
}

@Injectable()
export class AttachmentService {
  private readonly log = new Logger(AttachmentService.name);

  constructor(
    @InjectRepository(AttachmentTypeormEntity, ACM_DS)
    private readonly repo: Repository<AttachmentTypeormEntity>,
    private readonly store: ObjectStoreClient,
  ) {}

  // ── Issue presigned upload ─────────────────────────────────────────────

  async issuePresignedUpload(
    entId: string,
    inqId: string,
    opts: PresignedUploadOpts,
  ): Promise<{
    attId: string;
    s3Key: string;
    presignedUrl: string;
    expiresIn: number;
  }> {
    if (!this.store.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORE_NOT_CONFIGURED',
        message: 'Attachment storage is not configured (set ACM_S3_* env)',
      });
    }
    if (opts.sizeBytes <= 0 || opts.sizeBytes > MAX_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'SIZE_EXCEEDED',
        message: `File size must be 1B..10MB (got ${opts.sizeBytes})`,
      });
    }
    if (!ALLOWED_MIMES.includes(opts.mime as AttachmentMime)) {
      throw new BadRequestException({
        code: 'MIME_NOT_ALLOWED',
        message: `Only ${ALLOWED_MIMES.join(', ')} are allowed (got ${opts.mime})`,
      });
    }
    const count = await this.repo.count({
      where: { entId, inqId, category: opts.category, deletedAt: IsNull() },
    });
    if (count >= MAX_PER_INQ_CATEGORY) {
      throw new BadRequestException({
        code: 'COUNT_EXCEEDED',
        message: `Up to ${MAX_PER_INQ_CATEGORY} files per inquiry+category (have ${count})`,
      });
    }

    const visibility = this.defaultVisibility(opts.category);
    const row = this.repo.create({
      entId,
      inqId,
      category: opts.category,
      refId: opts.refId ?? null,
      s3Key: '', // filled below
      filename: opts.filename,
      mime: opts.mime as AttachmentMime,
      sizeBytes: String(opts.sizeBytes),
      visibility,
      uploadedBy: null,
    });
    const saved = await this.repo.save(row);
    saved.s3Key = this.store.buildKey(entId, saved.id, opts.filename);
    await this.repo.save(saved);

    const presignedUrl = await this.store.presignPut({
      key: saved.s3Key,
      mime: opts.mime,
      sizeBytes: opts.sizeBytes,
    });
    return {
      attId: saved.id,
      s3Key: saved.s3Key,
      presignedUrl,
      expiresIn: 300,
    };
  }

  // ── Confirm the PUT completed ─────────────────────────────────────────

  async confirmUpload(
    entId: string,
    inqId: string,
    attId: string,
    actorId: string,
  ): Promise<AttachmentTypeormEntity> {
    const row = await this.findOrThrow(entId, inqId, attId);
    if (row.uploadedBy) {
      // Idempotent — already confirmed.
      return row;
    }
    const head = await this.store.head(row.s3Key);
    if (!head) {
      throw new BadRequestException({
        code: 'OBJECT_NOT_FOUND',
        message: 'PUT to presigned URL did not complete — re-upload required',
      });
    }
    if (head.size !== Number(row.sizeBytes)) {
      // The browser uploaded a different size than declared — reject so
      // we don't end up with a row whose `size_bytes` lies. The object
      // is left in place; the cleanup job can sweep dangling keys.
      throw new BadRequestException({
        code: 'SIZE_MISMATCH',
        message: `Declared ${row.sizeBytes}B but stored ${head.size}B`,
      });
    }
    row.uploadedBy = actorId;
    await this.repo.save(row);
    return row;
  }

  // ── List + download ───────────────────────────────────────────────────

  /**
   * List attachments for an inquiry, filtered by category if given.
   * Visibility filtering happens at the controller layer based on
   * the caller's role + assignment, since the service doesn't know
   * the caller. This method always returns confirmed (uploaded_by
   * non-null) rows.
   */
  async list(
    entId: string,
    inqId: string,
    category?: AttachmentCategory,
  ): Promise<AttachmentTypeormEntity[]> {
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.ent_id = :entId', { entId })
      .andWhere('a.inq_id = :inqId', { inqId })
      .andWhere('a.deleted_at IS NULL')
      .andWhere('a.att_uploaded_by IS NOT NULL')
      .orderBy('a.created_at', 'DESC');
    if (category) {
      qb.andWhere('a.att_category = :category', { category });
    }
    return qb.getMany();
  }

  async getDownloadUrl(
    entId: string,
    inqId: string,
    attId: string,
  ): Promise<{ url: string; filename: string; expiresIn: number }> {
    if (!this.store.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORE_NOT_CONFIGURED',
      });
    }
    const row = await this.findOrThrow(entId, inqId, attId);
    if (!row.uploadedBy) {
      throw new NotFoundException({
        code: 'UPLOAD_NOT_CONFIRMED',
        message: 'Attachment upload was not confirmed',
      });
    }
    const url = await this.store.presignGet({
      key: row.s3Key,
      filename: row.filename,
    });
    return { url, filename: row.filename, expiresIn: 300 };
  }

  /**
   * NFR-CSL-104 — best-effort audit log of attachment downloads.
   * Returns a structured payload that the controller can persist to
   * the global audit_log table. Pulled out so it lives next to the
   * row lookup.
   */
  buildDownloadAuditPayload(row: AttachmentTypeormEntity, actorId: string) {
    return {
      action: 'acm.csl.attachment.download',
      entId: row.entId,
      actorId,
      target: { attId: row.id, inqId: row.inqId, category: row.category },
    };
  }

  // ── Soft delete (STAFF↑) ──────────────────────────────────────────────

  async softDelete(entId: string, inqId: string, attId: string): Promise<void> {
    const row = await this.findOrThrow(entId, inqId, attId);
    row.deletedAt = new Date();
    await this.repo.save(row);
  }

  // ── Visibility guard helper (used by controller) ──────────────────────

  /**
   * Decide whether the caller can see this attachment.
   *   - STAFF/ADMIN/APP_ADMIN: always.
   *   - TEACHER: only TEACHER_STUDENT rows (MATERIAL).
   *   - PARENT (future portal): only TEACHER_STUDENT, scoped to their inquiry.
   */
  static canView(
    row: AttachmentTypeormEntity,
    role: 'ADMIN' | 'TEACHER' | 'STAFF' | 'APP_ADMIN',
  ): boolean {
    if (role === 'ADMIN' || role === 'APP_ADMIN' || role === 'STAFF') return true;
    if (role === 'TEACHER') return row.visibility === 'TEACHER_STUDENT';
    return false;
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private async findOrThrow(
    entId: string,
    inqId: string,
    attId: string,
  ): Promise<AttachmentTypeormEntity> {
    const row = await this.repo.findOne({
      where: { id: attId, entId, inqId, deletedAt: IsNull() },
    });
    if (!row) throw new NotFoundException({ code: 'ATTACHMENT_NOT_FOUND' });
    return row;
  }

  private defaultVisibility(category: AttachmentCategory): AttachmentVisibility {
    switch (category) {
      case 'MATERIAL':
        return 'TEACHER_STUDENT';
      case 'TRANSCRIPT':
      case 'RESULT_PDF':
      default:
        return 'STAFF_ONLY';
    }
  }
}
