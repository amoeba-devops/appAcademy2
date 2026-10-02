#!/usr/bin/env node
// Run from backend/. Default validates rollback in a transaction then rolls back.
// node ../scripts/rollback-cal-october.cjs /private/preview.json.applied.json [--apply]
const fs = require("node:fs");
const { createRequire } = require("node:module");
const load = createRequire(process.cwd() + "/package.json");
const { Pool } = load("pg");
const { rollback } = require("./correct-cal-october.cjs");
(async () => {
  const receipt = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  if (!receipt.entId || !receipt.digest || !receipt.applied)
    throw Error("Expected applied receipt");
  const pool = new Pool({
    host: process.env.ACM_PG_HOST,
    port: Number(process.env.ACM_PG_PORT || 5432),
    user: process.env.ACM_PG_USER,
    password: process.env.ACM_PG_PASSWORD,
    database: process.env.ACM_PG_DATABASE || "db_acm",
  });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `cal-video:${receipt.entId}`,
    ]);
    for (const key of [
      `cal-ics:${receipt.entId}`,
      `cal-repeat:${receipt.entId}`,
      `cal-colors:${receipt.entId}`,
    ])
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
    await rollback(c, receipt);
    const apply = process.argv.includes("--apply");
    await c.query(apply ? "COMMIT" : "ROLLBACK");
    console.log(JSON.stringify({ restored: apply, digest: receipt.digest }));
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
