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
import {
  MaterialShareTargetKind,
  MaterialShareTypeormEntity,
} from '../infrastructure/typeorm/material-share.typeorm-entity';
import { MaterialCommentTypeormEntity } from '../infrastructure/typeorm/material-comment.typeorm-entity';

/**
 * PLN-260718 P3 — portal materials (자료실) authoring + sharing + comments.
 *
 * Author model:
 *   • TEACHER shares to STUDENT(s)  — 수업 자료 배포
 *   • STUDENT shares to TEACHER(s)  — 과제 제출(submission)
 * Views are role-scoped:
 *   • listOwn    → posts the caller authored
 *   • listShared → posts shared to the caller (+ legacy class materials)
 * Each post has a flat comment thread visible to anyone who can view the post.
 */
const MAX_BYTES = 20 * 1024 * 1024; // 20MB
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

export type PortalKind = 'STUDENT' | 'PARENT' | 'TEACHER';
export type AuthorKind = 'STUDENT' | 'TEACHER';

export interface PortalAuthor {
  kind: PortalKind;
  refId: string;
}

export interface ShareTargetView {
  kind: MaterialShareTargetKind;
  refId: string;
  name: string;
}

export interface PortalMaterialView {
  id: string;
  title: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  authorKind: string | null;
  authorName: string | null;
  shareTargets: ShareTargetView[];
  commentCount: number;
  mine: boolean;
  isSubmission: boolean;
}

export interface MaterialCommentView {
  id: string;
  authorKind: string;
  authorName: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

interface UploadFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class PortalMaterialService {
  constructor(
    @InjectRepository(MaterialTypeormEntity, ACM_DS)
    private readonly repo: Repository<MaterialTypeormEntity>,
    @InjectRepository(MaterialShareTypeormEntity, ACM_DS)
    private readonly shareRepo: Repository<MaterialShareTypeormEntity>,
    @InjectRepository(MaterialCommentTypeormEntity, ACM_DS)
    private readonly commentRepo: Repository<MaterialCommentTypeormEntity>,
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly store: ObjectStoreClient,
  ) {}

  // ── Share candidates ──────────────────────────────────────────────────

  /**
   * Who the caller may share a new post with:
   *   • TEACHER → students across the classes they teach
   *   • STUDENT → teachers of the classes they're enrolled in
   * Parents can't author, so they get [].
   */
  async listShareCandidates(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<Array<{ refId: string; name: string }>> {
    if (kind === 'TEACHER') {
      const rows: Array<{ ref_id: string; name: string }> = await this.ds.query(
        `SELECT DISTINCT s.std_id AS ref_id, s.std_name AS name
           FROM amb_acm_cls_classes c
           JOIN amb_acm_tch_teacher t
             ON t.tch_user_id = c.cls_teacher_user_id AND t.ent_id = c.ent_id
           JOIN amb_acm_cls_class_students cs
             ON cs.cls_id = c.cls_id AND cs.ent_id = c.ent_id AND cs.cst_left_at IS NULL
           JOIN amb_acm_std_student s
             ON s.std_id = cs.cst_student_user_id AND s.ent_id = cs.ent_id
          WHERE c.ent_id = $1 AND t.tch_id = $2
          ORDER BY s.std_name`,
        [entId, refId],
      );
      return rows.map((r) => ({ refId: r.ref_id, name: r.name }));
    }
    if (kind === 'STUDENT') {
      const rows: Array<{ ref_id: string; name: string }> = await this.ds.query(
        `SELECT DISTINCT t.tch_id AS ref_id, t.tch_name AS name
           FROM amb_acm_cls_class_students cs
           JOIN amb_acm_cls_classes c
             ON c.cls_id = cs.cls_id AND c.ent_id = cs.ent_id
           JOIN amb_acm_tch_teacher t
             ON t.tch_user_id = c.cls_teacher_user_id AND t.ent_id = c.ent_id
          WHERE cs.ent_id = $1 AND cs.cst_student_user_id = $2 AND cs.cst_left_at IS NULL
          ORDER BY t.tch_name`,
        [entId, refId],
      );
      return rows.map((r) => ({ refId: r.ref_id, name: r.name }));
    }
    return [];
  }

  // ── Create ────────────────────────────────────────────────────────────

  async create(
    entId: string,
    author: PortalAuthor,
    file: UploadFile | undefined,
    title: string | undefined,
    shareRefIds: string[],
  ): Promise<PortalMaterialView> {
    if (author.kind !== 'TEACHER' && author.kind !== 'STUDENT') {
      throw new ForbiddenException('ONLY_TEACHER_OR_STUDENT_CAN_POST');
    }
    if (!file?.buffer?.length) throw new BadRequestException('EMPTY_FILE');
    if (file.size > MAX_BYTES) throw new BadRequestException('FILE_TOO_LARGE');
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('MIME_NOT_ALLOWED');
    }

    // Target kind is implied by the author's role.
    const tgtKind: MaterialShareTargetKind =
      author.kind === 'TEACHER' ? 'STUDENT' : 'TEACHER';
    const refIds = Array.from(new Set(shareRefIds.filter(Boolean)));
    if (refIds.length === 0) {
      throw new BadRequestException(
        author.kind === 'TEACHER' ? 'SELECT_STUDENTS' : 'SELECT_TEACHER',
      );
    }
    await this.assertTargetsExist(entId, tgtKind, refIds);

    // multer decodes originalname as latin1; re-encode to UTF-8.
    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safe = filename.replace(/[^\w.-]+/g, '_').slice(-120);
    const key = `materials/${entId}/portal/${randomUUID()}-${safe}`;
    await this.store.putObject({ key, body: file.buffer, mime: file.mimetype });

    const mat = await this.repo.save(
      this.repo.create({
        entId,
        clsId: null,
        authorKind: author.kind,
        title: title?.trim() || filename,
        s3Key: key,
        filename,
        mime: file.mimetype,
        sizeBytes: String(file.size),
        uploadedBy: author.refId,
      }),
    );

    await this.shareRepo.save(
      refIds.map((refId) =>
        this.shareRepo.create({
          entId,
          matId: mat.id,
          tgtKind,
          tgtRefId: refId,
        }),
      ),
    );

    const [view] = await this.enrich(entId, [mat], author);
    return view;
  }

