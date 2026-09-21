import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { InquiryTypeormEntity } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import type { SourceSite } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { MapApplyTypeormEntity } from '../infrastructure/typeorm/map-apply.typeorm-entity';
import type { MapApplyGender } from '../infrastructure/typeorm/map-apply.typeorm-entity';
import { InquiryService } from './inquiry.service';
import { MapApplyNotifierService } from './map-apply-notifier.service';
import type {
  ExternalMapApplyDto,
  ImportMapApplyDto,
  ListMapApplyQueryDto,
  MapApplyDetail,
  MapApplyListItem,
  UpdateMapApplyDto,
} from './dto/map-apply.dto';

/**
 * CSL-PLN-260916 — 맵테스트 신청 (아임웹 `/test2` 접수 + 아임웹 누적 CSV 이관).
 *
 * 저장 구조: 상담(`amb_acm_csl_inquiry`) 1건 + 신청서 원본(`amb_acm_csl_map_apply`) 1:1.
 * 상담 쪽이 PII(학생명·연락처·학부모 이메일)를 암호화 소유하므로 중복 저장하지 않는다.
 */
@Injectable()
export class MapApplyService {
  private readonly log = new Logger(MapApplyService.name);

  constructor(
    @InjectRepository(MapApplyTypeormEntity, ACM_DS)
    private readonly repo: Repository<MapApplyTypeormEntity>,
    @InjectRepository(InquiryTypeormEntity, ACM_DS)
    private readonly inq: Repository<InquiryTypeormEntity>,
    private readonly inquiryService: InquiryService,
    private readonly notifier: MapApplyNotifierService,
  ) {}

  // ────────────────────────────────────────────────────────────────────
  // 생년월일 정규화
  // ────────────────────────────────────────────────────────────────────
  /**
   * `20100914` / `2010-09-14` / `2010.09.14` / `2010 09 14` → `2010-09-14`.
   * 해석할 수 없으면 `date: null` 과 원문을 함께 돌려준다 (유실 방지).
   */
  static normalizeBirthdate(raw?: string | null): {
    date: string | null;
    raw: string | null;
  } {
    const src = (raw ?? '').trim();
    if (!src) return { date: null, raw: null };
    const digits = src.replace(/[^0-9]/g, '');
    if (digits.length === 8) {
      const y = Number(digits.slice(0, 4));
      const m = Number(digits.slice(4, 6));
      const d = Number(digits.slice(6, 8));
      if (
        y >= 1900 &&
        y <= 2100 &&
        m >= 1 &&
        m <= 12 &&
        d >= 1 &&
        d <= 31 &&
        // 실제 달력상 존재하는 날짜인지 (2010-02-30 배제)
        new Date(Date.UTC(y, m - 1, d)).getUTCMonth() === m - 1
      ) {
        const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
        return { date: iso, raw: src };
      }
    }
    return { date: null, raw: src };
  }

