import { EntityManager } from 'typeorm';
import { validate } from 'class-validator';
import { UpsertEnrollmentDto } from './dto/inquiry.dto';
import { replaceEnrollmentCourses } from './enrollment-courses';
const a = '00000000-0000-4000-8000-000000000001',
  b = '00000000-0000-4000-8000-000000000002';
describe('Enrollment courses', () => {
  const query = jest.fn();
  const manager = { query } as unknown as EntityManager;
  beforeEach(() => query.mockReset());
  it('validates duplicate and null selections at the HTTP boundary', async () => {
    for (const ids of [null, [a, a], ['bad']])
      expect(
        (
          await validate(
            Object.assign(new UpsertEnrollmentDto(), { courseIds: ids }),
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        Object.assign(new UpsertEnrollmentDto(), { courseIds: [] }),
      ),
    ).toHaveLength(0);
  });
  it('keeps selected inactive courses but rejects new inactive or cross-tenant courses', async () => {
    query
      .mockResolvedValueOnce([
        { id: a, active: false, selected: true },
        { id: b, active: true, selected: false },
      ])
      .mockResolvedValue([]);
    await replaceEnrollmentCourses(manager, 'tenant', 'enrollment', [a, b]);
    expect(query).toHaveBeenCalledTimes(3);
    query
      .mockReset()
      .mockResolvedValueOnce([{ id: a, active: false, selected: false }]);
    await expect(
      replaceEnrollmentCourses(manager, 'tenant', 'enrollment', [a]),
    ).rejects.toThrow('INVALID_OR_INACTIVE');
    expect(query).toHaveBeenCalledTimes(1);
    query.mockReset().mockResolvedValueOnce([]);
    await expect(
      replaceEnrollmentCourses(manager, 'tenant', 'enrollment', [b]),
    ).rejects.toThrow('INVALID_OR_INACTIVE');
  });
  it('clears all choices explicitly with an empty array', async () => {
    query.mockResolvedValue([]);
    await replaceEnrollmentCourses(manager, 'tenant', 'enrollment', []);
    expect(query.mock.calls[1][1]).toEqual(['tenant', 'enrollment', []]);
  });
});
