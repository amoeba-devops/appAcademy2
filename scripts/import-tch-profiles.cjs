#!/usr/bin/env node
// Run from backend directory, using its pg dependency. Dry-run by default.
const fs = require("node:fs");
const { createRequire } = require("node:module");
const { Client } = createRequire(process.cwd() + "/package.json")("pg");
const fields = {
  education: "tch_education",
  experience: "tch_experience",
  teachingSubjectsText: "tch_teaching_subjects_text",
  profileText: "tch_profile_text",
  residence: "tch_residence",
  gender: "tch_gender",
  phone: "tch_phone",
  kakaoId: "tch_kakao_id",
};
const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const entId = process.argv[3];
const apply = process.argv.includes("--apply");
if (
  !entId ||
  payload.teachers.length !== 21 ||
  new Set(payload.teachers.map((t) => t.name)).size !== 21
)
  throw new Error("Invalid tenant or roster");
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
      "LOCK TABLE amb_acm_tch_teacher IN SHARE ROW EXCLUSIVE MODE",
    );
    const before = (
      await client.query(
        "SELECT * FROM amb_acm_tch_teacher WHERE ent_id=$1 FOR UPDATE",
        [entId],
      )
    ).rows;
    const stats = {
      created: 0,
      updated: 0,
      unchanged: 0,
      heldFields: 0,
      existingConflicts: 0,
    };
    const changes = [];
    for (const teacher of payload.teachers) {
      const matches = before.filter(
        (row) => row.tch_name.trim() === teacher.name,
      );
      if (matches.length > 1 || matches.some((r) => r.deleted_at))
        throw new Error("Ambiguous or deleted teacher match");
      const old = matches[0];
      if (teacher.name === "정성경" && !old)
        throw new Error("Required existing teacher missing");
      const values = {};
      stats.heldFields += teacher.held.length;
      for (const [source, column] of Object.entries(fields)) {
        const value = teacher[source];
        if (value == null || !value.trim()) continue;
        const max =
          {
            phone: 30,
            kakaoId: 100,
            residence: 200,
            gender: 20,
            profileText: 20000,
          }[source] || 4000;
        if (value.length > max) throw new Error("Source field too long");
        if (!old || old[column] == null || old[column] === "")
          values[column] = value;
        else if (old[column] !== value) stats.existingConflicts++;
      }
      const subjects = [
        ...new Set([...(old?.tch_subjects || []), ...teacher.subjects]),
      ];
      if (!old || JSON.stringify(subjects) !== JSON.stringify(old.tch_subjects))
        values.tch_subjects = JSON.stringify(subjects);
      if (!old) {
        Object.assign(values, {
          ent_id: entId,
          tch_name: teacher.name,
          tch_email: null,
          tch_employment_type: null,
          tch_status: "ACTIVE",
          tch_is_instructor: true,
        });
        const columns = Object.keys(values);
        const saved = await client.query(
          `INSERT INTO amb_acm_tch_teacher (${columns.join(",")}) VALUES (${columns.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING tch_id`,
          Object.values(values),
        );
        changes.push({ id: saved.rows[0].tch_id, before: null });
        stats.created++;
      } else if (Object.keys(values).length) {
        const columns = Object.keys(values);
        await client.query(
          `UPDATE amb_acm_tch_teacher SET ${columns.map((c, i) => c + "=$" + (i + 1)).join(",")}, updated_at=NOW() WHERE tch_id=$${columns.length + 1} AND ent_id=$${columns.length + 2}`,
          [...Object.values(values), old.tch_id, entId],
        );
        changes.push({ id: old.tch_id, before: old });
        stats.updated++;
      } else stats.unchanged++;
    }
    const after = (
      await client.query("SELECT * FROM amb_acm_tch_teacher WHERE ent_id=$1", [
        entId,
      ])
    ).rows;
    const changedIds = new Set(changes.map((c) => c.id));
    const allowed = new Set([
      ...Object.values(fields),
      "tch_subjects",
      "updated_at",
    ]);
    for (const old of before) {
      const current = after.find((row) => row.tch_id === old.tch_id);
      if (!current) throw new Error("Existing teacher disappeared");
      for (const key of Object.keys(old)) {
        if (changedIds.has(old.tch_id) && allowed.has(key)) continue;
        if (JSON.stringify(old[key]) !== JSON.stringify(current[key]))
          throw new Error("Unintended field change");
      }
    }
    if (after.length !== before.length + stats.created)
      throw new Error("Unexpected teacher count");
    if (apply) {
      const auditPath = process.env.TCH_IMPORT_AUDIT;
      if (!auditPath) throw new Error("Server audit path required");
      fs.writeFileSync(
        auditPath,
        JSON.stringify({
          sourceSha256: payload.sourceSha256,
          entId,
          stats,
          changes: changes.map((c) => ({
            ...c,
            after: after.find((row) => row.tch_id === c.id),
          })),
          at: new Date().toISOString(),
        }),
        { mode: 0o600, flag: "wx" },
      );
      await client.query("COMMIT");
    } else await client.query("ROLLBACK");
    console.log(
      JSON.stringify({ mode: apply ? "applied" : "dry-run", ...stats }),
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
})().catch(() => {
  console.error(
    "Import failed; transaction rolled back. Inspect server-side diagnostics without exporting personal data.",
  );
  process.exitCode = 1;
});
