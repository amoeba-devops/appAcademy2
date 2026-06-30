import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AttachmentTypeormEntity } from '../infrastructure/typeorm/attachment.typeorm-entity';
import { ObjectStoreClient } from '../infrastructure/external/object-store.client';
import { AuditService } from '../../acm-audit/application/audit.service';
import { AttachmentService } from './attachment.service';

/**
 * REQ-260626 T-06 / ADR-008 — covers the size/mime/count guards
 * and the visibility static helper. The presigned URL output is just
 * a passthrough from ObjectStoreClient (mocked).
 */
describe('AttachmentService', () => {
  let svc: AttachmentService;
  let repoCount: jest.Mock;
  let repoCreate: jest.Mock;
  let repoSave: jest.Mock;
  let repoFindOne: jest.Mock;
  let storeIsConfigured: jest.Mock;
  let storeBuildKey: jest.Mock;
  let storePresignPut: jest.Mock;
  let auditRecord: jest.Mock;

  beforeEach(async () => {
    repoCount = jest.fn().mockResolvedValue(0);
    repoCreate = jest.fn().mockImplementation((row) => ({ id: 'att-1', ...row }));
    repoSave = jest.fn().mockImplementation((row) => Promise.resolve(row));
    repoFindOne = jest.fn();
    storeIsConfigured = jest.fn().mockReturnValue(true);
    storeBuildKey = jest.fn().mockReturnValue('e1/att-1/foo.pdf');
    storePresignPut = jest.fn().mockResolvedValue('https://minio/sig');
    auditRecord = jest.fn().mockResolvedValue({ id: 'aud-1' });

    const mod = await Test.createTestingModule({
      providers: [
        AttachmentService,
        {
          provide: ObjectStoreClient,
          useValue: {
            isConfigured: storeIsConfigured,
            buildKey: storeBuildKey,
            presignPut: storePresignPut,
            presignGet: jest.fn(),
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
            findOne: repoFindOne,
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: { record: auditRecord },
        },
      ],
    }).compile();

    svc = mod.get(AttachmentService);
  });

  it('503 when ObjectStore not configured', async () => {
    storeIsConfigured.mockReturnValueOnce(false);
    await expect(
      svc.issuePresignedUpload('e1', 'inq-1', {
        category: 'TRANSCRIPT',
        filename: 'a.pdf',
        mime: 'application/pdf',
        sizeBytes: 100,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('rejects size > 10 MB', async () => {
    await expect(
      svc.issuePresignedUpload('e1', 'inq-1', {
        category: 'TRANSCRIPT',
        filename: 'a.pdf',
        mime: 'application/pdf',
        sizeBytes: 11 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects size = 0', async () => {
    await expect(
      svc.issuePresignedUpload('e1', 'inq-1', {
        category: 'TRANSCRIPT',
        filename: 'a.pdf',
        mime: 'application/pdf',
        sizeBytes: 0,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects disallowed mime (e.g. text/plain)', async () => {
    await expect(
      svc.issuePresignedUpload('e1', 'inq-1', {
        category: 'TRANSCRIPT',
        filename: 'a.txt',
        // intentionally invalid for the test
        mime: 'text/plain' as 'application/pdf',
        sizeBytes: 100,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects when (inq, category) already has 10 confirmed rows', async () => {
    repoCount.mockResolvedValueOnce(10);
    await expect(
      svc.issuePresignedUpload('e1', 'inq-1', {
        category: 'TRANSCRIPT',
        filename: 'a.pdf',
        mime: 'application/pdf',
        sizeBytes: 100,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('happy path inserts row and returns presigned URL', async () => {
    const r = await svc.issuePresignedUpload('e1', 'inq-1', {
      category: 'TRANSCRIPT',
      filename: 'a.pdf',
      mime: 'application/pdf',
      sizeBytes: 100,
    });
    expect(r).toEqual({
      attId: 'att-1',
      s3Key: 'e1/att-1/foo.pdf',
      presignedUrl: 'https://minio/sig',
      expiresIn: 300,
    });
    expect(storePresignPut).toHaveBeenCalledWith({
      key: 'e1/att-1/foo.pdf',
      mime: 'application/pdf',
      sizeBytes: 100,
    });
    // Two saves: initial + s3Key fill.
    expect(repoSave).toHaveBeenCalledTimes(2);
  });

  it('MATERIAL category gets TEACHER_STUDENT visibility', async () => {
    let capturedRow: Partial<AttachmentTypeormEntity> | undefined;
    repoCreate.mockImplementationOnce((row: Partial<AttachmentTypeormEntity>) => {
      capturedRow = { id: 'att-2', ...row };
      return capturedRow;
    });
    await svc.issuePresignedUpload('e1', 'inq-1', {
      category: 'MATERIAL',
      filename: 'guide.pdf',
      mime: 'application/pdf',
      sizeBytes: 100,
    });
    expect(capturedRow?.visibility).toBe('TEACHER_STUDENT');
  });

  it('TRANSCRIPT category gets STAFF_ONLY visibility', async () => {
    let capturedRow: Partial<AttachmentTypeormEntity> | undefined;
    repoCreate.mockImplementationOnce((row: Partial<AttachmentTypeormEntity>) => {
      capturedRow = { id: 'att-3', ...row };
      return capturedRow;
    });
    await svc.issuePresignedUpload('e1', 'inq-1', {
      category: 'TRANSCRIPT',
      filename: 'score.pdf',
      mime: 'application/pdf',
      sizeBytes: 100,
    });
    expect(capturedRow?.visibility).toBe('STAFF_ONLY');
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
      await expect(
        svc.recordDownloadAudit(baseRow, 'user-7'),
      ).resolves.toBeUndefined();
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
