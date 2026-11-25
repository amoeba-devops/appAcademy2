"""Portal UI regression checks. All API calls are fulfilled with synthetic data."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('ACM_TEST_URL', 'http://127.0.0.1:3009')
SHOTS = Path(os.environ.get('ACM_TEST_ARTIFACTS', '/private/tmp/acm-portal-ui-shots'))
SHOTS.mkdir(parents=True, exist_ok=True)

class Fixture:
    def __init__(self, role='TEACHER', notice=False, hidden=()):
        self.role, self.notice, self.hidden = role, notice, hidden
        self.calls, self.errors = [], []
        self.fail_menus = False
        self.enable_push = False
        self.students = [
            dict(id='student-a', name='가학생', englishName='Alice', school='예시학교', grade='5', subject='영어', status='ACTIVE', sources=['ASSIGNED']),
            dict(id='student-b', name='나학생', englishName='Bob', school='예시중학교', grade='8', subject='영어', status='INACTIVE', sources=['CALENDAR']),
            dict(id='student-c', name='다학생', school='예시학교', grade='6', subject='영어', status='WITHDRAWN', sources=['ASSIGNED']),
        ]
        self.channel = dict(id='room-a', name='강사 대화', type='GROUP', unreadCount=2,
                            lastMessageAt='2026-11-25T01:00:00Z', lastMessagePreview='수업 준비 안내',
                            members=[dict(kind='TEACHER', refId='teacher-a', name='예시강사', role='MEMBER')],
                            mine=False, archived=False, canSend=True)
    def context(self, browser, width=1280, locale='ko', timezone='Asia/Seoul'):
        ctx = browser.new_context(viewport={'width':width,'height':950},service_workers='block',timezone_id=timezone)
        user = dict(id='account-a',entId='tenant-a',refId='teacher-a',kind=self.role,loginId='user@example.com',mustChangePassword=False)
        state = {'active':'portal','token':None,'user':None,'portal':{'token':'fixture-token','user':user},'parent':{'token':None,'user':None}}
        ctx.add_init_script("if(location.origin === " + json.dumps(BASE) + "){localStorage.setItem('acm.lang',"+json.dumps(locale)+");localStorage.setItem('acm-auth',"+json.dumps(json.dumps({'version':4,'state':state}))+");}")
        def route(r):
            u=urlparse(r.request.url);path=u.path[4:];q=parse_qs(u.query)
            if u.netloc!=urlparse(BASE).netloc:return r.abort()
            if not u.path.startswith('/api/'):return r.continue_()
            self.calls.append((path,q,r.request.method))
            data,status={},200
            if path.endswith('/events') and ('inbox' in path or '/talk/' in path):
                return r.fulfill(status=200,content_type='text/event-stream',body=': fixture\n\n')
            if path=='/portal/me/menus':
                keys=['calendar','students','materials','chat','me'] if self.role=='TEACHER' else ['links','materials','me']
                if self.notice:keys.insert(0,'notices')
                keys=[k for k in keys if k not in self.hidden or k=='me']
                data={'visible':keys,'home':'/portal/'+keys[0]}
                if self.fail_menus:status=500
            elif path=='/portal/me':
                data=dict(name='예시 사용자',kind=self.role,loginId='user@example.com',timezone=None,tenantTimezone='Asia/Seoul')
            elif path.endswith('/video-capabilities'):data={'bodaEnabled':False,'provider':'NONE'}
            elif path=='/portal/teacher/students':
                data=[s for s in self.students if q.get('includeWithdrawn')==['true'] or s['status']!='WITHDRAWN']
            elif path.startswith('/portal/teacher/students/'):
                sid=path.split('/')[-1]
                data=next(s.copy() for s in self.students if s['id']==sid)
                data.update(phone=None,email='student@example.com',startDate='2025-04-22T00:00:00.000Z',
                            goalsNote='학습 목표 유지',specialNote='SECRET_NOTE_SHOULD_NOT_RENDER',
                            remarks=[],recentEvents=[],links=[],linksEditable=False)
            elif path=='/portal/cal/events':
                date=(q.get('from',['2026-11-25'])[0])[:10]
                events=[]
                # Fixed dates cover November and January boundary scenarios.
                for day in ['2026-11-25','2027-01-01']:
                    for i,name in enumerate(['가학생','나학생','가학생','가학생']):
                        events.append(dict(id=day+'-'+str(i),title=name+' 영어 수업',primaryStudentName=name,
                          category='REGULAR_CLASS' if i!=1 else 'DEMO_CLASS',startAt=day+'T01:00:00Z',endAt=day+'T01:50:00Z',
                          allDay=False,meetingProvider='NONE',invitees=[],attachments=[],classDone=False))
                data={'items':events}
            elif path=='/portal/materials':
                posts=[dict(id='mat-'+str(i),kind='FILE' if i%2 else 'DOC',title=('Reading ' if i<12 else 'Math ')+str(i),
                    filename='lesson.pdf' if i%2 else None,sizeBytes=1024,createdAt='2026-11-25T00:00:00Z',
                    authorName='예시강사',shareTargets=[],commentCount=0,mine=q.get('scope')==['own'],canEdit=False,isSubmission=False) for i in range(15)]
                if q.get('q'):posts=[m for m in posts if q['q'][0].lower() in m['title'].lower()]
                if q.get('kind'):posts=[m for m in posts if m['kind']==q['kind'][0]]
                page=int(q.get('page',['1'])[0]);limit=int(q.get('limit',['10'])[0])
                data={'data':posts[(page-1)*limit:page*limit],'meta':{'total':len(posts),'limit':limit,'page':page}}
            elif path=='/portal/std/class-info':data=[]
            elif path.endswith('/channels'):data=[self.channel]
            elif path.endswith('/messages'):data={'messages':[],'nextCursor':None}
            elif path.endswith('/channels/room-a'):data=self.channel
            elif path.endswith('/count') or 'unread' in path:data={'unreadCount':0}
            elif path.endswith('/push-config'):data={'enabled':self.enable_push,'publicKey':'fixture-public-key' if self.enable_push else None}
            elif path.endswith('/my-settings'):data={'spec':{},'prefs':{'types':{}},'tenant':{'types':{}},'types':[]}
            elif path=='/portal/posts/notices':data=[]
            r.fulfill(status=status,content_type='application/json',body=json.dumps({'success':status==200,'data':data}))
        ctx.route('**/*',route)
        ctx.on('page',lambda page:page.on('pageerror',lambda e:self.errors.append(str(e))))
        return ctx

def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),page.url

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    try:
        for width in [375,390,640,768,1024,1280]:
            f=Fixture();ctx=f.context(browser,width);page=ctx.new_page()
            page.goto(BASE+'/portal/calendar?view=month&date=2027-01-01')
            expect(page.locator('main h1')).to_have_text('수업일정')
            expect(page.locator('main').get_by_label('학생',exact=True)).to_be_visible()
            expect(page.locator('main').get_by_label('수업종류',exact=True)).to_be_visible()
            # January 2027 needs six weeks, with seven weekday headers.
            assert page.locator('main .grid.grid-cols-7 > div').count()==49
            expect(page.locator('main button').filter(has_text='가학생').first).to_be_visible()
            no_overflow(page)
            page.goto(BASE+'/portal/students')
            expect(page.get_by_text('가학생',exact=True)).to_be_visible()
            expect(page.get_by_text('다학생',exact=True)).to_have_count(0)
            page.get_by_role('button',name='전체보기(퇴원 포함)',exact=True).click()
            expect(page.get_by_text('다학생',exact=True)).to_be_visible()
            page.get_by_role('searchbox',name='이름·영문명·학교 검색').fill('Alice')
            expect(page.get_by_text('가학생',exact=True)).to_be_visible()
            expect(page.get_by_text('나학생',exact=True)).to_have_count(0)
            page.get_by_text('가학생',exact=True).click()
            expect(page.get_by_text('SECRET_NOTE_SHOULD_NOT_RENDER')).to_have_count(0)
            expect(page.get_by_text('2025-04-22T00:00:00.000Z')).to_have_count(0)
            expect(page.get_by_text('학습 목표 유지',exact=False)).to_be_visible()
            page.get_by_role('link',name='수강생 목록으로').click()
            expect(page.get_by_role('button',name='전체보기(퇴원 포함)',exact=True)).to_have_attribute('aria-pressed','true')
            expect(page.get_by_role('searchbox')).to_have_value('Alice')
            no_overflow(page)
            page.screenshot(path=str(SHOTS/('students-'+str(width)+'.png')),full_page=True)
            if width<640:
                page.locator('.portal-bottom').get_by_role('button',name='더보기',exact=True).click()
                page.get_by_role('dialog').get_by_role('link',name='마이페이지',exact=True).click()
                expect(page.locator('main h1')).to_have_text('마이페이지')
            assert not f.errors,f.errors
            ctx.close();print('PASS teacher layout, filters, withdrawn scope, detail and restore',width)
        for role in ['TEACHER','STUDENT','PARENT']:
            for on in [False,True]:
                f=Fixture(role,on);ctx=f.context(browser,390);page=ctx.new_page();page.goto(BASE+'/portal/me')
                expect(page.get_by_text('사용자 지정 타임존',exact=True)).to_have_count(1 if role=='PARENT' else 0)
                if role!='TEACHER':
                    for key in ['calendar','students','chat']:
                        assert page.locator('nav a[href="/portal/'+key+'"]').count()==0
                    assert page.locator('.portal-bottom a[href="/portal/notices"]').count()==(1 if on else 0)
                else:
                    page.locator('.portal-bottom').get_by_role('button',name='더보기').click()
                    assert page.get_by_role('dialog').locator('a[href="/portal/notices"]').count()==(1 if on else 0)
                assert not f.errors,f.errors
                ctx.close()
        print('PASS role menus, independent notice visibility and timezone policy')
        f=Fixture();ctx=f.context(browser,390);page=ctx.new_page()
        page.goto(BASE+'/portal/calendar?date=2026-11-25')
        expect(page.get_by_role('button',name='일',exact=True)).to_have_attribute('aria-pressed','true')
        expect(page.locator('.portal-week-strip')).to_be_visible()
        page.goto(BASE+'/portal/materials')
        expect(page.locator('tbody tr')).to_have_count(10)
        page.get_by_role('searchbox',name='전체 게시물에서 제목 검색').fill('Reading')
        page.get_by_role('button',name='검색',exact=True).click()
        expect(page.get_by_role('status').filter(has_text='12건')).to_be_visible()
        page.get_by_role('button',name='2',exact=True).click()
        expect(page.locator('tbody tr')).to_have_count(2)
        assert any(path=='/portal/materials' and q.get('q')==['Reading'] and q.get('page')==['2'] for path,q,_ in f.calls)
        page.screenshot(path=str(SHOTS/'materials-mobile.png'),full_page=True)
        no_overflow(page)
        page.goto(BASE+'/portal/chat')
        page.get_by_role('button',name='강사 대화',exact=False).first.click()
        expect(page).to_have_url(BASE+'/portal/chat?channelId=room-a')
        expect(page.locator('.portal-bottom')).not_to_be_visible()
        page.get_by_role('button',name='목록으로',exact=False).click()
        expect(page.locator('.portal-bottom')).to_be_visible()
        page.go_back()
        page.screenshot(path=str(SHOTS/'chat-mobile.png'),full_page=True)
        assert not f.errors,f.errors
        ctx.close();print('PASS mobile agenda, global title search/pagination and chat route')
        f=Fixture();f.fail_menus=True;ctx=f.context(browser,390);page=ctx.new_page()
        page.goto(BASE+'/portal/me')
        expect(page.locator('.portal-settings-error')).to_be_visible()
        assert page.locator('.portal-bottom a').count()==0
        expect(page.locator('header a[href="/portal/me"]')).to_be_visible()
        assert not f.errors,f.errors
        ctx.close()
        f=Fixture();f.enable_push=True;ctx=f.context(browser,390);page=ctx.new_page()
        page.goto(BASE+'/portal/calendar')
        expect(page.locator('.portal-push')).to_contain_text('알림')
        assert page.locator('div.fixed[role="dialog"]').count()==0
        assert not f.errors,f.errors
        ctx.close();print('PASS settings failure keeps account access and push prompt stays inline')
        f=Fixture();ctx=f.context(browser,390,timezone='America/Los_Angeles');page=ctx.new_page()
        page.goto(BASE+'/portal/students/student-a')
        expect(page.locator('dd').filter(has_text='2025. 04. 22.')).to_be_visible()
        assert not f.errors,f.errors
        ctx.close();print('PASS date-only start date in negative UTC offset')
        for locale in ['ko','en','vi','zh-CN']:
            f=Fixture();ctx=f.context(browser,390,locale);page=ctx.new_page();page.goto(BASE+'/portal/students')
            expect(page.locator('main h1')).not_to_be_empty()
            no_overflow(page)
            assert 'portalUi.' not in page.locator('body').inner_text()
            assert not f.errors,f.errors
            ctx.close()
        print('PASS 4 languages / narrow layout')
    finally:browser.close()
