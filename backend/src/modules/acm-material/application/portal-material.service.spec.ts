import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PortalMaterialService } from './portal-material.service';

/** PLN-260718 P3 — create validation, share model, access, comments. */
describe('PortalMaterialService', () => {
  function build(
    opts: {
      material?: any;
      shares?: any[];
      dsRows?: (sql: string) => any[];
    } = {},
  ) {
    const saved: any[] = [];
    const repo = {
      find: jest.fn().mockResolvedValue(opts.material ? [opts.material] : []),
      findAndCount: jest
        .fn()
        .mockResolvedValue(
          opts.material ? [[opts.material], 1] : [[], 0],
        ),
      findOne: jest.fn().mockResolvedValue(opts.material ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => {
        const row = { id: `mat-1`, createdAt: new Date(), ...x };
        saved.push(row);
        return row;
      }),
    };
    const shareRepo = {
      find: jest.fn().mockResolvedValue(opts.shares ?? []),
      findOne: jest.fn().mockResolvedValue((opts.shares ?? [])[0] ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const commentRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({
        id: 'c1',
        createdAt: new Date(),
        ...x,
      })),
    };
    const revisionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({
        id: 'rv1',
        createdAt: new Date(),
        ...x,
      })),
    };
    const attachmentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({
        id: 'a1',
        createdAt: new Date(),
        ...x,
      })),
    };
    const ds = {
      query: jest.fn(async (sql: string) =>
        opts.dsRows ? opts.dsRows(sql) : [],
      ),
    };
    const store = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getObjectStream: jest
        .fn()
        .mockResolvedValue({ stream: 'S', mime: 'application/pdf' }),
    };
    const svc = new PortalMaterialService(
      repo as any,
      shareRepo as any,
      commentRepo as any,
      revisionRepo as any,
      attachmentRepo as any,
      ds as any,
      store as any,
    );
    return {
      svc,
      repo,
      shareRepo,
      commentRepo,
      revisionRepo,
      attachmentRepo,
      ds,
      store,
      saved,
    };
  }

  const file = (
    over: Partial<{ size: number; mimetype: string; buffer: Buffer }> = {},
  ) => ({
    originalname: Buffer.from('자료.pdf', 'utf8').toString('latin1'),
    mimetype: over.mimetype ?? 'application/pdf',
    buffer: over.buffer ?? Buffer.from('x'),
    size: over.size ?? 1,
  });

  it('parents cannot author', async () => {
    const { svc } = build();
    await expect(
      svc.create('e1', { kind: 'PARENT', refId: 'p1' }, file() as any, 't', [
        { kind: 'STUDENT', refId: 's1', role: 'VIEWER' },
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an upload without share targets (REQ-260728B FR-3)', async () => {
    const { svc, store } = build();
    await expect(
      svc.create(
        'e1',
        { kind: 'TEACHER', refId: 't1' },
        file(),
        '대상 없이 업로드',
        [],
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(store.putObject).not.toHaveBeenCalled();
  });

  it('student can only share to teachers (REQ-260728B FR-1) — file upload', async () => {
    const { svc } = build();
    await expect(
      svc.create('e1', { kind: 'STUDENT', refId: 's1' }, file(), '제출', [
        { kind: 'STUDENT', refId: 's2', role: 'VIEWER' },
      ]),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('student can only share to teachers (REQ-260728B FR-1) — doc', async () => {
    const { svc } = build();
    await expect(
      svc.createDoc('e1', { kind: 'STUDENT', refId: 's1' }, '문서', '<p></p>', [
        { kind: 'STUDENT', refId: 's2', role: 'VIEWER' },
      ]),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('listAllPortalUsers returns teachers only for a student caller (FR-1)', async () => {
    const { svc, ds } = build({
      dsRows: (sql) =>
        sql.includes('amb_acm_tch_teacher')
          ? [{ ref_id: 't1', name: '김강사' }]
          : [{ ref_id: 's9', name: '학생' }],
    });
    const out = await svc.listAllPortalUsers('e1', {
      kind: 'STUDENT',
      refId: 's1',
    });
    expect(out).toEqual([{ kind: 'TEACHER', refId: 't1', name: '김강사' }]);
    // 학생 목록 쿼리는 아예 실행되지 않는다.
    expect(
      (ds.query as jest.Mock).mock.calls.some(([sql]) =>
        String(sql).includes('amb_acm_std_student'),
      ),
    ).toBe(false);
  });

  it('updateShares works for FILE posts too (후공유)', async () => {
    const filePost: any = {
      id: 'm',
      kind: 'FILE',
      authorKind: 'TEACHER',
      uploadedBy: 't1',
      title: 'F',
      filename: 'f.pdf',
      mime: 'application/pdf',
      sizeBytes: '3',
      createdAt: new Date(),
      deletedAt: null,
    };
    const { svc, shareRepo } = build({
      material: filePost,
      dsRows: (sql) =>
        sql.includes('amb_acm_std_student')
          ? [{ id: 's1', name: '홍길동' }]
          : [],
    });
    await svc.updateShares('e1', 'm', { kind: 'TEACHER', refId: 't1' }, [
      { kind: 'STUDENT', refId: 's1', role: 'VIEWER' },
    ]);
    expect(shareRepo.delete).toHaveBeenCalledWith({ entId: 'e1', matId: 'm' });
    expect(shareRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ tgtKind: 'STUDENT', tgtRefId: 's1' }),
    ]);
  });

  it('rejects a disallowed mime', async () => {
    const { svc } = build();
    await expect(
      svc.create(
        'e1',
        { kind: 'TEACHER', refId: 't1' },
        file({ mimetype: 'application/x-msdownload' }) as any,
        't',
        [{ kind: 'STUDENT', refId: 's1', role: 'VIEWER' }],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('teacher creates → shares to students (VIEWER 강제, existence checked)', async () => {
    // ds returns the student rows for assertTargetsExist + name resolution.
    const { svc, store, shareRepo } = build({
      dsRows: (sql) =>
        sql.includes('amb_acm_std_student')
          ? [{ id: 's1', name: '홍길동' }]
          : [],
    });
    const view = await svc.create(
      'e1',
      { kind: 'TEACHER', refId: 't1' },
      file(),
      '1주차 과제',
      // EDITOR 를 보내도 FILE 공유는 VIEWER 로 강제된다.
      [{ kind: 'STUDENT', refId: 's1', role: 'EDITOR' }],
    );
    expect(store.putObject).toHaveBeenCalled();
    expect(shareRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        tgtKind: 'STUDENT',
        tgtRefId: 's1',
        role: 'VIEWER',
      }),
    ]);
    expect(view).toMatchObject({
      title: '1주차 과제',
      authorKind: 'TEACHER',
      mine: true,
    });
  });

  it('rejects an invalid share target', async () => {
    const { svc } = build({ dsRows: () => [] }); // no matching rows
    await expect(
      svc.create('e1', { kind: 'STUDENT', refId: 's1' }, file() as any, 't', [
        { kind: 'TEACHER', refId: 'tX', role: 'VIEWER' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('download 404 when material missing', async () => {
    const { svc } = build({ material: null });
    await expect(
      svc.download('e1', 'x', { kind: 'STUDENT', refId: 's1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('author can download own post', async () => {
    const { svc } = build({
      material: {
        id: 'm',
        authorKind: 'TEACHER',
        uploadedBy: 't1',
        s3Key: 'k',
        mime: 'application/pdf',
        filename: 'f',
      },
    });
    const r = await svc.download('e1', 'm', { kind: 'TEACHER', refId: 't1' });
    expect(r.stream).toBe('S');
  });

  it('share target can download', async () => {
    const { svc } = build({
      material: {
        id: 'm',
        authorKind: 'TEACHER',
        uploadedBy: 't1',
        s3Key: 'k',
        mime: 'application/pdf',
        filename: 'f',
      },
      shares: [{ matId: 'm', tgtKind: 'STUDENT', tgtRefId: 's1' }],
    });
    const r = await svc.download('e1', 'm', { kind: 'STUDENT', refId: 's1' });
    expect(r.stream).toBe('S');
  });

  it('unrelated user is forbidden', async () => {
    const { svc } = build({
      material: {
        id: 'm',
        authorKind: 'TEACHER',
        uploadedBy: 't1',
        s3Key: 'k',
        mime: 'application/pdf',
        filename: 'f',
      },
      shares: [],
    });
    await expect(
      svc.download('e1', 'm', { kind: 'STUDENT', refId: 'sX' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ── Doc board (PLN-260719 B) ──────────────────────────────────────────

  it('createDoc rejects a parent author', async () => {
    const { svc } = build();
    await expect(
      svc.createDoc(
        'e1',
        { kind: 'PARENT', refId: 'p1' },
        '제목',
        '<p>x</p>',
        [],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createDoc requires a title', async () => {
    const { svc } = build();
    await expect(
      svc.createDoc(
        'e1',
        { kind: 'TEACHER', refId: 't1' },
        '  ',
        '<p>x</p>',
        [],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createDoc saves DOC row + shares with roles (self excluded, dupes removed)', async () => {
    const saved: any = {
      id: 'm',
      kind: 'DOC',
      content: '<p>hi</p>',
      authorKind: 'TEACHER',
      uploadedBy: 't1',
      title: '문서',
      createdAt: new Date(),
      deletedAt: null,
    };
    const { svc, repo, shareRepo } = build({
      material: saved,
      dsRows: (sql) =>
        sql.includes('amb_acm_std_student')
          ? [{ id: 's1', name: '홍길동' }]
          : [],
    });
    await svc.createDoc(
      'e1',
      { kind: 'TEACHER', refId: 't1' },
      '문서',
      '<p>hi</p>',
      [
        { kind: 'STUDENT', refId: 's1', role: 'EDITOR' },
        { kind: 'STUDENT', refId: 's1', role: 'VIEWER' }, // dupe
        { kind: 'TEACHER', refId: 't1', role: 'EDITOR' }, // self
      ],
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'DOC',
        content: '<p>hi</p>',
        s3Key: null,
      }),
    );
    expect(shareRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({
        tgtKind: 'STUDENT',
        tgtRefId: 's1',
        role: 'EDITOR',
      }),
    ]);
  });

  it('updateDoc allows an EDITOR share target', async () => {
    const doc: any = {
      id: 'm',
      kind: 'DOC',
      content: '<p>old</p>',
      authorKind: 'TEACHER',
      uploadedBy: 't1',
      title: 'T',
      createdAt: new Date(),
      deletedAt: null,
    };
    const { svc, repo } = build({
      material: doc,
      shares: [
        { matId: 'm', tgtKind: 'STUDENT', tgtRefId: 's1', role: 'EDITOR' },
      ],
    });
    await svc.updateDoc(
      'e1',
      'm',
      { kind: 'STUDENT', refId: 's1' },
      {
        content: '<p>new</p>',
      },
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ content: '<p>new</p>' }),
    );
  });

  it('updateDoc forbids a VIEWER share target', async () => {
    const doc: any = {
      id: 'm',
      kind: 'DOC',
      authorKind: 'TEACHER',
      uploadedBy: 't1',
      title: 'T',
      createdAt: new Date(),
      deletedAt: null,
    };
    const { svc, shareRepo } = build({ material: doc });
    // VIEWER only → canEdit 의 EDITOR 조회(findOne where role:'EDITOR')는 miss.
    shareRepo.findOne.mockResolvedValue(null);
    await expect(
      svc.updateDoc(
        'e1',
        'm',
        { kind: 'STUDENT', refId: 's1' },
        { content: 'x' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createDoc records revision v1 with author identity', async () => {
    const doc: any = {
      id: 'mat-1',
      kind: 'DOC',
      content: '<p>hi</p>',
      authorKind: 'TEACHER',
      uploadedBy: 't1',
      title: '문서',
      createdAt: new Date(),
      deletedAt: null,
    };
    const { svc, revisionRepo } = build({
      material: doc,
      dsRows: (sql) =>
        sql.includes('amb_acm_tch_teacher')
          ? [{ id: 't1', name: '김강사' }]
          : [],
    });
    await svc.createDoc(
      'e1',
      { kind: 'TEACHER', refId: 't1' },
      '문서',
      '<p>hi</p>',
      [],
    );
    expect(revisionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        seq: 1,
        editorKind: 'TEACHER',
        editorName: '김강사',
      }),
    );
  });

  it('updateDoc records a new revision only when content changed', async () => {
    const doc: any = {
      id: 'm',
      kind: 'DOC',
      content: '<p>old</p>',
      authorKind: 'TEACHER',
      uploadedBy: 't1',
      title: 'T',
      createdAt: new Date(),
      deletedAt: null,
    };
    const { svc, revisionRepo } = build({ material: doc });
    // findOne 순서: canEdit 은 작성자 매치로 통과 → recordRevision 의 last 조회.
    revisionRepo.findOne.mockResolvedValue({ seq: 3 });
    await svc.updateDoc(
      'e1',
      'm',
      { kind: 'TEACHER', refId: 't1' },
      {
        content: '<p>new</p>',
      },
    );
    expect(revisionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ seq: 4, content: '<p>new</p>' }),
    );
    // 변경 없음 → 리비전 기록 없음.
    (revisionRepo.save as jest.Mock).mockClear();
    doc.content = '<p>same</p>';
    await svc.updateDoc(
      'e1',
      'm',
      { kind: 'TEACHER', refId: 't1' },
      {
        content: '<p>same</p>',
      },
    );
    expect(revisionRepo.save).not.toHaveBeenCalled();
  });

  it('restoreRevision applies the snapshot via updateDoc (new revision)', async () => {
    const doc: any = {
      id: 'm',
      kind: 'DOC',
      content: '<p>v3</p>',
      authorKind: 'TEACHER',
      uploadedBy: 't1',
      title: 'T',
      createdAt: new Date(),
      deletedAt: null,
    };
    const { svc, repo, revisionRepo } = build({ material: doc });
    revisionRepo.findOne.mockResolvedValue({
      seq: 1,
      title: 'T',
      content: '<p>v1</p>',
    });
    await svc.restoreRevision('e1', 'm', 1, { kind: 'TEACHER', refId: 't1' });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ content: '<p>v1</p>' }),
    );
    expect(revisionRepo.save).toHaveBeenCalled();
  });

  it('updateShares is author-only', async () => {
    const doc: any = {
      id: 'm',
      kind: 'DOC',
      authorKind: 'TEACHER',
      uploadedBy: 't1',
      title: 'T',
      createdAt: new Date(),
      deletedAt: null,
    };
    const { svc } = build({ material: doc });
    await expect(
      svc.updateShares('e1', 'm', { kind: 'STUDENT', refId: 's1' }, []),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only the author can delete', async () => {
    const { svc } = build({
      material: {
        id: 'm',
        authorKind: 'TEACHER',
        uploadedBy: 't1',
        deletedAt: null,
      },
    });
    await expect(
      svc.remove('e1', 'm', { kind: 'STUDENT', refId: 's1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ── Doc attachments (REQ-260728B FR-2) ───────────────────────────────

  const docRow = (): any => ({
    id: 'm',
    kind: 'DOC',
    content: '<p>x</p>',
    authorKind: 'TEACHER',
    uploadedBy: 't1',
    title: 'T',
    createdAt: new Date(),
    deletedAt: null,
  });

  it('addAttachment stores the file and returns its meta', async () => {
    const { svc, store, attachmentRepo } = build({ material: docRow() });
    const out = await svc.addAttachment(
      'e1',
      'm',
      { kind: 'TEACHER', refId: 't1' },
      file() as any,
    );
    expect(store.putObject).toHaveBeenCalled();
    expect(attachmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ matId: 'm', filename: '자료.pdf' }),
    );
    expect(out).toMatchObject({ id: 'a1', filename: '자료.pdf' });
  });

  it('addAttachment enforces the per-doc cap (≤5)', async () => {
    const { svc, attachmentRepo } = build({ material: docRow() });
    attachmentRepo.count.mockResolvedValue(5);
    await expect(
      svc.addAttachment(
        'e1',
        'm',
        { kind: 'TEACHER', refId: 't1' },
        file() as any,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('addAttachment forbids a non-editor', async () => {
    const { svc, shareRepo } = build({ material: docRow() });
    shareRepo.findOne.mockResolvedValue(null); // no EDITOR share
    await expect(
      svc.addAttachment(
        'e1',
        'm',
        { kind: 'STUDENT', refId: 's1' },
        file() as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ── List pagination (REQ-260728B FR-4) ───────────────────────────────

  it('listOwn pages with take/skip and returns meta', async () => {
    const { svc, repo } = build();
    const out = await svc.listOwn('e1', 'TEACHER', 't1', {
      page: 2,
      limit: 10,
    });
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 10 }),
    );
    expect(out.meta).toEqual({ page: 2, limit: 10, total: 0 });
  });

  it('listShared filters by matKind and pages in memory', async () => {
    const now = Date.now();
    const mats: any[] = [
      {
        id: 'd1',
        kind: 'DOC',
        authorKind: 'TEACHER',
        uploadedBy: 't1',
        title: 'D',
        createdAt: new Date(now),
        deletedAt: null,
      },
      {
        id: 'f1',
        kind: 'FILE',
        authorKind: 'TEACHER',
        uploadedBy: 't1',
        title: 'F',
        filename: 'f.pdf',
        createdAt: new Date(now - 1000),
        deletedAt: null,
      },
    ];
    const { svc, repo, shareRepo } = build();
    shareRepo.find.mockResolvedValue([
      { matId: 'd1', tgtKind: 'STUDENT', tgtRefId: 's1' },
      { matId: 'f1', tgtKind: 'STUDENT', tgtRefId: 's1' },
    ]);
    repo.find.mockResolvedValue(mats);
    const out = await svc.listShared('e1', 'STUDENT', 's1', {
      matKind: 'DOC',
      page: 1,
      limit: 10,
    });
    expect(out.meta.total).toBe(1);
    expect(out.data.map((m) => m.id)).toEqual(['d1']);
  });
});
