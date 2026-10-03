import { StudentService } from './student.service';
import { StudentTypeormEntity } from '../infrastructure/typeorm/student.typeorm-entity';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { StudentTeacherTypeormEntity } from '../infrastructure/typeorm/student-teacher.typeorm-entity';
import { ParentService } from './parent.service';
import { validate } from 'class-validator';
import { ChangeStudentStatusDto } from './dto/student.dto';
function setup() {
  const query = jest.fn().mockResolvedValue([]),
    findOne = jest.fn().mockResolvedValue({ id: 'student' });
  const manager = { query, getRepository: () => ({ findOne }) };
  const transaction = jest.fn((work: (m: EntityManager) => Promise<unknown>) =>
    work(manager as unknown as EntityManager),
  );
  const service = new StudentService(
    {} as Repository<StudentTypeormEntity>,
    {} as Repository<TeacherTypeormEntity>,
    {} as Repository<StudentTeacherTypeormEntity>,
    { transaction } as unknown as DataSource,
    {} as ParentService,
  );
  return { service, query, findOne, transaction };
}
const correction = {
  effectiveDate: '2026-01-01',
  revision: 2,
  reason: 'Verified source date',
};
describe('student status dates', () => {
  it('requires real, date-only effective dates', async () => {
    for (const value of [undefined, '2026-02-30', '2026-01-01T10:00:00Z']) {
      const dto = Object.assign(new ChangeStudentStatusDto(), {
        stdStatus: 'INACTIVE',
        effectiveDate: value,
      });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    }
    expect(
      await validate(
        Object.assign(new ChangeStudentStatusDto(), {
          stdStatus: 'INACTIVE',
          effectiveDate: '2026-01-01',
        }),
      ),
    ).toHaveLength(0);
  });
  it('rejects future status dates before writing', async () => {
    const { service, transaction } = setup();
    await expect(
      service.changeStatus('tenant', 'student', {
        stdStatus: 'INACTIVE',
        effectiveDate: '2099-01-01',
      }),
    ).rejects.toThrow('STATUS_DATE_FUTURE');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects correction of a missing or cross-tenant student', async () => {
    const { service, findOne, query } = setup();
    findOne.mockResolvedValue(null);
    await expect(
      service.correctStatusDate(
        'tenant',
        'student',
        'history',
        correction,
        'actor',
      ),
    ).rejects.toThrow('STUDENT_NOT_FOUND');
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects stale revisions and does not silently report success', async () => {
    const { service, query } = setup();
    await expect(
      service.correctStatusDate(
        'tenant',
        'student',
        'history',
        correction,
        'actor',
      ),
    ).rejects.toThrow('STATUS_HISTORY_CONFLICT');
    expect(query.mock.calls[1][1]).toEqual([
      'tenant',
      'student',
      'history',
      '2026-01-01',
      'actor',
      'Verified source date',
      2,
    ]);
  });
  it('rejects a correction reversing event chronology', async () => {
    const { service, query } = setup();
    query.mockResolvedValueOnce([{}]);
    await expect(
      service.correctStatusDate(
        'tenant',
        'student',
        'history',
        correction,
        'actor',
      ),
    ).rejects.toThrow('STATUS_DATE_ORDER');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('accepts a revision-checked correction and retains audit metadata', async () => {
    const { service, query } = setup();
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ssh_id: 'history' }]);
    await expect(
      service.correctStatusDate(
        'tenant',
        'student',
        'history',
        correction,
        'actor',
      ),
    ).resolves.toEqual({ ok: true });
    expect(query.mock.calls[1][0]).toContain('ssh_corrections');
  });
});
