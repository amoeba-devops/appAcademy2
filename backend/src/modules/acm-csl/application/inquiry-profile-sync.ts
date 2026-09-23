import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { MapApplyTypeormEntity } from '../infrastructure/typeorm/map-apply.typeorm-entity';

export function readEnglishName(
  inq: InquiryTypeormEntity,
  crypto: AesGcmService,
): string | null {
  return inq.englishNameEncrypted && inq.englishNameIv && inq.englishNameAuthTag
    ? crypto.decrypt({
        ciphertext: inq.englishNameEncrypted,
        iv: inq.englishNameIv,
        authTag: inq.englishNameAuthTag,
      })
    : null;
}
export function setEnglishName(
  inq: InquiryTypeormEntity,
  name: string | null | undefined,
  crypto: AesGcmService,
) {
  const enc = name?.trim() ? crypto.encrypt(name.trim()) : null;
  inq.englishNameEncrypted = enc?.ciphertext ?? null;
  inq.englishNameIv = enc?.iv ?? null;
  inq.englishNameAuthTag = enc?.authTag ?? null;
}
/** Caller holds the inquiry row lock; map-apply always locks after inquiry. */
export async function syncInquiryProfile(
  manager: EntityManager,
  inq: InquiryTypeormEntity,
  crypto: AesGcmService,
  explicitEnglish = false,
) {
  const repo = manager.getRepository(MapApplyTypeormEntity);
  let row = await repo.findOne({
    where: { entId: inq.entId, inqId: inq.id },
    lock: { mode: 'pessimistic_write' },
  });
  // Adopt a legacy value only when the request did not explicitly clear it.
  if (!explicitEnglish && !inq.englishNameEncrypted && row?.studentNameEn) {
    setEnglishName(inq, row.studentNameEn, crypto);
    await manager.save(InquiryTypeormEntity, inq);
  }
  if (!row && inq.kind !== 'MAP_TEST') return;
  if (!row)
    row = repo.create({
      id: randomUUID(),
      entId: inq.entId,
      inqId: inq.id,
      submittedAt: inq.createdAt ?? new Date(),
      sourceSite: inq.sourceSite ?? inq.siteOverride ?? 'TPI',
      origin: 'CONSOLE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  row.studentNameEn = readEnglishName(inq, crypto);
  row.birthdate = inq.birthdate ?? null;
  if (row.birthdate) row.birthdateRaw = null;
  row.gender = inq.gender ?? null;
  row.updatedAt = new Date();
  await repo.save(row);
}
