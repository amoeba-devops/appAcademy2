import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import type { AcmRole } from '../../acm-common/decorators/current-user.decorator';
import { CalEventTypeormEntity } from '../infrastructure/typeorm/cal-event.typeorm-entity';
import {
  CalInviteeKind,
  CalInviteeTypeormEntity,
} from '../infrastructure/typeorm/cal-invitee.typeorm-entity';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student-parent.typeorm-entity';
import { ClassStudentTypeormEntity } from '../../acm-cls/infrastructure/typeorm/class-student.typeorm-entity';
import { TeacherTypeormEntity } from '../../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { BodaConfigService } from './boda-config.service';
import { BodaRoomService } from './boda-room.service';
import { CalInviteeService } from './cal-invitee.service';
import type {
  BodaLaunchContextResponseDto,
  BodaRoomStatusResponseDto,
} from './dto/boda-launch.dto';
import { In } from 'typeorm';

/**
 * REQ-260526 v2 §5.3 (FR-LAUNCH-1..8) — 캘린더 이벤트 입장 런처용 컨텍스트.
 *
 * 4 가지 책임:
 *   1. 권한 — owner / invitee(STUDENT or PARENT-of-STUDENT) 만 접근.
 *      그 외 ACM_ROLE='ADMIN' 또는 같은 entId 의 TEACHER (모니터링용) 도 통과.
 *   2. 시간창 — config 의 graceBeforeMin (default 10) ~ graceAfterMin (default 15)
 *      범위 밖이면 403 BODA_LAUNCH_OUT_OF_WINDOW.
 *   3. 룸 존재 확인 — provider != BODASCHOOL 인 이벤트면 422 BODA_NOT_BODASCHOOL.
 *      room 행이 없으면 race / DB drift — 422 BODA_ROOM_NOT_PROVISIONED.
 *   4. Payload 합성 — bodaOpen()/bodaJoin() 의 입력으로 바로 쓰일 수 있게
 *      meetKey, roomCode, userType, UId/UNm, appApiUrl 을 포함. 비밀 미포함.
 */
@Injectable()
export class BodaLaunchContextService {
  private readonly logger = new Logger(BodaLaunchContextService.name);

  constructor(
    @InjectRepository(CalEventTypeormEntity, ACM_DS)
    private readonly evtRepo: Repository<CalEventTypeormEntity>,
    @InjectRepository(CalInviteeTypeormEntity, ACM_DS)
    private readonly inviteeRepo: Repository<CalInviteeTypeormEntity>,
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly stdRepo: Repository<StudentTypeormEntity>,
    @InjectRepository(ParentTypeormEntity, ACM_DS)
    private readonly parentRepo: Repository<ParentTypeormEntity>,
    @InjectRepository(StudentParentTypeormEntity, ACM_DS)
    private readonly spRepo: Repository<StudentParentTypeormEntity>,
    @InjectRepository(ClassStudentTypeormEntity, ACM_DS)
    private readonly cstRepo: Repository<ClassStudentTypeormEntity>,
    @InjectRepository(TeacherTypeormEntity, ACM_DS)
    private readonly teacherRepo: Repository<TeacherTypeormEntity>,
    private readonly rooms: BodaRoomService,
    private readonly cfg: BodaConfigService,
    private readonly inviteeSvc: CalInviteeService,
    private readonly config: ConfigService,
  ) {}

  // -------------------------------------------------------------------------

  async getStatus(
    evtId: string,
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
  ): Promise<BodaRoomStatusResponseDto> {
    const { room } = await this.loadAndAuthorize(
      evtId,
      entId,
      actorUserId,
      actorRole,
    );
    return {
      status: room.status,
      openedAt: room.openedAt?.toISOString() ?? null,
      startedAt: room.startedAt?.toISOString() ?? null,
      endedAt: room.endedAt?.toISOString() ?? null,
      closedAt: room.closedAt?.toISOString() ?? null,
      closeType: room.closeType ?? null,
    };
  }

