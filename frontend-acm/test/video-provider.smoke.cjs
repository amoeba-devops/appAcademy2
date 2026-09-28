// Run against local Vite with a Playwright installation. All API responses are fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(10000);
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    let provider = 'GOOGLE_MEET';
    let created;
    let updated;
    const bodaRequests = [];
    const event = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', entId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      ownerUserId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', category: 'REGULAR_CLASS',
      title: 'Video smoke class', source: 'MANUAL', meetingProvider: 'GOOGLE_MEET',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      startAt: '2026-09-28T09:00:00Z', endAt: '2026-09-28T10:00:00Z',
      createdAt: '2026-09-28T09:00:00Z', updatedAt: '2026-09-28T09:00:00Z', invitees: [], attachments: [],
    };
    await page.addInitScript(() => {
      localStorage.setItem('acm.lang', 'ko');
      localStorage.setItem('acm-auth', JSON.stringify({ version: 4, state: {
        token: 'fixture-token', active: 'admin',
        user: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', entId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', role: 'ADMIN' },
        portal: { token: 'fixture-portal-token', user: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', entId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', kind: 'TEACHER', refId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', loginId: 'fixture' } },
        parent: { token: null, user: null },
      } }));
    });
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const path = url.pathname.slice(4);
      let data = {};
      if (path.includes('/boda/') || /class-record|recordings/.test(path)) bodaRequests.push(path);
      if (path.endsWith('/video-capabilities') || path === '/admin/cal/video/config') {
        if (request.method() === 'PUT') provider = request.postDataJSON().provider;
        data = { provider, bodaEnabled: provider === 'BODASCHOOL' };
      } else if (path === `/acm/cal/events/${event.id}` && request.method() === 'PUT') {
        updated = request.postDataJSON(); data = event;
      } else if (path === '/acm/cal/events' && request.method() === 'POST') {
        created = request.postDataJSON();
        data = { ...event, title: created.evtTitle, meetingProvider: created.evtMeetingProvider, meetingUrl: created.evtMeetingUrl };
      } else if (path === '/acm/cal/events' || path === '/portal/cal/events') data = { items: [], total: 0 };
      else if (path.endsWith('/review')) data = { feedbackHtml: null, homeworkHtml: null, homeworkStatus: null };
      else if (path.endsWith('/revisions')) data = { items: [] };
      else if (path === `/acm/cal/events/${event.id}` || path === `/portal/cal/events/${event.id}`) data = event;
      else if (path.includes('/teachers') || path.includes('/invitee') || path.includes('/candidates') || path.endsWith('/attachments') || path.endsWith('/channels')) data = [];
      else if (path.includes('/menus')) data = { hidden: [], order: [] };
      else if (path.includes('/boda/config')) data = null;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });
    const base = 'http://127.0.0.1:5173';
    await page.goto(`${base}/admin/config/video`);
    await page.getByRole('heading', { name: '화상강의 설정' }).waitFor().catch(async (e) => { console.log('URL',page.url(),'ERRORS',pageErrors,'BODY',await page.locator('body').innerText()); throw e; });
    await page.getByRole('radio', { name: '구글미트', exact: true }).waitFor();
    assert(await page.getByRole('radio', { name: '구글미트', exact: true }).isChecked());
    assert.equal(bodaRequests.length, 0);
    await page.getByRole('radio', { name: '보다에듀', exact: true }).check();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await page.getByText('저장했습니다.', { exact: true }).waitFor();
    assert.equal(provider, 'BODASCHOOL');
    await page.getByRole('radio', { name: '구글미트', exact: true }).check();
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await page.getByText('저장했습니다.', { exact: true }).waitFor();
    assert.equal(provider, 'GOOGLE_MEET');
    await page.screenshot({ path: '/tmp/acm-video-settings.png', fullPage: true });
    bodaRequests.length = 0;
    await page.goto(`${base}/admin/cal`);
    await page.getByRole('button', { name: '일정 등록', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[name="evtTitle"]').fill('Google class smoke');
    await dialog.locator('input[name="evtMeetingUrl"]').fill('https://evil.example/meeting');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await dialog.getByText('올바른 Google Meet 링크를 입력하세요.').waitFor();
    assert.equal(created, undefined);
    await dialog.locator('input[name="evtMeetingUrl"]').fill(event.meetingUrl);
    assert.equal(await dialog.getByText(/보다스쿨|BODA/).count(), 0);
    await page.screenshot({ path: '/tmp/acm-video-class-form.png', fullPage: true });
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(created.evtMeetingProvider, 'GOOGLE_MEET');
    assert.equal(created.evtMeetingUrl, event.meetingUrl);
    assert.equal(created.evtBodaRoomType, undefined);
    assert.equal(bodaRequests.length, 0);
    await page.goto(`${base}/admin/cal/${event.id}`);
    await page.getByRole('heading', { name: event.title, exact: true }).waitFor();
    await page.getByRole('button', { name: '입장링크', exact: true }).waitFor();
    assert.equal(bodaRequests.length, 0);
    await page.evaluate(() => { window.open = (url) => { window.__videoOpened = url; return null; }; });
    await page.getByRole('button', { name: '입장링크', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__videoOpened), event.meetingUrl);
    event.meetingProvider = 'BODASCHOOL';
    event.meetingUrl = `${base}/web/classroom/${event.id}`;
    await page.reload();
    await page.getByRole('heading', { name: event.title, exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '입장링크', exact: true }).count(), 0);
    assert.equal(bodaRequests.length, 0);
    await page.getByRole('button', { name: '수정', exact: true }).click();
    await dialog.locator('[name="evtEditReason"]').fill('Keep historical classroom');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(updated.evtMeetingProvider, 'BODASCHOOL');
    assert.equal(updated.evtMeetingUrl, undefined);
    assert.equal(updated.evtBodaRoomType, undefined);
    await page.getByRole('button', { name: '수정', exact: true }).click();
    await dialog.getByRole('button', { name: '현재 설정으로 변경', exact: true }).click();
    await dialog.locator('[name="evtMeetingUrl"]').fill('https://meet.google.com/abc-defg-hij');
    await dialog.locator('[name="evtEditReason"]').fill('Switch to Google Meet');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(updated.evtMeetingProvider, 'GOOGLE_MEET');
    assert.equal(updated.evtMeetingUrl, 'https://meet.google.com/abc-defg-hij');
    assert.equal(bodaRequests.length, 0);
    await page.goto(`${base}/portal/calendar/${event.id}`);
    await page.getByText('현재 화상강의 설정과 달라 입장할 수 없습니다.').waitFor();
    assert.equal(bodaRequests.length, 0);
    await page.goto(`${base}/web/classroom/${event.id}`);
    await page.getByText('현재 화상강의 설정과 달라 입장할 수 없습니다.').waitFor();
    assert.equal(bodaRequests.length, 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/admin/config/video`);
    await page.getByRole('heading', { name: '화상강의 설정' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await page.screenshot({ path: '/tmp/acm-video-settings-mobile.png', fullPage: true });
    assert.deepEqual(pageErrors, []);
    console.log('PASS: settings switch, Google class save/validation, BODA hiding, direct launcher, portal, mobile, no page errors');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
