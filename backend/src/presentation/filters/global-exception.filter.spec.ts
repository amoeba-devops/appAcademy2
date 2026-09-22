import { HttpStatus, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

/** FIX-260922 — PG unique_violation → 409, 그 외 비HTTP 예외 → 500 + 로그. */
describe('GlobalExceptionFilter', () => {
  const run = (exception: unknown) => {
    const json = jest.fn((_body: unknown) => undefined);
    const status = jest.fn((_code: number) => ({ json }));
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'POST', originalUrl: '/api/x' }),
      }),
    } as unknown as ArgumentsHost;
    new GlobalExceptionFilter().catch(exception, host);
    return {
      status: status.mock.calls[0][0] as number,
      body: json.mock.calls[0][0] as unknown,
    };
  };

  it('maps a TypeORM unique violation to 409 UNIQUE_VIOLATION with the constraint name', () => {
    const err = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      {
        name: 'QueryFailedError',
        driverError: { code: '23505', constraint: 'uq_acm_std_ent_name' },
      },
    );
    const out = run(err);
    expect(out.status).toBe(HttpStatus.CONFLICT);
    expect(out.body).toEqual({
      success: false,
      error: { code: 'UNIQUE_VIOLATION', message: 'uq_acm_std_ent_name' },
    });
  });

  it('keeps HttpException status/code', () => {
    const out = run(new NotFoundException('STUDENT_NOT_FOUND'));
    expect(out.status).toBe(404);
    expect(out.body).toMatchObject({ error: { message: 'STUDENT_NOT_FOUND' } });
  });

  it('returns 500 INTERNAL_ERROR for other errors', () => {
    const out = run(new Error('boom'));
    expect(out.status).toBe(500);
    expect(out.body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });
});
