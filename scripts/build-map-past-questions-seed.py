#!/usr/bin/env python3
"""
Build seed SQL for ACM MAP past questions from xlsx.

Source : docs/reference/MAP_RC_G2-4_기출문제.xlsx
Output : sql/acm/721-seed-map-past-questions-rc-g2-4.sql

Mapping:
  - ent_id        = trinity (00000000-0000-0000-0000-000000000001)
  - source        = 'MAP_RC_G2-4_PAST'
  - grade         = 'G3' for all rows (xlsx has no grade column; operator can
                    reassign via UI). The filename indicates G2-4 mixed.
  - paired rows   = passage_2 present → secondary passage row sharing
                    pair_group_id with the primary
  - answer        = NULL for all (xlsx has no answers; operator inputs later)

Idempotent via ON CONFLICT (ent_id, mpq_grade, mpq_external_no, mpq_source).
"""

from __future__ import annotations

import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SRC_XLSX = ROOT / "docs/reference/MAP_RC_G2-4_기출문제.xlsx"
OUT_SQL = ROOT / "sql/acm/721-seed-map-past-questions-rc-g2-4.sql"

ENT_ID = "00000000-0000-0000-0000-000000000001"
SOURCE = "MAP_RC_G2-4_PAST"
DEFAULT_GRADE = "G3"


def sql_str(value: object) -> str:
    if value is None:
        return "NULL"
    # PG standard_conforming_strings=on: backslash is literal; only escape single quotes.
    s = str(value).replace("'", "''")
    return "'" + s + "'"


def sql_jsonb_choices(c1: str, c2: str, c3: str, c4: str) -> str:
    import json

    payload = json.dumps([c1 or "", c2 or "", c3 or "", c4 or ""], ensure_ascii=False)
    # JSON already escapes " and \\; only need to double single quotes for PG literal.
    payload = payload.replace("'", "''")
    return "'" + payload + "'::jsonb"