  // ── List ──────────────────────────────────────────────────────────────

  /** Posts the caller authored (parents author nothing → []). */
  async listOwn(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<PortalMaterialView[]> {
    if (kind !== 'TEACHER' && kind !== 'STUDENT') return [];
    const rows = await this.repo.find({
      where: {
        entId,
        authorKind: kind,
        uploadedBy: refId,
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });
    return this.enrich(entId, rows, { kind, refId });
  }

  /** Posts shared to the caller + legacy class materials for their classes. */
  async listShared(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<PortalMaterialView[]> {
    const matIds = new Set<string>();

    // Direct shares.
    if (kind === 'STUDENT' || kind === 'TEACHER') {
      const shares = await this.shareRepo.find({
        where: { entId, tgtKind: kind, tgtRefId: refId },
      });
      shares.forEach((s) => matIds.add(s.matId));
    } else {
      // PARENT — shares to any of their children (students).
      const childIds = await this.childStudentIds(entId, refId);
      if (childIds.length > 0) {
        const shares = await this.shareRepo.find({
          where: { entId, tgtKind: 'STUDENT', tgtRefId: In(childIds) },
        });
        shares.forEach((s) => matIds.add(s.matId));
      }
    }

    // Legacy class materials (cls_id membership).
    const clsIds = await this.visibleClassIds(entId, kind, refId);
    let legacy: MaterialTypeormEntity[] = [];
    if (clsIds.length > 0) {
      legacy = await this.repo.find({
        where: { entId, clsId: In(clsIds), deletedAt: IsNull() },
      });
    }

    const shared = matIds.size
      ? await this.repo.find({
          where: { entId, id: In(Array.from(matIds)), deletedAt: IsNull() },
        })
      : [];

    // Merge + dedupe, newest first. Exclude posts the caller authored (those
    // live in the "own" tab).
    const byId = new Map<string, MaterialTypeormEntity>();
    for (const m of [...shared, ...legacy]) {
      if (m.authorKind === kind && m.uploadedBy === refId) continue;
      byId.set(m.id, m);
    }
    const rows = Array.from(byId.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    return this.enrich(entId, rows, { kind, refId });
  }

  // ── Download ──────────────────────────────────────────────────────────

  async download(
    entId: string,
    matId: string,
    viewer: PortalAuthor,
  ): Promise<{ stream: Readable; mime: string; filename: string }> {
    const mat = await this.getViewableOrThrow(entId, matId, viewer);
    const obj = await this.store.getObjectStream(mat.s3Key);
    return { stream: obj.stream, mime: mat.mime, filename: mat.filename };
  }

  // ── Comments ──────────────────────────────────────────────────────────

  async listComments(
    entId: string,
    matId: string,
    viewer: PortalAuthor,
  ): Promise<MaterialCommentView[]> {
    await this.getViewableOrThrow(entId, matId, viewer);
    const rows = await this.commentRepo.find({
      where: { entId, matId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return rows.map((c) => ({
      id: c.id,
      authorKind: c.authorKind,
      authorName: c.authorName,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      mine: c.authorKind === viewer.kind && c.authorRefId === viewer.refId,
    }));
  }

  async addComment(
    entId: string,
    matId: string,
    author: PortalAuthor,
    body: string,
  ): Promise<MaterialCommentView> {
    await this.getViewableOrThrow(entId, matId, author);
    const trimmed = (body ?? '').trim();
    if (!trimmed) throw new BadRequestException('EMPTY_COMMENT');
    if (trimmed.length > 2000)
      throw new BadRequestException('COMMENT_TOO_LONG');
    const name = await this.resolveName(entId, author.kind, author.refId);
    const saved = await this.commentRepo.save(
      this.commentRepo.create({
        entId,
        matId,
        authorKind: author.kind,
        authorRefId: author.refId,
        authorName: name ?? '-',
        body: trimmed,
      }),
    );
    return {
      id: saved.id,
      authorKind: saved.authorKind,
      authorName: saved.authorName,
      body: saved.body,
      createdAt: saved.createdAt.toISOString(),
      mine: true,
    };
  }

  // ── Delete (author only) ──────────────────────────────────────────────

  async remove(
    entId: string,
    matId: string,
    author: PortalAuthor,
  ): Promise<void> {
    const mat = await this.repo.findOne({
      where: { id: matId, entId, deletedAt: IsNull() },
    });
    if (!mat) throw new NotFoundException('MATERIAL_NOT_FOUND');
    if (mat.authorKind !== author.kind || mat.uploadedBy !== author.refId) {
      throw new ForbiddenException('NOT_AUTHOR');
    }
    mat.deletedAt = new Date();
    await this.repo.save(mat);
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private async getViewableOrThrow(
    entId: string,
    matId: string,
    viewer: PortalAuthor,
  ): Promise<MaterialTypeormEntity> {
    const mat = await this.repo.findOne({
      where: { id: matId, entId, deletedAt: IsNull() },
    });
    if (!mat) throw new NotFoundException('MATERIAL_NOT_FOUND');
    if (await this.canView(entId, mat, viewer)) return mat;
    throw new ForbiddenException('NO_ACCESS');
  }

  private async canView(
    entId: string,
    mat: MaterialTypeormEntity,
    viewer: PortalAuthor,
  ): Promise<boolean> {
    // Author.
    if (mat.authorKind === viewer.kind && mat.uploadedBy === viewer.refId) {
      return true;
    }
    // Share target.
    if (viewer.kind === 'STUDENT' || viewer.kind === 'TEACHER') {
      const share = await this.shareRepo.findOne({
        where: {
          entId,
          matId: mat.id,
          tgtKind: viewer.kind,
          tgtRefId: viewer.refId,
        },
      });
      if (share) return true;
    } else {
      const childIds = await this.childStudentIds(entId, viewer.refId);
      if (childIds.length > 0) {
        const share = await this.shareRepo.findOne({
          where: {
            entId,
            matId: mat.id,
            tgtKind: 'STUDENT',
            tgtRefId: In(childIds),
          },
        });
        if (share) return true;
      }
    }
    // Legacy class membership.
    if (mat.clsId) {
      const clsIds = await this.visibleClassIds(
        entId,
        viewer.kind,
        viewer.refId,
      );
      if (clsIds.includes(mat.clsId)) return true;
    }
    return false;
  }

  private async enrich(
    entId: string,
    rows: MaterialTypeormEntity[],
    viewer: PortalAuthor,
  ): Promise<PortalMaterialView[]> {
    if (rows.length === 0) return [];
    const matIds = rows.map((r) => r.id);

    // Share targets per material.
    const shares = await this.shareRepo.find({
      where: { entId, matId: In(matIds) },
    });
    const sharesByMat = new Map<string, MaterialShareTypeormEntity[]>();
    for (const s of shares) {
      const list = sharesByMat.get(s.matId) ?? [];
      list.push(s);
      sharesByMat.set(s.matId, list);
    }

    // Comment counts.
    const countRows: Array<{ mat_id: string; c: string }> = await this.ds.query(
      `SELECT mat_id, COUNT(*)::text AS c FROM amb_acm_material_comment
          WHERE ent_id = $1 AND mat_id = ANY($2::uuid[]) AND deleted_at IS NULL
          GROUP BY mat_id`,
      [entId, matIds],
    );
    const countByMat = new Map(countRows.map((r) => [r.mat_id, Number(r.c)]));

    // Resolve names for authors + all share targets in one batch.
    const nameRefs: Array<{ kind: PortalKind; refId: string }> = [];
    for (const m of rows) {
      if (m.authorKind && m.uploadedBy) {
        nameRefs.push({
          kind: m.authorKind as PortalKind,
          refId: m.uploadedBy,
        });
      }
    }
    for (const s of shares) {
      nameRefs.push({ kind: s.tgtKind, refId: s.tgtRefId });
    }
    const nameMap = await this.resolveNames(entId, nameRefs);

    return rows.map((m) => {
      const tgts = sharesByMat.get(m.id) ?? [];
      const authorName =
        m.authorKind && m.uploadedBy
          ? (nameMap.get(`${m.authorKind}:${m.uploadedBy}`) ?? null)
          : null;
      return {
        id: m.id,
        title: m.title,
        filename: m.filename,
        mime: m.mime,
        sizeBytes: Number(m.sizeBytes),
        createdAt: m.createdAt.toISOString(),
        authorKind: m.authorKind ?? null,
        authorName,
        shareTargets: tgts.map((s) => ({
          kind: s.tgtKind,
          refId: s.tgtRefId,
          name: nameMap.get(`${s.tgtKind}:${s.tgtRefId}`) ?? '-',
        })),
        commentCount: countByMat.get(m.id) ?? 0,
        mine: m.authorKind === viewer.kind && m.uploadedBy === viewer.refId,
        isSubmission:
          m.authorKind === 'STUDENT' &&
          tgts.some((s) => s.tgtKind === 'TEACHER'),
      };
    });
  }

  private async assertTargetsExist(
    entId: string,
    tgtKind: MaterialShareTargetKind,
    refIds: string[],
  ): Promise<void> {
    const table =
      tgtKind === 'STUDENT' ? 'amb_acm_std_student' : 'amb_acm_tch_teacher';
    const col = tgtKind === 'STUDENT' ? 'std_id' : 'tch_id';
    const rows: Array<{ id: string }> = await this.ds.query(
      `SELECT ${col} AS id FROM ${table} WHERE ent_id = $1 AND ${col} = ANY($2::uuid[])`,
      [entId, refIds],
    );
    if (rows.length !== refIds.length) {
      throw new BadRequestException('INVALID_SHARE_TARGET');
    }
  }

  private async resolveNames(
    entId: string,
    refs: Array<{ kind: PortalKind; refId: string }>,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const byKind: Record<PortalKind, Set<string>> = {
      STUDENT: new Set(),
      TEACHER: new Set(),
      PARENT: new Set(),
    };
    for (const r of refs) byKind[r.kind].add(r.refId);

    const specs: Array<{
      kind: PortalKind;
      table: string;
      idCol: string;
      nameCol: string;
    }> = [
      {
        kind: 'STUDENT',
        table: 'amb_acm_std_student',
        idCol: 'std_id',
        nameCol: 'std_name',
      },
      {
        kind: 'TEACHER',
        table: 'amb_acm_tch_teacher',
        idCol: 'tch_id',
        nameCol: 'tch_name',
      },
      {
        kind: 'PARENT',
        table: 'amb_acm_std_parent',
        idCol: 'par_id',
        nameCol: 'par_name',
      },
    ];
    for (const spec of specs) {
      const ids = Array.from(byKind[spec.kind]);
      if (ids.length === 0) continue;
      const rows: Array<{ id: string; name: string }> = await this.ds.query(
        `SELECT ${spec.idCol} AS id, ${spec.nameCol} AS name
           FROM ${spec.table} WHERE ent_id = $1 AND ${spec.idCol} = ANY($2::uuid[])`,
        [entId, ids],
      );
      for (const row of rows) map.set(`${spec.kind}:${row.id}`, row.name);
    }
    return map;
  }

  private async resolveName(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<string | null> {
    const map = await this.resolveNames(entId, [{ kind, refId }]);
    return map.get(`${kind}:${refId}`) ?? null;
  }

  private async childStudentIds(
    entId: string,
    parId: string,
  ): Promise<string[]> {
    const rows: Array<{ std_id: string }> = await this.ds.query(
      `SELECT std_id FROM amb_acm_std_student_parent WHERE ent_id = $1 AND par_id = $2`,
      [entId, parId],
    );
    return rows.map((r) => r.std_id);
  }

  /** Which class ids a portal user may see (mirrors MaterialService §O1). */
  private async visibleClassIds(
    entId: string,
    kind: PortalKind,
    refId: string,
  ): Promise<string[]> {
    let rows: Array<{ cls_id: string }>;
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
}