  async build(
    evtId: string,
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
    lang?: string,
  ): Promise<BodaLaunchContextResponseDto> {
    const { event, room, userType } = await this.loadAndAuthorize(
      evtId,
      entId,
      actorUserId,
      actorRole,
    );
    await this.assertTimeWindow(event, entId);

    const [user, owner] = await Promise.all([
      this.userRepo.findOne({
        where: { id: actorUserId, entId },
        select: ['id', 'name'],
      }),
      this.userRepo.findOne({
        where: { id: event.ownerUserId, entId },
        select: ['id', 'name'],
      }),
    ]);
    const uname = user?.name ?? 'User';
    const ownerName = owner?.name ?? 'Teacher';

    const cfg = await this.cfg.findByEntId(entId);
    const bodaWeb = this.bodaWebBase(cfg?.bodaWebUrl);
    // FIX-260703: BodaAppApi.js 는 vendor 호스트(bodaWeb)가 서빙하지 않는다
    // (bodaedu.kr/BodaAppApi.js → text/html SPA fallback → nosniff 로 실행 거부).
    // vendor 가이드대로 **자체 호스팅** 복사본을 로드한다 (tpi.html 과 동일 파일,
    // frontend-acm/public/web/BODA_APP/build/). same-origin 절대경로면 런처 페이지
    // 오리진(acm.amoeba.site)에서 실제 JS 로 로드된다. env 로 override 가능.
    const appApiUrl =
      this.config.get<string>('BODA_APP_API_URL') ??
      '/web/BODA_APP/build/BodaAppApi.js';

    // REQ-260619 FR-LX-4 — 학생/학부모 화면이면 다른 invitees 노출 금지 (NFR-LX-2).
    // ADMIN 으로 관전 중인 경우(`userType === 13`) 도 풀 노출 — 운영 모니터링.
    const inviteesPublic = await this.buildInviteesForViewer(
      entId,
      event.id,
      userType,
    );

    const lang2: 'ko' | 'en' = lang === 'en' ? 'en' : 'ko';
    const embedUrl = this.buildEmbedUrl({
      cfg,
      room,
      userType,
      uid: this.toBodaUid(actorUserId),
      uname,
      lang: lang2,
    });
    const webBrowserUrl = this.buildBrowserUrl({
      cfg,
      room,
      userType,
      uid: this.toBodaUid(actorUserId),
      uname,
      lang: lang2,
    });

    return {
      meetKey: room.meetKey,
      roomCode: room.roomCode,
      meetIdx: room.meetIdx ?? null,
      status: room.status,
      userType,
      uid: this.toBodaUid(actorUserId),
      uname,
      lang: lang2,
      appApiUrl,
      bodaWeb,
      companyId: cfg?.companyId || null,
      companyCode: cfg?.companyCode || null,
      evtTitle: event.title,
      evtStartAt: event.startAt.toISOString(),
      evtEndAt: event.endAt.toISOString(),
      evtDescription: event.description ?? null,
      ownerName,
      evtSource: event.source,
      invitees: inviteesPublic,
      embedUrl,
      webBrowserUrl,
    };
  }

  // -------------------------------------------------------------------------
  // PLN-260715 — Portal (student/parent) launch context. Browser mode only:
  // the portal client opens `webBrowserUrl` in a new tab (no BodaAppApi.js /
  // desktop app). Authorized by portal identity (std_id/par_id) + class
  // enrollment, mirroring cal-event.service.listForPortal scoping.
  // -------------------------------------------------------------------------

