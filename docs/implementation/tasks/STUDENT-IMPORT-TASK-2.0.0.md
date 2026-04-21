---
document_id: STUDENT-IMPORT-TASK-2.0.0
version: 2.0.0
status: APPROVED
date: 2026-04-22
author: Claude Code (pair with @gray.kim)
supersedes: null
builds_on: STUDENT-IMPORT-TASK-1.0.0
change_log:
  - "2.0.0 (2026-04-22): Extend Excel import to sheet 4 (구 학생 정보, 97 rows) and sheet 2 (학부모 및 학생 상담, 26 rows)."
---

# TPI Student Import v2 — Sheets 2 & 4

## 1. Overview (개요)

Build on v1.0.0 import to ingest:

- **Sheet 4 `구 학생 정보`** (97 students) — historical/active roster
  with real phone numbers, birthdays, MAP scores, and textbook lists.
  Includes terminated students.
- **Sheet 2 `학부모 및 학생 상담`** (26 students) — bimonthly parent
  consultation cycle registry; structurally empty template with 2
  new student names not in Sheet 1.

No additional schema migration is required — v1.0.0 columns suffice.

## 2. Approved Answers (확정 사항)

| Q | Answer |
|---|--------|
| Q-F | Placeholder names (`듀오링고 G5`, `Erica`, etc.) — store verbatim in `std_name` with `std_note` prefixed `[PLACEHOLDER]` |
| Q-G | AES_ENCRYPT with dev key `SHA2('trinity-dev-key',256)`; production re-encryption is a separate task |
| Q-H | `v` 없는 종료 학생 → `std_lifecycle_status='TERMINATED'`, enrollment 스킵 |
| Q-I | 6-digit MAP (`222254`) → Reading(222) + Math(254) |
| Q-J | Sheet 2 `tac_consultations.cst_channel='RECURRING'` |
| Q-K | 기존 placeholder 부모 참조 **소급 교체 X** (v1.0.0 데이터 보존) |
| Q-L | Sheet 2 의 성별/기타 필드가 Sheet 1 과 충돌 시 **Sheet 2 가 최신** — UPDATE |

## 3. Import Algorithm Summary

```
Python generator (scripts/build-seed-v2.py)
  1. Read xlsx (openpyxl, data_only)
  2. Parse sheet 4 → rows + continuation-row merging
  3. Parse sheet 2 → student roster (template text filtered)
  4. Normalize names / phones / birthdays / MAP scores
  5. Emit /tmp/tpi_seed_v2_review.json (human review)
  6. Emit sql/seed-tpi-students-v2.sql
```

### 3.1 Parsing heuristics

| Pattern | Example | Output |
|---------|---------|--------|
| `'{region} G{grade}, {name}'` | `'밀라노로 G9, 정가원'` | name=정가원, residence=밀라노, grade=G9 |
| `'{korean}/{english}'` | `'고유진/Chloe'` | name=고유진, english_name=Chloe |
| `'{korean}({english})'` | `'장연우(Jamy)'` | name=장연우, english_name=Jamy |
| English-only | `'Erica'` | name=Erica, note prefixed `[PLACEHOLDER]` if no grade/phone |
| numeric birth `20120216.0` | | `2012-02-16` |
| numeric birth `2017117.0` | | heuristic `2017-01-17` (1-digit month) |
| numeric birth `2010.0`, `201009.0` | | NULL (incomplete) |
| phone `1042951804.0` | | `01042951804` → AES_ENCRYPT |
| MAP 6-digit `222254` | | reading=222, math=254 |
| MAP `'234,223(리딩/랭귀지아트)'` | | reading=234, language=223 |
| MAP 3-digit `230` | | reading=230 (single score assumed Reading) |

### 3.2 Dedup & UPSERT

- Match Sheet 4 rows to existing `tac_students` by `acd_id + std_name` (after normalization).
- Match strategy: **fill NULLs only** — do not overwrite non-NULL
  values except where Q-L applies (Sheet 2 gender).

### 3.3 Parent creation

- Unique phone number in Sheet 4 → one `tac_parents` row
- Parent name: `'[IMPORTED] Guardian ({first_child_name})'`
- Siblings with same phone share the same `prt_id`
- Students without phone → keep placeholder parent (v1.0.0)

### 3.4 Teacher onboarding

Additional teachers introduced by Sheet 4:

| Name | AMA Client ID (placeholder) |
|------|----------------------------|
| 조혜수 | `PENDING-TPI-CHS` |
| 임승희 | `PENDING-TPI-LSH` |
| 손민서 | `PENDING-TPI-SMS` |
| 한승희 | `PENDING-TPI-HSH` |
| 김경진 | `PENDING-TPI-KKJ` |

(Each `INSERT IGNORE` on existing `(acd_id, tch_ama_client_id)`.)

## 4. Deliverables

| File | Description |
|------|-------------|
| `scripts/build-seed-v2.py` | Generator script — reads xlsx, emits JSON + SQL |
| `/tmp/tpi_seed_v2_review.json` | Parsed intermediate for human review (gitignored) |
| `sql/seed-tpi-students-v2.sql` | Generated seed SQL (depends on v1.0.0) |
| `docs/implementation/tasks/STUDENT-IMPORT-TASK-2.0.0.md` | This document |

## 5. Execution Order

```bash
# (seed-dev.sql + migration-student-import-1.0.0.sql + seed-tpi-students.sql already applied)
python3 scripts/build-seed-v2.py
# Review /tmp/tpi_seed_v2_review.json, then:
docker exec -i tac-mysql mysql -uroot -ppassword db_tac \
  < sql/seed-tpi-students-v2.sql
```

## 6. Verification

```sql
-- Total students ~ 99 (24 v1 + 2 sheet2-new + sheet4 net-new after dedup)
SELECT COUNT(*) FROM tac_students WHERE acd_id=@acd;

-- Lifecycle: ACTIVE (v-marked) vs TERMINATED (others)
SELECT std_lifecycle_status, COUNT(*) FROM tac_students WHERE acd_id=@acd GROUP BY 1;

-- Parent entities (placeholder 1 + unique phones)
SELECT COUNT(*) FROM tac_parents WHERE acd_id=@acd;

-- Consultation cycle
SELECT COUNT(*) FROM tac_consultations WHERE acd_id=@acd;  -- 26

-- MAP score entries
SELECT COUNT(*) FROM tac_map_scores;

-- Sibling pairs (parents with >1 student)
SELECT prt_id, COUNT(*) AS children FROM tac_students
 WHERE acd_id=@acd GROUP BY prt_id HAVING COUNT(*)>1;
```

## 7. Out of Scope

- Sheet 3 `수업 종료 학생` (not requested)
- Production-grade phone encryption (AES-GCM via KMS) — placeholder
  only; tracked as separate follow-up task
- Structured parent name collection — placeholder `[IMPORTED] Guardian`
- MAP score source differentiation (dated vs undated) — all imported
  rows use `msc_assessed_at=CURRENT_DATE` with `msc_source='IMPORT'`
