/* Run inside backend container: node /tmp/backfill-csl-english-name.cjs --tenant UUID [--apply]
 * Default is read-only. Never prints names, contacts, ciphertext or keys.
 */
'use strict';
const { Client } = require('/app/node_modules/pg');
const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');
const tenant = process.argv[process.argv.indexOf('--tenant') + 1];
const apply = process.argv.includes('--apply');
if (!process.argv.includes('--tenant') || !/^[0-9a-f-]{36}$/i.test(tenant ?? '')) throw new Error('A tenant UUID is required');
const key = Buffer.from(process.env.ACM_PII_KEY ?? '', 'hex');
if (key.length !== 32) throw new Error('Invalid encryption configuration');
const client = new Client({ host:process.env.ACM_PG_HOST,port:Number(process.env.ACM_PG_PORT || 5432),user:process.env.ACM_PG_USER,password:process.env.ACM_PG_PASSWORD,database:process.env.ACM_PG_DATABASE });
(async () => {
  await client.connect();
  await client.query('BEGIN');
  if (!apply) await client.query('SET TRANSACTION READ ONLY');
  await client.query("SET LOCAL lock_timeout = '5s'");
  const { rows } = await client.query(`SELECT i.inq_id, i.inq_english_name_encrypted AS ciphertext, i.inq_english_name_iv AS iv, i.inq_english_name_auth_tag AS tag, m.mpa_student_name_en AS english
    FROM amb_acm_csl_inquiry i JOIN amb_acm_csl_map_apply m ON m.ent_id=i.ent_id AND m.inq_id=i.inq_id
    WHERE i.ent_id=$1 AND i.deleted_at IS NULL AND NULLIF(TRIM(m.mpa_student_name_en),'') IS NOT NULL
    ORDER BY i.inq_id ${apply ? 'FOR UPDATE OF i, m' : ''}`, [tenant]);
  const result = { mode:apply?'apply':'dry-run', examined:rows.length, eligible:0, alreadyMatching:0, conflicts:0, written:0 };
  for (const row of rows) {
    const english = row.english.trim();
    if (row.ciphertext || row.iv || row.tag) {
      if (!row.ciphertext || !row.iv || !row.tag) { result.conflicts++; continue; }
      const decipher = createDecipheriv('aes-256-gcm',key,row.iv); decipher.setAuthTag(row.tag);
      const existing = Buffer.concat([decipher.update(row.ciphertext),decipher.final()]).toString('utf8');
      if (existing === english) result.alreadyMatching++; else result.conflicts++;
      continue;
    }
    result.eligible++;
    if (!apply) continue;
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm',key,iv);
    const encrypted = Buffer.concat([cipher.update(english,'utf8'),cipher.final()]);
    const write = await client.query(`UPDATE amb_acm_csl_inquiry SET inq_english_name_encrypted=$3,inq_english_name_iv=$4,inq_english_name_auth_tag=$5,updated_at=clock_timestamp()
      WHERE ent_id=$1 AND inq_id=$2 AND inq_english_name_encrypted IS NULL AND inq_english_name_iv IS NULL AND inq_english_name_auth_tag IS NULL`,[tenant,row.inq_id,encrypted,iv,cipher.getAuthTag()]);
    result.written += write.rowCount;
  }
  await client.query('COMMIT'); console.log(JSON.stringify(result));
})().catch(async error => { await client.query('ROLLBACK').catch(()=>{}); console.error(error.code || error.name); process.exitCode=1; }).finally(async()=>{key.fill(0);await client.end();});
