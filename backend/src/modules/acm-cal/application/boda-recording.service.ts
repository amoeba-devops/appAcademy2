import { Readable } from 'stream';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ObjectStoreClient } from '../../acm-csl/infrastructure/external/object-store.client';
import {
  BODAEDU_SERVER_CLIENT,
  BodaeduUnavailableException,
  type IBodaeduServerClient,
} from '../../../infrastructure/external/bodaedu/interfaces/bodaedu-server-api.interface';
import { bodaDatetimeToIso } from '../../../infrastructure/external/bodaedu/bodaedu.types';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import { BodaRoomTypeormEntity } from '../infrastructure/typeorm/boda-room.typeorm-entity';
import {
  BodaRecordingTypeormEntity,
  type BodaRecordingArchiveStatus,
} from '../infrastructure/typeorm/boda-recording.typeorm-entity';
import { BodaConfigService } from './boda-config.service';

/**
 * REQ-260912B — 보다스쿨 녹화본: 메타 동기화 + ACM 서버 보관 + 서빙.
 *
 * 보다 SERVER API(SPEC_823 v823.002)에는 공개 재생 URL 이 없고 Basic 인증
 * 다운로드(`/svr/record/log/video/{recordIdx}/download`)만 있다. 따라서
 *
 *   1) `syncEvent()`   — 녹화 목록을 당겨 `amb_acm_cal_boda_recording` upsert
 *   2) `archiveDue()`  — PENDING 건을 ACM S3 로 복사 (cron, 소량씩)
 *   3) `openStream()`  — ARCHIVED 면 S3(Range 지원), 아니면 보다 직프록시 폴백
 *
 * 로 구성한다. 보관본이 생기면 보다 보관주기가 지나도 재생할 수 있다.
 */

/** 수업(이벤트) 단위 녹화 상태 — 콘솔 배지 표기용. */
export type RecordingEventStatus =
  | 'NOT_APPLICABLE' // 보다스쿨 수업이 아님
  | 'NO_ROOM' // 룸이 만들어지지 않음
  | 'UPCOMING' // 아직 수업 시작 전
  | 'IN_PROGRESS' // 강의실 진행 중 — 녹화 여부 확정 전
  | 'AWAITING' // 종료 직후, 녹화 정보 수신 대기
  | 'NO_RECORDING' // 종료됐고 녹화본 없음
  | 'AVAILABLE'; // 녹화본 있음

export interface RecordingView {
  recordIdx: number;
  title: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  fileExist: boolean;
  archiveStatus: BodaRecordingArchiveStatus;
  sizeBytes: string | null;
  /** 재생/다운로드 가능 여부 — 보관본이 있거나 보다 원본이 남아 있을 때. */
  playable: boolean;
}

export interface RecordingSummary {
  status: RecordingEventStatus;
  roomStatus: string | null;
  counts: { total: number; archived: number; pending: number; failed: number };
  items: RecordingView[];
}

/** 종료 직후 이 시간까지는 "수신 대기"로 본다 (보다 파일 저장 지연 감안). */
const AWAIT_WINDOW_MIN = 30;
/** 길이 미상일 때만 쓰는 버퍼 폴백 상한. */
const MAX_BUFFER_BYTES = 256 * 1024 * 1024;
/** 아카이브 재시도 상한. */
const MAX_ATTEMPTS = 3;
/** 재생 티켓 수명(초) + 용도 클레임. */
const TICKET_TTL_SEC = 300;
const TICKET_PURPOSE = 'cal-recording';

@Injectable()
export class BodaRecordingService {
  private readonly logger = new Logger(BodaRecordingService.name);

  constructor(
    @InjectRepository(BodaRecordingTypeormEntity, ACM_DS)
    private readonly repo: Repository<BodaRecordingTypeormEntity>,
    @InjectRepository(BodaRoomTypeormEntity, ACM_DS)
    private readonly rooms: Repository<BodaRoomTypeormEntity>,
    @InjectRepository(CalEventTypeormEntity, ACM_DS)
    private readonly events: Repository<CalEventTypeormEntity>,
    @Inject(BODAEDU_SERVER_CLIENT)
    private readonly server: IBodaeduServerClient,
    private readonly cfg: BodaConfigService,
    private readonly store: ObjectStoreClient,
    private readonly jwt: JwtService,
  ) {}

  // ---------------------------------------------------------------------------
  // 재생 티켓 — <video> 는 Authorization 헤더를 붙일 수 없다 (REQ-260912B)
  // ---------------------------------------------------------------------------

