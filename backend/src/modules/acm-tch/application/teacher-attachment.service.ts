import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { TeacherTypeormEntity } from '../infrastructure/typeorm/teacher.typeorm-entity';
import {
  TeacherAttachmentTypeormEntity,
  type TchAttachmentKind,
} from '../infrastructure/typeorm/teacher-attachment.typeorm-entity';

export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

@Injectable()
export class TeacherAttachmentService {
  constructor(
    @InjectRepository(TeacherTypeormEntity, ACM_DS)
    private readonly tchRepo: Repository<TeacherTypeormEntity>,
    @InjectRepository(TeacherAttachmentTypeormEntity, ACM_DS)
    private readonly attRepo: Repository<TeacherAttachmentTypeormEntity>,
  ) {}

  private get baseDir(): string {
    return process.env.ACM_UPLOAD_DIR || '/app/uploads';
  }

  async list(entId: string, tchId: string) {
    await this.assertTeacher(entId, tchId);
    const items = await this.attRepo.find({
      where: { entId, tchId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return items.map((a) => this.toJson(a));
  }

  async upload(
    entId: string,
    tchId: string,
    file: Express.Multer.File | undefined,
    createdBy: string,
    kind: TchAttachmentKind = 'RESUME',
  ) {
    await this.assertTeacher(entId, tchId);
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    if (file.size > MAX_BYTES) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: `File exceeds ${MAX_BYTES} bytes`,
      });
    }
    if (!(ALLOWED_MIME as readonly string[]).includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException({
        code: 'MIME_NOT_ALLOWED',
        message: `Allowed: ${ALLOWED_MIME.join(', ')}`,
      });
    }
    if (!this.matchesMagicBytes(file.mimetype, file.buffer)) {
      throw new UnsupportedMediaTypeException({
        code: 'MIME_MISMATCH',
        message: 'File content does not match declared MIME',
      });
    }

    const ext = EXT_BY_MIME[file.mimetype] ?? 'bin';
    const attId = crypto.randomUUID();
    const relDir = path.posix.join('tch-resume', entId, tchId);
    const relPath = path.posix.join(relDir, `${attId}.${ext}`);
    const absDir = path.join(this.baseDir, relDir);
    const absPath = path.join(this.baseDir, relPath);

    await fs.mkdir(absDir, { recursive: true });
    await fs.writeFile(absPath, file.buffer);

    // FIX-260512: multer의 originalname은 latin1 인코딩으로 전달됨.
    // 한글 파일명이 깨지지 않도록 utf-8로 디코딩.
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const saved = await this.attRepo.save(
      this.attRepo.create({
        id: attId,
        entId,
        tchId,
        originalName: decodedName,
        mime: file.mimetype,
        sizeBytes: String(file.size),
        storagePath: relPath,
        kind,
        createdBy,
      }),
    );
    return this.toJson(saved);
  }

  async getForDownload(entId: string, tchId: string, attId: string) {
    await this.assertTeacher(entId, tchId);
    const att = await this.attRepo.findOne({
      where: { id: attId, entId, tchId, deletedAt: IsNull() },
    });
    if (!att) throw new NotFoundException('ATTACHMENT_NOT_FOUND');
    const absPath = path.join(this.baseDir, att.storagePath);
    return {
      stream: createReadStream(absPath),
      originalName: att.originalName,
      mime: att.mime,
      sizeBytes: att.sizeBytes,
    };
  }

  async remove(entId: string, tchId: string, attId: string) {
    await this.assertTeacher(entId, tchId);
    const att = await this.attRepo.findOne({
      where: { id: attId, entId, tchId, deletedAt: IsNull() },
    });
    if (!att) throw new NotFoundException('ATTACHMENT_NOT_FOUND');
    att.deletedAt = new Date();
    await this.attRepo.save(att);
    return { id: attId };
  }

  private async assertTeacher(entId: string, tchId: string) {
    const t = await this.tchRepo.findOne({
      where: { id: tchId, entId, deletedAt: IsNull() },
    });
    if (!t) throw new NotFoundException('TEACHER_NOT_FOUND');
    return t;
  }

  private matchesMagicBytes(mime: string, buf: Buffer): boolean {
    if (!buf || buf.length < 4) return false;
    if (mime === 'application/pdf') {
      return buf.slice(0, 4).toString('ascii') === '%PDF';
    }
    if (mime === 'image/png') {
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    }
    if (mime === 'image/jpeg') {
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    }
    return false;
  }

  private toJson(a: TeacherAttachmentTypeormEntity) {
    return {
      id: a.id,
      tchId: a.tchId,
      originalName: a.originalName,
      mime: a.mime,
      sizeBytes: Number(a.sizeBytes),
      kind: a.kind,
      createdAt: a.createdAt,
      createdBy: a.createdBy,
    };
  }
}
