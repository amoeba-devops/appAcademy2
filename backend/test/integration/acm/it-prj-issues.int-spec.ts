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
       CREATE TABLE amb_acm_user_permission(ent_id uuid,usr_id uuid,upr_permission text);
       CREATE TABLE amb_acm_tch_teacher(tch_id uuid PRIMARY KEY,ent_id uuid,tch_user_id uuid,deleted_at timestamptz);
       CREATE TABLE amb_acm_notification_outbox(nob_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ent_id uuid,nob_type varchar(32),nob_target_id uuid,nob_actor_id uuid,nob_payload jsonb,nob_recipients jsonb,created_at timestamptz DEFAULT now());
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
    // REQ-261016D — 유형 2종 + 담당 이력. 두 번 적용해도 안전해야 한다.
    await ds.query(sql('1042-prj-issue-types-assignee-log.sql'));
    await ds.query(sql('1042-prj-issue-types-assignee-log.sql'));
    // PLN-261027B — 프로젝트 숨김 삭제 + 프로젝트 변경 이력.
    await ds.query(sql('1055-prj-project-soft-delete-move-log.sql'));
    await ds.query(sql('1055-prj-project-soft-delete-move-log.sql'));
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
      issueType: 'OTHER',
      priority: 2,
      assigneeId: member.id,
      dueDate: '2026-10-20',
      startDate: '2026-10-16',
    });
    issueId = row.pit_id as string;
    expect(row).toMatchObject({
      pit_status: 'OPEN',
      pit_issue_type: 'OTHER',
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
      types: 'OTHER',
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
    const detail = (await issues.get(member, childId)) as Record<
      string,
      unknown
    > & { attachments: unknown[] };
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
    const kept = (await issues.get(owner, childId)) as Record<
      string,
      unknown
    > & { attachments: unknown[] };
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
    const moved = (await issues.get(owner, childId)) as Record<
      string,
      unknown
    > & { attachments: unknown[] };
    expect(
      Date.now() - new Date(moved.assigned_at as string).getTime(),
    ).toBeLessThan(60_000);
    expect(moved.attachments).toHaveLength(0);
  });

  it('issue types are limited to TASK and OTHER', async () => {
    await expect(
      ds.query(
        `UPDATE amb_acm_prj_item SET pit_issue_type='BUG' WHERE pit_id=$1`,
        [issueId],
      ),
    ).rejects.toThrow();
  });

  it('assignee is changed by select-then-assign with history', async () => {
    const before = await issues.get(member, issueId);
    expect(before.assignee_id).toBe(member.id);
    await expect(
      issues.changeAssignee(member, issueId, outsider.id),
    ).rejects.toThrow();
    const after = (await issues.changeAssignee(
      member,
      issueId,
      owner.id,
    )) as Record<string, unknown>;
    expect(after.assignee_id).toBe(owner.id);
    expect(after.assigned_at).toBeTruthy();
    // 수정(PUT)에서 담당자를 생략하면 유지된다
    await projects.saveItem(
      owner,
      projectId,
      { kind: 'ISSUE', title: '출결 알림 누락', issueType: 'OTHER' },
      issueId,
    );
    expect((await issues.get(owner, issueId)).assignee_id).toBe(owner.id);
    const cleared = await issues.changeAssignee(owner, issueId, null);
    expect(cleared.assignee_id).toBeNull();
    const logs = await issues.statusLogs(owner, issueId);
    const assigns = logs.filter((l) => l.psl_kind === 'ASSIGNEE');
    expect(assigns).toHaveLength(2);
    expect(assigns[1]).toMatchObject({
      from_user_name: 'staff',
      to_user_name: 'admin',
    });
  });

  it('mentions notify only newly mentioned project members, never the author', async () => {
    const tag = (u: AcmCurrentUser) =>
      `<span data-type="mention" data-id="${u.id}" data-label="x">@x</span>`;
    const outbox = async () =>
      ds.query<
        { nob_payload: Record<string, unknown>; nob_recipients: unknown }[]
      >(
        `SELECT nob_payload,nob_recipients FROM amb_acm_notification_outbox WHERE nob_type='ISSUE_MENTION' ORDER BY created_at`,
      );
    await ds.query(`DELETE FROM amb_acm_notification_outbox`);
    // 설명: member(참여자) + outsider(비참여) + owner 본인 → member 만
    const created = await projects.saveItem(owner, projectId, {
      kind: 'ISSUE',
      title: '멘션 테스트',
      body: `<p>${tag(member)} ${tag(outsider)} ${tag(owner)}</p>`,
    });
    let rows = await outbox();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0].nob_recipients)).toContain(member.id);
    expect(JSON.stringify(rows[0].nob_recipients)).not.toContain(outsider.id);
    // 같은 멘션으로 다시 저장해도 재알림 없음
    await projects.saveItem(
      owner,
      projectId,
      {
        kind: 'ISSUE',
        title: '멘션 테스트',
        body: `<p>${tag(member)} 수정</p>`,
      },
      created.pit_id as string,
    );
    expect(await outbox()).toHaveLength(1);
    // 댓글 멘션 → commentId 포함
    await issues.addComment(
      owner,
      created.pit_id as string,
      `<p>${tag(member)}</p>`,
    );
    rows = await outbox();
    expect(rows).toHaveLength(2);
    expect(rows[1].nob_payload.commentId).toBeTruthy();
    expect(String(rows[1].nob_payload.title)).toContain('멘션 테스트');
  });

  it('comments accept rich text and reject empty HTML', async () => {
    const list = await issues.addComment(
      member,
      issueId,
      '<p><strong>확인</strong> 완료</p>',
    );
    expect(list.at(-1)?.pic_body).toBe('<p><strong>확인</strong> 완료</p>');
    await expect(
      issues.addComment(member, issueId, '<p> </p><p>&nbsp;</p>'),
    ).rejects.toThrow();
  });

  it('delete is limited to the reporter or a project manager', async () => {
    const [legacy] = await ds.query<{ pit_id: string }[]>(
      `SELECT pit_id FROM amb_acm_prj_item WHERE pit_title='legacy todo'`,
    );
    await expect(issues.remove(member, legacy.pit_id)).rejects.toThrow();
    await issues.remove(owner, legacy.pit_id);
    expect((await issues.list(owner, {})).total).toBe(4);
  });

  // PLN-261027B — 서비스 관리자(관리자 등급 + 서비스 운영자/테넌트 마스터)
  describe('service operator & moving issues', () => {
    const operator = user('ADMIN');
    const plainAdmin = user('ADMIN');
    let target: string;
    let moved: string;
    let child: string;
    let fileId: string;

    beforeAll(async () => {
      for (const u of [operator, plainAdmin])
        await ds.query(
          `INSERT INTO amb_acm_user VALUES($1,$2,'op','op','ACTIVE','ADMIN')`,
          [u.id, ent],
        );
      await ds.query(
        `INSERT INTO amb_acm_user_permission VALUES($1,$2,'CONFIG_ADMIN')`,
        [ent, operator.id],
      );
      target = (
        await projects.save(member, {
          title: 'Spring',
          ownerId: member.id,
          memberIds: [],
        })
      ).prj_id;
    });

    it('operator sees and edits projects without joining them', async () => {
      const list = await projects.list(operator);
      expect(list.map((p) => [p.prj_title, p.is_member, p.can_manage])).toEqual(
        expect.arrayContaining([
          ['Winter', false, true],
          ['Spring', false, true],
        ]),
      );
      expect(await projects.list(plainAdmin)).toEqual([]);
      await expect(projects.detail(plainAdmin, target)).rejects.toThrow();
      await projects.save(
        operator,
        {
          title: 'Spring 2',
          ownerId: member.id,
          memberIds: [],
          status: 'ARCHIVED',
        },
        target,
      );
      // 보관된 프로젝트도 서비스 관리자가 다시 활성화할 수 있다.
      const back = await projects.save(
        operator,
        {
          title: 'Spring',
          ownerId: member.id,
          memberIds: [],
          status: 'ACTIVE',
        },
        target,
      );
      expect(back.prj_status).toBe('ACTIVE');
      const detail = await projects.detail(operator, target);
      expect(detail.members.map((m) => m.id)).toEqual([member.id]);
      expect(detail.is_member).toBe(false);
    });

    it('moves an issue with cleanup and history', async () => {
      [{ pit_id: fileId }] = await ds.query<{ pit_id: string }[]>(
        `INSERT INTO amb_acm_prj_item(ent_id,prj_id,pit_kind,pit_title,created_by) VALUES($1,$2,'FILE','plan.pdf',$3) RETURNING pit_id`,
        [ent, projectId, owner.id],
      );
      moved = (
        await projects.saveItem(owner, projectId, {
          kind: 'ISSUE',
          title: '옮길 이슈',
          assigneeId: owner.id,
          parentId: issueId,
          participantIds: [member.id],
          attachments: [{ fileItemId: fileId, name: 'plan.pdf' }],
        })
      ).pit_id as string;
      child = (
        await projects.saveItem(owner, projectId, {
          kind: 'ISSUE',
          title: '하위',
          parentId: moved,
        })
      ).pit_id as string;
      // 대상 프로젝트에 참여하지 않은 사람은 옮길 수 없다.
      await expect(issues.move(owner, moved, target)).rejects.toThrow();
      await expect(issues.move(plainAdmin, moved, target)).rejects.toThrow();

      const after = (await issues.move(operator, moved, target)) as Record<
        string,
        unknown
      > & { attachments: Record<string, unknown>[] };
      expect(after).toMatchObject({
        prj_id: target,
        assignee_id: null, // owner 는 Spring 참여자가 아님
        pit_parent_id: null,
        participant_ids: [member.id],
      });
      expect(after.attachments).toEqual([
        expect.objectContaining({ file_item_id: fileId, file_available: true }),
      ]);
      const [file] = await ds.query<{ prj_id: string }[]>(
        'SELECT prj_id FROM amb_acm_prj_item WHERE pit_id=$1',
        [fileId],
      );
      expect(file.prj_id).toBe(target);
      const [c] = await ds.query<{ pit_parent_id: string | null }[]>(
        'SELECT pit_parent_id FROM amb_acm_prj_item WHERE pit_id=$1',
        [child],
      );
      expect(c.pit_parent_id).toBeNull();
      const [log] = await issues.statusLogs(operator, moved);
      expect(log).toMatchObject({
        psl_kind: 'PROJECT',
        psl_note: 'Winter → Spring',
      });
      // 새 프로젝트 경로로 계속 수정할 수 있다(첨부 유지).
      await projects.saveItem(
        member,
        target,
        {
          kind: 'ISSUE',
          title: '옮긴 이슈',
          attachments: [{ fileItemId: fileId, name: 'plan.pdf' }],
        },
        moved,
      );
      // 참여자는 두 프로젝트 모두 참여하면 옮길 수 있다.
      await issues.move(member, moved, projectId);
      expect((await issues.get(member, moved)).prj_id).toBe(projectId);
    });

    it('keeps a file shared with another issue in the original project', async () => {
      const [{ pit_id: shared }] = await ds.query<{ pit_id: string }[]>(
        `INSERT INTO amb_acm_prj_item(ent_id,prj_id,pit_kind,pit_title,created_by) VALUES($1,$2,'FILE','shared.pdf',$3) RETURNING pit_id`,
        [ent, projectId, owner.id],
      );
      const att = [{ fileItemId: shared, name: 'shared.pdf' }];
      const a = (
        await projects.saveItem(member, projectId, {
          kind: 'ISSUE',
          title: 'A',
          attachments: att,
        })
      ).pit_id as string;
      await projects.saveItem(member, projectId, {
        kind: 'ISSUE',
        title: 'B',
        attachments: att,
      });
      await issues.move(member, a, target);
      const [file] = await ds.query<{ prj_id: string }[]>(
        'SELECT prj_id FROM amb_acm_prj_item WHERE pit_id=$1',
        [shared],
      );
      expect(file.prj_id).toBe(projectId);
      // 옮긴 이슈를 다시 저장해도 기존 첨부는 유지된다.
      await projects.saveItem(
        member,
        target,
        { kind: 'ISSUE', title: 'A2', attachments: att },
        a,
      );
      const detail = (await issues.get(member, a)) as unknown as {
        attachments: Record<string, unknown>[];
      };
      expect(detail.attachments).toEqual([
        expect.objectContaining({
          file_item_id: shared,
          file_available: false,
        }),
      ]);
      await issues.remove(member, a);
    });

    it('only the operator deletes projects, which hides their issues', async () => {
      await issues.move(member, moved, target);
      expect(await projects.counts(operator, target)).toEqual({
        issues: 1,
        files: 1,
        documents: 0,
      });
      await expect(projects.remove(member, target)).rejects.toThrow();
      await expect(projects.remove(plainAdmin, target)).rejects.toThrow();
      await projects.remove(operator, target);
      await expect(projects.remove(operator, target)).rejects.toThrow();
      expect((await projects.list(member)).map((p) => p.prj_title)).toEqual([
        'Winter',
      ]);
      await expect(issues.get(member, moved)).rejects.toThrow();
      await expect(issues.get(operator, moved)).rejects.toThrow();
      expect((await issues.list(operator, { projectId: target })).total).toBe(
        0,
      );
      expect(
        (await issues.myWork(member)).some((i) => i.pit_id === moved),
      ).toBe(false);
    });
  });
});
