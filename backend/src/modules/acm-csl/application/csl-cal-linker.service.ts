import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CalEventService } from '../../acm-cal/application/cal-event.service';
import { TenantSettingsService } from '../../acm-system/application/tenant-settings.service';
import type { AcmRole } from '../../acm-common/decorators/current-user.decorator';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { zonedDateTimeToUtc } from '../../acm-common/time/zoned-time.util';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from '../infrastructure/typeorm/map-test.typeorm-entity';
import { TrialClassTypeormEntity } from '../infrastructure/typeorm/trial-class.typeorm-entity';

/**
 * REQ-260626 T-08 / FR-CSL-114 / Q-CSL-107 — bridge CSL scheduling to
 * the acm-cal module so leveltest + demo class slots show up on the
 * shared calendar with a stable meetKey-style relationship.
 *
 * Strategy
 *   - Best-effort: any cal failure is logged but does NOT block the
 *     primary write. The cal_event_id column stays null and the
 *     operator can re-trigger by re-saving the row.
 *   - Sync (REQ-260903F): when the linked row already has cal_event_id,
 *     the event's start/end are UPDATED on re-schedule; a deleted linked
 *     event clears the id and a fresh one is created (self-heal).
 *   - Time math: the panel sends `scheduledAt` (date) + `scheduledTime`
 *     (HH:MM, 30-min) as tenant-timezone wall clock; we convert to a real
 *     UTC instant via TenantSettingsService (REQ-260903F — the old naive
 *     string was parsed in server TZ and drifted +9h on UTC prod).
 *     **60-minute default duration** for both leveltest and demo.
 *   - Title: short human-readable string with the decrypted student
 *     name when available.
 */
@Injectable()
export class CslCalLinkerService {
  private readonly log = new Logger(CslCalLinkerService.name);

  constructor(
    private readonly calEvents: CalEventService,
    private readonly tenantSettings: TenantSettingsService,
    private readonly crypto: AesGcmService,
    @InjectRepository(MapTestTypeormEntity, ACM_DS)
    private readonly mapTests: Repository<MapTestTypeormEntity>,
    @InjectRepository(TrialClassTypeormEntity, ACM_DS)
    private readonly trialClasses: Repository<TrialClassTypeormEntity>,
  ) {}

  /**
   * Link the inquiry's level test row to a fresh CAL event. Returns the
   * created evt id, or null when the link is skipped (already linked,
   * missing schedule, or cal create failed).
   */
  async linkLevelTest(
    inq: InquiryTypeormEntity,
    mt: MapTestTypeormEntity,
    actorUserId: string,
    actorRole: AcmRole,
  ): Promise<string | null> {
    if (!mt.scheduledAt || !mt.scheduledTime) {
      this.log.debug(`mpt ${mt.id} schedule incomplete — skip cal link`);
      return null;
    }

    const studentName = this.decryptName(inq) ?? '학생';
    const title = `Level Test (${mt.testType ?? 'MAP'}) — ${studentName}`;
    return this.createOrSync({
      existingCalEventId: mt.calEventId ?? null,
      clearFn: async () => {
        await this.mapTests.update({ id: mt.id }, { calEventId: null });
      },
      entId: inq.entId,
      actorUserId,
      actorRole,
      title,
      category: 'LEVEL_TEST',
      meetingProvider: 'NONE',
      scheduledAt: mt.scheduledAt,
      scheduledTime: mt.scheduledTime,
      // REQ-260630 FR-A02 — surface the level-test teacher as the event's 담당자.
      assigneeTchId: mt.teacherId ?? null,
      storeFn: async (calId) => {
        await this.mapTests.update({ id: mt.id }, { calEventId: calId });
      },
      logTag: `mpt=${mt.id}`,
    });
  }

  /**
   * Link a demo class row. Same rules as linkLevelTest.
   */
  async linkDemoClass(
    inq: InquiryTypeormEntity,
    tcl: TrialClassTypeormEntity,
    actorUserId: string,
    actorRole: AcmRole,
  ): Promise<string | null> {
    if (!tcl.heldAt || !tcl.heldTime) {
      this.log.debug(`tcl ${tcl.id} schedule incomplete — skip cal link`);
      return null;
    }

    const studentName = this.decryptName(inq) ?? '학생';
    const title = `Demo Class — ${studentName}`;
    return this.createOrSync({
      existingCalEventId: tcl.calEventId ?? null,
      clearFn: async () => {
        await this.trialClasses.update({ id: tcl.id }, { calEventId: null });
      },
      entId: inq.entId,
      actorUserId,
      actorRole,
      title,
      category: 'DEMO_CLASS',
      meetingProvider: 'BODASCHOOL',
      scheduledAt: tcl.heldAt,
      scheduledTime: tcl.heldTime,
      // REQ-260630 FR-A02 — demo-class teacher → calendar 담당자.
      assigneeTchId: tcl.teacherId ?? null,
      storeFn: async (calId) => {
        await this.trialClasses.update({ id: tcl.id }, { calEventId: calId });
      },
      logTag: `tcl=${tcl.id}`,
    });
  }

