# -*- coding: utf-8 -*-
"""Local portal-menu UI checks. All API responses are synthetic."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('ACM_TEST_URL', 'http://127.0.0.1:3009')
SHOTS = Path(os.environ.get('ACM_TEST_ARTIFACTS', '/private/tmp/acm-portal-menus-shots'))
SHOTS.mkdir(parents=True, exist_ok=True)
KEYS = ['notices', 'calendar', 'students', 'links', 'materials', 'chat', 'me']
PATHS = {k: '/portal/' + k for k in KEYS}
ALLOWED = {'TEACHER': ['notices', 'calendar', 'students', 'materials', 'chat', 'me'],
           'STUDENT': ['notices', 'links', 'materials', 'me']}


class Fixture:
    def __init__(self):
        self.flags = {}
        self.error = False
        self.requests = []
        self.goals = '학습 목표 유지'
        self.console_saves = 0

    def matrix(self):
        return [{'key': key, 'alwaysOn': key == 'me',
                 'locked': [kind for kind in ALLOWED if key not in ALLOWED[kind]],
                 'roles': {kind: key == 'me' or key in ALLOWED[kind] and self.flags.get((kind, key), key != 'notices')
                           for kind in ALLOWED}} for key in KEYS]

    def context(self, browser, kind='TEACHER', mobile=False):
        context = browser.new_context(service_workers='block', viewport={'width': 390 if mobile else 1280, 'height': 900})
        user = {'id': 'fixture-account', 'entId': 'fixture-tenant', 'refId': 'fixture-ref',
                'loginId': 'fixture', 'kind': kind, 'mustChangePassword': False}
        state = {'token': 'admin-token', 'active': 'portal',
                 'user': {'id': 'fixture-master', 'entId': 'fixture-tenant', 'role': 'ADMIN', 'name': 'Fixture', 'authSource': 'local'},
                 'portal': {'token': 'portal-token', 'user': user}, 'parent': {'token': None, 'user': None}}
        context.add_init_script("if(location.origin === " + json.dumps(BASE) + "){localStorage.setItem('acm.lang','ko');localStorage.setItem('acm-auth'," + json.dumps(json.dumps({'version': 4, 'state': state})) + ");}")
        errors = []
        context.on('page', lambda page: page.on('pageerror', lambda err: errors.append(str(err))))

        def handle(route):
            url = urlparse(route.request.url)
            if url.netloc != urlparse(BASE).netloc:
                return route.abort()
            if not url.path.startswith('/api/'):
                return route.continue_()
            path = url.path[4:]
            self.requests.append((path, route.request.headers.get('authorization')))
            data, status = {}, 200
            if path == '/portal/me/menus':
                if self.error:
                    status = 500
                visible = [item['key'] for item in self.matrix() if item['roles'][kind]]
                data = {'visible': visible, 'home': PATHS[visible[0]]}
            elif path == '/acm/tenant/portal-menus':
                if route.request.method == 'PUT':
                    for item in route.request.post_data_json['items']:
                        self.flags[(item['kind'], item['key'])] = item['visible']
                data = self.matrix()
            elif path == '/acm/tenant/menus':
                if route.request.method != 'GET':
                    self.console_saves += 1
                data = []
            elif path == '/acm/tenant/custom-menus':
                data = []
            elif path == '/acm/me/config-access':
                data = {'canManageTenant': True, 'canManageConfig': False, 'canViewAudit': False}
            elif path == '/acm/me/menus':
                data = {'hidden': [], 'order': [], 'custom': []}
            elif path == '/portal/posts/notices' or path.startswith('/portal/posts/notices/'):
                notice = {'id': 'notice', 'slug': 'fixture', 'title': '공지 테스트', 'bodyMd': '테넌트 공지 본문', 'publishedAt': '2026-11-25T00:00:00Z'}
                data = [notice] if path == '/portal/posts/notices' else notice
            elif path == '/portal/cal/events':
                data = {'items': []}
            elif path == '/portal/teacher/students/fixture':
                data = {'id': 'fixture', 'name': '학생 테스트', 'specialNote': '노출 금지 특이사항',
                        'goalsNote': self.goals, 'remarks': [], 'recentEvents': [], 'links': [], 'linksEditable': False}
            elif path in ['/portal/std/class-info', '/portal/teacher/students'] or path.endswith('/channels'):
                data = []
            elif path.endswith('/my-settings'):
                data = {'spec': {}, 'prefs': {'types': {}}, 'tenant': {'types': {}}, 'types': []}
            elif 'unread' in path:
                data = {'unreadCount': 0}
            elif path.endswith('/video-capabilities'):
                data = {'provider': 'GOOGLE_MEET', 'bodaEnabled': False}
            elif path == '/portal/me':
                data = {'name': 'Fixture', 'loginId': 'fixture', 'kind': kind, 'timezone': None, 'tenantTimezone': 'Asia/Seoul'}
            route.fulfill(status=status, content_type='application/json', body=json.dumps({'success': status == 200, 'data': data}))
        context.route('**/*', handle)
        return context, errors


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    try:
        fixture = Fixture()
        context, errors = fixture.context(browser)
        portal = context.new_page()
        portal.goto(BASE + '/portal')
        expect(portal).to_have_url(BASE + '/portal/calendar')
        expect(portal.locator('nav a[href="/portal/notices"]')).to_have_count(0)
        admin = context.new_page()
        admin.goto(BASE + '/admin/tenant')
        section = admin.get_by_role('region', name='학원 포털 메뉴 노출', exact=True)
        teacher = section.get_by_role('checkbox', name='공지사항 · 강사 포털', exact=True)
        student = section.get_by_role('checkbox', name='공지사항 · 학생 포털', exact=True)
        expect(teacher).not_to_be_checked()
        expect(student).not_to_be_checked()
        expect(section.get_by_role('checkbox', name='마이페이지 · 학생 포털', exact=True)).to_be_disabled()
        expect(section.get_by_role('checkbox', name='수업일정 · 학생 포털', exact=True)).to_have_count(0)
        teacher.check()
        section.get_by_role('button', name='저장', exact=True).click()
        expect(section.get_by_role('status')).to_contain_text('저장')
        expect(portal.locator('nav a[href="/portal/notices"]')).to_be_visible(timeout=10000)
        portal.locator('nav a[href="/portal/notices"]').click()
        portal.get_by_role('link', name='공지 테스트').click()
        expect(portal.get_by_role('heading', name='공지 테스트')).to_be_visible()
        expect(portal.get_by_text('테넌트 공지 본문', exact=True)).to_be_visible()
        teacher.uncheck()
        student.check()
        section.get_by_role('button', name='저장', exact=True).click()
        expect(portal).to_have_url(BASE + '/portal/calendar', timeout=10000)
        admin.reload()
        expect(teacher).not_to_be_checked()
        expect(student).to_be_checked()
        section.screenshot(path=str(SHOTS / 'portal-menu-matrix.png'))
        assert fixture.console_saves == 0
        assert not errors, errors
        context.close()
        print('PASS independent matrix/save/reload/cross-tab live update/authenticated notice detail')

        for teacher_on, student_on in [(False, False), (True, False), (False, True), (True, True)]:
            fixture = Fixture()
            fixture.flags = {('TEACHER', 'notices'): teacher_on, ('STUDENT', 'notices'): student_on}
            for kind, on in [('TEACHER', teacher_on), ('STUDENT', student_on)]:
                context, errors = fixture.context(browser, kind)
                page = context.new_page()
                page.goto(BASE + '/portal/notices')
                if on:
                    expect(page.get_by_role('link', name='공지 테스트')).to_be_visible()
                else:
                    expect(page).to_have_url(BASE + PATHS['calendar' if kind == 'TEACHER' else 'links'])
                    expect(page.locator('nav a[href="/portal/notices"]')).to_have_count(0)
                assert not errors, errors
                context.close()
            print('PASS notice combination:', teacher_on, student_on)

        for kind in ['TEACHER', 'STUDENT']:
            fixture = Fixture()
            fixture.flags = {(kind, key): False for key in ALLOWED[kind] if key != 'me'}
            context, errors = fixture.context(browser, kind)
            page = context.new_page()
            page.goto(BASE + '/portal/notices/fixture')
            expect(page).to_have_url(BASE + '/portal/me')
            expect(page.locator('.portal-sidebar nav a')).to_have_count(1)
            expect(page.locator('header a[href="/portal/chat"]')).to_have_count(0)
            assert not any(path.startswith('/portal/posts/') for path, _ in fixture.requests)
            assert not errors, errors
            context.close()
        print('PASS all optional menus off and direct-detail denial')

        fixture = Fixture()
        fixture.error = True
        context, errors = fixture.context(browser)
        page = context.new_page()
        page.goto(BASE + '/portal/notices')
        expect(page.get_by_role('alert')).to_contain_text('포털 메뉴 설정을 불러오지 못했습니다.')
        assert not any(path.startswith('/portal/posts/') for path, _ in fixture.requests)
        fixture.error = False
        page.get_by_role('button', name='다시 시도', exact=True).click()
        expect(page).to_have_url(BASE + '/portal/calendar')
        assert not errors, errors
        context.close()
        print('PASS menu errors fail closed and retry recovers')

        fixture = Fixture()
        context, errors = fixture.context(browser)
        page = context.new_page()
        page.goto(BASE + '/portal/students/fixture')
        expect(page.locator('main')).to_contain_text('학습 목표 유지')
        assert '노출 금지 특이사항' not in page.locator('main').inner_text()
        assert '특이사항' not in page.locator('main').inner_text()
        page.screenshot(path=str(SHOTS / 'student-detail.png'), full_page=True)
        fixture.goals = None
        page.reload()
        expect(page.get_by_role('heading', name='학생 테스트')).to_be_visible()
        expect(page.locator('main .mt-3.space-y-1')).to_have_count(0)
        assert all(auth == 'Bearer portal-token' for path, auth in fixture.requests if path.startswith('/portal/'))
        assert not errors, errors
        context.close()
        print('PASS special-note hiding/goals preservation/no empty card/portal token routing')

        fixture = Fixture()
        context, errors = fixture.context(browser, mobile=True)
        page = context.new_page()
        page.goto(BASE + '/admin/tenant')
        section = page.get_by_role('region', name='학원 포털 메뉴 노출', exact=True)
        expect(section.get_by_role('checkbox', name='공지사항 · 강사 포털', exact=True)).to_be_visible()
        section.scroll_into_view_if_needed()
        section.screenshot(path=str(SHOTS / 'portal-menu-mobile.png'))
        assert not errors, errors
        context.close()
        print('PASS mobile portal matrix')
    finally:
        browser.close()