def main() -> int:
    if not SRC_XLSX.exists():
        print(f"ERROR: missing source xlsx: {SRC_XLSX}", file=sys.stderr)
        return 1

    wb = openpyxl.load_workbook(SRC_XLSX, data_only=True)
    ws = wb.worksheets[0]

    rows: list[tuple] = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue
        if not row or row[0] is None:
            continue
        question_no = int(row[0])
        passage_1 = row[1] or ""
        passage_2 = row[2]
        glossary = row[3]
        question = row[4] or ""
        c1, c2, c3, c4 = row[5] or "", row[6] or "", row[7] or "", row[8] or ""
        answer = row[9]
        rows.append(
            (question_no, passage_1, passage_2, glossary, question, c1, c2, c3, c4, answer)
        )

    lines: list[str] = []
    lines.append(
        "-- ============================================================================\n"
        "-- ACM MAP — Seed: MAP RC G2-4 past questions (auto-generated)\n"
        "-- DO NOT EDIT BY HAND. Regenerate via:\n"
        "--   python3 scripts/build-map-past-questions-seed.py\n"
        "-- @see docs/reference/MAP_RC_G2-4_기출문제.xlsx\n"
        "-- Idempotent. Safe to re-run.\n"
        "-- ============================================================================\n"
    )
    lines.append(f"-- ent_id={ENT_ID} source={SOURCE} grade={DEFAULT_GRADE}\n")
    lines.append(f"-- total questions: {len(rows)}\n\n")

    lines.append("BEGIN;\n\n")

    for qno, p1, p2, gloss, q, c1, c2, c3, c4, ans in rows:
        ans_idx = None
        if isinstance(ans, (int, float)) and 1 <= int(ans) <= 4:
            ans_idx = int(ans) - 1

        # Generate deterministic UUIDs derived from question_no for idempotency
        # Format: 00000000-0000-4000-8000-{12hex}
        # We embed qno in the last 12 hex digits.
        hex_qno = f"{qno:012d}"
        primary_pid = f"00000000-0000-4000-8000-{hex_qno}"
        pair_id = primary_pid if p2 else None

        # 1. Primary passage upsert (delete-then-insert via WHERE NOT EXISTS pattern
        #    — but we need stable IDs so the question can FK them. Use deterministic UUIDs.)
        lines.append(
            "INSERT INTO amb_acm_map_passage "
            "(mpg_id, ent_id, mpg_grade, mpg_domain, mpg_body, mpg_glossary, "
            "mpg_pair_group_id, mpg_ordinal, mpg_source, mpg_status) "
            "VALUES ("
            f"{sql_str(primary_pid)}, {sql_str(ENT_ID)}, {sql_str(DEFAULT_GRADE)}, "
            f"'RC', {sql_str(p1)}, {sql_str(gloss)}, "
            f"{sql_str(pair_id) if pair_id else 'NULL'}, 1, "
            f"{sql_str(SOURCE)}, 'PUBLISHED'"
            ") ON CONFLICT (mpg_id) DO UPDATE SET "
            "mpg_body = EXCLUDED.mpg_body, "
            "mpg_glossary = EXCLUDED.mpg_glossary, "
            "mpg_pair_group_id = EXCLUDED.mpg_pair_group_id, "
            "mpg_grade = EXCLUDED.mpg_grade, "
            "updated_at = NOW();\n"
        )

        # 2. Secondary passage (paired) — derived UUID with high bit
        if p2:
            secondary_pid = f"00000000-0000-4000-8001-{hex_qno}"
            lines.append(
                "INSERT INTO amb_acm_map_passage "
                "(mpg_id, ent_id, mpg_grade, mpg_domain, mpg_body, mpg_glossary, "
                "mpg_pair_group_id, mpg_ordinal, mpg_source, mpg_status) "
                "VALUES ("
                f"{sql_str(secondary_pid)}, {sql_str(ENT_ID)}, {sql_str(DEFAULT_GRADE)}, "
                f"'RC', {sql_str(p2)}, NULL, "
                f"{sql_str(pair_id)}, 2, "
                f"{sql_str(SOURCE)}, 'PUBLISHED'"
                ") ON CONFLICT (mpg_id) DO UPDATE SET "
                "mpg_body = EXCLUDED.mpg_body, "
                "mpg_pair_group_id = EXCLUDED.mpg_pair_group_id, "
                "mpg_grade = EXCLUDED.mpg_grade, "
                "updated_at = NOW();\n"
            )

        # 3. Question upsert
        ans_sql = "NULL" if ans_idx is None else str(ans_idx)
        status = "PUBLISHED" if ans_idx is not None else "DRAFT"
        lines.append(
            "INSERT INTO amb_acm_map_question "
            "(ent_id, mpg_id, mpq_grade, mpq_domain, mpq_external_no, "
            "mpq_question, mpq_choices, mpq_answer_index, mpq_difficulty, "
            "mpq_source, mpq_status) "
            "VALUES ("
            f"{sql_str(ENT_ID)}, {sql_str(primary_pid)}, {sql_str(DEFAULT_GRADE)}, "
            f"'RC', {qno}, {sql_str(q)}, "
            f"{sql_jsonb_choices(c1, c2, c3, c4)}, {ans_sql}, 'INTERMEDIATE', "
            f"{sql_str(SOURCE)}, '{status}'"
            ") ON CONFLICT (ent_id, mpq_grade, mpq_external_no, mpq_source) DO UPDATE SET "
            "mpg_id = EXCLUDED.mpg_id, "
            "mpq_question = EXCLUDED.mpq_question, "
            "mpq_choices = EXCLUDED.mpq_choices, "
            "mpq_answer_index = EXCLUDED.mpq_answer_index, "
            "mpq_status = EXCLUDED.mpq_status, "
            "mpq_version = amb_acm_map_question.mpq_version + 1, "
            "updated_at = NOW();\n\n"
        )

    lines.append("COMMIT;\n")

    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    OUT_SQL.write_text("".join(lines), encoding="utf-8")
    print(f"Wrote {OUT_SQL} — {len(rows)} questions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
