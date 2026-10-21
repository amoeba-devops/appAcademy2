import {
  changedFields,
  createdId,
  decide,
  fileNameOf,
  menuOf,
  resultOf,
} from './activity-rules';

const d = (
  method: string,
  routePattern: string,
  params: Record<string, string> = {},
  meta = {},
) => decide({ method, routePattern, params, meta });

describe('activity rules (PLN-261022)', () => {
  it('maps HTTP methods to actions and infers the target', () => {
    expect(d('PATCH', '/api/acm/std/students/:id', { id: 's1' })).toMatchObject(
      {
        action: 'UPDATE',
        menu: 'std',
        actorKind: 'CONSOLE',
        targetType: 'student',
        targetId: 's1',
      },
    );
    expect(
      d('DELETE', '/api/acm/tch/teachers/:id', { id: 't1' }),
    ).toMatchObject({ action: 'DELETE', targetType: 'teacher' });
    expect(d('POST', '/api/acm/std/students')).toMatchObject({
      action: 'CREATE',
      targetType: 'student',
      targetId: null,
    });
  });
  it('treats a verb on an entity as UPDATE and a sub-collection as CREATE', () => {
    expect(
      d('POST', '/api/acm/system/users/:id/lock', { id: 'u1' })?.action,
    ).toBe('UPDATE');
    expect(
      d('POST', '/api/acm/prj/projects/:id/items', { id: 'p1' }),
    ).toMatchObject({
      action: 'CREATE',
      targetType: 'project',
      targetId: 'p1',
    });
  });
  it('ignores reads unless marked, and portal reads entirely', () => {
    expect(d('GET', '/api/acm/std/students/:id', { id: 's1' })).toBeNull();
    expect(
      d(
        'GET',
        '/api/acm/std/students/:id',
        { id: 's1' },
        { action: 'READ', target: 'student' },
      )?.action,
    ).toBe('READ');
    expect(
      d('GET', '/api/portal/materials/:id', { id: 'm' }, { action: 'READ' }),
    ).toBeNull();
    expect(
      d(
        'GET',
        '/api/portal/materials/:id/download',
        { id: 'm' },
        { action: 'DOWNLOAD' },
      ),
    ).toMatchObject({ actorKind: 'PORTAL' });
  });
  it('excludes auth, webhooks, public intake, audit API and noise', () => {
    for (const p of [
      '/api/acm/auth/login',
      '/api/portal/auth/logout',
      '/api/auth/parent/verify-otp',
      '/api/webhooks/boda',
      '/api/web/external-intake',
      '/api/acm/audit/policy',
      '/api/acm/notifications/inbox/:id/read',
      '/api/acm/talk/rooms/:id/typing',
    ])
      expect(d('POST', p)).toBeNull();
    expect(d('POST', '/api/acm/x', {}, { skip: true })).toBeNull();
  });
  it('uses an explicit param for the target id', () => {
    expect(
      d(
        'POST',
        '/api/acm/cal/events/:id/recordings/:recordIdx/ticket',
        { id: 'e1', recordIdx: '0' },
        { action: 'DOWNLOAD', target: 'event', param: 'id' },
      ),
    ).toMatchObject({ targetType: 'event', targetId: 'e1' });
  });
  it('derives menus', () => {
    expect(menuOf('/api/acm/admin/mail-config')).toBe('config');
    expect(menuOf('/api/admin/cal/events/:id')).toBe('cal');
    expect(menuOf('/api/enrollments/:id')).toBe('enrollments');
  });
  it('records field names only and masks sensitive keys', () => {
    expect(
      changedFields({
        name: 'x',
        phone: '010',
        newPassword: 'p',
        admissionDate: '2025-03-02',
        entId: 'e',
      }),
    ).toBe('name,***,admissionDate');
    expect(changedFields([1, 2])).toBeNull();
    expect(changedFields({})).toBeNull();
  });
  it('reads created ids, results and file names', () => {
    expect(createdId({ id: 'a' })).toBe('a');
    expect(createdId({ data: { stdId: 'b' } })).toBe('b');
    expect(createdId({ ok: true })).toBeNull();
    expect([
      resultOf(201),
      resultOf(403),
      resultOf(401),
      resultOf(409),
      resultOf(500),
    ]).toEqual(['SUCCESS', 'DENIED', 'DENIED', 'FAILURE', 'FAILURE']);
    expect(
      fileNameOf(
        `attachment; filename="a%20b.pdf"; filename*=UTF-8''%ED%95%9C.pdf`,
      ),
    ).toBe('한.pdf');
    expect(fileNameOf('attachment; filename="bills.xlsx"')).toBe('bills.xlsx');
  });
});
