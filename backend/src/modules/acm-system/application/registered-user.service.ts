import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';

export const REGISTERED_USER_TYPES = [
  'ALL',
  'ADMIN',
  'STAFF',
  'TEACHER',
  'STUDENT',
] as const;
export type RegisteredUserType = (typeof REGISTERED_USER_TYPES)[number];

export interface RegisteredUser {
  source: 'CONSOLE' | 'PORTAL';
  id: string;
  /** 관리 화면 이동용(학생 std_id·교사 tch_id) */
  ref_id: string | null;
  type: Exclude<RegisteredUserType, 'ALL'>;
  name: string;
  login_id: string;
  auth_source: string;
  permissions: string[];
  locked: boolean;
  status: string;
  created_at: string;
  last_login_at: string | null;
}

/**
 * REQ-261018B — 서비스 설정 › 사용자 초대의 "등록 사용자" 목록(읽기 전용).
 * 콘솔 계정(관리자·직원·강사, 시스템 관리자 제외) + 로그인 계정이 발급된 포털 학생·강사. 학부모 제외.
 */
@Injectable()
export class RegisteredUserService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async list(entId: string, type: RegisteredUserType = 'ALL', q?: string) {
    const rows = await this.ds.query<RegisteredUser[]>(
      `WITH all_users AS (
         SELECT 'CONSOLE' AS source, u.usr_id AS id, t.tch_id AS ref_id, u.usr_role AS type,
                u.usr_name AS name, u.usr_email AS login_id, u.auth_source,
                COALESCE((SELECT array_agg(p.upr_permission ORDER BY p.upr_permission)
                            FROM amb_acm_user_permission p
                           WHERE p.ent_id = u.ent_id AND p.usr_id = u.usr_id), '{}') AS permissions,
                u.usr_locked_at IS NOT NULL AS locked, u.usr_status AS status,
                u.created_at, u.usr_last_login_at AS last_login_at
           FROM amb_acm_user u
           LEFT JOIN amb_acm_tch_teacher t
             ON t.ent_id = u.ent_id AND t.tch_user_id = u.usr_id AND t.deleted_at IS NULL
          WHERE u.ent_id = $1 AND u.usr_role IN ('ADMIN','STAFF','TEACHER')
         UNION ALL
         SELECT 'PORTAL', a.pac_id, a.pac_ref_id, a.pac_kind,
                COALESCE(s.std_name, t.tch_name, a.pac_login_id), a.pac_login_id, 'portal',
                '{}', a.pac_locked_at IS NOT NULL, a.pac_status,
                a.created_at, a.pac_last_login_at
           FROM amb_acm_portal_account a
           LEFT JOIN amb_acm_std_student s
             ON a.pac_kind = 'STUDENT' AND s.ent_id = a.ent_id AND s.std_id = a.pac_ref_id
           LEFT JOIN amb_acm_tch_teacher t
             ON a.pac_kind = 'TEACHER' AND t.ent_id = a.ent_id AND t.tch_id = a.pac_ref_id
          WHERE a.ent_id = $1 AND a.pac_kind IN ('STUDENT','TEACHER')
       )
       SELECT * FROM all_users
        WHERE ($2 = 'ALL' OR type = $2)
          AND ($3::text IS NULL OR name ILIKE '%' || $3 || '%' OR login_id ILIKE '%' || $3 || '%')
        ORDER BY array_position(ARRAY['ADMIN','STAFF','TEACHER','STUDENT'], type), name, source
        LIMIT 1000`,
      [entId, type, q?.trim() ? q.trim().replace(/[\\%_]/g, '\\$&') : null],
    );
    const counts = await this.ds.query<{ type: string; n: number }[]>(
      `SELECT usr_role AS type, count(*)::int n FROM amb_acm_user
        WHERE ent_id = $1 AND usr_role IN ('ADMIN','STAFF','TEACHER') GROUP BY 1
       UNION ALL
       SELECT pac_kind, count(*)::int FROM amb_acm_portal_account
        WHERE ent_id = $1 AND pac_kind IN ('STUDENT','TEACHER') GROUP BY 1`,
      [entId],
    );
    const total: Record<string, number> = {
      ALL: 0,
      ADMIN: 0,
      STAFF: 0,
      TEACHER: 0,
      STUDENT: 0,
    };
    for (const c of counts) {
      total[c.type] += c.n;
      total.ALL += c.n;
    }
    return { users: rows, counts: total };
  }
}