  private static normalizeSubmittedAt(raw: string): Date | null {
    const s = raw.trim();
    if (!s) return null;
    // `2026-09-01 11:05` (아임웹 CSV, KST 로 간주) / ISO 문자열 모두 허용
    const kst =
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (kst) {
      const [, y, mo, d, h, mi, se] = kst;
      return new Date(`${y}-${mo}-${d}T${h}:${mi}:${se ?? '00'}+09:00`);
    }
    const parsed = new Date(s);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private static ymd(date: Date): string {
    // KST 기준 날짜 (상담 registeredAt 은 테넌트 타임존 기준 일자)
    const kst = new Date(date.getTime() + 9 * 3600 * 1000);
    return kst.toISOString().slice(0, 10);
  }

  private static importKeyOf(
    site: string,
    submittedAt: Date,
    studentName: string,
  ): string {
    return `${site}|${submittedAt.toISOString()}|${studentName.trim()}`.slice(
      0,
      200,
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // 접수 (공개 폼)
  // ────────────────────────────────────────────────────────────────────
  async createFromIntake(
    entId: string,
    site: SourceSite,
    dto: ExternalMapApplyDto,
  ): Promise<{ seqNo: number; inqId: string; mpaId: string }> {
    const bd = MapApplyService.normalizeBirthdate(dto.birthdate);
    const view = await this.inquiryService.create(entId, {
      studentName: dto.studentName,
      parentPhone: dto.parentPhone,
      parentEmail: dto.parentEmail,
      phoneStatus: 'PROVIDED',
      grade: dto.grade,
      inflowType: 'WEB_EXTERNAL',
      sourceSite: site,
      applyType: 'EXAM_ONLY',
      applyPurposes: ['MAP_TEST_TUTORING'],
      // REQ-260921B — 구분·생년월일·성별을 상담 본체에도 싣는다 (학교는 빈란).
      kind: 'MAP_TEST',
      birthdate: bd.date ?? undefined,
      gender: dto.gender ?? undefined,
    });

    const now = new Date();
    const row = this.repo.create({
      id: randomUUID(),
      entId,
      inqId: view.id,
      submittedAt: now,
      studentNameEn: dto.studentNameEn?.trim() || null,
      birthdate: bd.date,
      birthdateRaw: bd.date ? null : bd.raw,
      gender: dto.gender ?? null,
      examLocation: dto.examLocation?.trim() || null,
      preferredSlot: dto.preferredSlot?.trim() || null,
      sourceSite: site,
      origin: 'WEB',
      importKey: null,
      rawPayload: { ...dto, consent: true, website: undefined },
      createdAt: now,
      updatedAt: now,
    });
    const saved = await this.repo.save(row);

    // 알림은 접수 성공 이후 best-effort. 실패해도 접수를 되돌리지 않는다.
    void this.notifier.notifyNewApplication(entId, {
      inqId: view.id,
      seqNo: view.seqNo,
      site,
      studentName: dto.studentName,
      parentPhone: dto.parentPhone,
      parentEmail: dto.parentEmail ?? null,
      preferredSlot: dto.preferredSlot ?? null,
      examLocation: dto.examLocation ?? null,
    });

    return { seqNo: view.seqNo, inqId: view.id, mpaId: saved.id };
  }

  // ────────────────────────────────────────────────────────────────────
  // 목록 / 상세 / 수정
  // ────────────────────────────────────────────────────────────────────
  async list(
    entId: string,
    query: ListMapApplyQueryDto = {},
  ): Promise<{
    items: MapApplyListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;

    const qb = this.repo
      .createQueryBuilder('mpa')
      .where('mpa.ent_id = :entId', { entId });
    if (query.site) {
      qb.andWhere('mpa.mpa_source_site = :site', { site: query.site });
    }
    if (query.from) {
      qb.andWhere('mpa.mpa_submitted_at >= :from::date', { from: query.from });
    }
    if (query.to) {
      qb.andWhere("mpa.mpa_submitted_at < (:to::date + interval '1 day')", {
        to: query.to,
      });
    }
    const applies = await qb.orderBy('mpa.mpa_submitted_at', 'DESC').getMany();
    if (!applies.length) return { items: [], total: 0, page, limit };

    // 상담 레코드를 일괄 로드 (소프트 삭제분은 제외된다).
    const inqs = await this.inq.find({
      where: { id: In(applies.map((a) => a.inqId)), entId },
    });
    const byId = new Map(inqs.map((i) => [i.id, i]));

    const needle = query.q?.trim().toLocaleLowerCase();
    const digits = needle ? needle.replace(/[^0-9]/g, '') : '';
    const items: MapApplyListItem[] = [];
    for (const a of applies) {
      const inq = byId.get(a.inqId);
      if (!inq) continue; // 상담이 삭제된 신청은 목록에서 숨긴다
      if (query.stage && inq.currentStage !== query.stage) continue;
      const item = this.toListItem(a, inq);
      if (needle) {
        const hit =
          item.studentName.toLocaleLowerCase().includes(needle) ||
          (item.studentNameEn ?? '').toLocaleLowerCase().includes(needle) ||
          (digits.length >= 2 &&
            (item.parentPhone ?? '').replace(/[^0-9]/g, '').includes(digits));
        if (!hit) continue;
      }
      items.push(item);
    }

    return {
      items: items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit,
    };
  }

  async detail(entId: string, id: string): Promise<MapApplyDetail> {
    const row = await this.repo.findOne({ where: { id, entId } });
    if (!row) throw new NotFoundException('MAP_APPLY_NOT_FOUND');
    const inq = await this.inq.findOne({
      where: { id: row.inqId, entId },
    });
    if (!inq) throw new NotFoundException('INQUIRY_NOT_FOUND');
    const view = this.inquiryService.toView(inq);
    return {
      id: row.id,
      inqId: row.inqId,
      seqNo: view.seqNo,
      submittedAt: row.submittedAt.toISOString(),
      sourceSite: row.sourceSite,
      origin: row.origin,
      studentName: view.studentName,
      studentNameEn: row.studentNameEn ?? null,
      birthdate: row.birthdate ?? null,
      birthdateRaw: row.birthdateRaw ?? null,
      grade: view.grade ?? null,
      gender: (row.gender as MapApplyGender | null) ?? null,
      parentPhone: view.parentPhone,
      parentEmail: view.parentEmail,
      examLocation: row.examLocation ?? null,
      preferredSlot: row.preferredSlot ?? null,
      currentStage: view.currentStage,
      registeredAt: view.registeredAt,
      followupAt: view.followupAt ?? null,
      followupMemo: view.followupMemo ?? null,
      advisorId: view.advisorId ?? null,
      rawPayload: row.rawPayload ?? null,
    };
  }

  async update(
    entId: string,
    id: string,
    dto: UpdateMapApplyDto,
  ): Promise<MapApplyDetail> {
    const row = await this.repo.findOne({ where: { id, entId } });
    if (!row) throw new NotFoundException('MAP_APPLY_NOT_FOUND');

    if (dto.studentNameEn !== undefined) {
      row.studentNameEn = dto.studentNameEn.trim() || null;
    }
    if (dto.birthdate !== undefined) {
      const bd = MapApplyService.normalizeBirthdate(dto.birthdate);
      row.birthdate = bd.date;
      row.birthdateRaw = bd.date ? null : bd.raw;
    }
    if (dto.gender !== undefined) row.gender = dto.gender;
    if (dto.examLocation !== undefined) {
      row.examLocation = dto.examLocation.trim() || null;
    }
    if (dto.preferredSlot !== undefined) {
      row.preferredSlot = dto.preferredSlot.trim() || null;
    }
    row.updatedAt = new Date();
    await this.repo.save(row);

    // REQ-260921B — 생년월일·성별은 상담 본체(inq_birthdate/inq_gender)와 동기.
    if (dto.birthdate !== undefined || dto.gender !== undefined) {
      const inq = await this.inq.findOne({
        where: { id: row.inqId, entId },
      });
      if (inq) {
        if (dto.birthdate !== undefined) inq.birthdate = row.birthdate ?? null;
        if (dto.gender !== undefined) inq.gender = row.gender ?? null;
        await this.inq.save(inq);
      }
    }
    return this.detail(entId, id);
  }

  /**
   * REQ-260921B — 콘솔에서 등록/수정된 상담을 맵테스트 부속 행에 반영한다.
   *   - 구분=MAP_TEST 인데 부속 행이 없으면 생성(origin=CONSOLE) → /admin/test 노출
   *   - 부속 행이 있으면 생년월일·성별을 상담 본체 기준으로 맞춘다
   * 구분이 TUTORING 으로 바뀌어도 부속 행은 지우지 않는다(접수 원문 보존).
   */
  async reflectInquiry(entId: string, inqId: string): Promise<void> {
    const inq = await this.inq.findOne({ where: { id: inqId, entId } });
    if (!inq) return;
    const existing = await this.repo.findOne({ where: { inqId, entId } });
    if (existing) {
      const nextBirth = inq.birthdate ?? null;
      const nextGender = inq.gender ?? null;
      if (
        (existing.birthdate ?? null) !== nextBirth ||
        (existing.gender ?? null) !== nextGender
      ) {
        existing.birthdate = nextBirth;
        if (nextBirth) existing.birthdateRaw = null;
        existing.gender = nextGender;
        existing.updatedAt = new Date();
        await this.repo.save(existing);
      }
      return;
    }
    if (inq.kind !== 'MAP_TEST') return;
    const now = new Date();
    await this.repo.save(
      this.repo.create({
        id: randomUUID(),
        entId,
        inqId,
        submittedAt: inq.createdAt ?? now,
        studentNameEn: null,
        birthdate: inq.birthdate ?? null,
        birthdateRaw: null,
        gender: inq.gender ?? null,
        examLocation: null,
        preferredSlot: null,
        sourceSite: inq.sourceSite ?? inq.siteOverride ?? 'TPI',
        origin: 'CONSOLE',
        importKey: null,
        rawPayload: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    this.log.log(`map-apply row created from console inquiry inq=${inqId}`);
  }

  // ────────────────────────────────────────────────────────────────────
  // 아임웹 누적 CSV 이관 (REQ-260916 §8)
  // ────────────────────────────────────────────────────────────────────
  async importRows(
    entId: string,
    dto: ImportMapApplyDto,
  ): Promise<{
    site: string;
    inserted: number;
    skipped: number;
    failed: number;
    dryRun: boolean;
    errors: Array<{ index: number; reason: string }>;
  }> {
    const dryRun = dto.dryRun === true;
    const errors: Array<{ index: number; reason: string }> = [];
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < dto.rows.length; i += 1) {
      const r = dto.rows[i];
      try {
        const submittedAt = MapApplyService.normalizeSubmittedAt(r.submittedAt);
        if (!submittedAt) {
          errors.push({ index: i, reason: 'INVALID_SUBMITTED_AT' });
          continue;
        }
        const key = MapApplyService.importKeyOf(
          dto.site,
          submittedAt,
          r.studentName,
        );
        const dup = await this.repo.findOne({
          where: { entId, importKey: key },
        });
        if (dup) {
          skipped += 1;
          continue;
        }
        if (dryRun) {
          inserted += 1;
          continue;
        }

        const bd = MapApplyService.normalizeBirthdate(r.birthdate);
        const view = await this.inquiryService.create(entId, {
          studentName: r.studentName,
          parentPhone: r.parentPhone || undefined,
          parentEmail: r.parentEmail || undefined,
          phoneStatus: r.parentPhone ? 'PROVIDED' : 'UNKNOWN',
          grade: r.grade || undefined,
          inflowType: 'WEB_EXTERNAL',
          sourceSite: dto.site,
          applyType: 'EXAM_ONLY',
          applyPurposes: ['MAP_TEST_TUTORING'],
          registeredAt: MapApplyService.ymd(submittedAt),
          kind: 'MAP_TEST',
          birthdate: bd.date ?? undefined,
          gender: r.gender ?? undefined,
        });

        const now = new Date();
        await this.repo.save(
          this.repo.create({
            id: randomUUID(),
            entId,
            inqId: view.id,
            submittedAt,
            studentNameEn: r.studentNameEn?.trim() || null,
            birthdate: bd.date,
            birthdateRaw: bd.date ? null : bd.raw,
            gender: r.gender ?? null,
            examLocation: r.examLocation?.trim() || null,
            preferredSlot: r.preferredSlot?.trim() || null,
            sourceSite: dto.site,
            origin: 'IMPORT',
            importKey: key,
            rawPayload: { ...r },
            createdAt: now,
            updatedAt: now,
          }),
        );
        inserted += 1;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.log.warn(`map-apply import row ${i} failed: ${msg}`);
        errors.push({ index: i, reason: msg.slice(0, 200) });
      }
    }

    this.log.log(
      `map-apply import ent=${entId} site=${dto.site} dryRun=${dryRun} inserted=${inserted} skipped=${skipped} failed=${errors.length}`,
    );
    return {
      site: dto.site,
      inserted,
      skipped,
      failed: errors.length,
      dryRun,
      errors: errors.slice(0, 50),
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // CSV 내보내기
  // ────────────────────────────────────────────────────────────────────
  async exportCsv(entId: string, query: ListMapApplyQueryDto): Promise<string> {
    const { items } = await this.list(entId, { ...query, page: 1, limit: 200 });
    const header = [
      '번호',
      '접수일시',
      '사이트',
      '학생 한글이름',
      '학생 영문이름',
      '생년월일',
      '학년',
      '성별',
      '연락처',
      '학부모 이메일',
      '응시 국가/도시',
      '희망 요일/시간',
      '단계',
      '출처',
    ];
    const esc = (v: unknown): string => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of items) {
      lines.push(
        [
          r.seqNo,
          r.submittedAt,
          r.sourceSite,
          r.studentName,
          r.studentNameEn,
          r.birthdate,
          r.grade,
          r.gender === 'M' ? '남' : r.gender === 'F' ? '여' : '',
          r.parentPhone,
          r.parentEmail,
          r.examLocation,
          r.preferredSlot,
          r.currentStage,
          r.origin,
        ]
          .map(esc)
          .join(','),
      );
    }
    // UTF-8 BOM — 엑셀에서 한글이 깨지지 않도록
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }

  // ────────────────────────────────────────────────────────────────────
  private toListItem(
    e: MapApplyTypeormEntity,
    inq: InquiryTypeormEntity,
  ): MapApplyListItem {
    const view = this.inquiryService.toView(inq);
    return {
      id: e.id,
      inqId: e.inqId,
      seqNo: view.seqNo,
      submittedAt: e.submittedAt.toISOString(),
      sourceSite: e.sourceSite,
      origin: e.origin,
      studentName: view.studentName,
      studentNameEn: e.studentNameEn ?? null,
      birthdate: e.birthdate ?? null,
      grade: view.grade ?? null,
      gender: (e.gender as MapApplyGender | null) ?? null,
      parentPhone: view.parentPhone,
      parentEmail: view.parentEmail,
      examLocation: e.examLocation ?? null,
      preferredSlot: e.preferredSlot ?? null,
      currentStage: view.currentStage,
    };
  }
}