  async buildForPortal(
    evtId: string,
    entId: string,
    kind: 'STUDENT' | 'PARENT' | 'TEACHER',
    refId: string,
    lang?: string,
  ): Promise<BodaLaunchContextResponseDto> {
    const event = await this.evtRepo.findOne({
      where: { id: evtId, entId, deletedAt: IsNull() },
    });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND' });
    if (event.meetingProvider !== 'BODASCHOOL') {
      throw new HttpException(
        {
          code: 'BODA_NOT_BODASCHOOL',
          message: 'Event provider is not BODASCHOOL',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const room = await this.rooms.findByEvtId(evtId, entId);
    if (!room) {
      throw new HttpException(
        { code: 'BODA_ROOM_NOT_PROVISIONED' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const userType = await this.resolvePortalUserType(
      event,
      kind,
      refId,
      entId,
    );
    await this.assertTimeWindow(event, entId);

    const uname = await this.resolvePortalName(kind, refId, entId);
    const uid = this.toBodaUid(refId);
    const owner = await this.userRepo.findOne({
      where: { id: event.ownerUserId, entId },
      select: ['id', 'name'],
    });
    const cfg = await this.cfg.findByEntId(entId);
    const bodaWeb = this.bodaWebBase(cfg?.bodaWebUrl);
    const appApiUrl =
      this.config.get<string>('BODA_APP_API_URL') ??
      '/web/BODA_APP/build/BodaAppApi.js';
    const lang2: 'ko' | 'en' = lang === 'en' ? 'en' : 'ko';
    const embedUrl = this.buildEmbedUrl({
      cfg,
      room,
      userType,
      uid,
      uname,
      lang: lang2,
    });
    const webBrowserUrl = this.buildBrowserUrl({
      cfg,
      room,
      userType,
      uid,
      uname,
      lang: lang2,
    });

    return {
      meetKey: room.meetKey,
      roomCode: room.roomCode,
      meetIdx: room.meetIdx ?? null,
      status: room.status,
      userType,
      uid,
      uname,
      lang: lang2,
      appApiUrl,
      bodaWeb,
      companyId: cfg?.companyId || null,
      companyCode: cfg?.companyCode || null,
      evtTitle: event.title,
      evtStartAt: event.startAt.toISOString(),
      evtEndAt: event.endAt.toISOString(),
      evtDescription: event.description ?? null,
      ownerName: owner?.name ?? 'Teacher',
      evtSource: event.source,
      invitees: [], // 학생/학부모 화면 — 다른 참석자 명단 미노출 (NFR-LX-2)
      embedUrl,
      webBrowserUrl,
    };
  }

  /**
   * Portal attendee resolution — always STUDENT seat (12). Grants access when
   * the caller is an explicit invitee OR (student) enrolled in the event's
   * class / (parent) has a child so enrolled. Mirrors listForPortal scoping.
   */
  private async resolvePortalUserType(
    event: CalEventTypeormEntity,
    kind: 'STUDENT' | 'PARENT' | 'TEACHER',
    refId: string,
    entId: string,
  ): Promise<11 | 12> {
    // PLN-260715 — 포털 강사(담당강사)는 강의실을 개설(bodaOpen)할 수 있는
    // TEACHER 좌석(11). 이벤트 담당강사(assignee) 또는 TEACHER invitee 매칭.
    if (kind === 'TEACHER') {
      if (event.assigneeTchId && event.assigneeTchId === refId) return 11;
      const inv = await this.inviteeRepo.findOne({
        where: { entId, evtId: event.id, kind: 'TEACHER', refId },
      });
      if (inv) return 11;
      throw new ForbiddenException({ code: 'NOT_AN_ATTENDEE' });
    }

    if (kind === 'STUDENT') {
      const inv = await this.inviteeRepo.findOne({
        where: { entId, evtId: event.id, kind: 'STUDENT', refId },
      });
      if (inv) return 12;
      if (
        event.clsId &&
        (await this.cstRepo.findOne({
          where: {
            entId,
            clsId: event.clsId,
            studentUserId: refId,
            leftAt: IsNull(),
          },
        }))
      ) {
        return 12;
      }
      throw new ForbiddenException({ code: 'NOT_AN_ATTENDEE' });
    }

    if (kind === 'PARENT') {
      const childRows = await this.spRepo.find({
        where: { entId, parId: refId },
        select: ['stdId'],
      });
      const childIds = childRows.map((r) => r.stdId);
      if (childIds.length > 0) {
        const inv = await this.inviteeRepo.findOne({
          where: {
            entId,
            evtId: event.id,
            kind: 'STUDENT',
            refId: In(childIds),
          },
        });
        if (inv) return 12;
        if (
          event.clsId &&
          (await this.cstRepo.findOne({
            where: {
              entId,
              clsId: event.clsId,
              studentUserId: In(childIds),
              leftAt: IsNull(),
            },
          }))
        ) {
          return 12;
        }
      }
      throw new ForbiddenException({ code: 'NOT_AN_ATTENDEE' });
    }

    throw new ForbiddenException({ code: 'NOT_AN_ATTENDEE' });
  }

  private async resolvePortalName(
    kind: 'STUDENT' | 'PARENT' | 'TEACHER',
    refId: string,
    entId: string,
  ): Promise<string> {
    if (kind === 'STUDENT') {
      const s = await this.stdRepo.findOne({
        where: { id: refId, entId },
        select: ['id', 'name'],
      });
      return s?.name ?? 'Student';
    }
    if (kind === 'PARENT') {
      const p = await this.parentRepo.findOne({
        where: { id: refId, entId },
        select: ['id', 'name'],
      });
      return p?.name ?? 'Parent';
    }
    if (kind === 'TEACHER') {
      const tch = await this.teacherRepo.findOne({
        where: { id: refId, entId },
        select: ['id', 'name'],
      });
      return tch?.name ?? 'Teacher';
    }
    return 'User';
  }

  // -------------------------------------------------------------------------
  // Invitee build — viewer-aware masking (FR-LX-4 / NFR-LX-2)
  // -------------------------------------------------------------------------

  private async buildInviteesForViewer(
    entId: string,
    evtId: string,
    userType: 11 | 12 | 13,
  ): Promise<BodaLaunchContextResponseDto['invitees']> {
    // 학생/학부모 본인 화면에서는 다른 학생 명단을 일절 노출하지 않음.
    if (userType === 12) return [];

    const list = await this.inviteeSvc.listForEvent(entId, evtId);
    if (list.length === 0) return [];

    // STUDENT 행에 대해 학교명 batch lookup → subLabel.
    const stdIds = list.filter((i) => i.kind === 'STUDENT').map((i) => i.refId);
    const schoolMap = new Map<string, string>();
    if (stdIds.length > 0) {
      const rows = await this.stdRepo.find({
        where: { id: In(stdIds), entId },
        select: ['id', 'school', 'grade'],
      });
      for (const r of rows) {
        const sub = [r.school, r.grade].filter(Boolean).join(' ');
        if (sub) schoolMap.set(r.id, sub);
      }
    }

    return list.map((i) => ({
      kind: i.kind,
      refId: i.refId,
      name: i.name,
      subLabel: i.kind === 'STUDENT' ? (schoolMap.get(i.refId) ?? null) : null,
      notified: i.notifyStatus === 'SENT',
    }));
  }

  // -------------------------------------------------------------------------
  // BODA WebRTC URL builders (모드 A iframe + 모드 B 브라우저 새 탭)
  // -------------------------------------------------------------------------

  /**
   * 모드 A — iframe `src`. `BODA_EMBED_ENABLED=true` 일 때만 채움. vendor
   * Q-LX-1 (iframe 임베드 허용 여부) 회신 전에는 항상 false → null 반환.
   */
  private buildEmbedUrl(input: {
    cfg: {
      webrtcUrl?: string;
      companyCode?: string;
      companyId?: string;
    } | null;
    room: { meetKey: string; roomCode: string; meetIdx?: string | null };
    userType: number;
    uid: string;
    uname: string;
    lang: 'ko' | 'en';
  }): string | null {
    const enabled = this.config.get<string>('BODA_EMBED_ENABLED');
    if (enabled !== 'true' && enabled !== '1') return null;
    return this.buildVendorWebUrl(input);
  }

  /**
   * 모드 B — "브라우저 새 탭으로 열기" 버튼이 클릭하는 URL. env flag 와 무관,
   * cfg.webrtcUrl 이 있으면 항상 채움. cfg 미입력 시 null → FE 가 버튼 disabled.
   */
  private buildBrowserUrl(input: {
    cfg: {
      webrtcUrl?: string;
      companyCode?: string;
      companyId?: string;
    } | null;
    room: { meetKey: string; roomCode: string; meetIdx?: string | null };
    userType: number;
    uid: string;
    uname: string;
    lang: 'ko' | 'en';
  }): string | null {
    return this.buildVendorWebUrl(input);
  }

  private buildVendorWebUrl(input: {
    cfg: {
      webrtcUrl?: string;
      companyCode?: string;
      companyId?: string;
    } | null;
    room: { meetKey: string; roomCode: string; meetIdx?: string | null };
    userType: number;
    uid: string;
    uname: string;
    lang: 'ko' | 'en';
  }): string | null {
    const webrtcUrl =
      input.cfg?.webrtcUrl ?? this.config.get<string>('BODA_WEBRTC_URL');
    if (!webrtcUrl) return null;
    const params = new URLSearchParams({
      CCd: String(input.cfg?.companyCode ?? ''),
      CId: String(input.cfg?.companyId ?? ''),
      meetKey: input.room.meetKey,
      roomCode: input.room.roomCode,
      UTy: String(input.userType),
      UId: input.uid,
      UNm: input.uname,
      lang: input.lang,
    });
    // PLN-260715 — 학생(비교사) 웹 조인은 meetIdx 로 방을 지목해야 한다(JOIN_IDX).
    // meetIdx 는 강사가 방을 연(ROOM_OPENED) 이후에만 존재한다.
    if (input.room.meetIdx) params.set('meetIdx', input.room.meetIdx);
    const sep = webrtcUrl.includes('?') ? '&' : '?';
    return `${webrtcUrl.replace(/\/$/, '')}${sep}${params.toString()}`;
  }

  // -------------------------------------------------------------------------

  private async loadAndAuthorize(
    evtId: string,
    entId: string,
    actorUserId: string,
    actorRole: AcmRole,
  ) {
    const event = await this.evtRepo.findOne({
      where: { id: evtId, entId, deletedAt: IsNull() },
    });
    if (!event) {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND' });
    }
    if (event.meetingProvider !== 'BODASCHOOL') {
      throw new HttpException(
        {
          code: 'BODA_NOT_BODASCHOOL',
          message: 'Event provider is not BODASCHOOL',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const room = await this.rooms.findByEvtId(evtId, entId);
    if (!room) {
      // Race or T4 drift — surface explicitly so operator can re-create.
      throw new HttpException(
        { code: 'BODA_ROOM_NOT_PROVISIONED' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const userType = await this.resolveUserType(
      event,
      actorUserId,
      actorRole,
      entId,
    );
    return { event, room, userType };
  }

  /**
   * Decides who the actor is in BODA's eyes:
   *   - event owner(등록자) → TEACHER (11) — 등록자가 직접 강의실을 즉시 개설
   *     (bodaOpen)할 수 있어야 하므로 강사 좌석. (260728C 의 운영자(13) 참관
   *     전환은 즉시개설 흐름을 막아 원복함.)
   *   - listed invitee (STUDENT/PARENT) → STUDENT (12)
   *   - ACM ADMIN (not owner, not invitee) → OPERATOR (13) — silent monitoring
   *   - else → 403 NOT_AN_ATTENDEE
   */
  private async resolveUserType(
    event: CalEventTypeormEntity,
    actorUserId: string,
    actorRole: AcmRole,
    entId: string,
  ): Promise<11 | 12 | 13> {
    if (event.ownerUserId === actorUserId) return 11;

    const invitees = await this.inviteeRepo.find({
      where: { entId, evtId: event.id },
      select: ['kind', 'refId'],
    });

    const matches = (kind: CalInviteeKind) =>
      invitees.some((inv) => inv.kind === kind && inv.refId === actorUserId);

    if (matches('STUDENT') || matches('PARENT')) return 12;

    if (actorRole === 'ADMIN') return 13;

    throw new ForbiddenException({ code: 'NOT_AN_ATTENDEE' });
  }

  private async assertTimeWindow(
    event: CalEventTypeormEntity,
    entId: string,
  ): Promise<void> {
    const cfg = await this.cfg.findByEntId(entId);
    const beforeMin = cfg?.graceBeforeMin ?? 10;
    const afterMin = cfg?.graceAfterMin ?? 15;
    const now = Date.now();
    const openAt = event.startAt.getTime() - beforeMin * 60_000;
    const closeAt = event.endAt.getTime() + afterMin * 60_000;
    if (now < openAt || now > closeAt) {
      throw new HttpException(
        {
          code: 'BODA_LAUNCH_OUT_OF_WINDOW',
          data: {
            now: new Date(now).toISOString(),
            openAt: new Date(openAt).toISOString(),
            closeAt: new Date(closeAt).toISOString(),
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /**
   * BODA Backend API 베이스 URL (`bodaWeb`, 끝 슬래시 제거). bodaOpen()/bodaJoin()
   * 의 1번째 위치 인자. (BodaAppApi.js 스크립트는 자체 호스팅 — appApiUrl 참조.)
   */
  private bodaWebBase(bodaWebUrl: string | undefined | null): string {
    return (
      bodaWebUrl ??
      this.config.get<string>('BODA_WEB_URL') ??
      ''
    ).replace(/\/$/, '');
  }

  /** Strip UUID dashes → 32 hex chars. BODA `UId` is constrained to ≤ 32 (FR-LAUNCH-5). */
  private toBodaUid(acmUserId: string): string {
    return acmUserId.replace(/-/g, '').toLowerCase();
  }
}
