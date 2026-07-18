import { ForbiddenException } from '@nestjs/common';
import { PortalTeacherStudentsService } from './portal-teacher-students.service';

/** PLN-260719 C — 강사 수강생 목록/상세 스코프. */
describe('PortalTeacherStudentsService', () => {
  function build(router: (sql: string) => any[]) {
    const ds = { query: jest.fn(async (sql: string) => router(sql)) };
    const svc = new PortalTeacherStudentsService(ds as any);
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
  };

  it('listMyStudents maps rows to summaries', async () => {
    const { svc } = build((sql) =>
      sql.includes('amb_acm_std_student s') ? [stdRow] : [],
    );
    const r = await svc.listMyStudents('e1', 't1');
    expect(r).toEqual([
      expect.objectContaining({ id: 's1', name: '홍길동', school: 'ABC중' }),
    ]);
  });

  it('getMyStudent 403 when the student is not mine', async () => {
    const { svc } = build(() => []); // 목록이 비어 있음 → 접근 불가
    await expect(svc.getMyStudent('e1', 't1', 'sX')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('getMyStudent returns detail + inquiry + remarks + events', async () => {
    const { svc } = build((sql) => {
      if (sql.includes('SELECT DISTINCT s.std_id')) return [stdRow];
      if (sql.includes('std_phone')) {
        return [
          {
            std_phone: '010',
            std_start_date: '2026-01-01',
            std_special_note: null,
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
    expect(r.remarks[0].body).toBe('상담메모');
    expect(r.recentEvents[0]).toMatchObject({ title: '정규수업' });
  });
});
