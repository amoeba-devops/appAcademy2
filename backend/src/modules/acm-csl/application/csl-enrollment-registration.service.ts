import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { StudentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/student-parent.typeorm-entity';
import { PortalAccountService } from '../../acm-auth/application/portal-account.service';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';

/**
 * PLN-260706 §4.3 — when a consultation reaches CLASS_STARTED, register its
 * student + parent into STD management (find-or-create + link) and issue their
 * portal login accounts. Idempotent via inquiry.inq_std_id.
 *
 * Called INLINE from InquiryService.applyTransition BEFORE the MAP-score
 * inheritance hook so the student row exists when inheritance matches it.
 * Best-effort — the caller wraps this so a failure never aborts the stage
 * transition.
 */
@Injectable()
export class CslEnrollmentRegistrationService {
  private readonly log = new Logger(CslEnrollmentRegistrationService.name);

  constructor(
    @InjectRepository(InquiryTypeormEntity, ACM_DS)
    private readonly inq: Repository<InquiryTypeormEntity>,
    @InjectRepository(StudentTypeormEntity, ACM_DS)
    private readonly students: Repository<StudentTypeormEntity>,
    @InjectRepository(ParentTypeormEntity, ACM_DS)
    private readonly parents: Repository<ParentTypeormEntity>,
    @InjectRepository(StudentParentTypeormEntity, ACM_DS)
    private readonly links: Repository<StudentParentTypeormEntity>,
    private readonly crypto: AesGcmService,
    private readonly portalAccounts: PortalAccountService,
  ) {}

  /**
   * Register the inquiry's student + parent and issue portal accounts.
   * Returns the resolved stdId, or null when skipped (anonymous / already
   * registered / missing name).
   */
  async register(
    entId: string,
    inqId: string,
  ): Promise<{ stdId: string; created: boolean } | null> {
    const inq = await this.inq.findOne({ where: { id: inqId, entId } });
    if (!inq) {
      this.log.warn(`register: inquiry ${inqId} not found`);
      return null;
    }
    if (inq.stdId) {
      this.log.debug(`inq ${inqId}: already registered → std ${inq.stdId}`);
      return { stdId: inq.stdId, created: false };
    }

    const studentName = this.decrypt(inq.nameEncrypted, inq.nameIv, inq.nameAuthTag);
    if (inq.isAnonymous || !studentName || studentName === '익명') {
      this.log.log(`inq ${inqId}: anonymous/empty name — auto-registration skipped`);
      return null;
    }

    const phone = this.decryptOptional(
      inq.phoneEncrypted,
      inq.phoneIv,
      inq.phoneAuthTag,
    );

    // ---- Student find-or-create ---------------------------------------------
    const { student, created } = await this.findOrCreateStudent(
      entId,
      studentName,
      phone,
      inq,
    );

    // ---- Parent find-or-create + link ---------------------------------------
    const parentName = this.decryptOptional(
      inq.parentNameEncrypted,
      inq.parentNameIv,
      inq.parentNameAuthTag,
    );
    let parentId: string | null = null;
    if (parentName) {
      const parent = await this.findOrCreateParent(entId, parentName, phone);
      parentId = parent.id;
      await this.linkStudentParent(entId, student.id, parent.id);
      await this.portalAccounts.ensureAccount(entId, 'PARENT', parent.id);
    }

    // ---- Portal account for the student -------------------------------------
    await this.portalAccounts.ensureAccount(entId, 'STUDENT', student.id);

    // ---- Idempotency link ----------------------------------------------------
    inq.stdId = student.id;
    await this.inq.save(inq);

    this.log.log(
      `inq ${inqId} auto-registered → std ${student.id}` +
        (parentId ? ` + par ${parentId}` : '') +
        ` (student ${created ? 'created' : 'matched'})`,
    );
    return { stdId: student.id, created };
  }

  // ---------------------------------------------------------------------------

  private async findOrCreateStudent(
    entId: string,
    name: string,
    phone: string | null,
    inq: InquiryTypeormEntity,
  ): Promise<{ student: StudentTypeormEntity; created: boolean }> {
    const nameMatches = await this.students.find({
      where: { entId, name, status: 'ACTIVE' },
    });

    // Tier 1 — name + normalized phone (reuse the closest match).
    if (phone && nameMatches.length > 0) {
      const norm = normalizePhone(phone);
      const phoneHits = nameMatches.filter(
        (s) => s.phone && normalizePhone(s.phone) === norm,
      );
      if (phoneHits.length >= 1) {
        if (phoneHits.length > 1) {
          this.log.warn(
            `inq ${inq.id}: ${phoneHits.length} students match "${name}"+phone — reusing first`,
          );
        }
        return { student: phoneHits[0], created: false };
      }
    }

    // Tier 2 — exactly one name-only match → reuse. Ambiguous (2+) → create a
    // fresh row to avoid mis-linking to the wrong same-named student.
    if (nameMatches.length === 1) {
      return { student: nameMatches[0], created: false };
    }
    if (nameMatches.length > 1) {
      this.log.warn(
        `inq ${inq.id}: ambiguous name-only match for "${name}" (${nameMatches.length}) — creating new student`,
      );
    }

    const school = inq.schoolFreetext ?? null;
    const student = await this.students.save(
      this.students.create({
        entId,
        name,
        phone: phone ?? null,
        school,
        grade: inq.grade ?? null,
        status: 'ACTIVE',
        startDate: new Date().toISOString().slice(0, 10),
      }),
    );
    return { student, created: true };
  }

  private async findOrCreateParent(
    entId: string,
    name: string,
    phone: string | null,
  ): Promise<ParentTypeormEntity> {
    const matches = await this.parents.find({ where: { entId, name } });
    if (phone && matches.length > 0) {
      const norm = normalizePhone(phone);
      const hit = matches.find((p) => p.phone && normalizePhone(p.phone) === norm);
      if (hit) return hit;
    }
    if (matches.length === 1 && !phone) return matches[0];

    return this.parents.save(
      this.parents.create({ entId, name, phone: phone ?? null }),
    );
  }

  private async linkStudentParent(
    entId: string,
    stdId: string,
    parId: string,
  ): Promise<void> {
    const existing = await this.links.findOne({ where: { entId, stdId, parId } });
    if (existing) return;
    // First guardian for this student → primary.
    const hasPrimary = await this.links.findOne({
      where: { entId, stdId, isPrimary: true },
    });
    await this.links.save(
      this.links.create({
        entId,
        stdId,
        parId,
        isPrimary: !hasPrimary,
      }),
    );
  }

  private decrypt(ciphertext: Buffer, iv: Buffer, authTag: Buffer): string {
    return this.crypto.decrypt({ ciphertext, iv, authTag });
  }

  private decryptOptional(
    ciphertext?: Buffer | null,
    iv?: Buffer | null,
    authTag?: Buffer | null,
  ): string | null {
    if (!ciphertext || !iv || !authTag) return null;
    try {
      const plain = this.crypto.decrypt({ ciphertext, iv, authTag });
      return plain && plain.length > 0 ? plain : null;
    } catch {
      return null;
    }
  }
}

/**
 * Normalize a phone for equality — strips non-digits and collapses the +82
 * country code to the national 0-trunk form so "+82 10-1234-5678" and
 * "010-1234-5678" compare equal. Mirrors std-inheritance.service.
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D+/g, '');
  if (digits.length === 0) return '';
  if (digits.startsWith('82') && digits.length >= 11) {
    return '0' + digits.slice(2);
  }
  return digits;
}
