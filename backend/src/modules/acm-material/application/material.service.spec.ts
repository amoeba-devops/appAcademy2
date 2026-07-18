import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MaterialService } from './material.service';

/** PLN-260706 §4.5 — upload validation, download scope, role→class scope. */
describe('MaterialService', () => {
  const CLS = 'cls-1';

  function build(opts: { material?: any; scopeClsIds?: string[] } = {}) {
    const saved: any[] = [];
    const repo = {
      find: jest.fn().mockResolvedValue(opts.material ? [opts.material] : []),
      findOne: jest.fn().mockResolvedValue(opts.material ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => {
        const row = {
          id: `mat-${saved.length + 1}`,
          createdAt: new Date(),
          ...x,
        };
        saved.push(row);
        return row;
      }),
    };
    // DataSource.query — route by SQL: scope (cls_id list) vs label lookup.
    const ds = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('cls_subject_label')) {
          return [{ cls_id: CLS, label: '중등수학 A', code: 'M-A' }];
        }
        return (opts.scopeClsIds ?? []).map((cls_id) => ({ cls_id }));
      }),
    };
    const store = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getObjectStream: jest
        .fn()
        .mockResolvedValue({ stream: 'STREAM', mime: 'text/plain' }),
    };
    const svc = new MaterialService(repo as any, ds as any, store as any);
    return { svc, repo, ds, store, saved };
  }

  const file = (over: Partial<{ size: number; buffer: Buffer }> = {}) => ({
    originalname: 'note.pdf',
    mimetype: 'application/pdf',
    buffer: over.buffer ?? Buffer.from('hello'),
    size: over.size ?? 5,
  });

  // ---- upload ---------------------------------------------------------------
  it('rejects an empty file', async () => {
    const { svc } = build();
    await expect(
      svc.upload('e1', CLS, 'u1', file({ buffer: Buffer.alloc(0), size: 0 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a file over 20MB', async () => {
    const { svc } = build();
    await expect(
      svc.upload('e1', CLS, 'u1', file({ size: 21 * 1024 * 1024 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uploads to S3 and stores a row + view (with class label)', async () => {
    const { svc, store, repo } = build();
    const view = await svc.upload('e1', CLS, 'u1', file(), '1주차');
    expect(store.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^materials\/e1\/cls-1\//),
        mime: 'application/pdf',
      }),
    );
    expect(repo.save).toHaveBeenCalled();
    expect(view).toMatchObject({
      title: '1주차',
      className: '중등수학 A',
      sizeBytes: 5,
    });
  });

  // ---- download scope -------------------------------------------------------
  it('404 when material missing', async () => {
    const { svc } = build({ material: null });
    await expect(
      svc.download('e1', 'x', { isAdmin: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('admin can download any material', async () => {
    const { svc } = build({
      material: {
        id: 'm',
        clsId: CLS,
        s3Key: 'k',
        mime: 'text/plain',
        filename: 'f',
      },
    });
    const r = await svc.download('e1', 'm', { isAdmin: true });
    expect(r.stream).toBe('STREAM');
  });

  it('portal user in the class can download', async () => {
    const { svc } = build({
      material: {
        id: 'm',
        clsId: CLS,
        s3Key: 'k',
        mime: 'text/plain',
        filename: 'f',
      },
      scopeClsIds: [CLS],
    });
    const r = await svc.download('e1', 'm', {
      portal: { kind: 'STUDENT', refId: 'std-1' },
    });
    expect(r.stream).toBe('STREAM');
  });

  it('portal user NOT in the class is forbidden', async () => {
    const { svc } = build({
      material: {
        id: 'm',
        clsId: CLS,
        s3Key: 'k',
        mime: 'text/plain',
        filename: 'f',
      },
      scopeClsIds: ['other-class'],
    });
    await expect(
      svc.download('e1', 'm', { portal: { kind: 'STUDENT', refId: 'std-1' } }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  // ---- portal list scope ----------------------------------------------------
  it('listForPortal returns [] when the user has no classes', async () => {
    const { svc, repo } = build({ scopeClsIds: [] });
    const r = await svc.listForPortal('e1', 'PARENT', 'par-1');
    expect(r).toEqual([]);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('listForPortal returns materials for the user’s classes', async () => {
    const { svc } = build({
      material: {
        id: 'm',
        clsId: CLS,
        title: 'T',
        filename: 'f',
        mime: 'x',
        sizeBytes: '3',
        createdAt: new Date(),
      },
      scopeClsIds: [CLS],
    });
    const r = await svc.listForPortal('e1', 'TEACHER', 'tch-1');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ clsId: CLS, className: '중등수학 A' });
  });
});
