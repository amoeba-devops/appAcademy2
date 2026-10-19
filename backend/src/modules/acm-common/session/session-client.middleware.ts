import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { parseSessionClient, runWithSessionClient } from './session-client';

/** REQ-261019B — `X-ACM-Client` 헤더를 요청 문맥에 담는다. */
@Injectable()
export class SessionClientMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    runWithSessionClient(parseSessionClient(req.headers['x-acm-client']), next);
  }
}
