import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { BodaRecordingService } from '../application/boda-recording.service';

/**
 * REQ-260912B — 녹화본 스트리밍 (티켓 인증).
 *
 * `<video src>` 와 다운로드 링크는 Authorization 헤더를 실을 수 없으므로,
 * 권한 검증을 마친 콘솔이 발급받은 **5분짜리 티켓**을 경로에 담아 연다.
 * 티켓에는 entId·evtId·recordIdx 가 서명되어 있어 다른 수업의 녹화로 갈아탈
 * 수 없다.
 *
 * 영상 재생은 seek 할 때마다 Range 요청이 몰리므로 전역 스로틀에서 제외한다.
 */
@ApiTags('acm-cal')
@SkipThrottle()
@Controller('acm/cal/recordings')
export class CalRecordingStreamController {
  constructor(private readonly svc: BodaRecordingService) {}

  @Get(':ticket')
  @ApiOperation({
    summary:
      '녹화본 스트리밍 — 티켓 인증, Range 지원. ?dl=1 이면 첨부파일로 내려받기',
  })
  async stream(
    @Param('ticket') ticket: string,
    @Query('dl') dl: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const claims = this.svc.verifyTicket(ticket);
    const range = dl ? undefined : req.headers.range;
    const out = await this.svc.openStream(
      claims.entId,
      claims.evtId,
      claims.recordIdx,
      range,
    );

    res.setHeader('Content-Type', out.mime);
    res.setHeader('Accept-Ranges', 'bytes');
    // 티켓 URL 이 공유·캐시되지 않도록.
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader(
      'Content-Disposition',
      `${dl ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(
        out.filename,
      )}`,
    );
    if (out.contentLength) res.setHeader('Content-Length', out.contentLength);
    if (out.partial && out.contentRange) {
      res.setHeader('Content-Range', out.contentRange);
      res.status(206);
    }
    out.stream.pipe(res);
  }
}
