import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ObjectStoreClient } from '../../acm-csl/infrastructure/external/object-store.client';
@Injectable()
export class DeletedFileCleanupService {
  private readonly log = new Logger(DeletedFileCleanupService.name);
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly store: ObjectStoreClient,
  ) {}
  @Cron('*/5 * * * *', { waitForCompletion: true })
  async clean() {
    if (!this.store.isConfigured()) return;
    const rows: { id: string; key: string }[] = await this.ds
      .query(`WITH picked AS (SELECT sdf_id FROM amb_acm_std_deleted_file WHERE sdf_done_at IS NULL AND sdf_next_at<=now() ORDER BY sdf_next_at LIMIT 20 FOR UPDATE SKIP LOCKED)
   UPDATE amb_acm_std_deleted_file f SET sdf_attempts=sdf_attempts+1,sdf_next_at=now()+interval '30 minutes' FROM picked p WHERE f.sdf_id=p.sdf_id RETURNING f.sdf_id AS id,f.sdf_key AS key`);
    for (const row of rows) {
      try {
        const refs = await this.ds.query<unknown[]>(
          'SELECT 1 FROM amb_acm_csl_attachment WHERE att_s3_key=$1 UNION ALL SELECT 1 FROM amb_acm_cal_event_attachment WHERE cea_s3_key=$1 UNION ALL SELECT 1 FROM amb_acm_material WHERE mat_s3_key=$1 UNION ALL SELECT 1 FROM amb_acm_material_attachment WHERE mta_s3_key=$1',
          [row.key],
        );
        if (refs.length) continue;
        await this.store.delete(row.key);
        await this.ds.query(
          'UPDATE amb_acm_std_deleted_file SET sdf_done_at=now() WHERE sdf_id=$1',
          [row.id],
        );
      } catch {
        this.log.warn('Student deleted-file cleanup deferred');
      }
    }
  }
}
