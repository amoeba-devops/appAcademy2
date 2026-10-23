import { FeedbackMailerService } from './feedback-mailer.service';
describe('teacher feedback send idempotency', () => {
  const input = {
    recipients: [{ stdId: 's', parId: 'p' }],
    requestId: 'k',
    expectedUpdatedAt: '2026-10-13T00:00:00.000Z',
  };
  function setup() {
    const service = Object.create(
      FeedbackMailerService.prototype,
    ) as FeedbackMailerService;
    const rows: { hash: string; result: unknown }[] = [];
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('SELECT')) return rows;
      if (sql.startsWith('INSERT')) {
        rows.push({ hash: String(params[4]), result: null });
        return [{ id: 'claim' }];
      }
      if (sql.startsWith('UPDATE')) {
        rows[0].result = params[3];
        return [];
      }
    });
    const send = jest.fn(async () => ({
      results: [{ stdId: 's', parId: 'p', status: 'SENT' as const }],
    }));
    Object.assign(service, {
      ds: { query },
      reviews: {
        findOne: async () => ({
          updatedAt: new Date(input.expectedUpdatedAt),
          feedbackHtml: 'Saved content',
        }),
      },
      sendFeedbackEmail: send,
    });
    return { service, send };
  }
  it('replays result without sending twice', async () => {
    const { service, send } = setup();
    const a = await service.sendForTeacher('e', 'evt', 't', input);
    const b = await service.sendForTeacher('e', 'evt', 't', input);
    expect(a).toEqual(b);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('rejects stale feedback and reused key for other recipients', async () => {
    const { service, send } = setup();
    await expect(
      service.sendForTeacher('e', 'evt', 't', {
        ...input,
        expectedUpdatedAt: 'old',
      }),
    ).rejects.toThrow('FEEDBACK_CHANGED');
    expect(send).not.toHaveBeenCalled();
    await service.sendForTeacher('e', 'evt', 't', input);
    await expect(
      service.sendForTeacher('e', 'evt', 't', {
        ...input,
        recipients: [{ stdId: 'x', parId: 'y' }],
      }),
    ).rejects.toThrow('SEND_KEY_REUSED');
  });
  it('retains an uncertain claim after transport failure', async () => {
    const { service, send } = setup();
    send.mockRejectedValueOnce(new Error('lost response'));
    await expect(
      service.sendForTeacher('e', 'evt', 't', input),
    ).rejects.toThrow('lost response');
    await expect(
      service.sendForTeacher('e', 'evt', 't', input),
    ).rejects.toThrow('SEND_IN_PROGRESS_OR_UNCERTAIN');
    expect(send).toHaveBeenCalledTimes(1);
  });
});

import { PortalCalController } from '../presentation/portal-cal.controller';
describe('teacher email authorization', () => {
  it('denies students and a different teacher before accessing parent addresses', async () => {
    const controller = Object.create(
      PortalCalController.prototype,
    ) as PortalCalController;
    const listRecipients = jest.fn();
    const assertAssignee = jest.fn((assigned: string, actual: string) => {
      if (assigned !== actual) throw new Error('NOT_ASSIGNEE_TEACHER');
    });
    Object.assign(controller, {
      svc: {
        ensurePortalEventAccess: async () => {},
        getEventMeta: async () => ({ assigneeTchId: 'assigned' }),
      },
      reviewSvc: { assertAssignee },
      feedbackMailer: { listRecipients },
    });
    await expect(
      controller.feedbackRecipients(
        { kind: 'STUDENT', entId: 'e', refId: 's' } as never,
        'event',
      ),
    ).rejects.toThrow('TEACHER_ONLY');
    await expect(
      controller.feedbackRecipients(
        { kind: 'TEACHER', entId: 'e', refId: 'other' } as never,
        'event',
      ),
    ).rejects.toThrow('NOT_ASSIGNEE_TEACHER');
    expect(listRecipients).not.toHaveBeenCalled();
  });
});

describe('feedback recipients (REQ-261023 §5)', () => {
  it('includes current class enrollees as well as STUDENT invitees', async () => {
    const service = Object.create(FeedbackMailerService.prototype) as FeedbackMailerService;
    const query = jest.fn(async () => [{ stdId: 'cls-std' }]);
    const studentsFind = jest.fn(async ({ where }: { where: { id: { _value: string[] } } }) =>
      where.id._value.map((id) => ({ id, name: id })),
    );
    Object.assign(service, {
      ds: { query },
      invitees: { find: async () => [{ refId: 'inv-std' }] },
      students: { find: studentsFind },
      studentParents: {
        find: async () => [
          { stdId: 'cls-std', parId: 'p1', isPrimary: true },
          { stdId: 'inv-std', parId: 'p2', isPrimary: true },
        ],
      },
      parents: {
        find: async () => [
          { id: 'p1', name: 'P1', email: 'p1@x.test' },
          { id: 'p2', name: 'P2', email: 'p2@x.test' },
        ],
      },
    });
    const out = await (
      service as unknown as { resolveStudents(e: string, v: string): Promise<{ stdId: string; parents: { parId: string }[] }[]> }
    ).resolveStudents('e', 'evt');
    expect(out.map((s) => s.stdId).sort()).toEqual(['cls-std', 'inv-std']);
    expect(String(query.mock.calls[0][0])).toContain('cst_left_at IS NULL');
    expect(out.find((s) => s.stdId === 'cls-std')?.parents.map((p) => p.parId)).toEqual(['p1']);
  });
});
