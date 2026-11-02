import {
  normalizePersonal,
  normalizeTenant,
  personalOn,
  quietUntil,
  userRolesOf,
} from './notification-catalog';

describe('notification catalog (REQ-261102B)', () => {
  it('defaults keep the current behaviour', () => {
    const c = normalizeTenant(null);
    expect(c.types.CSL_CREATED).toMatchObject({
      inbox: true,
      push: true,
      popup: true,
      roles: ['ADMIN', 'STAFF'],
    });
    expect(c.types.CAL_UPDATED.roles).toEqual(['ADMIN', 'STAFF', 'TEACHER']);
    expect(c.push).toEqual({
      enabled: true,
      chatPreview: true,
      quiet: { on: false, start: '22:00', end: '08:00' },
    });
    expect(c.reminder).toEqual({ first: 5, second: 10 });
  });

  it('keeps fixed channels on and cannot widen roles', () => {
    const c = normalizeTenant({
      types: {
        CSL_CREATED: {
          popup: false,
          inbox: false,
          roles: ['TEACHER', 'ADMIN'],
        },
      },
    });
    expect(c.types.CSL_CREATED.popup).toBe(true);
    expect(c.types.CSL_CREATED.inbox).toBe(false);
    expect(c.types.CSL_CREATED.roles).toEqual(['ADMIN']);
  });

  it('falls back to default reminder hours when the order is wrong', () => {
    expect(
      normalizeTenant({ reminder: { first: 3, second: 6 } }).reminder,
    ).toEqual({
      first: 3,
      second: 6,
    });
    expect(
      normalizeTenant({ reminder: { first: 8, second: 4 } }).reminder,
    ).toEqual({
      first: 5,
      second: 10,
    });
  });

  it('personal settings only turn things off on top of the academy', () => {
    const tenant = normalizeTenant({ types: { CSL_STAGE: { push: false } } });
    const prefs = normalizePersonal({
      types: { CHAT_MESSAGE: { popup: false }, CSL_CREATED: { popup: false } },
    });
    expect(personalOn(tenant, prefs, 'CSL_STAGE', 'push')).toBe(false);
    expect(personalOn(tenant, prefs, 'CHAT_MESSAGE', 'popup')).toBe(false);
    expect(personalOn(tenant, prefs, 'CHAT_MESSAGE', 'push')).toBe(true);
    // 신규 상담 팝업은 항상 켜짐
    expect(personalOn(tenant, prefs, 'CSL_CREATED', 'popup')).toBe(true);
    expect(
      personalOn(
        normalizeTenant({ push: { enabled: false } }),
        null,
        'CHAT_MENTION',
        'push',
      ),
    ).toBe(false);
  });

  it('maps ADMIN to console admin roles', () => {
    expect(userRolesOf(['ADMIN', 'TEACHER'])).toEqual([
      'ADMIN',
      'APP_ADMIN',
      'TEACHER',
    ]);
  });

  describe('quietUntil', () => {
    const q = { on: true, start: '22:00', end: '08:00' };
    it('returns the end time across midnight in the academy time zone', () => {
      // 23:30 KST
      const at = quietUntil(new Date('2026-11-02T14:30:00Z'), 'Asia/Seoul', q);
      expect(at?.toISOString()).toBe('2026-11-02T23:00:00.000Z'); // 08:00 KST next day
      // 07:59 KST
      expect(
        quietUntil(
          new Date('2026-11-02T22:59:00Z'),
          'Asia/Seoul',
          q,
        )?.toISOString(),
      ).toBe('2026-11-02T23:00:00.000Z');
    });
    it('is null outside the window, when off, or when start equals end', () => {
      expect(
        quietUntil(new Date('2026-11-02T03:00:00Z'), 'Asia/Seoul', q),
      ).toBeNull();
      expect(
        quietUntil(new Date('2026-11-02T14:30:00Z'), 'Asia/Seoul', {
          ...q,
          on: false,
        }),
      ).toBeNull();
      expect(
        quietUntil(new Date('2026-11-02T14:30:00Z'), 'Asia/Seoul', {
          ...q,
          end: '22:00',
        }),
      ).toBeNull();
    });
    it('supports a same-day window', () => {
      const at = quietUntil(new Date('2026-11-02T04:10:00Z'), 'Asia/Seoul', {
        on: true,
        start: '12:00',
        end: '14:00',
      });
      expect(at?.toISOString()).toBe('2026-11-02T05:00:00.000Z');
    });
  });
});
