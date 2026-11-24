# -*- coding: utf-8 -*-
"""Run against local Vite with Python Playwright; all API data is synthetic.

python3 test/portal-visibility.smoke.py
"""
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('ACM_TEST_URL', 'http://127.0.0.1:3009')
ARTIFACTS = Path(os.environ.get('ACM_TEST_ARTIFACTS', '/private/tmp/acm-portal-261124-shots'))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
WORK_LIST_URL = 'https://work.example.test/list'
WORK_PATHS = ['/admin/embed/work-list', '/admin/issues', '/admin/my-work',
              '/admin/projects', '/admin/drive', '/admin/chat']
WORK_LABELS = ['업무목록', '이슈', '내 업무', '프로젝트', '드라이브', '채팅']


def run(browser, role, mobile=False, hidden=None, fail_calendar=False,
        work_list_mode='EMBED', include_work_list=True):
    context = browser.new_context(viewport={'width': 390 if mobile else 1280, 'height': 900})
    state = {
        'token': 'fixture-admin-token', 'active': 'admin' if role == 'ADMIN' else 'portal',
        'user': {'id': 'admin-a', 'entId': 'tenant-a', 'role': 'ADMIN',
                 'name': '테스트 관리자', 'authSource': 'local'},
        'portal': {'token': 'fixture-portal-token', 'user': {
            'id': 'account-a', 'entId': 'tenant-a', 'kind': role,
            'refId': 'teacher-a', 'loginId': 'fixture', 'mustChangePassword': False}},
        'parent': {'token': None, 'user': None},
    }
    context.add_init_script("if (location.origin === " + json.dumps(BASE) + ") { localStorage.setItem('acm.lang','ko');localStorage.setItem('acm-auth'," +
                            json.dumps(json.dumps({'version': 4, 'state': state})) + "); }")
    page = context.new_page()
    page.set_default_timeout(15000)
    errors, requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    failure = {'enabled': fail_calendar}

    def route_request(route):
        url = urlparse(route.request.url)
        if url.netloc != urlparse(BASE).netloc:
            return route.abort()
        if not url.path.startswith('/api/'):
            return route.continue_()
        path = url.path[4:]
        requests.append((path, parse_qs(url.query)))
        data = {}
        status = 200
        if path in ['/portal/me', '/acm/me/profile']:
            data = {'name': '테스트 사용자', 'loginId': 'fixture', 'kind': role,
                    'role': 'ADMIN', 'tenantTimezone': 'Asia/Seoul', 'timezone': 'America/New_York'}
            if path == '/acm/me/profile':
                data.pop('kind')
        elif path == '/portal/cal/events':
            if failure['enabled']:
                status, data = 500, {'error': {'message': 'fixture failure'}}
            else:
                data = {'items': []}
        elif path == '/portal/teacher/students':
            data = [{'id': 'active', 'name': '재원 테스트', 'status': 'ACTIVE'},
                    {'id': 'inactive', 'name': '휴원 테스트', 'status': 'INACTIVE'}]
            if parse_qs(url.query).get('includeWithdrawn') == ['true']:
                data.append({'id': 'withdrawn', 'name': '퇴원 테스트', 'status': 'WITHDRAWN'})
        elif path == '/portal/teacher/students/withdrawn':
            data = {'id': 'withdrawn', 'name': '퇴원 테스트', 'status': 'WITHDRAWN',
                    'remarks': [], 'recentEvents': [], 'links': [], 'linksEditable': False}
        elif path == '/acm/me/menus':
            custom = [{'id': 'other-work', 'name': '추가 링크', 'url': '/admin/extra',
                       'group': 'WORK', 'openMode': 'LINK', 'newTab': False}]
            if include_work_list:
                custom.append({'id': 'work-list', 'name': '업무목록', 'url': WORK_LIST_URL,
                               'group': 'WORK', 'openMode': work_list_mode, 'newTab': True})
            data = {'hidden': hidden or [], 'order': ['chat', 'drive', 'projects', 'myWork', 'issues', 'documents'], 'custom': custom}
        elif path == '/acm/me/config-access':
            data = {'canManageConfig': False, 'canManageTenant': False, 'canViewAudit': False}
        elif 'video-capabilities' in path:
            data = {'provider': 'GOOGLE_MEET', 'bodaEnabled': False}
        elif path.endswith('/my-settings'):
            data = {'spec': {}, 'types': [], 'prefs': {'types': {}}, 'tenant': {'types': {}}}
        elif 'unread' in path:
            data = {'unreadCount': 0}
        elif path.endswith('/channels') or path == '/portal/news':
            data = []
        route.fulfill(status=status, content_type='application/json', body=json.dumps({'success': status == 200, 'data': data}))

    page.route('**/*', route_request)
    return context, page, errors, requests, failure


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    try:
        for role in ['TEACHER', 'STUDENT', 'PARENT']:
            context, page, errors, requests, _ = run(browser, role)
            page.goto(BASE + '/portal/calendar/')
            page.wait_for_load_state('networkidle')
            calendar = page.locator('nav a[href="/portal/calendar"]')
            if role == 'TEACHER':
                expect(calendar).to_be_visible()
                for label in ['주', '일', '리스트', '월']:
                    page.get_by_role('button', name=label, exact=True).click()
                page.reload()
                expect(calendar).to_be_visible()
                assert any(path == '/portal/cal/events' for path, _ in requests)
                page.screenshot(path=str(ARTIFACTS / 'teacher-calendar.png'), full_page=True)
            else:
                expect(page).to_have_url(BASE + '/portal/notices')
                expect(calendar).to_have_count(0)
                assert not any(path == '/portal/cal/events' for path, _ in requests)
            page.goto(BASE + '/portal/me')
            page.wait_for_load_state('networkidle')
            if role in ['TEACHER', 'STUDENT']:
                expect(page.get_by_text('사용자 지정 타임존', exact=True)).to_have_count(0)
                expect(page.locator('main select')).to_have_count(0)
                expect(page.get_by_text('학원 기준 타임존', exact=True)).to_be_visible()
                page.screenshot(path=str(ARTIFACTS / (role.lower() + '-profile.png')), full_page=True)
            else:
                expect(page.get_by_text('사용자 지정 타임존', exact=True)).to_be_visible()
            assert not errors, errors
            context.close()
            print('PASS role/calendar/timezone:', role)

        context, page, errors, requests, failure = run(browser, 'TEACHER', fail_calendar=True)
        page.goto(BASE + '/portal/calendar')
        expect(page.get_by_role('alert')).to_contain_text('일정을 불러오지 못했습니다.')
        failure['enabled'] = False
        page.get_by_role('button', name='다시 시도', exact=True).click()
        expect(page.get_by_role('alert')).to_have_count(0)
        page.goto(BASE + '/portal/students')
        page.wait_for_load_state('networkidle')
        expect(page.get_by_text('재원 테스트', exact=True)).to_be_visible()
        expect(page.get_by_text('휴원 테스트', exact=True)).to_be_visible()
        expect(page.get_by_text('퇴원 테스트', exact=True)).to_have_count(0)
        page.get_by_role('checkbox', name='전체보기').check()
        expect(page.get_by_text('퇴원 테스트', exact=True)).to_be_visible()
        page.screenshot(path=str(ARTIFACTS / 'students-all.png'), full_page=True)
        page.get_by_text('퇴원 테스트', exact=True).click()
        expect(page.get_by_role('heading', name='퇴원 테스트', exact=True)).to_be_visible()
        page.get_by_role('link', name='수강생 목록으로').click()
        expect(page.get_by_role('checkbox', name='전체보기')).not_to_be_checked()
        expect(page.get_by_text('퇴원 테스트', exact=True)).to_have_count(0)
        assert any(q.get('includeWithdrawn') == ['true'] for path, q in requests if path == '/portal/teacher/students')
        assert any(q.get('includeWithdrawn') == ['false'] for path, q in requests if path == '/portal/teacher/students')
        assert not errors, errors
        context.close()
        print('PASS retry/default/all/withdrawn-detail')

        for mobile, hidden in [(False, []), (True, []), (False, ['drive'])]:
            context, page, errors, _, _ = run(browser, 'ADMIN', mobile=mobile, hidden=hidden)
            page.goto(BASE + '/admin/me')
            page.wait_for_load_state('networkidle')
            assert not errors, errors
            assert page.locator('aside').count(), page.locator('body').inner_text()
            if mobile:
                page.get_by_role('button', name='메뉴 열기', exact=True).click()
                page.wait_for_function("Math.abs(document.querySelector('aside').getBoundingClientRect().x) < 1")
            links = page.locator('aside nav a')
            actual = [href for href in links.evaluate_all('(els) => els.map(e => e.getAttribute("href"))') if href in WORK_PATHS]
            wanted = [p for p in WORK_PATHS if p != '/admin/drive' or 'drive' not in hidden]
            assert actual == wanted, (actual, wanted)
            expect(page.locator('aside nav a[href="/admin/documents"]')).to_have_count(0)
            page.locator('aside nav a[href="/admin/chat"]').scroll_into_view_if_needed()
            for path, label in zip(WORK_PATHS, WORK_LABELS):
                if path in wanted:
                    expect(page.locator('aside nav a[href="' + path + '"]')).to_contain_text(label)
                    expect(page.locator('aside nav a[href="' + path + '"]')).to_be_in_viewport()
            expect(page.get_by_text('사용자 지정 타임존', exact=True)).to_be_visible()
            shot = 'admin-mobile.png' if mobile else 'admin-hidden.png' if hidden else 'admin-desktop.png'
            page.screenshot(path=str(ARTIFACTS / shot), full_page=True)
            page.locator('aside nav a[href="/admin/embed/work-list"]').click()
            expect(page).to_have_url(BASE + '/admin/embed/work-list')
            expect(page.locator('iframe')).to_have_attribute('src', WORK_LIST_URL)
            assert not errors, errors
            context.close()
            print('PASS admin menu order/visibility:', mobile, hidden)

        for included in [True, False]:
            context, page, errors, _, _ = run(browser, 'ADMIN', work_list_mode='LINK', include_work_list=included)
            page.goto(BASE + '/admin/me')
            page.wait_for_load_state('networkidle')
            expect(page.locator('aside nav a[href="/admin/documents"]')).to_have_count(0)
            work_list = page.locator('aside nav a[href="' + WORK_LIST_URL + '"]')
            if included:
                expect(work_list).to_have_attribute('target', '_blank')
                work_order = page.locator('aside nav a').evaluate_all(
                    '(els) => els.map(e => e.getAttribute("href")).filter(h => h === "https://work.example.test/list" || ["/admin/issues", "/admin/my-work", "/admin/projects", "/admin/drive", "/admin/chat", "/admin/extra"].includes(h))')
                assert work_order == [WORK_LIST_URL] + WORK_PATHS[1:] + ['/admin/extra'], work_order
            else:
                expect(work_list).to_have_count(0)
                expect(page.locator('aside nav a[href="/admin/embed/work-list"]')).to_have_count(0)
            assert not errors, errors
            context.close()
            print('PASS configured link/role-filtered absence:', included)
    finally:
        browser.close()
