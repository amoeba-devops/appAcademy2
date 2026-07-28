import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';

/**
 * PLN-260728F A — 수업(이벤트)별 보다 강의실 실적 기록 조회.
 * 개설/수업시작/종료/폐쇄 시각(웹훅 eventDatetime 기준) + 참석자 입·퇴실.
 *
 * viewer 스코프:
 *   • 관리자/강사(담당): 참석자 전원
 *   • 학생: 본인 기록만 / 학부모: 자녀 기록만
 */

export interface ClassRecordParticipant {
  kind: string; // TEACHER | STUDENT | OPERATOR | UNKNOWN
  refId: string | null;
  name: string | null;
  joinedAt: string;
  leftAt: string | null;
  totalSeconds: number | null;
}

export interface ClassRecord {
  status: string;
  openedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  closedAt: string | null;
  participants: ClassRecordParticipant[];
}

export type RecordViewer =
  | { scope: 'ALL' }
  | { scope: 'STUDENT'; refId: string }
  | { scope: 'PARENT'; refId: string };

@Injectable()
export class BodaRecordService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  /** 이벤트의 강의실 기록. 룸이 없으면 null. */
  async getClassRecord(
    entId: string,
    evtId: string,
    viewer: RecordViewer,
  ): Promise<ClassRecord | null> {
    const rooms: Array<{
      bdr_id: string;
      bdr_status: string;
      bdr_opened_at: string | null;
      bdr_started_at: string | null;
      bdr_ended_at: string | null;
      bdr_closed_at: string | null;
    }> = await this.ds.query(
      `SELECT bdr_id, bdr_status, bdr_opened_at, bdr_started_at,
              bdr_ended_at, bdr_closed_at
         FROM amb_acm_cal_boda_room
        WHERE ent_id = $1 AND evt_id = $2`,
      [entId, evtId],
    );
    const room = rooms[0];
    if (!room) return null;

    const params: unknown[] = [entId, room.bdr_id];
    let scopeSql = '';
    if (viewer.scope === 'STUDENT') {
      scopeSql = 'AND p.bdp_ref_user_id = $3';
      params.push(viewer.refId);
    } else if (viewer.scope === 'PARENT') {
      scopeSql = `AND p.bdp_ref_user_id IN (
        SELECT sp.std_id FROM amb_acm_std_student_parent sp
         WHERE sp.ent_id = $1 AND sp.par_id = $3)`;
      params.push(viewer.refId);
    }

    const rows: Array<{
      kind: string;
      ref_id: string | null;
      name: string | null;
      joined_at: string;
      left_at: string | null;
      total_seconds: number | null;
    }> = await this.ds.query(
      `SELECT p.bdp_user_kind AS kind, p.bdp_ref_user_id AS ref_id,
              COALESCE(s.std_name, t.tch_name, u.usr_name) AS name,
              p.bdp_joined_at AS joined_at, p.bdp_left_at AS left_at,
              p.bdp_total_seconds AS total_seconds
         FROM amb_acm_cal_boda_participant p
         LEFT JOIN amb_acm_std_student s
           ON s.std_id = p.bdp_ref_user_id AND s.ent_id = p.ent_id
         LEFT JOIN amb_acm_tch_teacher t
           ON t.tch_id = p.bdp_ref_user_id AND t.ent_id = p.ent_id
         LEFT JOIN amb_acm_user u
           ON u.usr_id = p.bdp_ref_user_id AND u.ent_id = p.ent_id
        WHERE p.ent_id = $1 AND p.bdr_id = $2 ${scopeSql}
        ORDER BY p.bdp_joined_at ASC`,
      params,
    );

    const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);
    return {
      status: room.bdr_status,
      openedAt: iso(room.bdr_opened_at),
      startedAt: iso(room.bdr_started_at),
      endedAt: iso(room.bdr_ended_at),
      closedAt: iso(room.bdr_closed_at),
      participants: rows.map((r) => ({
        kind: r.kind,
        refId: r.ref_id,
        name: r.name,
        joinedAt: new Date(r.joined_at).toISOString(),
        leftAt: iso(r.left_at),
        totalSeconds: r.total_seconds != null ? Number(r.total_seconds) : null,
      })),
    };
  }
}