  // ── internals ─────────────────────────────────────────────────────

  private decryptName(inq: InquiryTypeormEntity): string | null {
    if (inq.isAnonymous) return null;
    return this.crypto.decrypt({
      ciphertext: inq.nameEncrypted,
      iv: inq.nameIv,
      authTag: inq.nameAuthTag,
    });
  }

  /**
   * REQ-260903F — 생성/동기화 통합.
   *  - 미연동: CAL 이벤트 생성 후 id 저장.
   *  - 연동됨: 시작/종료를 update (시간 변경이 캘린더에 반영).
   *  - 연동 id 가 있으나 이벤트가 삭제/부재: id 초기화 후 재생성 (자가 복구).
   * 시각은 테넌트 타임존 벽시계 → UTC 로 변환 (기존 naive 문자열이 서버 TZ 로
   * 해석되어 프로덕션(UTC)에서 +9h 어긋나던 버그 수정).
   */
  private async createOrSync(input: {
    existingCalEventId: string | null;
    clearFn: () => Promise<void>;
    entId: string;
    actorUserId: string;
    actorRole: AcmRole;
    title: string;
    category: 'LEVEL_TEST' | 'DEMO_CLASS';
    meetingProvider: 'NONE' | 'BODASCHOOL';
    scheduledAt: string;
    scheduledTime: string;
    /** REQ-260630 — null when the source row has no teacher assigned. */
    assigneeTchId: string | null;
    storeFn: (calId: string) => Promise<void>;
    logTag: string;
  }): Promise<string | null> {
    try {
      const tz = await this.tenantSettings.getTimezone(input.entId);
      const start = zonedDateTimeToUtc(input.scheduledAt, input.scheduledTime, tz);
      if (!start) {
        this.log.warn(`invalid schedule for ${input.logTag} — skip cal link`);
        return null;
      }
      const startAt = start.toISOString();
      const endAt = new Date(start.getTime() + 60 * 60 * 1000).toISOString();

      if (input.existingCalEventId) {
        try {
          await this.calEvents.update(
            input.entId,
            input.actorUserId,
            input.actorRole,
            input.existingCalEventId,
            {
              evtStartAt: startAt,
              evtEndAt: endAt,
              ...(input.assigneeTchId
                ? { evtAssigneeTchId: input.assigneeTchId }
                : {}),
              evtEditReason: 'CSL 일정 변경 자동 동기화 (REQ-260903F)',
            },
          );
          this.log.log(
            `synced ${input.logTag} → cal ${input.existingCalEventId} (@ ${startAt})`,
          );
          return input.existingCalEventId;
        } catch (e) {
          if (!(e instanceof NotFoundException)) throw e;
          // 연동 이벤트가 삭제됨 — id 초기화 후 아래에서 재생성.
          this.log.warn(
            `linked event ${input.existingCalEventId} missing for ${input.logTag} — relinking`,
          );
          await input.clearFn();
        }
      }

      const event = await this.calEvents.create(
        input.entId,
        input.actorUserId,
        input.actorRole,
        {
          evtTitle: input.title,
          evtStartAt: startAt,
          evtEndAt: endAt,
          evtCategory: input.category,
          evtMeetingProvider: input.meetingProvider,
          // REQ-260630 — teacher pre-set on the CSL row becomes the
          // calendar event's 담당자. Omit when null so service treats it
          // as "no assignee".
          evtAssigneeTchId: input.assigneeTchId ?? undefined,
        },
      );
      await input.storeFn(event.id);
      this.log.log(
        `linked ${input.logTag} → cal ${event.id} (${input.title} @ ${startAt})`,
      );
      return event.id;
    } catch (e) {
      this.log.warn(
        `cal link skipped for ${input.logTag}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return null;
    }
  }
}
