import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AttachmentTypeormEntity } from '../infrastructure/typeorm/attachment.typeorm-entity';
import { ObjectStoreClient } from '../infrastructure/external/object-store.client';
import { AuditService } from '../../acm-audit/application/audit.service';
import { AttachmentService } from './attachment.service';

/**
 * REQ-260626 T-06 / ADR-008 + FIX-260630 — covers backend-proxied
 * multipart upload (size/mime/count guards + UTF-8 filename re-encode +
 * rollback on store failure) and the visibility static helper.
 */
describe('AttachmentService', () => {
  let svc: AttachmentService;
  let repoCount: jest.Mock;
  let repoCreate: jest.Mock;
  let repoSave: jest.Mock;
  let repoDelete: jest.Mock;
  let repoFindOne: jest.Mock;
  let storeIsConfigured: jest.Mock;
  let storeBuildKey: jest.Mock;
  let storePutObject: jest.Mock;
  let auditRecord: jest.Mock;

  function makeFile(over: Partial<Express.Multer.File> = {}): Express.Multer.File {
    return {
      buffer: Buffer.from('content'),
      originalname: 'foo.pdf',
      mimetype: 'application/pdf',
      size: 7,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: undefined as never,
      ...over,
    } as Express.Multer.File;
  }

  beforeEach(async () => {
    repoCount = jest.fn().mockResolvedValue(0);
    repoCreate = jest.fn().mockImplementation((row) => ({ id: 'att-1', ...row }));
    repoSave = jest.fn().mockImplementation((row) => Promise.resolve(row));
    repoDelete = jest.fn().mockResolvedValue({ affected: 1 });
    repoFindOne = jest.fn();
    storeIsConfigured = jest.fn().mockReturnValue(true);
    storeBuildKey = jest.fn().mockReturnValue('e1/att-1/foo.pdf');
    storePutObject = jest.fn().mockResolvedValue(undefined);
    auditRecord = jest.fn().mockResolvedValue({ id: 'aud-1' });

    const mod = await Test.createTestingModule({
      providers: [
        AttachmentService,
        {
          provide: ObjectStoreClient,
          useValue: {
            isConfigured: storeIsConfigured,
            buildKey: storeBuildKey,
            putObject: storePutObject,
            getObjectStream: jest.fn(),
            head: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AttachmentTypeormEntity, ACM_DS),
          useValue: {
            count: repoCount,
            create: repoCreate,
            save: repoSave,
            delete: repoDelete,
            findOne: repoFindOne,
            createQueryBuilder: jest.fn(),
          },
        },
        { provide: AuditService, useValue: { record: auditRecord } },
      ],
    }).compile();

    svc = mod.get(AttachmentService);
  });

  it('503 when ObjectStore not configured', async () => {
    storeIsConfigured.mockReturnValueOnce(false);
    await expect(
      svc.upload('e1', 'inq-1', makeFile(), { category: 'TRANSCRIPT' }, 'u1'),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('rejects missing file (multer slot empty)', async () => {
    await expect(
      svc.upload(
        'e1',
        'inq-1',
        undefined,
        { category: 'TRANSCRIPT' },
        'u1',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects size > 10 MB', async () => {
    await expect(
      svc.upload(
        'e1',
        'inq-1',
        makeFile({ size: 11 * 1024 * 1024 }),
        { category: 'TRANSCRIPT' },
        'u1',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects size = 0', async () => {
    await expect(
      svc.upload('e1', 'inq-1', makeFile({ size: 0 }), { category: 'TRANSCRIPT' }, 'u1'),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects disallowed mime (e.g. text/plain)', async () => {
    await expect(
      svc.upload(
        'e1',
        'inq-1',
        makeFile({ mimetype: 'text/plain' }),
        { category: 'TRANSCRIPT' },
        'u1',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects when (inq, category) already has 10 rows', async () => {
    repoCount.mockResolvedValueOnce(10);
    await expect(
      svc.upload('e1', 'inq-1', makeFile(), { category: 'TRANSCRIPT' }, 'u1'),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('happy path: validates, writes row, calls putObject, returns saved row', async () => {
    const r = await svc.upload(
      'e1',
      'inq-1',
      makeFile(),
      { category: 'TRANSCRIPT' },
      'u1',
    );
    expect(r.id).toBe('att-1');
    expect(storePutObject).toHaveBeenCalledWith({
      key: 'e1/att-1/foo.pdf',
      body: expect.any(Buffer),
      mime: 'application/pdf',
    });
    // Two saves: initial + s3Key fill.
    expect(repoSave).toHaveBeenCalledTimes(2);
    expect(repoDelete).not.toHaveBeenCalled();
  });

  it('re-encodes latin1 originalname to UTF-8 (Korean filename)', async () => {
    // Multer hands the latin1-decoded bytes through originalname; the
    // service must re-encode for UTF-8 storage. Simulate by encoding a
    // Korean string as UTF-8 then decoding as latin1 to get the broken
    // string multer would present.
    const utf8 = '한글파일.pdf';
    const broken = Buffer.from(utf8, 'utf8').toString('latin1');
    let captured: Partial<AttachmentTypeormEntity> | undefined;
    repoCreate.mockImplementationOnce((row: Partial<AttachmentTypeormEntity>) => {
      captured = { id: 'att-9', ...row };
      return captured;
    });
    await svc.upload(
      'e1',
      'inq-1',
      makeFile({ originalname: broken }),
      { category: 'TRANSCRIPT' },
      'u1',
    );
    expect(captured?.filename).toBe(utf8);
  });

  it('rolls back the row when putObject throws', async () => {
    storePutObject.mockRejectedValueOnce(new Error('s3 down'));
    await expect(
      svc.upload('e1', 'inq-1', makeFile(), { category: 'TRANSCRIPT' }, 'u1'),
    ).rejects.toMatchObject({ status: 400 });
    expect(repoDelete).toHaveBeenCalledWith({ id: 'att-1' });
  });

  it('MATERIAL category gets TEACHER_STUDENT visibility', async () => {
    let captured: Partial<AttachmentTypeormEntity> | undefined;
    repoCreate.mockImplementationOnce((row: Partial<AttachmentTypeormEntity>) => {
      captured = { id: 'att-2', ...row };
      return captured;
    });
    await svc.upload('e1', 'inq-1', makeFile(), { category: 'MATERIAL' }, 'u1');
    expect(captured?.visibility).toBe('TEACHER_STUDENT');
  });

  it('TRANSCRIPT category gets STAFF_ONLY visibility', async () => {
    let captured: Partial<AttachmentTypeormEntity> | undefined;
    repoCreate.mockImplementationOnce((row: Partial<AttachmentTypeormEntity>) => {
      captured = { id: 'att-3', ...row };
      return captured;
    });
    await svc.upload('e1', 'inq-1', makeFile(), { category: 'TRANSCRIPT' }, 'u1');
    expect(captured?.visibility).toBe('STAFF_ONLY');
  });

  describe('recordDownloadAudit (T-20 v2.1)', () => {
    const baseRow = {
      id: 'att-9',
      entId: 'e1',
      inqId: 'inq-9',
      category: 'TRANSCRIPT',
      visibility: 'STAFF_ONLY',
    } as unknown as AttachmentTypeormEntity;

    it('persists an EXPORT row with attachment metadata + reason tag', async () => {
      await svc.recordDownloadAudit(baseRow, 'user-7', '10.0.0.1', 'jest');
      expect(auditRecord).toHaveBeenCalledTimes(1);
      expect(auditRecord).toHaveBeenCalledWith({
        entId: 'e1',
        userId: 'user-7',
        action: 'EXPORT',
        entityType: 'acm.csl.attachment',
        entityId: 'att-9',
        fieldName: 'TRANSCRIPT',
        ip: '10.0.0.1',
        userAgent: 'jest',
        reason: 'download:inq=inq-9',
      });
    });

    it('swallows audit failures so the download URL still returns', async () => {
      auditRecord.mockRejectedValueOnce(new Error('db down'));
      await expect(svc.recordDownloadAudit(baseRow, 'user-7')).resolves.toBeUndefined();
    });

    it('omits ip/userAgent when not provided', async () => {
      await svc.recordDownloadAudit(baseRow, 'user-7');
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ ip: null, userAgent: null }),
      );
    });
  });

  describe('canView visibility helper', () => {
    const make = (v: 'STAFF_ONLY' | 'TEACHER_STUDENT') =>
      ({ visibility: v }) as AttachmentTypeormEntity;
    it('STAFF sees everything', () => {
      expect(AttachmentService.canView(make('STAFF_ONLY'), 'STAFF')).toBe(true);
      expect(AttachmentService.canView(make('TEACHER_STUDENT'), 'STAFF')).toBe(true);
    });
    it('ADMIN sees everything', () => {
      expect(AttachmentService.canView(make('STAFF_ONLY'), 'ADMIN')).toBe(true);
    });
    it('TEACHER blocked from STAFF_ONLY (transcript)', () => {
      expect(AttachmentService.canView(make('STAFF_ONLY'), 'TEACHER')).toBe(false);
      expect(AttachmentService.canView(make('TEACHER_STUDENT'), 'TEACHER')).toBe(true);
    });
  });
});
