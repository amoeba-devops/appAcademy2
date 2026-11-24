import { ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { PortalTeacherStudentsService } from './portal-teacher-students.service';

/** PLN-260719 C — 강사 수강생 목록/상세 스코프. */
describe('PortalTeacherStudentsService', () => {
  function build(router: (sql: string) => unknown[]) {
    const ds = { query: jest.fn(async (sql: string, _params?: unknown[]) => router(sql)) };
    const svc = new PortalTeacherStudentsService(ds as unknown as DataSource);
    return { svc, ds };
  }

  const stdRow = {
    std_id: 's1',
    std_name: '홍길동',
    std_english_name: null,
    std_school: 'ABC중',
    std_grade: 'M2',
    std_subject: 'MATH',
    std_status: 'ACTIVE',
    std_email: 'a@b.c',
    assigned: false,
    in_class: false,
    in_calendar: true,
  };

  it('listMyStudents maps rows to summaries', async () => {
    const { svc } = build((sql) =>
      sql.includes('amb_acm_std_student s') ? [stdRow] : [],
    );
    const r = await svc.listMyStudents('e1', 't1');
    expect(r).toEqual([
      expect.objectContaining({
        id: 's1',
        name: '홍길동',
        school: 'ABC중',
        sources: ['CALENDAR'],
      }),
    ]);
  });

  it('getMyStudent 403 when the student is not mine', async () => {
    const { svc } = build(() => []); // 목록이 비어 있음 → 접근 불가
    await expect(svc.getMyStudent('e1', 't1', 'sX')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('excludes withdrawn students by default without changing the tenant/teacher scope', async () => {
    const { svc, ds } = build(() => []);
    await svc.listMyStudents('tenant-a', 'teacher-a');
    const [sql, params] = ds.query.mock.calls[0];
    expect(params).toEqual(['tenant-a', 'teacher-a', false]);
    expect(sql).toContain("AND ($3::boolean OR s.std_status <> 'WITHDRAWN')");
    expect(sql).toContain('WHERE s.ent_id = $1 AND s.deleted_at IS NULL');
    expect(sql).toContain('WHERE x.assigned OR x.in_class OR x.in_calendar');
  });

  it('includes withdrawn students only when requested explicitly', async () => {
    const { svc, ds } = build(() => [{ ...stdRow, std_status: 'WITHDRAWN' }]);
    const students = await svc.listMyStudents('tenant-a', 'teacher-a', true);
    expect(ds.query).toHaveBeenCalledWith(expect.any(String), ['tenant-a', 'teacher-a', true]);
    expect(students[0].status).toBe('WITHDRAWN');
  });

  it('allows related withdrawn student details independently of the default list filter', async () => {
    const { svc, ds } = build((sql) => {
      if (sql.includes('AS in_calendar')) return [{ ...stdRow, std_status: 'WITHDRAWN' }];
      if (sql.includes('std_phone')) return [{ std_phone: null, std_start_date: null }];
      return [];
    });
    const student = await svc.getMyStudent('tenant-a', 'teacher-a', 's1');
    expect(student.status).toBe('WITHDRAWN');
    expect(ds.query).toHaveBeenNthCalledWith(1, expect.any(String), ['tenant-a', 'teacher-a', true]);
  });

  it('getMyStudent returns detail + inquiry + remarks + events', async () => {
    const { svc } = build((sql) => {
      if (sql.includes('AS in_calendar')) return [stdRow];
      if (sql.includes('std_phone')) {
        return [
          {
            std_phone: '010',
            std_start_date: '2026-01-01',
            std_special_note: 'private note must not leave the portal API',
            std_goals_note: null,
          },
        ];
      }
      if (sql.includes('amb_acm_csl_inquiry')) {
        return [
          { inq_id: 'i1', inq_seq_no: 12, inq_current_stage: 'ATTENDING' },
        ];
      }
      if (sql.includes('amb_acm_csl_remark')) {
        return [{ body: '상담메모', created_at: '2026-07-01T00:00:00Z' }];
      }
      if (sql.includes('amb_acm_cal_event')) {
        return [
          {
            evt_id: 'ev1',
            evt_title: '정규수업',
            evt_category: 'REGULAR_CLASS',
            evt_start_at: '2026-07-18T01:00:00Z',
            evt_end_at: '2026-07-18T02:00:00Z',
          },
        ];
      }
      return [];
    });
    const r = await svc.getMyStudent('e1', 't1', 's1');
    expect(r.sourceInquiry).toMatchObject({
      seqNo: 12,
      currentStage: 'ATTENDING',
    });
    expect(r).not.toHaveProperty('specialNote');
    expect(r.remarks[0].body).toBe('상담메모');
    expect(r.recentEvents[0]).toMatchObject({ title: '정규수업' });
  });
});
