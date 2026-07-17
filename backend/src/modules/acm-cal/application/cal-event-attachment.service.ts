import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ObjectStoreClient } from '../../acm-csl/infrastructure/external/object-store.client';
import { CalEventAttachmentTypeormEntity } from '../infrastructure/typeorm/cal-event-attachment.typeorm-entity';

/**
 * PLN-260718 P2 — calendar event attachment service (S3-backed).
 * Mirrors the CSL AttachmentService flow: backend-proxied multipart upload
 * → putObject → row; backend-proxied streaming download. When the object
 * store is not configured (local without MinIO) upload/download return 503.
 *
 * Caps: ≤20MB × ≤20 rows / event.
 */
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PER_EVENT = 20;
const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/haansofthwp',
  'application/x-hwp',
  'application/vnd.hancom.hwp',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
];

export interface CalEventAttachmentView {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: string;
  createdAt: string;
}

@Injectable()
export class CalEventAttachmentService {
  constructor(
    @InjectRepository(CalEventAttachmentTypeormEntity, ACM_DS)
    private readonly repo: Repository<CalEventAttachmentTypeormEntity>,
    private readonly store: ObjectStoreClient,
  ) {}

  async upload(
    entId: string,
    evtId: string,
    file: Express.Multer.File | undefined,
    actorId: string,
  ): Promise<CalEventAttachmentView> {
    if (!this.store.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORE_NOT_CONFIGURED',
        message: 'Attachment storage is not configured (set ACM_S3_* env)',
      });
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException({ code: 'FILE_REQUIRED' });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      throw new BadRequestException({
        code: 'SIZE_EXCEEDED',
        message: `File size must be 1B..20MB (got ${file.size})`,
      });
    }
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'MIME_NOT_ALLOWED',
        message: `Unsupported file type (got ${file.mimetype})`,
      });
    }
    const count = await this.repo.count({
      where: { entId, evtId, deletedAt: IsNull() },
    });
    if (count >= MAX_PER_EVENT) {
      throw new BadRequestException({
        code: 'COUNT_EXCEEDED',
        message: `Up to ${MAX_PER_EVENT} files per event (have ${count})`,
      });
    }

    // multer decodes originalname as latin1; re-encode to UTF-8 so Korean
    // filenames aren't corrupted (same root cause as CSL/teacher attachments).
    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safe = filename.replace(/[^\w.-]+/g, '_').slice(-120);
    const key = `cal-events/${entId}/${evtId}/${randomUUID()}-${safe}`;

    try {
      await this.store.putObject({
        key,
        body: file.buffer,
        mime: file.mimetype,
      });
    } catch (err) {
      throw new BadRequestException({
        code: 'OBJECT_STORE_PUT_FAILED',
        message: (err as Error).message,
      });
    }

    const saved = await this.repo.save(
      this.repo.create({
        entId,
        evtId,
        s3Key: key,
        filename,
        mime: file.mimetype,
        sizeBytes: String(file.size),
        uploadedBy: actorId,
      }),
    );
    return this.toView(saved);
  }

  async list(entId: string, evtId: string): Promise<CalEventAttachmentView[]> {
    const rows = await this.repo.find({
      where: { entId, evtId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toView(r));
  }

  async streamDownload(
    entId: string,
    evtId: string,
    attId: string,
  ): Promise<{ stream: Readable; filename: string; mime: string }> {
    if (!this.store.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'OBJECT_STORE_NOT_CONFIGURED',
      });
    }
    const row = await this.findOrThrow(entId, evtId, attId);
    const { stream, mime } = await this.store.getObjectStream(row.s3Key);
    return { stream, filename: row.filename, mime: mime ?? row.mime };
  }

  async softDelete(entId: string, evtId: string, attId: string): Promise<void> {
    const row = await this.findOrThrow(entId, evtId, attId);
    row.deletedAt = new Date();
    await this.repo.save(row);
  }

  private async findOrThrow(
    entId: string,
    evtId: string,
    attId: string,
  ): Promise<CalEventAttachmentTypeormEntity> {
    const row = await this.repo.findOne({
      where: { id: attId, entId, evtId, deletedAt: IsNull() },
    });
    if (!row) throw new NotFoundException({ code: 'ATTACHMENT_NOT_FOUND' });
    return row;
  }

  private toView(r: CalEventAttachmentTypeormEntity): CalEventAttachmentView {
    return {
      id: r.id,
      filename: r.filename,
      mime: r.mime,
      sizeBytes: r.sizeBytes,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
