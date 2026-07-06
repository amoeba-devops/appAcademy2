import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { ACM_DS } from '../../acm-common/datasource';
import { ObjectStoreClient } from '../../acm-csl/infrastructure/external/object-store.client';
import { MaterialTypeormEntity } from '../infrastructure/typeorm/material.typeorm-entity';

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

export type PortalKind = 'STUDENT' | 'PARENT' | 'TEACHER';

export interface MaterialView {
  id: string;
  clsId: string;
  className: string | null;
  title: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * PLN-260706 §4.5 — class materials. Upload by teacher/admin; download by
 * portal users scoped to their class membership.
 */
@Injectable()
export class MaterialService {
  constructor(
    @InjectRepository(MaterialTypeormEntity, ACM_DS)
    private readonly repo: Repository<MaterialTypeormEntity>,
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly store: ObjectStoreClient,
  ) {}

  async upload(
    entId: string,
    clsId: string,
    uploadedBy: string | null,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
    title?: string,
  ): Promise<MaterialView> {
    if (!file?.buffer?.length) throw new BadRequestException('EMPTY_FILE');
    if (file.size > MAX_BYTES) throw new BadRequestException('FILE_TOO_LARGE');

    const safe = file.originalname.replace(/[^\w.\-]+/g, '_').slice(-120);
    const key = `materials/${entId}/${clsId}/${randomUUID()}-${safe}`;
    await this.store.putObject({ key, body: file.buffer, mime: file.mimetype });

    const mat = await this.repo.save(
      this.repo.create({
        entId,
        clsId,
        title: title?.trim() || file.originalname,
        s3Key: key,
        filename: file.originalname,
        mime: file.mimetype,
        sizeBytes: String(file.size),
        uploadedBy,
      }),
    );
    return this.toView(mat, await this.classLabels(entId, [clsId]));
  }

  /** Admin/teacher — materials for one class. */
  async listForClass(entId: string, clsId: string): Promise<MaterialView[]> {
    const rows = await this.repo.find({
      where: { entId, clsId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const labels = await this.classLabels(entId, [clsId]);
    return rows.map((r) => this.toView(r, labels));
  }

  /** Portal — materials for the caller's classes (by role/membership). */
  async listForPortal(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<MaterialView[]> {
    const clsIds = await this.visibleClassIds(entId, kind, refId);
    if (clsIds.length === 0) return [];
    const rows = await this.repo.find({
      where: { entId, clsId: In(clsIds), deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const labels = await this.classLabels(entId, clsIds);
    return rows.map((r) => this.toView(r, labels));
  }

  async download(
    entId: string,
    id: string,
    viewer: { isAdmin?: boolean; portal?: { kind: PortalKind; refId: string } },
  ): Promise<{ stream: Readable; mime: string; filename: string }> {
    const mat = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!mat) throw new NotFoundException('MATERIAL_NOT_FOUND');
    if (!viewer.isAdmin) {
      if (!viewer.portal) throw new ForbiddenException('NO_ACCESS');
      const clsIds = await this.visibleClassIds(
        entId,
        viewer.portal.kind,
        viewer.portal.refId,
      );
      if (!clsIds.includes(mat.clsId)) throw new ForbiddenException('NO_ACCESS');
    }
    const obj = await this.store.getObjectStream(mat.s3Key);
    return { stream: obj.stream, mime: mat.mime, filename: mat.filename };
  }

  async remove(entId: string, id: string): Promise<void> {
    const mat = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!mat) throw new NotFoundException('MATERIAL_NOT_FOUND');
    mat.deletedAt = new Date();
    await this.repo.save(mat);
  }

  // ---------------------------------------------------------------------------

  /** Resolve which class ids a portal user may see (PLN-260706 §4.5 / O1). */
  private async visibleClassIds(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<string[]> {
    let rows: Array<{ cls_id: string }> = [];
    if (kind === 'STUDENT') {
      rows = await this.ds.query(
        `SELECT DISTINCT cls_id FROM amb_acm_cls_class_students
          WHERE ent_id = $1 AND cst_student_user_id = $2 AND cst_left_at IS NULL`,
        [entId, refId],
      );
    } else if (kind === 'PARENT') {
      rows = await this.ds.query(
        `SELECT DISTINCT cs.cls_id FROM amb_acm_cls_class_students cs
           JOIN amb_acm_std_student_parent sp
             ON sp.std_id = cs.cst_student_user_id AND sp.ent_id = cs.ent_id
          WHERE cs.ent_id = $1 AND sp.par_id = $2 AND cs.cst_left_at IS NULL`,
        [entId, refId],
      );
    } else {
      // TEACHER — refId is tch_id; classes reference the teacher's acm_user id.
      rows = await this.ds.query(
        `SELECT c.cls_id FROM amb_acm_cls_classes c
           JOIN amb_acm_tch_teacher t
             ON t.tch_user_id = c.cls_teacher_user_id AND t.ent_id = c.ent_id
          WHERE c.ent_id = $1 AND t.tch_id = $2`,
        [entId, refId],
      );
    }
    return rows.map((r) => r.cls_id);
  }

  private async classLabels(
    entId: string,
    clsIds: string[],
  ): Promise<Map<string, string>> {
    if (clsIds.length === 0) return new Map();
    const rows: Array<{ cls_id: string; label: string | null; code: string }> =
      await this.ds.query(
        `SELECT cls_id, cls_subject_label AS label, cls_code AS code
           FROM amb_acm_cls_classes
          WHERE ent_id = $1 AND cls_id = ANY($2::uuid[])`,
        [entId, clsIds],
      );
    return new Map(rows.map((r) => [r.cls_id, r.label || r.code]));
  }

  private toView(
    m: MaterialTypeormEntity,
    labels: Map<string, string>,
  ): MaterialView {
    return {
      id: m.id,
      clsId: m.clsId,
      className: labels.get(m.clsId) ?? null,
      title: m.title,
      filename: m.filename,
      mime: m.mime,
      sizeBytes: Number(m.sizeBytes),
      createdAt: m.createdAt.toISOString(),
    };
  }
}
