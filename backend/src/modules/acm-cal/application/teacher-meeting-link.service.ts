import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { CalInviteeTypeormEntity } from '../infrastructure/typeorm/cal-invitee.typeorm-entity';
import {
  InviteeNotifierService,
  type NotifySummary,
} from './invitee-notifier.service';
import { validateMeetingUrl } from './meeting-url';
import { VideoConfigService } from './video-config.service';

export type LinkScope = 'ONE' | 'FOLLOWING';

interface EventRow {
  id: string;
  title: string;
  startAt: Date;
  provider: string;
  url: string | null;
  assigneeTchId: string | null;
}

/**
 * REQ-261023 (PLN-261023) — the assigned teacher enters or changes the class link from the
 * teacher portal. Google Meet tenants only; BODA links are generated automatically.
 * `FOLLOWING` also records a series change so auto-extended occurrences get the new link.
 */
@Injectable()
export class TeacherMeetingLinkService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly video: VideoConfigService,
    private readonly notifier: InviteeNotifierService,
  ) {}

  private async event(
    m: EntityManager | DataSource,
    entId: string,
    evtId: string,
    lock = false,
  ): Promise<EventRow> {
    const [e] = await m.query<EventRow[]>(
      `SELECT evt_id id, evt_title title, evt_start_at "startAt", evt_meeting_provider provider,
              evt_meeting_url url, evt_assignee_tch_id "assigneeTchId"
         FROM amb_acm_cal_event WHERE ent_id=$1 AND evt_id=$2 AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
      [entId, evtId],
    );
    if (!e) throw new NotFoundException('EVENT_NOT_FOUND');
    return e;
  }

  private async series(
    m: EntityManager | DataSource,
    entId: string,
    evtId: string,
  ) {
    const [o] = await m.query<{ crsId: string; key: Date }[]>(
      `SELECT crs_id "crsId", cro_key key FROM amb_acm_cal_recurrence_occurrence WHERE ent_id=$1 AND evt_id=$2`,
      [entId, evtId],
    );
    return o ?? null;
  }

  /** Occurrences from this one on (inclusive) that can take a Meet link. */
  private async following(
    m: EntityManager | DataSource,
    entId: string,
    crsId: string,
    key: Date,
  ) {
    const rows = await m.query<{ id: string }[]>(
      `SELECT o.evt_id id FROM amb_acm_cal_recurrence_occurrence o
         JOIN amb_acm_cal_event e ON e.evt_id=o.evt_id AND e.ent_id=o.ent_id
        WHERE o.ent_id=$1 AND o.crs_id=$2 AND o.cro_key >= $3 AND e.deleted_at IS NULL
          AND COALESCE(e.evt_meeting_provider,'NONE') <> 'BODASCHOOL'
        ORDER BY o.cro_key`,
      [entId, crsId, key],
    );
    return rows.map((r) => r.id);
  }

  private editBlock(e: EventRow, tenantProvider: string): string | null {
    if (e.provider === 'BODASCHOOL') return 'BODA_LINK_MANAGED';
    if (tenantProvider !== 'GOOGLE_MEET') return 'VIDEO_PROVIDER_MISMATCH';
    return null;
  }

  async info(entId: string, tchId: string, evtId: string) {
    const e = await this.event(this.ds, entId, evtId);
    const { provider: tenantProvider } = await this.video.get(entId);
    const block = this.editBlock(e, tenantProvider);
    const s = await this.series(this.ds, entId, evtId);
    const followingCount = s
      ? (await this.following(this.ds, entId, s.crsId, s.key)).length
      : 1;
    return {
      canEdit: e.assigneeTchId === tchId && !block,
      reason: e.assigneeTchId !== tchId ? 'NOT_ASSIGNEE_TEACHER' : block,
      provider: e.provider ?? 'NONE',
      meetingUrl: e.url,
      recurring: !!s,
      followingCount,
    };
  }

  async update(
    entId: string,
    tchId: string,
    evtId: string,
    input: {
      meetingUrl: string | null | undefined;
      scope: LinkScope;
      notify: boolean;
    },
  ): Promise<{ updated: number; notify: NotifySummary | null }> {
    const { provider: tenantProvider } = await this.video.get(entId);
    const url = validateMeetingUrl('GOOGLE_MEET', input.meetingUrl ?? null);
    const result = await this.ds.transaction(async (m) => {
      const e = await this.event(m, entId, evtId, true);
      if (e.assigneeTchId !== tchId)
        throw new ForbiddenException('NOT_ASSIGNEE_TEACHER');
      const block = this.editBlock(e, tenantProvider);
      if (block) throw new ConflictException({ code: block, message: block });
      const [t] = await m.query<{ name: string; userId: string | null }[]>(
        `SELECT tch_name name, tch_user_id "userId" FROM amb_acm_tch_teacher WHERE ent_id=$1 AND tch_id=$2`,
        [entId, tchId],
      );
      const s =
        input.scope === 'FOLLOWING' ? await this.series(m, entId, evtId) : null;
      const ids = s ? await this.following(m, entId, s.crsId, s.key) : [evtId];
      const before = await m.query<
        { id: string; provider: string | null; url: string | null }[]
      >(
        `SELECT evt_id id, evt_meeting_provider provider, evt_meeting_url url FROM amb_acm_cal_event
          WHERE ent_id=$1 AND evt_id = ANY($2::uuid[]) FOR UPDATE`,
        [entId, ids],
      );
      let updated = 0;
      for (const b of before) {
        if ((b.provider ?? 'NONE') === 'GOOGLE_MEET' && (b.url ?? null) === url)
          continue;
        await m.query(
          `UPDATE amb_acm_cal_event SET evt_meeting_provider='GOOGLE_MEET', evt_meeting_url=$3, updated_at=now()
            WHERE ent_id=$1 AND evt_id=$2`,
          [entId, b.id, url],
        );
        const changes = [
          ...((b.provider ?? 'NONE') !== 'GOOGLE_MEET'
            ? [
                {
                  field: 'meetingProvider',
                  before: b.provider ?? 'NONE',
                  after: 'GOOGLE_MEET',
                },
              ]
            : []),
          ...((b.url ?? null) !== url
            ? [{ field: 'meetingUrl', before: b.url ?? null, after: url }]
            : []),
        ];
        await m.query(
          `INSERT INTO amb_acm_cal_event_revision (ent_id, evt_id, rev_editor_user_id, rev_reason, rev_changes)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [
            entId,
            b.id,
            t?.userId ?? null,
            `강사 링크 변경 (강사 포털: ${t?.name ?? tchId})`.slice(0, 500),
            JSON.stringify(changes),
          ],
        );
        updated++;
      }
      if (s) {
        // Later auto-extended occurrences are built from the template + changes from their key on.
        await m.query(
          `UPDATE amb_acm_cal_recurrence_series
              SET crs_changes = crs_changes || $3::jsonb, crs_version = crs_version + 1, updated_at = now()
            WHERE ent_id=$1 AND crs_id=$2`,
          [
            entId,
            s.crsId,
            JSON.stringify([
              {
                from: new Date(s.key).toISOString(),
                patch: {
                  evtMeetingProvider: 'GOOGLE_MEET',
                  evtMeetingUrl: url ?? '',
                },
                startShift: 0,
                endShift: 0,
              },
            ]),
          ],
        );
      }
      return { e, updated, later: Math.max(0, ids.length - 1) };
    });
    let notify: NotifySummary | null = null;
    if (input.notify && result.updated > 0) {
      const rows = await this.ds
        .getRepository(CalInviteeTypeormEntity)
        .findBy({ entId, evtId });
      notify = await this.notifier.notifyLinkChanged(
        entId,
        {
          title: result.e.title,
          startAt: new Date(result.e.startAt),
          meetingUrl: url,
        },
        rows,
        tchId,
        result.later,
      );
    }
    return { updated: result.updated, notify };
  }
}
