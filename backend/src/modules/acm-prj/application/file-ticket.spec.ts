import { ForbiddenException } from '@nestjs/common';
import { signFileTicket, verifyFileTicket } from './file-ticket';

describe('project file download ticket', () => {
  const t = { ent: 'ent-1', prj: 'prj-1', item: 'item-1' };
  const now = Date.UTC(2026, 9, 20, 2, 0, 0);

  it('round-trips within 5 minutes', () => {
    const ticket = signFileTicket(t, now);
    expect(verifyFileTicket(ticket, now + 4 * 60_000)).toEqual(t);
  });

  it('rejects expired, tampered and malformed tickets', () => {
    const ticket = signFileTicket(t, now);
    expect(() => verifyFileTicket(ticket, now + 6 * 60_000)).toThrow(
      ForbiddenException,
    );
    const [body, sig] = ticket.split('.');
    const forged = Buffer.from(
      JSON.stringify({
        ...t,
        item: 'other',
        exp: Math.floor(now / 1000) + 300,
      }),
    ).toString('base64url');
    expect(() => verifyFileTicket(`${forged}.${sig}`, now)).toThrow(
      ForbiddenException,
    );
    expect(() => verifyFileTicket(`${body}.x${sig.slice(1)}`, now)).toThrow(
      ForbiddenException,
    );
    expect(() => verifyFileTicket('garbage', now)).toThrow(ForbiddenException);
    expect(() => verifyFileTicket('', now)).toThrow(ForbiddenException);
  });
});
