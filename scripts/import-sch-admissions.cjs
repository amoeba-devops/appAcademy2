#!/usr/bin/env node
// Run from backend directory. Dry-run writes a protected before-image and review plan.
// Apply requires the exact plan and an unchanged database snapshot. Never inserts schools.
const fs = require("node:fs");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const { Client } = createRequire(process.cwd() + "/package.json")("pg");
const [sourcePath, entId, planPath] = process.argv.slice(2);
const apply = process.argv.includes("--apply");
const payload = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (
  !entId ||
  !planPath ||
  payload.schools.length !== 18 ||
  payload.schools.reduce((n, s) => n + s.admissions.length, 0) !== 33
)
  throw Error("Invalid arguments or source");
const hash = (v) =>
  crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
const normalize = (s) => s.trim();
const client = new Client({
  host: process.env.ACM_PG_HOST,
  port: Number(process.env.ACM_PG_PORT || 5432),
  user: process.env.ACM_PG_USER,
  password: process.env.ACM_PG_PASSWORD,
  database: process.env.ACM_PG_DATABASE || "db_acm",
});
(async () => {
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "LOCK TABLE amb_acm_sch_school,amb_acm_sch_admission_info IN SHARE ROW EXCLUSIVE MODE",
    );
    const schools = (
      await client.query(
        "SELECT * FROM amb_acm_sch_school WHERE ent_id=$1 ORDER BY sch_id",
        [entId],
      )
    ).rows;
    const admissions = (
      await client.query(
        "SELECT * FROM amb_acm_sch_admission_info WHERE ent_id=$1 ORDER BY sai_id",
        [entId],
      )
    ).rows;
    const snapshot = { schools, admissions };
    const fingerprint = hash(snapshot);
    const runId = crypto.randomUUID();
    const changes = [];
    for (const source of payload.schools) {
      const candidates = schools.filter(
        (s) => normalize(s.name) === source.name,
      );
      if (candidates.length !== 1 || candidates[0].deleted_at)
        throw Error("Ambiguous/missing/deleted school: " + source.name);
      const old = candidates[0];
      const fields = {};
      for (const [key, col] of Object.entries({
        curriculumDescription: "curriculum_description",
        region: "region",
        eligibility: "eligibility",
        notes: "notes",
        isAuthorized: "is_authorized",
      })) {
        const val = source[key];
        if (val == null || val === "") continue;
        if (old[col] !== val) fields[col] = { before: old[col], after: val };
      }
      const sourceRows = admissions.filter(
        (a) =>
          a.source_file_hash === payload.fileHash && a.sch_id === old.sch_id,
      );
      if (sourceRows.length && sourceRows.length !== source.admissions.length)
        throw Error("Partially applied source, manual review required");
      // Already imported source is never replayed over subsequent user edits or soft-deletes.
      changes.push({
        id: old.sch_id,
        name: source.name,
        fields: sourceRows.length ? {} : fields,
        admissions: sourceRows.length ? [] : source.admissions,
      });
    }
    const summary = {
      schools: changes.length,
      updated: changes.filter((c) => Object.keys(c.fields).length).length,
      admissions: changes.reduce((n, c) => n + c.admissions.length, 0),
      authorizationCorrections: changes.filter((c) => c.fields.is_authorized)
        .length,
    };
    if (!apply) {
      fs.writeFileSync(
        planPath,
        JSON.stringify(
          {
            entId,
            fileHash: payload.fileHash,
            payloadHash: hash(payload),
            fingerprint,
            runId,
            summary,
            changes,
            before: snapshot,
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
      await client.query("ROLLBACK");
      console.log(JSON.stringify({ mode: "dry-run", ...summary, planPath }));
      return;
    }
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    if (
      plan.entId !== entId ||
      plan.fileHash !== payload.fileHash ||
      plan.payloadHash !== hash(payload) ||
      plan.fingerprint !== fingerprint ||
      hash(plan.changes) !== hash(changes)
    )
      throw Error("Source or database changed since dry-run");
    for (const c of changes) {
      const entries = Object.entries(c.fields);
      if (entries.length)
        await client.query(
          `UPDATE amb_acm_sch_school SET ${entries.map(([k], i) => `${k}=$${i + 3}`).join(",")},updated_at=now() WHERE ent_id=$1 AND sch_id=$2`,
          [entId, c.id, ...entries.map(([, v]) => v.after)],
        );
      for (const [order, a] of c.admissions.entries())
        await client.query(
          `INSERT INTO amb_acm_sch_admission_info(ent_id,sch_id,target_label,exam_content,schedule_text,sort_order,source_file_hash,source_sheet,source_row,import_run_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            entId,
            c.id,
            a.targetLabel,
            a.examContent,
            a.scheduleText,
            order,
            payload.fileHash,
            payload.sheet,
            a.sourceRow,
            plan.runId,
          ],
        );
    }
    const result = (
      await client.query(
        "SELECT count(*)::int AS count FROM amb_acm_sch_admission_info WHERE ent_id=$1 AND source_file_hash=$2",
        [entId, payload.fileHash],
      )
    ).rows[0];
    if (result.count !== 33) throw Error("Post-apply count mismatch");
    await client.query("COMMIT");
    console.log(
      JSON.stringify({
        mode: "applied",
        ...summary,
        sourceRows: result.count,
        runId: plan.runId,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
