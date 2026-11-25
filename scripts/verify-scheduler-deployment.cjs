/* Run via docker exec -i <backend> node, with ACM_VERIFY_SCHEDULER=1.
 * Creates an isolated random tenant and removes its business rows after testing.
 * Existing append-only audit traces are deliberately preserved.
 * Never prints keys, JWTs, environment credentials or customer data.
 */
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { DataSource } = require("typeorm");
const { JwtService } = require("@nestjs/jwt");

if (process.env.ACM_VERIFY_SCHEDULER !== "1")
  throw new Error("Explicit verification flag required");
const ds = new DataSource({
  type: "postgres",
  host: process.env.ACM_PG_HOST,
  port: Number(process.env.ACM_PG_PORT || 5432),
  username: process.env.ACM_PG_USER,
  password: process.env.ACM_PG_PASSWORD,
  database: process.env.ACM_PG_DATABASE,
  logging: false,
  synchronize: false,
});
const ent = process.env.ACM_VERIFY_CLEANUP_ENT || randomUUID(),
  user = randomUUID(),
  teacher = randomUUID();
const scopes = ["teachers:read", "lessons:read", "lessons:write"];
const base = `http://127.0.0.1:${process.env.PORT || 4009}/api`;
let jwt, key;
async function call(
  path,
  method = "GET",
  body,
  headers = {},
  credential = key,
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json();
  return {
    status: response.status,
    body: json,
    data: json.data,
    etag: response.headers.get("etag"),
  };
}
async function admin(path, method = "GET", body) {
  return call("/acm/integrations" + path, method, body, {}, jwt);
}
async function cleanup() {
  const tables =
    await ds.query(`SELECT t.table_name,c.column_name FROM information_schema.tables t JOIN information_schema.columns c USING(table_schema,table_name)
    WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND t.table_name LIKE 'amb_acm_%' AND c.column_name IN ('ent_id','tnt_ent_id','tnm_ent_id')
      AND NOT EXISTS (SELECT 1 FROM pg_trigger tr JOIN pg_proc p ON p.oid=tr.tgfoid
        WHERE tr.tgrelid=('public.'||t.table_name)::regclass AND p.proname='acm_aud_append_only')`);
  for (let pass = 0; pass < 8; pass++) {
    let left = 0;
    for (const { table_name: table, column_name: column } of tables) {
      if (!/^amb_acm_[a-z0-9_]+$/.test(table))
        throw new Error("Unexpected schema identifier");
      try {
        await ds.query(`DELETE FROM "${table}" WHERE "${column}"=$1`, [ent]);
      } catch (e) {
        if (e.code !== "23503") throw e;
        left++;
      }
    }
    if (!left && pass >= 1) break;
  }
  for (const { table_name: table, column_name: column } of tables) {
    const [row] = await ds.query(
      `SELECT count(*)::int AS count FROM "${table}" WHERE "${column}"=$1`,
      [ent],
    );
    assert.equal(row.count, 0, "Verification tenant cleanup incomplete");
  }
}
(async () => {
  await ds.initialize();
  if (process.env.ACM_VERIFY_CLEANUP_ENT) {
    try {
      const [owned] = await ds.query(
        `SELECT t.tnt_ent_id FROM amb_acm_tenant t JOIN amb_acm_user u ON u.ent_id=t.tnt_ent_id
        WHERE t.tnt_ent_id=$1 AND t.tnt_name='Ephemeral API deployment verification' AND u.usr_name='Deployment fixture' AND u.usr_password_hash='disabled-fixture-login'`,
        [ent],
      );
      assert(owned, "Cleanup is restricted to this verifier's own fixture");
      await cleanup();
      console.log(
        "PASS recovered fixture business rows removed; append-only audit retained",
      );
    } finally {
      await ds.destroy();
    }
    return;
  }
  try {
    await ds.transaction(async (m) => {
      await m.query(
        "INSERT INTO amb_acm_tenant(tnt_ent_id,tnt_name) VALUES($1,$2)",
        [ent, "Ephemeral API deployment verification"],
      );
      await m.query(
        `INSERT INTO amb_acm_user(usr_id,ent_id,usr_email,usr_password_hash,usr_name,usr_role,usr_must_change_password,ama_role) VALUES($1,$2,$3,'disabled-fixture-login','Deployment fixture','ADMIN',false,'MASTER')`,
        [user, ent, `${user}@example.invalid`],
      );
      await m.query(
        `INSERT INTO amb_acm_tch_teacher(tch_id,ent_id,tch_name,tch_email) VALUES($1,$2,'Fixture teacher',$3)`,
        [teacher, ent, `${teacher}@example.invalid`],
      );
    });
    jwt = new JwtService({
      secret: process.env.ACM_JWT_SECRET || process.env.JWT_SECRET,
    }).sign({ sub: user, entId: ent, role: "ADMIN" }, { expiresIn: "5m" });
    const access = await call(
      "/acm/me/config-access",
      "GET",
      undefined,
      {},
      jwt,
    );
    assert.equal(access.status, 200);
    assert.equal(access.data.canManageApi, true);
    assert.equal(access.data.canManageTenant, false);
    assert.equal(access.data.canManageConfig, false);
    assert.equal(
      (await call("/acm/tenant/portal-menus", "GET", undefined, {}, jwt))
        .status,
      403,
    );
    const defaults = await admin("/settings");
    assert.equal(defaults.status, 200);
    assert.equal(defaults.data.enabled, false);
    assert.equal(
      (await admin("/settings", "PUT", { enabled: true, scopes })).status,
      200,
    );
    const client = await admin("/clients", "POST", {
      name: "Deployment fixture",
    });
    assert.equal(client.status, 201);
    const issued = await admin(`/clients/${client.data.id}/keys`, "POST", {
      name: "Ephemeral verification",
      scopes,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
    assert.equal(issued.status, 201);
    key = issued.data.secret;
    const teachers = await call("/integrations/v1/teachers");
    assert.equal(teachers.status, 200);
    assert.equal(teachers.data.length, 1);
    assert.equal(teachers.data[0].id, teacher);
    const starts = new Date(Date.now() + 2 * 86400000);
    starts.setUTCHours(1, 0, 0, 0);
    const ends = new Date(+starts + 50 * 60000);
    const body = {
      teacherId: teacher,
      students: [{ name: "Unregistered fixture" }],
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      category: "DEMO_CLASS",
      deliveryMode: "ONSITE",
    };
    const path = "/integrations/v1/lessons/external/deployment-fixture";
    const initialHeaders = {
      "Idempotency-Key": "fixture-create",
      "If-None-Match": "*",
    };
    const created = await call(path, "PUT", body, initialHeaders);
    assert.equal(created.status, 201);
    assert.equal(created.data.students[0].studentId, null);
    assert.equal(created.data.deliveryMode, "ONSITE");
    const replay = await call(path, "PUT", body, initialHeaders);
    assert.equal(replay.status, 201);
    assert.equal(replay.data.id, created.data.id);
    const conflict = await call(
      "/integrations/v1/lessons/external/conflict",
      "PUT",
      body,
      { "Idempotency-Key": "fixture-conflict", "If-None-Match": "*" },
    );
    assert.equal(conflict.status, 409);
    const details = await call(path);
    assert.equal(details.status, 200);
    const url = new URL(base + "/integrations/v1/lessons");
    url.searchParams.set("from", new Date(+starts - 3600000).toISOString());
    url.searchParams.set("to", new Date(+ends + 3600000).toISOString());
    url.searchParams.set("teacherId", teacher);
    const listed = await call(url.pathname.replace(/^\/api/, "") + url.search);
    assert.equal(listed.status, 200);
    assert.equal(listed.data.length, 1);
    const updated = await call(
      path,
      "PUT",
      { ...body, location: "Fixture room" },
      { "Idempotency-Key": "fixture-update", "If-Match": details.etag },
    );
    assert.equal(updated.status, 200);
    const deleted = await call(
      path,
      "DELETE",
      { reason: "Deployment verification cleanup" },
      { "Idempotency-Key": "fixture-delete", "If-Match": updated.etag },
    );
    assert.equal(deleted.status, 200);
    assert.equal((await call(path)).status, 404);
    assert.equal(
      (await admin("/settings", "PUT", { enabled: false, scopes })).status,
      200,
    );
    assert.equal((await call("/integrations/v1/teachers")).status, 403);
    assert.equal(
      (await admin("/settings", "PUT", { enabled: true, scopes })).status,
      200,
    );
    assert.equal(
      (await admin(`/keys/${issued.data.id}`, "DELETE")).status,
      200,
    );
    assert.equal((await call("/integrations/v1/teachers")).status, 401);
    const catalog = await admin("/catalog");
    assert.equal(catalog.status, 200);
    assert.equal(catalog.data.apis.length, 5);
    const spec = await admin("/openapi.json");
    assert.equal(spec.status, 200);
    assert.equal(spec.body.openapi, "3.0.3");
    const [customers] = await ds.query(
      "SELECT count(*)::int AS count FROM amb_acm_int_config WHERE ent_id<>$1 AND int_is_enabled=true",
      [ent],
    );
    console.log(
      `PASS deployed HTTP: settings, key issue/revoke, teachers, guest demo CRUD, replay, conflicts, catalog/OpenAPI; other enabled tenants=${customers.count}`,
    );
  } finally {
    key = undefined;
    jwt = undefined;
    await cleanup();
    console.log(
      "PASS isolated verification business rows removed; append-only audit retained",
    );
    await ds.destroy();
  }
})().catch((e) => {
  console.error("FAIL deployment verification:", e.code || e.name);
  process.exitCode = 1;
});
