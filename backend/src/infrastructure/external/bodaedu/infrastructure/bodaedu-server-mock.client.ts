import { Injectable, Logger } from '@nestjs/common';
import type {
  BodaCloseRequest,
  BodaJoinLogEntry,
  BodaMeetInfo,
} from '../bodaedu.types';
import type { IBodaeduServerClient } from '../interfaces/bodaedu-server-api.interface';

/**
 * Mock BODA SERVER API client. Activated by `BODA_MODE=mock` (default).
 *
 * 외부 vendor (㈜새하컴즈) 가 ACM Webhook URL 등록을 마치고 Q1·Q2 회신을
 * 줄 때까지 development / staging 에서 BODA 호출이 깨지지 않게 해주는
 * fixture. dev 가 `meetKey` 끝 글자로 분기를 강제할 수 있도록 가벼운
 * convention 을 둔다:
 *
 *   tac-…0         (대부분)  → STARTED 상태, 입장 2명
 *   tac-…1         → ENDED 상태 (출결 reconcile 시연용)
 *   tac-…2         → PENDING (강사 아직 안 들어옴)
 *   tac-…f         → throws (5xx 시뮬레이션)
 */
@Injectable()
export class BodaeduServerMockClient implements IBodaeduServerClient {
  private readonly logger = new Logger(BodaeduServerMockClient.name);

  async getMeetInfo(meetKey: string): Promise<BodaMeetInfo | null> {
    const tag = meetKey.slice(-1).toLowerCase();
    if (tag === 'f') {
      throw new Error(`MOCK_FAIL: simulated 5xx for meetKey=${meetKey}`);
    }
    if (tag === '2') {
      this.logger.debug(`mock getMeetInfo ${meetKey} → PENDING`);
      return {
        meetKey,
        meetIdx: null,
        status: 'PENDING',
      };
    }
    if (tag === '1') {
      this.logger.debug(`mock getMeetInfo ${meetKey} → ENDED`);
      return {
        meetKey,
        meetIdx: `m-${meetKey.slice(4, 12)}`,
        status: 'ENDED',
        openedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
        startedAt: new Date(Date.now() - 55 * 60_000).toISOString(),
        endedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
        currentUserCount: 0,
      };
    }
    this.logger.debug(`mock getMeetInfo ${meetKey} → STARTED`);
    return {
      meetKey,
      meetIdx: `m-${meetKey.slice(4, 12)}`,
      status: 'STARTED',
      openedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      startedAt: new Date(Date.now() - 8 * 60_000).toISOString(),
      currentUserCount: 2,
    };
  }

  async closeMeet(req: BodaCloseRequest): Promise<void> {
    if (req.meetKey.endsWith('f')) {
      throw new Error(`MOCK_FAIL: simulated 5xx on closeMeet ${req.meetKey}`);
    }
    this.logger.debug(
      `mock closeMeet ${req.meetKey} reason=${req.reason ?? 'unspecified'}`,
    );
  }

  async getJoinLog(meetKey: string): Promise<BodaJoinLogEntry[]> {
    if (meetKey.endsWith('f')) {
      throw new Error(`MOCK_FAIL: simulated 5xx on getJoinLog ${meetKey}`);
    }
    const base = Date.now() - 60 * 60_000;
    return [
      {
        meetKey,
        userId: 'ama-user-mgr-1', // 강사 김교사 (ama-platform mock 와 동일 id 체계)
        joinedAt: new Date(base + 0).toISOString(),
        leftAt: new Date(base + 50 * 60_000).toISOString(),
        totalSeconds: 50 * 60,
        clientType: 'native',
      },
      {
        meetKey,
        userId: 'ama-user-mem-1', // 학생 박조교
        joinedAt: new Date(base + 2 * 60_000).toISOString(),
        leftAt: new Date(base + 48 * 60_000).toISOString(),
        totalSeconds: 46 * 60,
        clientType: 'native',
      },
    ];
  }

  // PLN-260728F C — mock: 녹화 없음.
  async listRecordings(): Promise<
    import('../bodaedu.types').BodaRecordingEntry[]
  > {
    return [];
  }

  async downloadRecording(): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string | null;
    contentLength: number | null;
  }> {
    throw new Error('MOCK_NO_RECORDING');
  }
}
