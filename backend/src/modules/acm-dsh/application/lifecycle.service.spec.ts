import { DataSource } from 'typeorm';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { LifecycleService } from './lifecycle.service';
import { LifecycleDto } from './dto/lifecycle.dto';
const id = '00000000-0000-4000-8000-000000000001';
describe('Lifecycle evidence validation', () => {
  const query = jest.fn();
  const manager = { query };
  const ds = {
    query,
    manager,
    transaction: async (fn: (m: unknown) => unknown) => fn(manager),
  } as unknown as DataSource;
  const service = new LifecycleService(ds, {} as AesGcmService);
  const dto = (extra: Partial<LifecycleDto>): LifecycleDto => ({
    subjectKind: 'STUDENT',
    subjectId: id,
    kind: 'SCHEDULE',
    effectiveDate: '2026-09-01',
    site: 'TPI',
    ...extra,
  });
  beforeEach(() => query.mockReset());
  it('cannot write another tenant subject', async () => {
    query.mockResolvedValue([]);
    await expect(
      service.record('tenant-a', id, dto({ status: 'SCHEDULING' })),
    ).rejects.toThrow('Subject not found');
    expect(query.mock.calls[0][1]).toEqual(['tenant-a', id]);
  });
  it('requires actual teacher and schedule to complete coordination', async () => {
    query.mockResolvedValue([{}]);
    await expect(
      service.record('tenant-a', id, dto({ status: 'SCHEDULED' })),
    ).rejects.toThrow('Teacher and schedule');
  });
  it('rejects referral to self', async () => {
    query.mockResolvedValue([{}]);
    await expect(
      service.record(
        'tenant-a',
        id,
        dto({
          kind: 'REFERRAL',
          relatedKind: 'STUDENT',
          relatedId: id,
          verified: true,
        }),
      ),
    ).rejects.toThrow('Self referral');
  });
  it('requires evidence of interruption rather than only a supplied date', async () => {
    query
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([]);
    await expect(
      service.record(
        'tenant-a',
        id,
        dto({
          kind: 'RETURN',
          relatedKind: 'STUDENT',
          relatedId: id,
          stoppedDate: '2026-08-30',
          verified: true,
        }),
      ),
    ).rejects.toThrow('No matching interruption');
  });
  it('does not allow a first payment without matching paid tuition', async () => {
    query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([]);
    await expect(
      service.record(
        'tenant-a',
        id,
        dto({ kind: 'FIRST_PAYMENT', verified: true }),
      ),
    ).rejects.toThrow('Matching paid tuition');
  });
  it('staff cannot cancel administrator financial evidence', async () => {
    query.mockResolvedValueOnce([{ kind: 'FIRST_PAYMENT' }]);
    await expect(service.cancel('tenant-a', id, id, 'STAFF')).rejects.toThrow(
      'Administrator',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('rejects impossible business dates and reversed ranges', async () => {
    await expect(
      service.record('tenant-a', id, dto({ effectiveDate: '2026-02-30' })),
    ).rejects.toThrow('Invalid ISO date');
    await expect(
      service.range('tenant-a', '2026-09-02', '2026-09-01'),
    ).rejects.toThrow('Invalid range');
  });
});
