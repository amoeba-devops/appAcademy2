import { BadRequestException } from '@nestjs/common';
import {
  TIMELINE_SQL,
  timelinePage,
  timelineParams,
  type TimelineRow,
} from './project-timeline';

// REQ-261112F — 프로젝트 타임라인 파라미터·페이지 나누기.
const row = (n: number): TimelineRow => ({
  kind: 'STATUS',
  eid: `l:${n}`,
  at: new Date(2026, 10, 12, 10, n),
  cursor_at: `2026-11-12T01:${String(n).padStart(2, '0')}:00.123456Z`,
  pit_id: 'p',
  pit_title: 't',
  pit_ref_no: n,
  pit_kind: 'ISSUE',
  document_type: null,
  actor_name: null,
  from_status: 'OPEN',
  to_status: 'DONE',
  from_user_name: null,
  to_user_name: null,
  note: null,
  body: null,
});

describe('project timeline', () => {
  it('defaults to 30 and fetches one extra row', () => {
    const { limit, params } = timelineParams('e', 'p', {});
    expect(limit).toBe(30);
    expect(params).toEqual(['e', 'p', null, null, '', 31]);
  });
  it('passes kind filter and cursor', () => {
    const { params } = timelineParams('e', 'p', {
      kind: 'COMMENT',
      before: '2026-11-12T01:00:00.123456Z',
      beforeId: 'm:1',
      limit: 10,
    });
    expect(params).toEqual([
      'e',
      'p',
      'COMMENT',
      '2026-11-12T01:00:00.123456Z',
      'm:1',
      11,
    ]);
  });
  it('rejects half cursors', () => {
    expect(() => timelineParams('e', 'p', { before: '2026-11-12' })).toThrow(
      BadRequestException,
    );
    expect(() => timelineParams('e', 'p', { beforeId: 'x' })).toThrow(
      BadRequestException,
    );
  });
  it('returns next cursor only when more rows exist', () => {
    const more = timelinePage([row(3), row(2), row(1)], 2);
    expect(more.items).toHaveLength(2);
    expect(more.next).toEqual({
      before: '2026-11-12T01:02:00.123456Z',
      beforeId: 'l:2',
    });
    expect(timelinePage([row(2), row(1)], 2).next).toBeNull();
    expect(timelinePage([], 2)).toEqual({ items: [], next: null });
  });
  it('covers every event source and excludes deleted rows', () => {
    for (const kind of ['CREATE', 'DOCUMENT', 'COMMENT'])
      expect(TIMELINE_SQL).toContain(`'${kind}'`);
    expect(TIMELINE_SQL).toContain('amb_acm_prj_issue_status_log');
    expect(TIMELINE_SQL).toContain('c.deleted_at IS NULL');
    expect(TIMELINE_SQL.match(/i\.deleted_at IS NULL/g)?.length).toBe(4);
  });
});
