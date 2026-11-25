/* Deployment read-only checks. Never prints credentials, tokens, names or IDs. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { JwtService } = require('@nestjs/jwt');
assert.equal(process.env.ACM_VERIFY_PORTAL_UI, '1', 'Explicit verifier flag required');
const ds = new DataSource({
 type:'postgres',host:process.env.ACM_PG_HOST,port:Number(process.env.ACM_PG_PORT||5432),
 username:process.env.ACM_PG_USER,password:process.env.ACM_PG_PASSWORD,
 database:process.env.ACM_PG_DATABASE,logging:false,synchronize:false,
});
const base='http://127.0.0.1:'+String(process.env.PORT||4009)+'/api';
async function get(path, token) {
 const response=await fetch(base+path,{headers:token?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(15000)});
 assert.ok(response.status===200,'Unexpected HTTP status '+response.status+' on read-only endpoint');
 const json=await response.json();
 return json.data;
}
(async()=>{
 await ds.initialize();
 const report={readonly:true,roles:[]};
 try {
  for (const role of ['TEACHER','STUDENT']) {
   const [account]=await ds.query(
    "SELECT a.pac_id,a.ent_id,a.pac_ref_id,a.pac_login_id,a.pac_must_change_password FROM amb_acm_portal_account a WHERE a.pac_kind=$1 AND a.pac_status='ACTIVE' AND a.pac_locked_at IS NULL AND a.pac_deleted_at IS NULL ORDER BY EXISTS(SELECT 1 FROM amb_acm_material m WHERE m.ent_id=a.ent_id AND m.mat_uploaded_by=a.pac_ref_id AND m.mat_author_kind=a.pac_kind AND m.deleted_at IS NULL) DESC,a.pac_id LIMIT 1",[role]);
   if(!account){report.roles.push({role,skipped:'no_active_account'});continue;}
   const token=new JwtService({secret:process.env.ACM_JWT_SECRET}).sign({
    sub:account.pac_id,entId:account.ent_id,kind:role,refId:account.pac_ref_id,
    loginId:account.pac_login_id,mustChangePassword:account.pac_must_change_password,
   },{expiresIn:'5m'});
   const menu=await get('/portal/me/menus',token);
   assert.ok(Array.isArray(menu.visible)&&menu.visible.includes('me'),'Account navigation contract failed');
   if(role==='STUDENT')assert.ok(!['calendar','students','chat'].some(k=>menu.visible.includes(k)),'Student role menu boundary failed');
   const profile=await get('/portal/me',token);
   assert.ok(profile.kind===role,'Profile role mismatch');
   const result={role,profile:true,menus:true,materials:'not_visible'};
   if(menu.visible.includes('materials')) {
    const baseline=await get('/portal/materials?scope=own&page=1&limit=1',token);
    assert.ok(Array.isArray(baseline.data)&&Number.isInteger(baseline.meta.total),'Material response shape failed');
    const sentinel='release-'+randomUUID()+'%_';
    for (const scope of ['own','shared']) {
     const empty=await get('/portal/materials?'+new URLSearchParams({scope,q:sentinel,page:'1',limit:'10'}),token);
     assert.ok(empty.data.length===0&&empty.meta.total===0,'Literal title search did not filter before pagination');
    }
    if(baseline.data.length) {
     const term=baseline.data[0].title.trim().slice(0,50);
     const found=await get('/portal/materials?'+new URLSearchParams({scope:'own',q:term,page:'1',limit:'10'}),token);
     assert.ok(found.meta.total>=1&&found.data.every(m=>m.title.toLocaleLowerCase().includes(term.toLocaleLowerCase())),'Existing-title search failed');
    }
    result.materials='search_and_pagination_passed';
   }
   if(role==='TEACHER'&&menu.visible.includes('students')) {
    const current=await get('/portal/teacher/students?includeWithdrawn=false',token);
    const all=await get('/portal/teacher/students?includeWithdrawn=true',token);
    assert.ok(Array.isArray(current)&&Array.isArray(all),'Student response shape failed');
    assert.ok(current.every(s=>s.status!=='WITHDRAWN'),'Withdrawn student in default list');
    const allIds=new Set(all.map(s=>s.id));
    assert.ok(current.every(s=>allIds.has(s.id)),'All-view scope mismatch');
    if(current.length) {
     const detail=await get('/portal/teacher/students/'+current[0].id,token);
     assert.ok(!Object.prototype.hasOwnProperty.call(detail,'specialNote'),'Special-note field was exposed');
    }
    result.students='default_all_scope_and_note_hiding_passed';
   }
   report.roles.push(result);
  }
  report.authenticatedRoles=report.roles.filter(role=>role.profile===true).length;
  console.log(JSON.stringify(report));
 } finally {await ds.destroy();}
})().catch(error=>{console.error('PORTAL_READONLY_VERIFICATION_FAILED',error.message);process.exitCode=1;});
