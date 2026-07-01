import { Readable } from 'stream';
import {
  BadRequestException,
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
import { AuditService } from '../../acm-audit/application/audit.service';

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

interface UploadOpts {
  category: AttachmentCategory;
  refId?: string | null;
}

@Injectable()
export class AttachmentService {
  private readonly log = new Logger(AttachmentService.name);

  constructor(
    @InjectRepository(AttachmentTypeormEntity, ACM_DS)
    private readonly repo: Repository<AttachmentTypeormEntity>,
    private readonly store: ObjectStoreClient,
    private readonly audit: AuditService,
  ) {}

  // ── Upload (backend-proxied) ──────────────────────────────────────────

  /**
   * FIX-260630 — single-step multipart upload. Replaces the previous
   * presigned PUT flow because MinIO sits on the docker internal hostname
   * (`http://minio:9000`) so the browser couldn't reach it directly
   * (Mixed Content + DNS). Backend receives the file via multer, validates,
   * streams the buffer to MinIO via the internal client, then writes the
   * att row in a single atomic operation.
   */
  async upload(
    entId: string,
    inqId: string,
    file: Express.Multer.File | undefined,
    opts: UploadOpts,
    actorId: string,
  ): Promise<AttachmentTypeormEntity> {
    if (!this.store.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORE_NOT_CONFIGURED',
        message: 'Attachment storage is not configured (set ACM_S3_* env)',
      });
    }
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'multipart "file" part missing',
      });
    }
    if (file.size <= 0 || file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'SIZE_EXCEEDED',
        message: `File size must be 1B..10MB (got ${file.size})`,
      });
    }
    if (!ALLOWED_MIMES.includes(file.mimetype as AttachmentMime)) {
      throw new BadRequestException({
        code: 'MIME_NOT_ALLOWED',
        message: `Only ${ALLOWED_MIMES.join(', ')} are allowed (got ${file.mimetype})`,
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

    // multer's originalname is latin1-decoded (FIX-260512 same root cause as
    // teacher attachment). Re-encode to UTF-8 so Korean filenames don't
    // arrive corrupted.
    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const visibility = this.defaultVisibility(opts.category);
    const row = this.repo.create({
      entId,
      inqId,
      category: opts.category,
      refId: opts.refId ?? null,
      s3Key: '',
      filename,
      mime: file.mimetype as AttachmentMime,
      sizeBytes: String(file.size),
      visibility,
      uploadedBy: actorId,
    });
    const saved = await this.repo.save(row);
    saved.s3Key = this.store.buildKey(entId, saved.id, filename);
    await this.repo.save(saved);

    // Stream buffer to MinIO. Throws → row stays in DB with non-null
    // uploadedBy but no object; cleanup is the operator's responsibility
    // until a sweeper exists.
    try {
      await this.store.putObject({
        key: saved.s3Key,
        body: file.buffer,
        mime: file.mimetype,
      });
    } catch (err) {
      // Roll back the row so we don't show ghost entries in the list.
      await this.repo.delete({ id: saved.id });
      throw new BadRequestException({
        code: 'OBJECT_STORE_PUT_FAILED',
        message: (err as Error).message,
      });
    }
    return saved;
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

  /**
   * FIX-260630 — backend-proxied download. Returns a Node Readable for
   * the controller to wrap in StreamableFile + Content-Disposition. Same
   * reason as upload: presigned GET URL points at internal `minio:9000`
   * which the browser can't reach over HTTPS Mixed Content.
   */
  async streamDownload(
    entId: string,
    inqId: string,
    attId: string,
  ): Promise<{
    stream: Readable;
    filename: string;
    mime: string;
    sizeBytes: number;
  }> {
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
    const { stream, mime } = await this.store.getObjectStream(row.s3Key);
    return {
      stream,
      filename: row.filename,
      mime: mime ?? row.mime,
      sizeBytes: Number(row.sizeBytes),
    };
  }

  /**
   * NFR-CSL-104 / REQ-260626 T-20 v2.1 — persist an attachment download
   * to `amb_acm_audit_log`. Best-effort: any audit failure is logged but
   * never blocks the presigned URL issuance (download UX > strict trail).
   *
   * action='EXPORT' is the closest fit in the AuditAction enum; the
   * `reason` field carries the CSL-specific event tag so admin panels
   * can filter for attachment downloads specifically.
   */
  async recordDownloadAudit(
    row: AttachmentTypeormEntity,
    actorId: string,
    ip?: string | null,
    userAgent?: string | null,
  ): Promise<void> {
    try {
      await this.audit.record({
        entId: row.entId,
        userId: actorId,
        action: 'EXPORT',
        entityType: 'acm.csl.attachment',
        entityId: row.id,
        fieldName: row.category,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        reason: `download:inq=${row.inqId}`,
      });
    } catch (err) {
      this.log.warn(
        `audit record failed for attId=${row.id} actor=${actorId}: ${(err as Error).message}`,
      );
    }
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
