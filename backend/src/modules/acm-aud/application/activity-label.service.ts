import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';

/** Target types whose display name is snapshotted into the activity log (survives deletion). */
const LABEL_SQL: Record<string, string> = {
  student: `SELECT std_name l FROM amb_acm_std_student WHERE ent_id=$1 AND std_id::text=$2`,
  parent: `SELECT par_name l FROM amb_acm_std_parent WHERE ent_id=$1 AND par_id::text=$2`,
  teacher: `SELECT tch_name l FROM amb_acm_tch_teacher WHERE ent_id=$1 AND tch_id::text=$2`,
  staff: `SELECT stf_name l FROM amb_acm_stf_staff WHERE ent_id=$1 AND stf_id::text=$2`,
  user: `SELECT usr_name l FROM amb_acm_user WHERE ent_id=$1 AND usr_id::text=$2`,
  class: `SELECT COALESCE(NULLIF(cls_subject_label,''), cls_code) l FROM amb_acm_cls_classes WHERE ent_id=$1 AND cls_id::text=$2`,
  event: `SELECT evt_title l FROM amb_acm_cal_event WHERE ent_id=$1 AND evt_id::text=$2`,
  project: `SELECT prj_title l FROM amb_acm_prj_project WHERE ent_id=$1 AND prj_id::text=$2`,
  item: `SELECT pit_title l FROM amb_acm_prj_item WHERE ent_id=$1 AND pit_id::text=$2`,
  material: `SELECT mat_title l FROM amb_acm_material WHERE ent_id=$1 AND mat_id::text=$2`,
  post: `SELECT pst_title l FROM amb_acm_post WHERE ent_id=$1 AND pst_id::text=$2`,
  portalAccount: `SELECT pac_login_id l FROM amb_acm_portal_account WHERE ent_id=$1 AND pac_id::text=$2`,
};

/** PLN-261022 — best-effort label lookup; never throws. Inquiry names are encrypted, so none. */
@Injectable()
export class ActivityLabelService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async label(
    entId: string,
    type: string | null,
    id: string | null,
  ): Promise<string | null> {
    const sql = type ? LABEL_SQL[type] : undefined;
    if (!sql || !id) return null;
    try {
      const [row] = await this.ds.query<{ l: string | null }[]>(sql, [
        entId,
        id,
      ]);
      return row?.l?.slice(0, 200) ?? null;
    } catch {
      return null;
    }
  }
}
