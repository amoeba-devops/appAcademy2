import { DataSource } from 'typeorm';
import {
  CURRENT_SOURCE_SQL,
  SourceCurrentService,
} from './source-current.service';

describe('SourceCurrentService', () => {
  const query = jest.fn();
  const service = new SourceCurrentService({ query } as unknown as DataSource);
  beforeEach(() => query.mockReset());
  it('uses the authenticated tenant in one statement and labels the result as current only', async () => {
    query.mockResolvedValueOnce([
      {
        asOf: new Date('2026-09-22T01:00:00Z'),
        activeStudents: 58,
        activeTeachers: 14,
        assignedStudents: 47,
        assignedTeachers: 12,
      },
    ]);
    expect(await service.getCurrent('tenant-a')).toMatchObject({
      scope: 'ALL',
      definitionVersion: 'current-master-v1',
      asOf: '2026-09-22T01:00:00.000Z',
      activeStudents: 58,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(CURRENT_SOURCE_SQL, ['tenant-a']);
  });
  it('propagates source failures rather than manufacturing zero or falling back to legacy KPI', async () => {
    query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.getCurrent('tenant-a')).rejects.toThrow(
      'database unavailable',
    );
  });
});
