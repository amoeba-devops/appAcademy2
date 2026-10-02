// Isolated TEMP tables in PostgreSQL; no production/local application rows touched.
// Run from backend/: node --test ../scripts/correct-cal-october.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { execFileSync } = require("node:child_process");
const load = createRequire(process.cwd() + "/package.json");
const { Client } = load("pg");
const { plan, apply, rollback } = require("./correct-cal-october.cjs");
test("PostgreSQL correction: tenant isolation, exact cutoff, category/colors, idempotence and rollback", async () => {
  // Credentials are consumed in memory and never printed.
  const info = JSON.parse(
    execFileSync("docker", ["inspect", "acm-postgres"], { encoding: "utf8" }),
  )[0];
  const env = Object.fromEntries(
    info.Config.Env.map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1)];
    }),
  );
  const c = new Client({
    host: "127.0.0.1",
    port: 5434,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB || env.POSTGRES_USER,
  });
  await c.connect();
  try {
    await c.query(`CREATE TEMP TABLE amb_acm_cal_event(evt_id text primary key,ent_id text,evt_category text,evt_start_at timestamptz,deleted_at timestamptz,evt_deleted_by text,evt_delete_reason text,updated_at timestamptz default now());
    CREATE TEMP TABLE amb_acm_cal_ics_source(cis_id text primary key,ent_id text,category text,ical_text text,is_unbounded boolean,generated_until timestamptz,stopped_at timestamptz,stopped_by text,updated_at timestamptz default now());
    CREATE TEMP TABLE amb_acm_cal_ics_occurrence(ent_id text,evt_id text,cis_id text);
    CREATE TEMP TABLE amb_acm_cal_recurrence_series(crs_id text primary key,ent_id text,crs_template jsonb,crs_changes jsonb,crs_version int,crs_generated_until timestamptz,crs_stop_at timestamptz,updated_at timestamptz default now());
    CREATE TEMP TABLE amb_acm_cal_recurrence_occurrence(ent_id text,evt_id text,crs_id text);
    CREATE TEMP TABLE amb_acm_cal_color_setting(ccs_id text primary key,ent_id text,ccs_kind text,ccs_target text,ccs_palette text,created_at timestamptz default now(),updated_at timestamptz default now(),unique(ent_id,ccs_kind,ccs_target));`);
    await c.query(require('node:fs').readFileSync('../sql/acm/1028-cal-category-repeat-cutoff.sql', 'utf8'));
    const ics =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test\r\nDTSTART:20261001T010000Z\r\nDTEND:20261001T020000Z\r\nRRULE:FREQ=WEEKLY\r\nEND:VEVENT\r\nEND:VCALENDAR";
    await c.query(
      "INSERT INTO amb_acm_cal_ics_source(cis_id,ent_id,category,ical_text,is_unbounded,generated_until) VALUES('ics','a','CLASS',$1,true,'2027-10-01')",
      [ics],
    );
    await c.query(`INSERT INTO amb_acm_cal_event(evt_id,ent_id,evt_category,evt_start_at) VALUES
    ('oct','a','CLASS','2026-10-31T14:59:59Z'),('nov','a','CLASS','2026-10-31T15:00:00Z'),
    ('single','a','CLASS','2026-11-02'),('native','a','REGULAR_CLASS','2026-11-02'),('event','a','EVENT','2026-10-01'),
    ('personal','a','PERSONAL','2026-10-01'),('other-tenant','b','CLASS','2026-11-02');
    INSERT INTO amb_acm_cal_ics_occurrence VALUES ('a','oct','ics'),('a','nov','ics');
    INSERT INTO amb_acm_cal_recurrence_series(crs_id,ent_id,crs_template,crs_changes,crs_version,crs_generated_until) VALUES('series','a','{"evtCategory":"REGULAR_CLASS"}','[]',1,'2027-01-01');
    INSERT INTO amb_acm_cal_recurrence_occurrence VALUES ('a','native','series');
    INSERT INTO amb_acm_cal_color_setting(ccs_id,ent_id,ccs_kind,ccs_target,ccs_palette) VALUES
    ('old','a','CATEGORY','CLASS','blue'),('new','a','CATEGORY','REGULAR_CLASS','rose'),('evt','a','CATEGORY','EVENT','amber');`);
    const p = await plan(c, "a", "2026-10-31T15:00:00Z");
    assert.deepEqual(p.summary, {
      migratedClass: 3,
      migratedEvent: 1,
      migratedPersonal: 1,
      removedIcs: 1,
      removedNative: 1,
      stoppedIcs: 1,
      stoppedNative: 1,
    });
    assert.equal((await plan(c, "a", p.cutoff)).digest, p.digest);
    await c.query("BEGIN");
    const receipt = await apply(c, p, "actor");
    const events = (await c.query("SELECT * FROM amb_acm_cal_event")).rows;
    for (const id of ["oct", "single", "event", "personal", "other-tenant"])
      assert.equal(events.find((e) => e.evt_id === id).deleted_at, null);
    for (const id of ["nov", "native"])
      assert.equal(events.find((e) => e.evt_id === id).evt_deleted_by, "actor");
    assert.equal(
      events.find((e) => e.evt_id === "other-tenant").evt_category,
      "CLASS",
    );
    assert.equal(
      events.find((e) => e.evt_id === "event").evt_category,
      "OTHER",
    );
    const colors = (await c.query("SELECT * FROM amb_acm_cal_color_setting"))
      .rows;
    assert.equal(
      colors.find((c) => c.ccs_target === "REGULAR_CLASS").ccs_palette,
      "rose",
    );
    assert.equal(
      colors.find((c) => c.ccs_target === "OTHER").ccs_palette,
      "amber",
    );
    const again = await plan(c, "a", p.cutoff);
    assert.equal(Object.values(again.changes).flat().length, 0);
    await rollback(c, JSON.parse(JSON.stringify(receipt)));
    assert.equal((await plan(c, "a", p.cutoff)).digest, p.digest);
    const receipt2 = await apply(c, p, "actor");
    await c.query(
      "UPDATE amb_acm_cal_event SET evt_category='OTHER' WHERE evt_id='oct'",
    );
    await assert.rejects(
      rollback(c, JSON.parse(JSON.stringify(receipt2))),
      /Rollback conflict/,
    );
    await c.query("ROLLBACK");
    assert.equal((await plan(c, "a", p.cutoff)).digest, p.digest);
    await c.query(
      "UPDATE amb_acm_cal_ics_source SET generated_until='2026-10-01'",
    );
    await assert.rejects(plan(c, "a", p.cutoff), /Generate October/);
  } finally {
    await c.end();
  }
});
