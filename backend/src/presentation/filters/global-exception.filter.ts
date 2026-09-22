import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** PostgreSQL SQLSTATE — unique_violation. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * TypeORM QueryFailedError 는 driverError 에 PG 오류(code/constraint)를 싣는다.
 * 클래스 import 없이 구조로 판별해 필터가 ORM 에 결합되지 않게 한다.
 */
function pgErrorOf(
  exception: unknown,
): { code?: string; constraint?: string } | null {
  if (!exception || typeof exception !== 'object') return null;
  const e = exception as {
    code?: unknown;
    constraint?: unknown;
    driverError?: { code?: unknown; constraint?: unknown };
  };
  const src = e.driverError ?? e;
  const code = typeof src.code === 'string' ? src.code : undefined;
  const constraint =
    typeof src.constraint === 'string' ? src.constraint : undefined;
  return code ? { code, constraint } : null;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    const pg = pgErrorOf(exception);
    if (
      !(exception instanceof HttpException) &&
      pg?.code === PG_UNIQUE_VIOLATION
    ) {
      // FIX-260922 — DB 유니크 제약 위반은 클라이언트가 고칠 수 있는 충돌이다.
      // 500 대신 409 + 제약 이름을 돌려 UI 가 안내할 수 있게 한다.
      status = HttpStatus.CONFLICT;
      code = 'UNIQUE_VIOLATION';
      message = pg.constraint ?? 'UNIQUE_VIOLATION';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        code = `HTTP_${status}`;
      } else {
        const obj = res as { code?: string; message?: string | string[] };
        code = obj.code ?? `HTTP_${status}`;
        message = obj.message ?? `HTTP_${status}`;
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // FIX-260922 — 이전에는 5xx 원인이 어디에도 남지 않아 프로덕션 진단이 불가했다.
      const err = exception instanceof Error ? exception : null;
      this.logger.error(
        `${request?.method ?? '-'} ${request?.originalUrl ?? request?.url ?? '-'} → ${status} ${
          err ? `${err.name}: ${err.message}` : String(exception)
        }`,
        err?.stack,
      );
    }

    response.status(status).json({
      success: false,
      error: { code, message },
    });
  }
}
