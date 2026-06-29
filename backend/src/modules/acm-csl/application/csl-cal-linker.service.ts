import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalEventService } from '../../acm-cal/application/cal-event.service';
import type { AcmRole } from '../../acm-common/decorators/current-user.decorator';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
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
 *   - Idempotent: when the linked row already has cal_event_id set,
 *     skip. Re-scheduling re-runs the link (operator can clear the
 *     column manually if they need a fresh event).
 *   - Time math: the panel sends `scheduledAt` (date) + `scheduledTime`
 *     (HH:MM, 30-min). We assume **60-minute default duration** for
 *     both leveltest and demo. Operators can edit the CAL event
 *     directly for non-default durations.
 *   - Title: short human-readable string with the decrypted student
 *     name when available.
 */
@Injectable()
export class CslCalLinkerService {
  private readonly log = new Logger(CslCalLinkerService.name);

  constructor(
    private readonly calEvents: CalEventService,
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
    if (mt.calEventId) {
      this.log.debug(`mpt ${mt.id} already linked → ${mt.calEventId}`);
      return null;
    }
    if (!mt.scheduledAt || !mt.scheduledTime) {
      this.log.debug(`mpt ${mt.id} schedule incomplete — skip cal link`);
      return null;
    }

    const studentName = this.decryptName(inq) ?? '학생';
    const title = `Level Test (${mt.testType ?? 'MAP'}) — ${studentName}`;
    return this.createAndStore({
      entId: inq.entId,
      actorUserId,
      actorRole,
      title,
      scheduledAt: mt.scheduledAt,
      scheduledTime: mt.scheduledTime,
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
    if (tcl.calEventId) {
      this.log.debug(`tcl ${tcl.id} already linked → ${tcl.calEventId}`);
      return null;
    }
    if (!tcl.heldAt || !tcl.heldTime) {
      this.log.debug(`tcl ${tcl.id} schedule incomplete — skip cal link`);
      return null;
    }

    const studentName = this.decryptName(inq) ?? '학생';
    const title = `Demo Class — ${studentName}`;
    return this.createAndStore({
      entId: inq.entId,
      actorUserId,
      actorRole,
      title,
      scheduledAt: tcl.heldAt,
      scheduledTime: tcl.heldTime,
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

  private async createAndStore(input: {
    entId: string;
    actorUserId: string;
    actorRole: AcmRole;
    title: string;
    scheduledAt: string;
    scheduledTime: string;
    storeFn: (calId: string) => Promise<void>;
    logTag: string;
  }): Promise<string | null> {
    try {
      // scheduledAt is YYYY-MM-DD; scheduledTime is HH:MM[:SS]. Compose to
      // an ISO 8601 string in Asia/Seoul. We send local naive ISO and let
      // the server-side validator + DB store as TIMESTAMPTZ assuming UTC
      // is intended (operator-facing labels render in local time anyway).
      const time = input.scheduledTime.slice(0, 5);
      const startAt = `${input.scheduledAt}T${time}:00`;
      const endAt = addOneHour(startAt);

      const event = await this.calEvents.create(
        input.entId,
        input.actorUserId,
        input.actorRole,
        {
          evtTitle: input.title,
          evtStartAt: startAt,
          evtEndAt: endAt,
          // CAL_CATEGORIES = CLASS | MEETING | EVENT | PERSONAL — leveltest
          // and demo class both surface on the operator calendar as EVENT
          // (CLASS is reserved for ongoing enrollments, not one-offs).
          evtCategory: 'EVENT',
          evtMeetingProvider: 'NONE',
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

/** Add 60 minutes to a 'YYYY-MM-DDTHH:MM:SS' string and return the same shape. */
function addOneHour(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + 60);
  // Re-serialize without timezone suffix to match the input form.
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