  /**
   * 단시간(5분) 재생 티켓 발급. 브라우저 `<video src>` / 다운로드 링크가
   * 헤더 없이 스트림 라우트를 열 수 있게 한다. 발급 시점에 이미 권한 검증을
   * 마친 상태여야 한다 (컨트롤러가 assertConsoleAccess 선행).
   */
  issueTicket(input: {
    entId: string;
    evtId: string;
    recordIdx: number;
    actorId: string;
  }): { ticket: string; expiresInSec: number } {
    const ticket = this.jwt.sign(
      {
        purpose: TICKET_PURPOSE,
        entId: input.entId,
        evtId: input.evtId,
        recordIdx: input.recordIdx,
        sub: input.actorId,
      },
      { expiresIn: TICKET_TTL_SEC },
    );
    return { ticket, expiresInSec: TICKET_TTL_SEC };
  }

  /** 티켓 검증 — 위조/만료/용도 불일치는 모두 403. */
  verifyTicket(ticket: string): {
    entId: string;
    evtId: string;
    recordIdx: number;
  } {
    let payload: Record<string, unknown>;
    try {
      payload = this.jwt.verify<Record<string, unknown>>(ticket);
    } catch {
      throw new ForbiddenException('INVALID_TICKET');
    }
    if (
      payload.purpose !== TICKET_PURPOSE ||
      typeof payload.entId !== 'string' ||
      typeof payload.evtId !== 'string' ||
      typeof payload.recordIdx !== 'number'
    ) {
      throw new ForbiddenException('INVALID_TICKET');
    }
    return {
      entId: payload.entId,
      evtId: payload.evtId,
      recordIdx: payload.recordIdx,
    };
  }

  // ---------------------------------------------------------------------------
  // 접근 제어 — 녹화본은 학원 운영자(ADMIN·STAFF)와 강사만 (REQ-260912B)
  // ---------------------------------------------------------------------------

