import { ForbiddenException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * 프로젝트 ACM 저장소 파일 다운로드용 5분 링크(HMAC 서명). 새 창은 로그인 토큰 헤더를 보낼 수 없어서
 * 권한 확인을 마친 시점에 짧은 링크를 발급하고, 내용 라우트는 이 서명만 검증한다.
 */
const TTL_SEC = 300;
interface FileTicket {
  ent: string;
  prj: string;
  item: string;
}

const secret = () =>
  `${process.env.ACM_JWT_SECRET || 'acm-dev-secret-change-in-production'}:prj-file`;
const b64 = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const mac = (body: string) =>
  createHmac('sha256', secret()).update(body).digest('base64url');

export function signFileTicket(t: FileTicket, now = Date.now()): string {
  const body = b64(
    JSON.stringify({ ...t, exp: Math.floor(now / 1000) + TTL_SEC }),
  );
  return `${body}.${mac(body)}`;
}

export function verifyFileTicket(ticket: string, now = Date.now()): FileTicket {
  const [body, sig] = String(ticket ?? '').split('.');
  if (!body || !sig) throw new ForbiddenException('INVALID_FILE_TICKET');
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    throw new ForbiddenException('INVALID_FILE_TICKET');
  let p: FileTicket & { exp: number };
  try {
    p = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as FileTicket & { exp: number };
  } catch {
    throw new ForbiddenException('INVALID_FILE_TICKET');
  }
  if (!p.exp || p.exp * 1000 < now)
    throw new ForbiddenException('FILE_TICKET_EXPIRED');
  return { ent: p.ent, prj: p.prj, item: p.item };
}
