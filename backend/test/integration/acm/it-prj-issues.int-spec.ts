import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { ProjectService } from '../../../src/modules/acm-prj/application/project.service';
import { IssueService } from '../../../src/modules/acm-prj/application/issue.service';
import type { AcmCurrentUser } from '../../../src/modules/acm-common/decorators/current-user.decorator';

// REQ-261015C WP3/WP4 — 프로젝트 횡단 이슈·상태 전이·댓글·내 업무.
const sql = (f: string) =>
  readFileSync(resolve(__dirname, '../../../../sql/acm', f), 'utf8');

describe('ACM project issues (PostgreSQL)', () => {
  let container: StartedPostgreSqlContainer;
  let ds: DataSource;
  let projects: ProjectService;
  let issues: IssueService;
  const ent = randomUUID();
  const user = (role: string) =>
    ({ id: randomUUID(), entId: ent, role }) as AcmCurrentUser;
  const owner = user('ADMIN');
  const member = user('STAFF');
  const outsider = user('TEACHER'); // 같은 테넌트, 프로젝트 비참여
  const other = {
    id: randomUUID(),
    entId: randomUUID(),
    role: 'ADMIN',
  } as AcmCurrentUser;
  let projectId: string;
  let issueId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    ds = await new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
    }).initialize();
    await ds.query(
      `CREATE TABLE amb_acm_user(usr_id uuid PRIMARY KEY,ent_id uuid,usr_name text,usr_email text,usr_status text,usr_role text);
       CREATE FUNCTION set_acm_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
         BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;`,
    );
    for (const f of [
      '1032-project-drive.sql',
      '1033-project-workspace.sql',
      '1034-project-parity.sql',
    ])
      await ds.query(sql(f));
    for (const u of [owner, member, outsider, other])
      await ds.query(
        `INSERT INTO amb_acm_user VALUES($1,$2,$3,$3,'ACTIVE',$4)`,
        [u.id, u.entId, (u.role ?? '').toLowerCase(), u.role],
      );
    projects = new ProjectService(ds);
    issues = new IssueService(ds, projects);
    projectId = (
      await projects.save(owner, {
        title: 'Winter',
        ownerId: owner.id,
        memberIds: [member.id],
      })
    ).prj_id;
    // 이행 전 데이터: TODO/DOING 이슈가 1036 에서 OPEN/IN_PROGRESS 로 바뀌어야 한다.
    await ds.query(
      `INSERT INTO amb_acm_prj_item(ent_id,prj_id,pit_kind,pit_title,pit_status,created_by) VALUES($1,$2,'ISSUE','legacy todo','TODO',$3),($1,$2,'ISSUE','legacy doing','DOING',$3)`,
      [ent, projectId, owner.id],
    );
    await ds.query(sql('1036-prj-issue-extend.sql'));
    await ds.query(sql('1036-prj-issue-extend.sql'));
    // REQ-261016C — 번호·상위·참여자·첨부. 두 번 적용해도 번호가 바뀌지 않아야 한다.
    await ds.query(sql('1040-prj-issue-ama-parity.sql'));
    await ds.query(sql('1040-prj-issue-ama-parity.sql'));
  }, 120_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  });

  it('maps legacy statuses to the simplified workflow', async () => {
    const rows = await ds.query<{ pit_title: string; pit_status: string }[]>(
      `SELECT pit_title,pit_status FROM amb_acm_prj_item ORDER BY pit_title`,
    );
    expect(rows).toEqual([
      { pit_title: 'legacy doing', pit_status: 'IN_PROGRESS' },
      { pit_title: 'legacy todo', pit_status: 'OPEN' },
    ]);
  });

  it('creates issues with type/priority and logs the initial status', async () => {
    const row = await projects.saveItem(member, projectId, {
      kind: 'ISSUE',
      title: '출결 알림 누락',
      issueType: 'BUG',
      priority: 2,
      assigneeId: member.id,
      dueDate: '2026-10-20',
      startDate: '2026-10-16',
    });
    issueId = row.pit_id as string;
    expect(row).toMatchObject({
      pit_status: 'OPEN',
      pit_issue_type: 'BUG',
      pit_priority: 2,
    });
    expect(await issues.statusLogs(member, issueId)).toHaveLength(1);
    await expect(
      projects.saveItem(member, projectId, {
        kind: 'ISSUE',
        title: 'bad dates',
        startDate: '2026-10-21',
        dueDate: '2026-10-20',
      }),
    ).rejects.toThrow();
  });

  it('lists issues only from accessible projects with server filters', async () => {
    const all = await issues.list(member, {});
    expect(all.total).toBe(3);
    const bugs = await issues.list(member, {
      types: 'BUG',
      sort: 'priority_asc',
    });
    expect(bugs.items.map((i) => i.pit_title)).toEqual(['출결 알림 누락']);
    expect((await issues.list(member, { scope: 'assigned' })).total).toBe(1);
    expect((await issues.list(member, { q: '알림' })).total).toBe(1);
    expect((await issues.list(member, { q: '%' })).total).toBe(0);
    expect((await issues.list(outsider, {})).total).toBe(0);
    expect((await issues.list(other, {})).total).toBe(0);
    await expect(issues.list(member, { statuses: 'TODO' })).rejects.toThrow();
    await expect(issues.get(outsider, issueId)).rejects.toThrow();
  });

  it('enforces transitions, records history and done time', async () => {
    await issues.changeStatus(member, issueId, 'IN_PROGRESS', '시작');
    await expect(
      issues.changeStatus(member, issueId, 'REJECTED'),
    ).rejects.toThrow();
    const done = await issues.changeStatus(member, issueId, 'DONE');
    expect(done.pit_done_at).toBeTruthy();
    const logs = await issues.statusLogs(member, issueId);
    expect(logs.map((l) => l.to_status)).toEqual([
      'DONE',
      'IN_PROGRESS',
      'OPEN',
    ]);
    const reopened = await issues.changeStatus(member, issueId, 'OPEN');
    expect(reopened.pit_done_at).toBeNull();
  });

  it('comments: author edits, manager deletes, outsiders cannot read', async () => {
    let list = await issues.addComment(member, issueId, ' 확인했습니다 ');
    expect(list[0]).toMatchObject({
      pic_body: '확인했습니다',
      author_id: member.id,
    });
    const commentId = list[0].pic_id as string;
    await expect(
      issues.editComment(owner, issueId, commentId, '수정'),
    ).rejects.toThrow();
    list = await issues.editComment(member, issueId, commentId, '수정됨');
    expect(list[0].pic_body).toBe('수정됨');
    await expect(issues.comments(outsider, issueId)).rejects.toThrow();
    list = await issues.editComment(owner, issueId, commentId, null);
    expect(list).toHaveLength(0);
  });

  it('my work returns assigned or created open issues and recent done ones', async () => {
    const mine = await issues.myWork(member);
    expect(mine.map((i) => i.pit_title)).toEqual(['출결 알림 누락']);
    const ownerWork = await issues.myWork(owner);
    expect(ownerWork.map((i) => i.pit_title).sort()).toEqual([
      'legacy doing',
      'legacy todo',
    ]);
  });

  it('numbers issues per tenant and searches by number', async () => {
    const rows = await ds.query<{ pit_title: string; pit_ref_no: number }[]>(
      `SELECT pit_title,pit_ref_no FROM amb_acm_prj_item WHERE pit_kind='ISSUE' ORDER BY pit_ref_no`,
    );
    expect(rows.map((r) => r.pit_ref_no)).toEqual([1, 2, 3]);
    expect(rows[2].pit_title).toBe('출결 알림 누락');
    const byRef = await issues.list(member, { q: 'ISS-3' });
    expect(byRef.items.map((i) => i.pit_title)).toEqual(['출결 알림 누락']);
  });

  it('parent issue, participants, progress, attachments and assignment time', async () => {
    const child = await projects.saveItem(owner, projectId, {
      kind: 'ISSUE',
      title: '하위 작업',
      assigneeId: owner.id,
      parentId: issueId,
      participantIds: [member.id, owner.id],
      doneRatio: 40,
      attachments: [{ url: 'https://example.com/spec', name: 'spec' }],
    });
    const childId = child.pit_id as string;
    const detail = await issues.get(member, childId);
    expect(detail).toMatchObject({
      pit_parent_id: issueId,
      parent_title: '출결 알림 누락',
      pit_done_ratio: 40,
      participant_ids: [member.id], // 담당자는 참여자에서 제외
    });
    expect(detail.attachments).toEqual([
      expect.objectContaining({
        pia_url: 'https://example.com/spec',
        pia_name: 'spec',
      }),
    ]);
    expect(detail.assigned_at).toBeTruthy();
    // 참여자에게는 내 업무에 보인다
    expect((await issues.myWork(member)).map((i) => i.pit_title)).toContain(
      '하위 작업',
    );

    // 순환·자기 자신·비참여자는 거부
    await expect(
      projects.saveItem(
        member,
        projectId,
        { kind: 'ISSUE', title: '출결 알림 누락', parentId: childId },
        issueId,
      ),
    ).rejects.toThrow();
    await expect(
      projects.saveItem(
        owner,
        projectId,
        { kind: 'ISSUE', title: '하위 작업', parentId: childId },
        childId,
      ),
    ).rejects.toThrow();
    await expect(
      projects.saveItem(owner, projectId, {
        kind: 'ISSUE',
        title: 'x',
        participantIds: [outsider.id],
      }),
    ).rejects.toThrow();

    // 생략한 항목은 유지, 담당 변경 시 배정 시각 갱신, 첨부 목록 교체
    await ds.query(
      `UPDATE amb_acm_prj_item SET assigned_at=now()-interval '3 days' WHERE pit_id=$1`,
      [childId],
    );
    await projects.saveItem(
      owner,
      projectId,
      { kind: 'ISSUE', title: '하위 작업', assigneeId: owner.id },
      childId,
    );
    const kept = await issues.get(owner, childId);
    expect(kept.pit_done_ratio).toBe(40);
    expect(kept.participant_ids).toEqual([member.id]);
    expect(
      Date.now() - new Date(kept.assigned_at as string).getTime(),
    ).toBeGreaterThan(2 * 86_400_000);
    await projects.saveItem(
      owner,
      projectId,
      {
        kind: 'ISSUE',
        title: '하위 작업',
        assigneeId: member.id,
        attachments: [],
      },
      childId,
    );
    const moved = await issues.get(owner, childId);
    expect(
      Date.now() - new Date(moved.assigned_at as string).getTime(),
    ).toBeLessThan(60_000);
    expect(moved.attachments).toHaveLength(0);
  });

  it('delete is limited to the reporter or a project manager', async () => {
    const [legacy] = await ds.query<{ pit_id: string }[]>(
      `SELECT pit_id FROM amb_acm_prj_item WHERE pit_title='legacy todo'`,
    );
    await expect(issues.remove(member, legacy.pit_id)).rejects.toThrow();
    await issues.remove(owner, legacy.pit_id);
    expect((await issues.list(owner, {})).total).toBe(3);
  });
});