  /**
   * 콘솔 사용자의 녹화본 접근 검증.
   *   ADMIN / STAFF → 테넌트 내 모든 수업
   *   TEACHER       → 본인이 만든 일정 · 담당 강사인 일정 · 강사로 초대된 일정
   *   그 외          → 403
   */
  async assertConsoleAccess(
    entId: string,
    evtId: string,
    actor: { id: string; role: string },
  ): Promise<void> {
    if (actor.role === 'ADMIN' || actor.role === 'STAFF') {
      const exists = await this.events.findOne({
        where: { id: evtId, entId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('EVENT_NOT_FOUND');
      return;
    }
    if (actor.role !== 'TEACHER') throw new ForbiddenException('FORBIDDEN');

    const rows: Array<{ ok: number }> = await this.repo.query(
      `SELECT 1 AS ok
         FROM amb_acm_cal_event e
        WHERE e.ent_id = $1 AND e.evt_id = $2 AND e.deleted_at IS NULL
          AND (
            e.evt_owner_user_id = $3
            OR EXISTS (
              SELECT 1 FROM amb_acm_tch_teacher t
               WHERE t.ent_id = e.ent_id AND t.tch_user_id = $3
                 AND (
                   t.tch_id = e.evt_assignee_tch_id
                   OR EXISTS (
                     SELECT 1 FROM amb_acm_cal_invitee i
                      WHERE i.evt_id = e.evt_id AND i.ent_id = e.ent_id
                        AND i.inv_kind = 'TEACHER' AND i.inv_ref_id = t.tch_id)
                 ))
          )
        LIMIT 1`,
      [entId, evtId, actor.id],
    );
    if (!rows.length) throw new ForbiddenException('NOT_RELATED_TO_EVENT');
  }

  // ---------------------------------------------------------------------------
  // 조회
  // ---------------------------------------------------------------------------

  /** DB 기준 요약 (벤더 호출 없음 — 화면 진입용). */
  async summaryForEvent(
    entId: string,
    evtId: string,
  ): Promise<RecordingSummary> {
    const event = await this.events.findOne({ where: { id: evtId, entId } });
    if (!event) throw new NotFoundException('EVENT_NOT_FOUND');

    const room = await this.rooms.findOne({ where: { entId, evtId } });
    const rows = await this.repo.find({
      where: { entId, evtId },
      order: { recordIdx: 'ASC' },
    });
    return this.buildSummary(event, room, rows);
  }

  /** 보다 SERVER API 에서 녹화 목록을 당겨 upsert 후 요약 반환. */
  async syncEvent(entId: string, evtId: string): Promise<RecordingSummary> {
    const event = await this.events.findOne({ where: { id: evtId, entId } });
    if (!event) throw new NotFoundException('EVENT_NOT_FOUND');

    const room = await this.rooms.findOne({ where: { entId, evtId } });
    if (room?.meetKey) {
      const auth = (await this.cfg.getServerApiAuth(entId)) ?? undefined;
      const entries = await this.server.listRecordings(room.meetKey, auth);
      for (const e of entries) {
        await this.upsert({
          entId,
          evtId,
          roomId: room.id,
          recordIdx: e.recordIdx,
          title: e.recordTitle,
          startedAt: bodaDatetimeToIso(e.startDatetime),
          endedAt: bodaDatetimeToIso(e.endDatetime),
          fileExist: e.fileExist,
          meetIdx: e.meetIdx ?? room.meetIdx ?? null,
          roomCode: e.roomCode ?? room.roomCode ?? null,
        });
      }
    }

    const rows = await this.repo.find({
      where: { entId, evtId },
      order: { recordIdx: 'ASC' },
    });
    return this.buildSummary(event, room, rows);
  }

  // ---------------------------------------------------------------------------
  // 수신 (webhook event 21) / upsert
  // ---------------------------------------------------------------------------

  /**
   * 웹훅 event 21(녹화파일 저장 완료). meetKey 로 룸을 찾아 행을 만들고
   * 아카이브 대기(PENDING) 로 둔다. 룸을 못 찾으면 무시(감사 로그는 남음).
   */
  async applyRecordingEvent(
    entId: string,
    meetKey: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const recordIdx = Number(payload['recordIdx']);
    if (!Number.isFinite(recordIdx)) return;
    const room = await this.rooms.findOne({ where: { meetKey } });
    if (!room || room.entId !== entId) return;

    const recordTime = Number(payload['recordTime']);
    await this.upsert({
      entId,
      evtId: room.evtId,
      roomId: room.id,
      recordIdx,
      title:
        typeof payload['recordTitle'] === 'string'
          ? payload['recordTitle']
          : null,
      startedAt: null,
      endedAt: null,
      durationSec: Number.isFinite(recordTime) ? recordTime : null,
      fileExist: true,
      meetIdx: room.meetIdx ?? null,
      roomCode: room.roomCode ?? null,
    });
    this.logger.log(
      `recording event 21 stored evtId=${room.evtId} recordIdx=${recordIdx}`,
    );
  }

  private async upsert(input: {
    entId: string;
    evtId: string;
    roomId: string | null;
    recordIdx: number;
    title: string | null;
    startedAt: string | null;
    endedAt: string | null;
    durationSec?: number | null;
    fileExist: boolean;
    meetIdx: string | null;
    roomCode: string | null;
  }): Promise<void> {
    const existing = await this.repo.findOne({
      where: { entId: input.entId, recordIdx: input.recordIdx },
    });

    if (!existing) {
      await this.repo.save(
        this.repo.create({
          entId: input.entId,
          evtId: input.evtId,
          roomId: input.roomId,
          recordIdx: input.recordIdx,
          meetIdx: input.meetIdx,
          roomCode: input.roomCode,
          title: input.title,
          startedAt: input.startedAt ? new Date(input.startedAt) : null,
          endedAt: input.endedAt ? new Date(input.endedAt) : null,
          durationSec: input.durationSec ?? null,
          fileExist: input.fileExist,
          archiveStatus: input.fileExist ? 'PENDING' : 'MISSING',
        }),
      );
      return;
    }

    // 메타는 최신값으로 보강하되, 이미 보관된 파일의 상태는 건드리지 않는다.
    existing.title = input.title ?? existing.title;
    existing.startedAt = input.startedAt
      ? new Date(input.startedAt)
      : existing.startedAt;
    existing.endedAt = input.endedAt
      ? new Date(input.endedAt)
      : existing.endedAt;
    existing.durationSec = input.durationSec ?? existing.durationSec;
    existing.meetIdx = input.meetIdx ?? existing.meetIdx;
    existing.roomCode = input.roomCode ?? existing.roomCode;
    existing.fileExist = input.fileExist;
    if (!input.fileExist && existing.archiveStatus !== 'ARCHIVED') {
      existing.archiveStatus = 'MISSING';
    } else if (input.fileExist && existing.archiveStatus === 'MISSING') {
      existing.archiveStatus = 'PENDING';
    }
    await this.repo.save(existing);
  }

  // ---------------------------------------------------------------------------
  // 아카이브 (ACM 서버 보관)
  // ---------------------------------------------------------------------------

  /**
   * 보관 대기건을 ACM S3 로 복사한다. 영상 크기가 커서 한 번에 소량만 처리.
   * 반환: 처리 시도/성공/실패 건수.
   */
  async archiveDue(
    limit = 3,
  ): Promise<{ picked: number; archived: number; failed: number }> {
    if (!this.store.isConfigured())
      return { picked: 0, archived: 0, failed: 0 };

    const candidates = await this.repo.find({
      where: { archiveStatus: In(['PENDING', 'FAILED']), fileExist: true },
      order: { createdAt: 'ASC' },
      take: limit * 3,
    });
    const due = candidates
      .filter((r) => r.attempts < MAX_ATTEMPTS)
      .slice(0, limit);

    let archived = 0;
    let failed = 0;
    for (const row of due) {
      // 낙관적 점유 — 다른 워커가 이미 집어간 행은 건너뛴다.
      const claim = await this.repo.update(
        { id: row.id, archiveStatus: row.archiveStatus },
        { archiveStatus: 'ARCHIVING', attempts: row.attempts + 1 },
      );
      if (!claim.affected) continue;

      try {
        await this.archiveOne(row);
        archived++;
      } catch (e) {
        failed++;
        const msg = e instanceof Error ? e.message : String(e);
        await this.repo.update(
          { id: row.id },
          { archiveStatus: 'FAILED', error: msg.slice(0, 500) },
        );
        this.logger.warn(
          `recording archive failed recordIdx=${row.recordIdx} attempt=${row.attempts + 1}: ${msg}`,
        );
      }
    }
    return { picked: due.length, archived, failed };
  }

  private async archiveOne(row: BodaRecordingTypeormEntity): Promise<void> {
    const auth = (await this.cfg.getServerApiAuth(row.entId)) ?? undefined;
    const dl = await this.server.downloadRecording(row.recordIdx, auth);
    const mime = dl.contentType ?? 'video/mp4';
    const key = `cal-recordings/${row.entId}/${row.evtId}/${row.recordIdx}.mp4`;

    let size: number;
    if (dl.contentLength && dl.contentLength > 0) {
      await this.store.putObjectStream({
        key,
        body: dl.stream as Readable,
        mime,
        contentLength: dl.contentLength,
      });
      size = dl.contentLength;
    } else {
      // 업스트림이 길이를 주지 않으면 상한까지만 버퍼링해 올린다.
      const buf = await this.readAllCapped(dl.stream as Readable);
      await this.store.putObject({ key, body: buf, mime });
      size = buf.length;
    }

    await this.repo.update(
      { id: row.id },
      {
        archiveStatus: 'ARCHIVED',
        s3Key: key,
        mime,
        sizeBytes: String(size),
        archivedAt: new Date(),
        error: null,
      },
    );
    this.logger.log(
      `recording archived evtId=${row.evtId} recordIdx=${row.recordIdx} bytes=${size}`,
    );
  }

  private async readAllCapped(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
      total += buf.length;
      if (total > MAX_BUFFER_BYTES) {
        throw new Error('RECORDING_TOO_LARGE_WITHOUT_CONTENT_LENGTH');
      }
      chunks.push(buf);
    }
    if (total === 0) throw new Error('RECORDING_EMPTY_BODY');
    return Buffer.concat(chunks);
  }

  // ---------------------------------------------------------------------------
  // 서빙 (재생/다운로드)
  // ---------------------------------------------------------------------------

  /**
   * 보관본(S3) 우선, 없으면 보다 직프록시. Range 는 가능한 쪽에서만 처리되고
   * 지원되지 않으면 전체 본문으로 폴백한다(`partial=false`).
   */
  async openStream(
    entId: string,
    evtId: string,
    recordIdx: number,
    range?: string,
  ): Promise<{
    stream: Readable;
    mime: string;
    contentLength: number | null;
    contentRange: string | null;
    partial: boolean;
    source: 'ACM' | 'BODA';
    filename: string;
  }> {
    const row = await this.repo.findOne({
      where: { entId, evtId, recordIdx },
    });
    if (!row) throw new NotFoundException('RECORDING_NOT_FOUND');
    const filename = `${(row.title ?? `recording-${recordIdx}`).replace(/[^\w.-]+/g, '_').slice(-80)}.mp4`;

    if (row.archiveStatus === 'ARCHIVED' && row.s3Key) {
      const obj = await this.store.getObjectStream(row.s3Key, range);
      return {
        stream: obj.stream,
        mime: obj.mime ?? row.mime ?? 'video/mp4',
        contentLength: obj.contentLength ?? null,
        contentRange: obj.contentRange ?? null,
        partial: obj.partial,
        source: 'ACM',
        filename,
      };
    }

    if (!row.fileExist) throw new NotFoundException('RECORDING_FILE_MISSING');

    try {
      const auth = (await this.cfg.getServerApiAuth(entId)) ?? undefined;
      const dl = await this.server.downloadRecording(recordIdx, auth, range);
      return {
        stream: dl.stream as Readable,
        mime: dl.contentType ?? 'video/mp4',
        contentLength: dl.contentLength,
        contentRange: dl.contentRange,
        partial: dl.partial,
        source: 'BODA',
        filename,
      };
    } catch (e) {
      if (e instanceof BodaeduUnavailableException) {
        throw new ServiceUnavailableException('BODA_UNAVAILABLE');
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------------------

  private buildSummary(
    event: CalEventTypeormEntity,
    room: BodaRoomTypeormEntity | null,
    rows: BodaRecordingTypeormEntity[],
  ): RecordingSummary {
    const items: RecordingView[] = rows.map((r) => ({
      recordIdx: r.recordIdx,
      title: r.title,
      startedAt: r.startedAt ? r.startedAt.toISOString() : null,
      endedAt: r.endedAt ? r.endedAt.toISOString() : null,
      durationSec: r.durationSec,
      fileExist: r.fileExist,
      archiveStatus: r.archiveStatus,
      sizeBytes: r.sizeBytes,
      playable: r.archiveStatus === 'ARCHIVED' || r.fileExist,
    }));
    const counts = {
      total: items.length,
      archived: items.filter((i) => i.archiveStatus === 'ARCHIVED').length,
      pending: items.filter(
        (i) => i.archiveStatus === 'PENDING' || i.archiveStatus === 'ARCHIVING',
      ).length,
      failed: items.filter((i) => i.archiveStatus === 'FAILED').length,
    };

    return {
      status: this.deriveStatus(event, room, items.length),
      roomStatus: room?.status ?? null,
      counts,
      items,
    };
  }

  private deriveStatus(
    event: CalEventTypeormEntity,
    room: BodaRoomTypeormEntity | null,
    itemCount: number,
  ): RecordingEventStatus {
    if (event.meetingProvider !== 'BODASCHOOL') return 'NOT_APPLICABLE';
    if (itemCount > 0) return 'AVAILABLE';
    if (!room) return 'NO_ROOM';

    const now = Date.now();
    const liveRoom =
      room.status === 'OPEN' ||
      room.status === 'STARTED' ||
      room.status === 'PAUSED';
    if (liveRoom) return 'IN_PROGRESS';

    const startMs = new Date(event.startAt).getTime();
    const endMs = new Date(event.endAt).getTime();
    if (now < startMs) return 'UPCOMING';
    if (now < endMs) return 'IN_PROGRESS';
    if (now < endMs + AWAIT_WINDOW_MIN * 60_000) return 'AWAITING';
    return 'NO_RECORDING';
  }

  /**
   * 최근 종료된 보다 수업 중 아직 녹화본을 못 받은 건 (cron 동기화 대상).
   * 웹훅(event 21)이 유실돼도 목록 API 로 따라잡기 위한 경로.
   */
  async findEventsNeedingSync(
    lookbackHours = 48,
    limit = 20,
  ): Promise<Array<{ entId: string; evtId: string }>> {
    const rows: Array<{ ent_id: string; evt_id: string }> =
      await this.repo.query(
        `SELECT r.ent_id, r.evt_id
           FROM amb_acm_cal_boda_room r
           JOIN amb_acm_cal_event e
             ON e.evt_id = r.evt_id AND e.ent_id = r.ent_id
          WHERE e.evt_meeting_provider = 'BODASCHOOL'
            AND e.deleted_at IS NULL
            AND e.evt_end_at < NOW()
            AND e.evt_end_at > NOW() - ($1 * INTERVAL '1 hour')
            AND NOT EXISTS (
              SELECT 1 FROM amb_acm_cal_boda_recording v
               WHERE v.ent_id = r.ent_id AND v.evt_id = r.evt_id)
          ORDER BY e.evt_end_at DESC
          LIMIT $2`,
        [lookbackHours, limit],
      );

    return rows.map((r) => ({ entId: r.ent_id, evtId: r.evt_id }));
  }
}
