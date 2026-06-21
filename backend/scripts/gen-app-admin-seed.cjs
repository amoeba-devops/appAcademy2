#!/usr/bin/env node
/**
 * REQ-260621 — generate a PRODUCTION system-admin seed with an
 * environment-specific password (never a committed shared secret).
 *
 * Usage:
 *   node backend/scripts/gen-app-admin-seed.cjs
 *   APP_ADMIN_EMAIL=ops@amoeba.group APP_ADMIN_ENT_ID=<uuid> node backend/scripts/gen-app-admin-seed.cjs
 *   APP_ADMIN_PASSWORD='<chosen>' node backend/scripts/gen-app-admin-seed.cjs   # use a chosen password
 *
 * Behaviour:
 *   • If APP_ADMIN_PASSWORD is set, uses it; otherwise generates a strong random one.
 *   • Prints the plaintext password ONCE (capture it now — it is not stored) and
 *     a ready-to-run SQL INSERT with a fresh bcrypt(12) hash and
 *     usr_must_change_password=true (operator is forced to rotate on first login).
 *
 * The generated SQL is what you apply to the production ACM Postgres. The hash
 * differs every run, so no shared credential ever lands in the repo.
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const EMAIL = (process.env.APP_ADMIN_EMAIL || 'admin@amoeba.group').trim().toLowerCase();
const ENT_ID = (process.env.APP_ADMIN_ENT_ID || '00000000-0000-0000-0000-0000000000ff').trim();
const NAME = process.env.APP_ADMIN_NAME || 'Amoeba System Admin';

/** Strong random password satisfying the policy (>=8, letters + digits). */
function randomPassword() {
  const raw = crypto.randomBytes(18).toString('base64url').replace(/[^A-Za-z0-9]/g, '');
  // Guarantee at least one letter and one digit regardless of base64url output.
  return `Aa${raw}9`.slice(0, 24);
}

function sqlLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

(async () => {
  const password = process.env.APP_ADMIN_PASSWORD || randomPassword();
  if (password.length < 8 || password.length > 120 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    console.error('ERROR: APP_ADMIN_PASSWORD must be 8-120 chars and contain letters and digits.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);

  console.log('\n=== ACM system-admin provisioning (REQ-260621) ===');
  console.log(`email   : ${EMAIL}`);
  console.log(`ent_id  : ${ENT_ID}`);
  console.log(`PASSWORD: ${password}   <-- capture now; it is not stored anywhere`);
  console.log('\n--- Apply this SQL to the production ACM Postgres ---\n');
  console.log(
    `INSERT INTO amb_acm_user (\n` +
      `  ent_id, usr_email, usr_password_hash, usr_name, usr_status, usr_role,\n` +
      `  auth_source, usr_must_change_password\n` +
      `) VALUES (\n` +
      `  ${sqlLiteral(ENT_ID)},\n` +
      `  ${sqlLiteral(EMAIL)},\n` +
      `  ${sqlLiteral(hash)},\n` +
      `  ${sqlLiteral(NAME)},\n` +
      `  'ACTIVE', 'APP_ADMIN', 'local', true\n` +
      `)\nON CONFLICT (ent_id, usr_email) DO NOTHING;\n`,
  );
})();
