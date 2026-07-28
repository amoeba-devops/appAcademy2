import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CalEventAttachmentService } from './cal-event-attachment.service';

/** PLN-260718 P2 — upload validation, 503 when store unconfigured, download/delete. */
describe('CalEventAttachmentService', () => {
  const ENT = 'e1';
  const EVT = 'evt-1';

  function build(
    opts: { configured?: boolean; row?: any; count?: number } = {},
  ) {
    const saved: any[] = [];
    const repo = {
      count: jest.fn().mockResolvedValue(opts.count ?? 0),
      find: jest.fn().mockResolvedValue(opts.row ? [opts.row] : []),
      findOne: jest.fn().mockResolvedValue(opts.row ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => {
        const row = {
          id: `cea-${saved.length + 1}`,
          createdAt: new Date(),
          ...x,
        };
        saved.push(row);
        return row;
      }),
    };
    const store = {
      isConfigured: jest.fn().mockReturnValue(opts.configured ?? true),
      putObject: jest.fn().mockResolvedValue(undefined),
      getObjectStream: jest
        .fn()
        .mockResolvedValue({ stream: 'STREAM', mime: 'application/pdf' }),
    };
    const svc = new CalEventAttachmentService(repo as any, store as any);
    return { svc, repo, store, saved };
  }

  const file = (
    over: Partial<{ size: number; mimetype: string; buffer: Buffer }> = {},
  ) =>
    ({
      // multer decodes the UTF-8 filename bytes as latin1; the service
      // re-encodes to UTF-8. Simulate that wire form here.
      originalname: Buffer.from('자료.pdf', 'utf8').toString('latin1'),
      mimetype: over.mimetype ?? 'application/pdf',
      buffer: over.buffer ?? Buffer.from('hello'),
      size: over.size ?? 5,
    }) as any;

  it('503 when object store not configured', async () => {
    const { svc } = build({ configured: false });
    await expect(svc.upload(ENT, EVT, file(), 'u1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects an empty file', async () => {
    const { svc } = build();
    await expect(
      svc.upload(ENT, EVT, file({ buffer: Buffer.alloc(0), size: 0 }), 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a file over 20MB', async () => {
    const { svc } = build();
    await expect(
      svc.upload(ENT, EVT, file({ size: 21 * 1024 * 1024 }), 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a disallowed MIME type', async () => {
    const { svc } = build();
    await expect(
      svc.upload(
        ENT,
        EVT,
        file({ mimetype: 'application/x-msdownload' }),
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the per-event count cap is reached', async () => {
    const { svc } = build({ count: 20 });
    await expect(svc.upload(ENT, EVT, file(), 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('uploads to S3 and stores a row (Korean filename preserved)', async () => {
    const { svc, store, repo } = build();
    const view = await svc.upload(ENT, EVT, file(), 'u1');
    expect(store.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringMatching(/^cal-events\/e1\/evt-1\//),
        mime: 'application/pdf',
      }),
    );
    expect(repo.save).toHaveBeenCalled();
    expect(view).toMatchObject({ filename: '자료.pdf', sizeBytes: '5' });
  });

  it('streamDownload 404 when row missing', async () => {
    const { svc } = build({ row: null });
    await expect(svc.streamDownload(ENT, EVT, 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('streamDownload returns the object stream', async () => {
    const { svc } = build({
      row: {
        id: 'cea-1',
        s3Key: 'k',
        filename: 'f.pdf',
        mime: 'application/pdf',
      },
    });
    const r = await svc.streamDownload(ENT, EVT, 'cea-1');
    expect(r.stream).toBe('STREAM');
    expect(r.filename).toBe('f.pdf');
  });

  it('softDelete stamps deleted_at', async () => {
    const row: any = { id: 'cea-1', s3Key: 'k', filename: 'f', mime: 'x' };
    const { svc, repo } = build({ row });
    await svc.softDelete(ENT, EVT, 'cea-1');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });
});
