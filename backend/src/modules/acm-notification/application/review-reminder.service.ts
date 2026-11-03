import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { reviewMissing } from '../../acm-cal/application/review-completion';
import { enqueueInbox } from './inbox-outbox';

@Injectable()
export class ReviewReminderService {
  private readonly log = new Logger(ReviewReminderService.name);
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  @Cron('0 * * * * *', { waitForCompletion: true })
  async sweep() {
    try {
      await this.ds.transaction(async (m) => {
        const rows: {
          id: string;
          entId: string;
          teacherId: string;
          title: string;
          endAt: Date;
          stage: number;
          hours: number;
          feedbackHtml: string | null;
          homeworkStatus: string | null;
          homeworkHtml: string | null;
          files: number;
        }[] = await m.query(`
          SELECT e.evt_id AS id,e.ent_id AS "entId",e.evt_assignee_tch_id AS "teacherId",e.evt_title AS title,e.evt_end_at AS "endAt",
            CASE WHEN e.evt_end_at<=now()-make_interval(hours=>h.h2) THEN 10 ELSE 5 END AS stage,
            CASE WHEN e.evt_end_at<=now()-make_interval(hours=>h.h2) THEN h.h2 ELSE h.h1 END AS hours,
            r.rvw_feedback_html AS "feedbackHtml",r.rvw_homework_status AS "homeworkStatus",r.rvw_homework_html AS "homeworkHtml",
            (SELECT count(*)::int FROM amb_acm_cal_event_attachment a WHERE a.ent_id=e.ent_id AND a.evt_id=e.evt_id AND a.cea_kind='HOMEWORK' AND a.deleted_at IS NULL) AS files
          FROM amb_acm_cal_event e LEFT JOIN amb_acm_cal_event_review r ON r.ent_id=e.ent_id AND r.evt_id=e.evt_id
          LEFT JOIN amb_acm_notification_setting s ON s.ent_id=e.ent_id
          CROSS JOIN LATERAL (SELECT COALESCE((s.nst_config->'reminder'->>'first')::int,5) AS h1,
            COALESCE((s.nst_config->'reminder'->>'second')::int,10) AS h2) h
          WHERE e.deleted_at IS NULL AND e.evt_category IN ('CLASS','REGULAR_CLASS','DEMO_CLASS')
            AND e.evt_assignee_tch_id IS NOT NULL AND e.evt_end_at<=now()-make_interval(hours=>h.h1)
            AND e.evt_end_at>=(SELECT created_at FROM amb_acm_notification_rollout WHERE nrl_id='review-reminders')
            AND NOT EXISTS(SELECT 1 FROM amb_acm_cal_review_reminder x WHERE x.ent_id=e.ent_id AND x.evt_id=e.evt_id
              AND x.rrm_stage=CASE WHEN e.evt_end_at<=now()-make_interval(hours=>h.h2) THEN 10 ELSE 5 END)
          ORDER BY e.evt_end_at LIMIT 500 FOR UPDATE OF e SKIP LOCKED`);
        // REQ-261102B — 1차·2차 시간은 학원 설정(기본 5·10시간). rrm_stage 5=1차, 10=2차.
        for (const e of rows) {
          const missing = reviewMissing(e, e.files);
          const claim: unknown[] = await m.query(
            `INSERT INTO amb_acm_cal_review_reminder(ent_id,evt_id,rrm_stage) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING rrm_id`,
            [e.entId, e.id, e.stage],
          );
          // A completed stage is also recorded to avoid repeatedly scanning old completed events.
          if (!claim.length || !missing.length) continue;
          await enqueueInbox(m, {
            entId: e.entId,
            type: 'REVIEW_OVERDUE',
            targetId: e.id,
            assigneeIds: [e.teacherId],
            teacherRecipientIds: [e.teacherId],
            payload: {
              title: e.title,
              hours: e.hours,
              missing: missing.join(','),
              endAt: e.endAt.toISOString(),
              teacherId: e.teacherId,
            },
          });
        }
      });
    } catch {
      this.log.error('Review reminder sweep failed; retry on next schedule');
    }
  }
}
