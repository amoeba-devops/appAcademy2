#!/usr/bin/env node
// Run from backend/ (built application dependencies). Dry-run by default.
// --email EMAIL --cutoff ISO --snapshot /private/path.json
// --apply additionally requires --expect SHA256 from reviewed dry-run.
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const load = createRequire(process.cwd() + "/package.json");
const ICAL = load("ical.js");
const normalize = (c) =>
  c === "CLASS"
    ? "REGULAR_CLASS"
    : ["EVENT", "PERSONAL"].includes(c)
      ? "OTHER"
      : c;
const isClass = (c) => ["CLASS", "REGULAR_CLASS"].includes(c);
const tables = {
  events: ["amb_acm_cal_event", "evt_id"],
  sources: ["amb_acm_cal_ics_source", "cis_id"],
  series: ["amb_acm_cal_recurrence_series", "crs_id"],
  colors: ["amb_acm_cal_color_setting", "ccs_id"],
};
async function plan(c, entId, cutoff) {
  if (!Number.isFinite(+new Date(cutoff))) throw Error("Invalid cutoff");
  cutoff = new Date(cutoff).toISOString();
  const sources = (
    await c.query(
      "SELECT * FROM amb_acm_cal_ics_source WHERE ent_id=$1 ORDER BY cis_id",
      [entId],
    )
  ).rows;
  const repeating = new Set();
  for (const s of sources) {
    if (!isClass(s.category)) continue;
    const root = new ICAL.Component(ICAL.parse(s.ical_text));
    if (
      root
        .getAllSubcomponents("vevent")
        .some((e) => e.hasProperty("rrule") || e.hasProperty("rdate"))
    ) {
      repeating.add(s.cis_id);
      if (
        s.is_unbounded &&
        !s.stopped_at &&
        (!s.generated_until || +s.generated_until < +new Date(cutoff))
      )
        throw Error("Generate October ICS occurrences before stopping source");
    }
  }
  const series = (
    await c.query(
      "SELECT * FROM amb_acm_cal_recurrence_series WHERE ent_id=$1 ORDER BY crs_id",
      [entId],
    )
  ).rows;
  const native = new Set(
    series
      .filter((s) => isClass(s.crs_template.evtCategory))
      .map((s) => s.crs_id),
  );
  for (const s of series.filter((s) => native.has(s.crs_id))) {
    if (
      !s.crs_stop_at &&
      (!s.crs_generated_until || +s.crs_generated_until < +new Date(cutoff))
    )
      throw Error("Generate October native occurrences before stopping series");
    if (
      s.crs_changes.some(
        (x) => x.patch?.evtCategory && !isClass(x.patch.evtCategory),
      )
    )
      throw Error("Mixed category series requires review");
  }
  const events = (
    await c.query(
      `SELECT e.evt_id,e.evt_category,e.deleted_at,e.evt_deleted_by,e.evt_delete_reason,e.updated_at,e.evt_start_at,i.cis_id,r.crs_id
    FROM amb_acm_cal_event e LEFT JOIN amb_acm_cal_ics_occurrence i ON i.ent_id=e.ent_id AND i.evt_id=e.evt_id
    LEFT JOIN amb_acm_cal_recurrence_occurrence r ON r.ent_id=e.ent_id AND r.evt_id=e.evt_id WHERE e.ent_id=$1 ORDER BY e.evt_id`,
      [entId],
    )
  ).rows;
  const changes = { events: [], sources: [], series: [], colors: [] };
  const summary = {
    migratedClass: 0,
    migratedEvent: 0,
    migratedPersonal: 0,
    removedIcs: 0,
    removedNative: 0,
    stoppedIcs: 0,
    stoppedNative: 0,
  };
  for (const e of events) {
    const after = {};
    const category = normalize(e.evt_category);
    if (category !== e.evt_category) {
      after.evt_category = category;
      if (!e.deleted_at)
        summary[
          {
            CLASS: "migratedClass",
            EVENT: "migratedEvent",
            PERSONAL: "migratedPersonal",
          }[e.evt_category]
        ]++;
    }
    const remove =
      !e.deleted_at &&
      isClass(e.evt_category) &&
      +e.evt_start_at >= +new Date(cutoff) &&
      (repeating.has(e.cis_id) || native.has(e.crs_id));
    if (remove) {
      after.deleted_at = "$NOW";
      after.evt_deleted_by = "$ACTOR";
      after.evt_delete_reason = `CAL October correction: starts before ${cutoff}`;
      summary[repeating.has(e.cis_id) ? "removedIcs" : "removedNative"]++;
    }
    if (Object.keys(after).length)
      changes.events.push({
        id: e.evt_id,
        before: pick(e, [...Object.keys(after), "updated_at"]),
        after,
      });
  }
  for (const s of sources) {
    const after = {};
    if (normalize(s.category) !== s.category)
      after.category = normalize(s.category);
    if (
      repeating.has(s.cis_id) &&
      (!s.stopped_at || +s.stopped_at > +new Date(cutoff))
    ) {
      after.stopped_at = cutoff;
      after.stopped_by = "$ACTOR";
      summary.stoppedIcs++;
    }
    if (Object.keys(after).length)
      changes.sources.push({
        id: s.cis_id,
        before: pick(s, [...Object.keys(after), "updated_at"]),
        after,
      });
  }
  for (const s of series) {
    const after = {};
    const template = { ...s.crs_template };
    if (template.evtCategory)
      template.evtCategory = normalize(template.evtCategory);
    const patches = s.crs_changes.map((x) => ({
      ...x,
      patch: {
        ...x.patch,
        ...(x.patch?.evtCategory
          ? { evtCategory: normalize(x.patch.evtCategory) }
          : {}),
      },
    }));
    if (JSON.stringify(template) !== JSON.stringify(s.crs_template))
      after.crs_template = template;
    if (JSON.stringify(patches) !== JSON.stringify(s.crs_changes))
      after.crs_changes = patches;
    if (
      native.has(s.crs_id) &&
      (!s.crs_start_before || +s.crs_start_before > +new Date(cutoff))
    ) {
      after.crs_start_before = cutoff;
      summary.stoppedNative++;
      // Key cutoff stays separate: earlier series cancellations remain intact.
    }
    if (Object.keys(after).length) {
      after.crs_version = s.crs_version + 1;
      changes.series.push({
        id: s.crs_id,
        before: pick(s, [...Object.keys(after), "updated_at"]),
        after,
      });
    }
  }
  const colors = (
    await c.query(
      "SELECT * FROM amb_acm_cal_color_setting WHERE ent_id=$1 AND ccs_kind='CATEGORY' ORDER BY ccs_id",
      [entId],
    )
  ).rows;
  const existing = new Set(
    colors
      .filter((c) => c.ccs_target === normalize(c.ccs_target))
      .map((c) => c.ccs_target),
  );
  for (const color of colors) {
    const target = normalize(color.ccs_target);
    if (target === color.ccs_target) continue;
    if (existing.has(target))
      changes.colors.push({ id: color.ccs_id, before: color, after: null });
    else {
      changes.colors.push({
        id: color.ccs_id,
        before: pick(color, ["ccs_target", "updated_at"]),
        after: { ccs_target: target },
      });
      existing.add(target);
    }
  }
  const result = { entId, cutoff, summary, changes };
  return {
    ...result,
    digest: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
  };
}
function pick(row, keys) {
  return Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));
}
async function apply(c, p, actor) {
  const applied = { events: [], sources: [], series: [], colors: [] };
  for (const [kind, rows] of Object.entries(p.changes)) {
    const [table, id] = tables[kind];
    for (const row of rows) {
      if (!row.after) {
        await c.query(`DELETE FROM ${table} WHERE ent_id=$1 AND ${id}=$2`, [
          p.entId,
          row.id,
        ]);
        applied[kind].push({ ...row, current: null });
        continue;
      }
      const entries = Object.entries(row.after);
      const values = entries.map(([, v]) =>
        v === "$ACTOR"
          ? actor
          : v === "$NOW"
            ? new Date()
            : typeof v === "object" && v !== null
              ? JSON.stringify(v)
              : v,
      );
      const saved = await c.query(
        `UPDATE ${table} SET ${entries.map(([k], i) => `${k}=$${i + 3}`).join(",")},updated_at=now() WHERE ent_id=$1 AND ${id}=$2 RETURNING *`,
        [p.entId, row.id, ...values],
      );
      if (saved.rowCount !== 1) throw Error("Correction row disappeared");
      applied[kind].push({
        ...row,
        current: pick(saved.rows[0], [...Object.keys(row.after), "updated_at"]),
      });
    }
  }
  return { entId: p.entId, cutoff: p.cutoff, digest: p.digest, applied };
}
async function rollback(c, receipt) {
  // Compare current values including modification timestamps before restoring.
  // Any subsequent user edit aborts the entire transaction; never overwrite it.
  for (const [kind, rows] of Object.entries(receipt.applied).reverse()) {
    const [table, id] = tables[kind];
    for (const row of [...rows].reverse()) {
      const result = await c.query(
        `SELECT * FROM ${table} WHERE ent_id=$1 AND ${id}=$2 FOR UPDATE`,
        [receipt.entId, row.id],
      );
      if (!row.current) {
        if (result.rowCount)
          throw Error("Rollback conflict: deleted color was recreated");
        const entries = Object.entries(row.before);
        await c.query(
          `INSERT INTO ${table} (${entries.map(([k]) => k).join(",")}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(",")})`,
          entries.map(([, v]) => v),
        );
      } else {
        const current = result.rows[0];
        if (
          !current ||
          Object.keys(row.current).some(
            (k) =>
              JSON.stringify(current[k]) !== JSON.stringify(row.current[k]),
          )
        )
          throw Error("Rollback conflict: row changed after correction");
        const entries = Object.entries(row.before);
        const values = entries.map(([, v]) =>
          typeof v === "object" && v !== null && !(v instanceof Date)
            ? JSON.stringify(v)
            : v,
        );
        await c.query(
          `UPDATE ${table} SET ${entries.map(([k], i) => `${k}=$${i + 3}`).join(",")} WHERE ent_id=$1 AND ${id}=$2`,
          [receipt.entId, row.id, ...values],
        );
      }
    }
  }
}
async function main() {
  const arg = (n) => {
    const i = process.argv.indexOf(n);
    return i < 0 ? undefined : process.argv[i + 1];
  };
  const email = arg("--email"),
    cutoff = arg("--cutoff"),
    snapshot = arg("--snapshot");
  if (!email || !cutoff || !snapshot)
    throw Error("Required: --email --cutoff --snapshot");
  const { Pool } = load("pg");
  const pool = new Pool({
    host: process.env.ACM_PG_HOST,
    port: Number(process.env.ACM_PG_PORT || 5432),
    user: process.env.ACM_PG_USER,
    password: process.env.ACM_PG_PASSWORD,
    database: process.env.ACM_PG_DATABASE || "db_acm",
  });
  const c = await pool.connect();
  try {
    const doApply = process.argv.includes("--apply");
    await c.query(doApply ? "BEGIN" : "BEGIN READ ONLY");
    const users = (
      await c.query(
        "SELECT usr_id,ent_id FROM amb_acm_user WHERE usr_email=$1 AND usr_status='ACTIVE' AND usr_role='ADMIN'",
        [email],
      )
    ).rows;
    if (users.length !== 1) throw Error("Expected exactly one active admin");
    const { ent_id: entId, usr_id: actor } = users[0];
    if (doApply) {
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `cal-video:${entId}`,
      ]);
      for (const key of [
        `cal-ics:${entId}`,
        `cal-repeat:${entId}`,
        `cal-colors:${entId}`,
      ])
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
      // Block concurrent row edits while constructing and applying the exact plan.
      for (const [table] of Object.values(tables))
        await c.query(`SELECT 1 FROM ${table} WHERE ent_id=$1 FOR UPDATE`, [
          entId,
        ]);
    }
    const p = await plan(c, entId, cutoff);
    if (doApply && arg("--expect") !== p.digest)
      throw Error("Dry-run digest changed; review a fresh preview");
    // Before images, private and exclusive; never overwrite an earlier backup.
    fs.writeFileSync(snapshot, JSON.stringify(p, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    if (doApply) {
      const receipt = await apply(c, p, actor);
      fs.writeFileSync(
        snapshot + ".applied.json",
        JSON.stringify(receipt, null, 2),
        { flag: "wx", mode: 0o600 },
      );
    }
    await c.query(doApply ? "COMMIT" : "ROLLBACK");
    console.log(
      JSON.stringify(
        {
          applied: doApply,
          cutoff: p.cutoff,
          ...p.summary,
          digest: p.digest,
          snapshot,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
module.exports = { plan, apply, rollback };
if (require.main === module)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
