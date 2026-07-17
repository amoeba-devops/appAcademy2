import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
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
      ds as any,
      store as any,
    );
    return { svc, repo, shareRepo, commentRepo, ds, store, saved };
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
        's1',
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an empty share list', async () => {
    const { svc } = build();
    await expect(
      svc.create(
        'e1',
        { kind: 'TEACHER', refId: 't1' },
        file() as any,
        't',
        [],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a disallowed mime', async () => {
    const { svc } = build();
    await expect(
      svc.create(
        'e1',
        { kind: 'TEACHER', refId: 't1' },
        file({ mimetype: 'application/x-msdownload' }) as any,
        't',
        ['s1'],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('teacher creates → shares to students (target kind STUDENT, existence checked)', async () => {
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
      ['s1'],
    );
    expect(store.putObject).toHaveBeenCalled();
    expect(shareRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ tgtKind: 'STUDENT', tgtRefId: 's1' }),
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
        'tX',
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
});
