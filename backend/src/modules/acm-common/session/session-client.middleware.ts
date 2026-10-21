import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { parseSessionClient, runWithSessionClient } from './session-client';
import { clientIp } from '../http/client-ip';
import { runWithRequestMeta } from '../http/request-meta';

/**
 * REQ-261019B — `X-ACM-Client` 헤더를 요청 문맥에 담는다.
 * REQ-261021B — 감사 기록용 실제 접속 IP·User-Agent 도 함께 담는다.
 */
@Injectable()
export class SessionClientMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const ua = req.headers['user-agent'];
    runWithRequestMeta(
      { ip: clientIp(req), userAgent: (Array.isArray(ua) ? ua[0] : ua ?? '').slice(0, 500) },
      () => runWithSessionClient(parseSessionClient(req.headers['x-acm-client']), next),
    );
  }
}
