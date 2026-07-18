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
  MaterialShareRole,
  MaterialShareTargetKind,
  MaterialShareTypeormEntity,
} from '../infrastructure/typeorm/material-share.typeorm-entity';
import { MaterialCommentTypeormEntity } from '../infrastructure/typeorm/material-comment.typeorm-entity';
import { MaterialRevisionTypeormEntity } from '../infrastructure/typeorm/material-revision.typeorm-entity';

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
  role: MaterialShareRole;
}

/** PLN-260719 B — doc share input (Google-Docs-like per-target role). */
export interface ShareInput {
  kind: MaterialShareTargetKind;
  refId: string;
  role: MaterialShareRole;
}

export interface PortalMaterialView {
  id: string;
  kind: 'FILE' | 'DOC';
  title: string;
  filename: string | null;
  mime: string | null;
  sizeBytes: number | null;
  createdAt: string;
  authorKind: string | null;
  authorName: string | null;
  shareTargets: ShareTargetView[];
  commentCount: number;
  mine: boolean;
  canEdit: boolean;
  isSubmission: boolean;
}

export interface PortalDocView extends PortalMaterialView {
  content: string;
}

// DOC 본문 HTML 최대 크기 (렌더 시 프론트에서 DOMPurify sanitize).
const MAX_DOC_CONTENT = 200 * 1024;

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
    @InjectRepository(MaterialRevisionTypeormEntity, ACM_DS)
    private readonly revisionRepo: Repository<MaterialRevisionTypeormEntity>,
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
             ON (c.cls_teacher_tch_id = t.tch_id
                 OR t.tch_user_id = c.cls_teacher_user_id)
            AND t.ent_id = c.ent_id
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
             ON (c.cls_teacher_tch_id = t.tch_id
                 OR t.tch_user_id = c.cls_teacher_user_id)
            AND t.ent_id = c.ent_id
          WHERE cs.ent_id = $1 AND cs.cst_student_user_id = $2 AND cs.cst_left_at IS NULL
          ORDER BY t.tch_name`,
        [entId, refId],
      );
      return rows.map((r) => ({ refId: r.ref_id, name: r.name }));
    }
    return [];
  }

  /**
   * PLN-260719 B — 문서 게시판 공유후보: 포털 사용자 전체(모든 강사 + 모든 학생).
   * 본인은 제외. (파일 자료의 반-기반 후보와 별개)
   */
  async listAllPortalUsers(
    entId: string,
    self: PortalAuthor,
  ): Promise<
    Array<{ kind: MaterialShareTargetKind; refId: string; name: string }>
  > {
    const teachers: Array<{ ref_id: string; name: string }> =
      await this.ds.query(
        `SELECT tch_id AS ref_id, tch_name AS name FROM amb_acm_tch_teacher
        WHERE ent_id = $1 AND deleted_at IS NULL ORDER BY tch_name`,
        [entId],
      );
    const students: Array<{ ref_id: string; name: string }> =
      await this.ds.query(
        `SELECT std_id AS ref_id, std_name AS name FROM amb_acm_std_student
        WHERE ent_id = $1 AND deleted_at IS NULL AND std_status = 'ACTIVE'
        ORDER BY std_name`,
        [entId],
      );
    return [
      ...teachers.map((r) => ({
        kind: 'TEACHER' as const,
        refId: r.ref_id,
        name: r.name,
      })),
      ...students.map((r) => ({
        kind: 'STUDENT' as const,
        refId: r.ref_id,
        name: r.name,
      })),
    ].filter((c) => !(c.kind === self.kind && c.refId === self.refId));
  }

  // ── Doc board (PLN-260719 B) ──────────────────────────────────────────

  async createDoc(
    entId: string,
    author: PortalAuthor,
    title: string,
    content: string,
    shares: ShareInput[],
  ): Promise<PortalDocView> {
    if (author.kind !== 'TEACHER' && author.kind !== 'STUDENT') {
      throw new ForbiddenException('ONLY_TEACHER_OR_STUDENT_CAN_POST');
    }
    const cleanTitle = (title ?? '').trim();
    if (!cleanTitle) throw new BadRequestException('TITLE_REQUIRED');
    if ((content ?? '').length > MAX_DOC_CONTENT) {
      throw new BadRequestException('CONTENT_TOO_LONG');
    }
    const cleanShares = this.dedupeShares(shares, author);
    await this.assertShareInputsValid(entId, cleanShares);

    const mat = await this.repo.save(
      this.repo.create({
        entId,
        clsId: null,
        kind: 'DOC',
        content: content ?? '',
        authorKind: author.kind,
        title: cleanTitle,
        s3Key: null,
        filename: null,
        mime: null,
        sizeBytes: null,
        uploadedBy: author.refId,
      }),
    );
    if (cleanShares.length > 0) {
      await this.shareRepo.save(
        cleanShares.map((s) =>
          this.shareRepo.create({
            entId,
            matId: mat.id,
            tgtKind: s.kind,
            tgtRefId: s.refId,
            role: s.role,
          }),
        ),
      );
    }
    // 리비전 v1 — 생성도 히스토리로 기록.
    await this.recordRevision(entId, mat, author);
    return this.getDoc(entId, mat.id, author);
  }

  async getDoc(
    entId: string,
    matId: string,
    viewer: PortalAuthor,
  ): Promise<PortalDocView> {
    const mat = await this.getViewableOrThrow(entId, matId, viewer);
    if (mat.kind !== 'DOC') throw new NotFoundException('NOT_A_DOC');
    const [view] = await this.enrich(entId, [mat], viewer);
    return { ...view, content: mat.content ?? '' };
  }

  /** 본문/제목 수정 — 작성자 또는 EDITOR 공유대상만. */
  async updateDoc(
    entId: string,
    matId: string,
    editor: PortalAuthor,
    patch: { title?: string; content?: string },
  ): Promise<PortalDocView> {
    const mat = await this.repo.findOne({
      where: { id: matId, entId, deletedAt: IsNull() },
    });
    if (!mat || mat.kind !== 'DOC')
      throw new NotFoundException('DOC_NOT_FOUND');
    if (!(await this.canEdit(entId, mat, editor))) {
      throw new ForbiddenException('NOT_EDITOR');
    }
    let changed = false;
    if (patch.title !== undefined) {
      const cleanTitle = patch.title.trim();
      if (!cleanTitle) throw new BadRequestException('TITLE_REQUIRED');
      if (cleanTitle !== mat.title) changed = true;
      mat.title = cleanTitle;
    }
    if (patch.content !== undefined) {
      if (patch.content.length > MAX_DOC_CONTENT) {
        throw new BadRequestException('CONTENT_TOO_LONG');
      }
      if (patch.content !== (mat.content ?? '')) changed = true;
      mat.content = patch.content;
    }
    await this.repo.save(mat);
    // 저장 단위 리비전 — 실제 변경이 있을 때만 새 버전 기록.
    if (changed) await this.recordRevision(entId, mat, editor);
    return this.getDoc(entId, matId, editor);
  }

  // ── Revisions (수정 히스토리 / 버전보기 / 복원) ──────────────────────

  /** 히스토리 목록 — 열람 권한자(canView) 누구나. 최신순. */
  async listRevisions(
    entId: string,
    matId: string,
    viewer: PortalAuthor,
  ): Promise<
    Array<{
      seq: number;
      editorKind: string;
      editorName: string;
      createdAt: string;
    }>
  > {
    const mat = await this.getViewableOrThrow(entId, matId, viewer);
    if (mat.kind !== 'DOC') throw new NotFoundException('NOT_A_DOC');
    const rows = await this.revisionRepo.find({
      where: { entId, matId },
      order: { seq: 'DESC' },
    });
    return rows.map((r) => ({
      seq: r.seq,
      editorKind: r.editorKind,
      editorName: r.editorName,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** 특정 버전 스냅샷 (제목+본문) — 열람 권한자 누구나. */
  async getRevision(
    entId: string,
    matId: string,
    seq: number,
    viewer: PortalAuthor,
  ): Promise<{
    seq: number;
    title: string;
    content: string;
    editorKind: string;
    editorName: string;
    createdAt: string;
  }> {
    const mat = await this.getViewableOrThrow(entId, matId, viewer);
    if (mat.kind !== 'DOC') throw new NotFoundException('NOT_A_DOC');
    const row = await this.revisionRepo.findOne({
      where: { entId, matId, seq },
    });
    if (!row) throw new NotFoundException('REVISION_NOT_FOUND');
    return {
      seq: row.seq,
      title: row.title,
      content: row.content,
      editorKind: row.editorKind,
      editorName: row.editorName,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** 해당 버전으로 복원 — 편집 권한자. 복원 결과도 새 리비전으로 기록. */
  async restoreRevision(
    entId: string,
    matId: string,
    seq: number,
    editor: PortalAuthor,
  ): Promise<PortalDocView> {
    const row = await this.revisionRepo.findOne({
      where: { entId, matId, seq },
    });
    if (!row) throw new NotFoundException('REVISION_NOT_FOUND');
    return this.updateDoc(entId, matId, editor, {
      title: row.title,
      content: row.content,
    });
  }

  /** 스냅샷 + 수정자 append (seq = max+1). */
  private async recordRevision(
    entId: string,
    mat: MaterialTypeormEntity,
    editor: PortalAuthor,
  ): Promise<void> {
    const last = await this.revisionRepo.findOne({
      where: { entId, matId: mat.id },
      order: { seq: 'DESC' },
    });
    const name = await this.resolveName(entId, editor.kind, editor.refId);
    await this.revisionRepo.save(
      this.revisionRepo.create({
        entId,
        matId: mat.id,
        seq: (last?.seq ?? 0) + 1,
        title: mat.title,
        content: mat.content ?? '',
        editorKind: editor.kind,
        editorRefId: editor.refId,
        editorName: name ?? '-',
      }),
    );
  }

  /** 공유대상/권한 전체 교체 — 작성자만. */
  async updateShares(
    entId: string,
    matId: string,
    author: PortalAuthor,
    shares: ShareInput[],
  ): Promise<PortalDocView> {
    const mat = await this.repo.findOne({
      where: { id: matId, entId, deletedAt: IsNull() },
    });
    if (!mat || mat.kind !== 'DOC')
      throw new NotFoundException('DOC_NOT_FOUND');
    if (mat.authorKind !== author.kind || mat.uploadedBy !== author.refId) {
      throw new ForbiddenException('NOT_AUTHOR');
    }
    const cleanShares = this.dedupeShares(shares, author);
    await this.assertShareInputsValid(entId, cleanShares);
    await this.shareRepo.delete({ entId, matId });
    if (cleanShares.length > 0) {
      await this.shareRepo.save(
        cleanShares.map((s) =>
          this.shareRepo.create({
            entId,
            matId,
            tgtKind: s.kind,
            tgtRefId: s.refId,
            role: s.role,
          }),
        ),
      );
    }
    return this.getDoc(entId, matId, author);
  }

  private dedupeShares(
    shares: ShareInput[],
    author: PortalAuthor,
  ): ShareInput[] {
    const seen = new Set<string>();
    const out: ShareInput[] = [];
    for (const s of shares ?? []) {
      if (!s?.refId || (s.kind !== 'STUDENT' && s.kind !== 'TEACHER')) continue;
      if (s.kind === author.kind && s.refId === author.refId) continue; // 본인 제외
      const key = `${s.kind}:${s.refId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind: s.kind,
        refId: s.refId,
        role: s.role === 'EDITOR' ? 'EDITOR' : 'VIEWER',
      });
    }
    return out;
  }

  private async assertShareInputsValid(
    entId: string,
    shares: ShareInput[],
  ): Promise<void> {
    const byKind: Record<MaterialShareTargetKind, string[]> = {
      STUDENT: [],
      TEACHER: [],
    };
    for (const s of shares) byKind[s.kind].push(s.refId);
    for (const kind of ['STUDENT', 'TEACHER'] as const) {
      if (byKind[kind].length > 0) {
        await this.assertTargetsExist(entId, kind, byKind[kind]);
      }
    }
  }

  /** 편집 권한 = 작성자 또는 EDITOR 공유대상. */
  private async canEdit(
    entId: string,
    mat: MaterialTypeormEntity,
    viewer: PortalAuthor,
  ): Promise<boolean> {
    if (mat.authorKind === viewer.kind && mat.uploadedBy === viewer.refId) {
      return true;
    }
    if (viewer.kind !== 'STUDENT' && viewer.kind !== 'TEACHER') return false;
    const share = await this.shareRepo.findOne({
      where: {
        entId,
        matId: mat.id,
        tgtKind: viewer.kind,
        tgtRefId: viewer.refId,
        role: 'EDITOR',
      },
    });
    return !!share;
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
    if (!mat.s3Key || !mat.filename) throw new NotFoundException('NOT_A_FILE');
    const obj = await this.store.getObjectStream(mat.s3Key);
    return {
      stream: obj.stream,
      mime: mat.mime ?? 'application/octet-stream',
      filename: mat.filename,
    };
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
      const mine =
        m.authorKind === viewer.kind && m.uploadedBy === viewer.refId;
      return {
        id: m.id,
        kind: m.kind ?? 'FILE',
        title: m.title,
        filename: m.filename ?? null,
        mime: m.mime ?? null,
        sizeBytes: m.sizeBytes != null ? Number(m.sizeBytes) : null,
        createdAt: m.createdAt.toISOString(),
        authorKind: m.authorKind ?? null,
        authorName,
        shareTargets: tgts.map((s) => ({
          kind: s.tgtKind,
          refId: s.tgtRefId,
          name: nameMap.get(`${s.tgtKind}:${s.tgtRefId}`) ?? '-',
          role: s.role ?? 'VIEWER',
        })),
        commentCount: countByMat.get(m.id) ?? 0,
        mine,
        // PLN-260719 B — 편집 가능 = 작성자 또는 EDITOR 공유대상.
        canEdit:
          mine ||
          tgts.some(
            (s) =>
              s.tgtKind === viewer.kind &&
              s.tgtRefId === viewer.refId &&
              s.role === 'EDITOR',
          ),
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
             ON (c.cls_teacher_tch_id = t.tch_id
                 OR t.tch_user_id = c.cls_teacher_user_id)
            AND t.ent_id = c.ent_id
          WHERE c.ent_id = $1 AND t.tch_id = $2`,
        [entId, refId],
      );
    }
    return rows.map((r) => r.cls_id);
  }
}
