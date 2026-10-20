// Local React UI + deterministic API fixtures. Persistence is covered by recurrence-pg-check.ts.
const { chromium }=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {expandRecurrence}=require('../../backend/dist/modules/acm-cal/application/recurrence-calculator.js');
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let colors=[],created,changed,repeated=false;
 const teacher={id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',name:'김강사',email:'teacher@example.invalid'};
 const event={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',ownerUserId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',category:'REGULAR_CLASS',title:'영어 회화 수업',assigneeTchId:teacher.id,assigneeName:teacher.name,source:'MANUAL',startAt:'2026-09-30T07:00:00Z',endAt:'2026-09-30T08:00:00Z',meetingProvider:'GOOGLE_MEET',meetingUrl:'https://meet.google.com/abc-defg-hij',invitees:[],attachments:[]};
 const shots=process.env.CAL_SCREENSHOT_DIR||'/private/tmp/cal-repeat-screenshots';fs.mkdirSync(shots,{recursive:true});
 try{
  await page.addInitScript(()=>{localStorage.setItem('acm.lang','ko');localStorage.setItem('acm-auth',JSON.stringify({version:4,state:{token:'fixture-token',active:'admin',user:{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',entId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',role:'ADMIN'},parent:{token:null,user:null},portal:{token:null,user:null}}}));});
  await page.route('**/*',async route=>{
   const q=route.request(),url=new URL(q.url());if(url.hostname!=='127.0.0.1')return route.abort();if(!url.pathname.startsWith('/api/'))return route.continue();const p=url.pathname.slice(4);let data={};
   if(p.endsWith('/video-capabilities'))data={provider:'GOOGLE_MEET',bodaEnabled:false};
   else if(p==='/acm/cal/color-settings'){if(q.method()==='PUT')colors=q.postDataJSON().items;data=colors;}
   else if(p==='/acm/cal/recurrence/preview'){const b=q.postDataJSON();try{data={timezone:'Asia/Seoul',items:expandRecurrence(b.event.evtStartAt,b.event.evtEndAt,'Asia/Seoul',b.rule,new Date('2040-01-01'),5)};if(!data.items.length)throw Error('empty');}catch{return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'REPEAT_EMPTY'})});}}
   else if(p==='/acm/cal/recurrence/series'){created=q.postDataJSON();repeated=true;data={id:'test-series',created:5};}
   else if(p.endsWith('/impact'))data={changed:4,protected:1};
   else if(p.endsWith('/update')&&p.includes('/recurrence/')){changed=q.postDataJSON();data={changed:4,protected:1};}
   else if(p===`/acm/cal/recurrence/events/${event.id}`)data=repeated?{seriesId:'test-series',version:1,rule:created.rule,timezone:'Asia/Seoul',stoppedAt:null}:null;
   else if(p==='/acm/cal/events')data={items:[event],total:1};
   else if(p==='/acm/cal/recurrence/status')data=[];
   else if(p.includes('/recurrence/events/')||p.endsWith('/ics'))data=null;
   else if(p===`/acm/cal/events/${event.id}`)data=event;
   else if(p.includes('/teachers'))data={items:[teacher],total:1};
   else if(p.includes('/menus'))data={hidden:[],order:[]};
   else if(p.includes('/invitee')||p.includes('/candidates')||p.endsWith('/attachments')||p.endsWith('/channels'))data=[];
   else if(p.endsWith('/revisions'))data={items:[]};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  await page.goto('http://127.0.0.1:5173/admin/cal');
  await page.getByRole('button',{name:'색상 설정',exact:true}).click();let dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'정규수업: 분홍',exact:true}).click();await dialog.getByRole('button',{name:'저장',exact:true}).click();assert(colors.some(c=>c.target==='REGULAR_CLASS'&&c.palette==='rose'));
  await page.getByRole('button',{name:'색상 설정',exact:true}).click();await dialog.getByRole('button',{name:'담당자',exact:true}).click();await dialog.getByRole('button',{name:'김강사: 보라',exact:true}).click();await dialog.screenshot({path:path.join(shots,'260930B-cal-color-settings.png')});await dialog.getByRole('button',{name:'저장',exact:true}).click();
  await page.getByRole('combobox',{name:'색상 기준',exact:true}).selectOption('ASSIGNEE');await page.reload();assert.equal(await page.getByRole('combobox',{name:'색상 기준',exact:true}).inputValue(),'ASSIGNEE');await page.getByText('영어 회화 수업',{exact:false}).first().waitFor();
  await page.screenshot({path:path.join(shots,'260930B-cal-assignee-colors.png'),fullPage:true});
  await page.getByRole('button',{name:'일정 등록',exact:true}).click();dialog=page.getByRole('dialog');await dialog.locator('[name="evtTitle"]').fill('영어 회화 · 평일 반복');await dialog.locator('[name="evtMeetingUrl"]').fill('https://meet.google.com/abc-defg-hij');await dialog.locator('[name="evtAssigneeTchId"]').selectOption(teacher.id);
  await dialog.locator('input[type="date"]').nth(0).fill('2026-10-01');await dialog.locator('input[type="date"]').nth(1).fill('2026-10-01');
  const times=dialog.locator('select').filter({has:page.locator('option[value="10:00"]')});await times.nth(0).selectOption('10:00');await times.nth(1).selectOption('11:00');
  await dialog.getByRole('combobox',{name:'반복',exact:true}).selectOption('DAILY');await dialog.getByRole('combobox',{name:'주말',exact:true}).selectOption('EXCLUDE');assert.equal(await dialog.getByRole('button',{name:'저장',exact:true}).isDisabled(),true);await dialog.getByLabel('반복 종료일 (필수)',{exact:true}).fill('2026-09-30');assert.equal(await dialog.getByRole('button',{name:'저장',exact:true}).isDisabled(),true);await dialog.getByLabel('반복 종료일 (필수)',{exact:true}).fill('2026-10-07');
  await dialog.getByText('2026. 10. 7.',{exact:false}).waitFor();await dialog.getByRole('button',{name:'저장',exact:true}).waitFor();
  await dialog.locator('fieldset').filter({has:page.getByRole('combobox',{name:'반복',exact:true})}).screenshot({path:path.join(shots,'260930B-cal-weekday-repeat.png')});
  await dialog.getByRole('button',{name:'저장',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(created.rule.kind,'DAILY');assert.equal(created.rule.excludeWeekends,true);assert.equal(created.rule.end,'UNTIL');assert.equal(created.rule.until,'2026-10-07');assert.equal(created.event.evtAssigneeTchId,teacher.id);assert(created.requestId);
  await page.getByText('영어 회화 수업',{exact:false}).first().click();
  await dialog.locator('[name="evtEditReason"]').fill('반복 일정 제목 변경');
  await dialog.getByRole('combobox',{name:'적용 범위',exact:true}).selectOption('FOLLOWING');
  await dialog.getByRole('button',{name:'저장',exact:true}).click();
  await page.getByRole('heading',{name:'4회에 적용합니다. 보호되는 1회는 유지합니다. 계속할까요?',exact:true}).waitFor();
  await page.getByRole('button',{name:'확인',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(changed.scope,'FOLLOWING');assert.equal(changed.version,1);
  await page.getByRole('button',{name:'일정 등록',exact:true}).click();await page.getByRole('combobox',{name:'반복',exact:true}).selectOption('DATES');await page.getByRole('dialog').locator('fieldset').filter({has:page.getByRole('combobox',{name:'반복',exact:true})}).locator('ol li').first().waitFor();assert.equal(await page.getByLabel('반복 종료일 (필수)',{exact:true}).count(),0);
  await page.setViewportSize({width:390,height:844});await page.reload();await page.getByRole('button',{name:'일정 등록',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log('PASS: color palette save, assignee mode persistence, teacher assignment, weekday repeat preview/payload, explicit-date mode, mobile width, no page errors');
 }catch(e){await page.screenshot({path:path.join(shots,'failure.png'),fullPage:true});console.error(await page.locator('body').innerText());throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
