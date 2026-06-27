import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from '../infrastructure/typeorm/map-test.typeorm-entity';

/**
 * REQ-260626 Q-CSL-102 / T-19 — copy CSL-side MAP scores onto the
 * matching STD student row when an inquiry advances to CLASS_STARTED.
 *
 * Matching rule (intentionally conservative — Phase 1 simplified):
 *   1. Inquiry's student name (decrypted via AES-GCM) must be set.
 *   2. Find exactly **one** amb_acm_std_student row with the same
 *      (ent_id, decrypted name, std_status='ACTIVE').
 *   3. Inheritance is idempotent — fields only overwrite when the
 *      student row's value is null (operator-entered values stay).
 *   4. 0 matches or 2+ matches → no write, log a structured note so
 *      the operator can resolve manually (the full REQ-260511 §D7
 *      matching rule with parent name + phone lands in a later PR).
 *
 * The hook is best-effort: any failure here is logged but does NOT
 * abort the stage transition (the inquiry advances regardless).
 */
@Injectable()
export class StdInheritanceService {
  private readonly log = new Logger(StdInheritanceService.name);

  constructor(
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly students: Repository<StudentTypeormEntity>,
    private readonly crypto: AesGcmService,
  ) {}

  /**
   * Inherit MAP scores from inquiry's map-test row onto the student
   * row. Returns:
   *  - { matched: 1, applied: true|false, stdId } on a clean match
   *  - { matched: 0, applied: false }
   *  - { matched: N, applied: false } for N >= 2
   *
   * Caller (applyTransition) ignores the result; this method's job is
   * to do best-effort copy + structured logging.
   */
  async inheritMapScoresOnClassStart(
    inq: InquiryTypeormEntity,
    mt: MapTestTypeormEntity | null,
  ): Promise<{ matched: number; applied: boolean; stdId?: string }> {
    if (!mt) {
      this.log.debug(`inq ${inq.id}: no map-test row — nothing to inherit`);
      return { matched: 0, applied: false };
    }

    const studentName = this.crypto.decrypt({
      ciphertext: inq.nameEncrypted,
      iv: inq.nameIv,
      authTag: inq.nameAuthTag,
    });
    if (!studentName || studentName === '익명') {
      this.log.debug(`inq ${inq.id}: anonymous or empty student name — skip`);
      return { matched: 0, applied: false };
    }

    const candidates = await this.students.find({
      where: { entId: inq.entId, name: studentName, status: 'ACTIVE' },
    });

    if (candidates.length === 0) {
      this.log.log(
        `inq ${inq.id}: no STD match for "${studentName}" — operator must create student manually`,
      );
      return { matched: 0, applied: false };
    }
    if (candidates.length > 1) {
      this.log.warn(
        `inq ${inq.id}: ambiguous STD match for "${studentName}" (${candidates.length} candidates) — auto-inherit skipped`,
      );
      return { matched: candidates.length, applied: false };
    }

    const std = candidates[0];
    let dirty = false;
    if (std.mapReading == null && mt.scoreReading != null) {
      std.mapReading = mt.scoreReading;
      dirty = true;
    }
    if (std.mapMath == null && mt.scoreMath != null) {
      std.mapMath = mt.scoreMath;
      dirty = true;
    }
    if (std.mapLanguage == null && mt.scoreLanguage != null) {
      std.mapLanguage = mt.scoreLanguage;
      dirty = true;
    }

    if (!dirty) {
      this.log.debug(
        `inq ${inq.id} → std ${std.id}: no MAP fields to copy (already populated or mpt empty)`,
      );
      return { matched: 1, applied: false, stdId: std.id };
    }

    await this.students.save(std);
    this.log.log(
      `inq ${inq.id} → std ${std.id}: inherited MAP scores R=${std.mapReading} M=${std.mapMath} L=${std.mapLanguage}`,
    );
    return { matched: 1, applied: true, stdId: std.id };
  }
}
