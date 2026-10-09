import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { MapTestTypeormEntity } from '../infrastructure/typeorm/map-test.typeorm-entity';

/**
 * REQ-260626 Q-CSL-102 / T-19 — copy CSL-side MAP scores onto the
 * matching STD student row when an inquiry advances to CLASS_STARTED.
 *
 * Explicit stdId links are preferred and tenant/deletion checked.
 * The legacy matching rule below is used only without an explicit link.
 * Matching rule (T-19 v2, REQ-260511 §D7 — tiered fallback):
 *   1. Inquiry's student name (decrypted via AES-GCM) must be set.
 *   2. **Tier 1 (preferred)** — when the inquiry has a phone:
 *      filter (ent_id, decrypted name, status=ACTIVE), then in-memory
 *      filter by normalized phone equality (inquiry phone decrypted
 *      vs std_phone plaintext). If exactly 1 row matches → apply.
 *      If 2+ → ambiguous, skip + warn.
 *   3. **Tier 2 (fallback)** — only when inquiry has no phone OR
 *      tier 1 returned 0: name-only match (legacy v1 path). 1 row →
 *      apply; 0 → log; 2+ → ambiguous skip.
 *   4. Inheritance is idempotent — fields only overwrite when the
 *      student row's value is null (operator-entered values stay).
 *
 * Phone matching uses an O(N) in-memory pass (no blind-index column).
 * In practice the (ent_id, name) filter already narrows to ~1 row,
 * so the cost is negligible. If STD volume grows, migrate to a
 * deterministic HMAC blind-index column (std_phone_idx, sql/acm/988).
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
    if (
      !mt ||
      mt.testType !== 'MAP' ||
      mt.entId !== inq.entId ||
      mt.inqId !== inq.id
    ) {
      this.log.debug(`inq ${inq.id}: no map-test row — nothing to inherit`);
      return { matched: 0, applied: false };
    }

    if (inq.stdId) {
      const linked = await this.students.findOne({
        where: { id: inq.stdId, entId: inq.entId, deletedAt: IsNull() },
      });
      if (!linked) return { matched: 0, applied: false };
      return this.fillMissingScores(inq, mt, linked);
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

    const nameMatches = await this.students.find({
      where: {
        entId: inq.entId,
        name: studentName,
        status: 'ACTIVE',
        deletedAt: IsNull(),
      },
    });

    if (nameMatches.length === 0) {
      this.log.log(
        `inq ${inq.id}: no STD match for "${studentName}" — operator must create student manually`,
      );
      return { matched: 0, applied: false };
    }

    // T-19 v2 — tier 1: name + normalized phone. Only attempt if the
    // inquiry actually has a phone; otherwise fall through to name-only.
    const inqPhone = this.decryptInquiryPhone(inq);
    let candidates = nameMatches;
    let tier = 2;
    if (inqPhone) {
      const normalized = normalizePhone(inqPhone);
      const phoneHits = nameMatches.filter(
        (s) => s.phone && normalizePhone(s.phone) === normalized,
      );
      if (phoneHits.length > 0) {
        candidates = phoneHits;
        tier = 1;
      }
      // tier 1 returned 0 → fall back to tier 2 (name-only) with full nameMatches.
    }

    if (candidates.length > 1) {
      this.log.warn(
        `inq ${inq.id}: ambiguous STD match for "${studentName}" (tier ${tier}, ${candidates.length} candidates) — auto-inherit skipped`,
      );
      return { matched: candidates.length, applied: false };
    }

    const std = candidates[0];
    this.log.debug(
      `inq ${inq.id} → std ${std.id}: matched via tier ${tier} (${tier === 1 ? 'name+phone' : 'name-only'})`,
    );
    return this.fillMissingScores(inq, mt, std);
  }

  private async fillMissingScores(
    inq: InquiryTypeormEntity,
    mt: MapTestTypeormEntity,
    std: StudentTypeormEntity,
  ) {
    if (
      !(
        (std.mapReading == null && mt.scoreReading != null) ||
        (std.mapMath == null && mt.scoreMath != null) ||
        (std.mapLanguage == null && mt.scoreLanguage != null)
      )
    ) {
      return { matched: 1, applied: false, stdId: std.id };
    }
    const rows: { std_id: string }[] = await this.students.query(
      `WITH updated AS (UPDATE amb_acm_std_student SET
        std_map_reading=COALESCE(std_map_reading,$3),
        std_map_math=COALESCE(std_map_math,$4),
        std_map_language=COALESCE(std_map_language,$5), updated_at=now()
       WHERE ent_id=$1 AND std_id=$2 AND deleted_at IS NULL
       AND ((std_map_reading IS NULL AND $3::int IS NOT NULL)
         OR (std_map_math IS NULL AND $4::int IS NOT NULL)
         OR (std_map_language IS NULL AND $5::int IS NOT NULL))
       RETURNING std_id) SELECT std_id FROM updated`,
      [
        inq.entId,
        std.id,
        mt.scoreReading ?? null,
        mt.scoreMath ?? null,
        mt.scoreLanguage ?? null,
      ],
    );
    return { matched: 1, applied: rows.length > 0, stdId: std.id };
  }

  /**
   * Decrypt the parent phone off the inquiry row, returning null when
   * any of the three encrypted components is absent (intake without
   * phone, e.g. anonymous inquiries from KAKAO_CHANNEL).
   */
  private decryptInquiryPhone(inq: InquiryTypeormEntity): string | null {
    if (!inq.phoneEncrypted || !inq.phoneIv || !inq.phoneAuthTag) {
      return null;
    }
    try {
      const plain = this.crypto.decrypt({
        ciphertext: inq.phoneEncrypted,
        iv: inq.phoneIv,
        authTag: inq.phoneAuthTag,
      });
      return plain && plain.length > 0 ? plain : null;
    } catch (err) {
      this.log.warn(
        `inq ${inq.id}: phone decrypt failed — falling back to name-only match (${(err as Error).message})`,
      );
      return null;
    }
  }
}

/**
 * Normalize a phone string for equality match. Strips every char that
 * isn't a digit; drops a leading country code (82 / 81 / 1) only when
 * it's followed by a national-trunk digit, so "+82 10-1234-5678" and
 * "010-1234-5678" hash to the same key.
 *
 * Korean trunk: leading 0 dropped after CC82 (010 → 82 10 → keep "1012345678").
 * To make both forms equal we drop CC82 prefix and re-prepend 0.
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D+/g, '');
  if (digits.length === 0) return '';
  // +82 1012345678 → 01012345678
  if (digits.startsWith('82') && digits.length >= 11) {
    return '0' + digits.slice(2);
  }
  return digits;
}
