"""API guide UI checks against the served bundle; all API data is synthetic."""
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import expect, sync_playwright

BASE = os.environ.get('ACM_TEST_URL', 'http://127.0.0.1:3009')
ARTIFACTS = Path(os.environ.get('ACM_TEST_ARTIFACTS', '/private/tmp/acm-scheduler-ui'))
ARTIFACTS.mkdir(parents=True, exist_ok=True)
CATALOG = json.loads(Path('/private/tmp/acm-scheduler-catalog.json').read_text())
OPENAPI = json.loads(Path('/private/tmp/acm-scheduler-openapi.json').read_text())
SCOPES = ['teachers:read', 'lessons:read', 'lessons:write']


class Fixture:
    def __init__(self, master=True):
        self.master = master
        self.settings = {'enabled': False, 'scopes': SCOPES[:]}
        self.clients = []
        self.error = False
        self.calls = []

    def context(self, browser, mobile=False):
        context = browser.new_context(service_workers='block', accept_downloads=True, permissions=['clipboard-read', 'clipboard-write'],
                                      viewport={'width': 390 if mobile else 1280, 'height': 950})
        state = {'token': 'fixture-admin-token', 'active': 'admin',
                 'user': {'id': 'fixture-master', 'entId': 'fixture-ent', 'role': 'ADMIN', 'name': 'Fixture', 'authSource': 'local'},
                 'parent': {'token': None, 'user': None}, 'portal': {'token': None, 'user': None}}
        context.add_init_script("if(location.origin === " + json.dumps(BASE) + "){localStorage.setItem('acm.lang','ko');localStorage.setItem('acm-auth'," + json.dumps(json.dumps({'version': 4, 'state': state})) + ");}")
        errors = []
        context.on('page', lambda page: page.on('pageerror', lambda e: errors.append(str(e))))

        def route_handler(route):
            url = urlparse(route.request.url)
            if url.netloc != urlparse(BASE).netloc:
                return route.abort()
            if not url.path.startswith('/api/'):
                return route.continue_()
            path, method = url.path[4:], route.request.method
            self.calls.append((path, method))
            data, status = {}, 200
            if path == '/acm/me/config-access':
                data = {'canManageConfig': True, 'canManageTenant': self.master}
            elif path == '/acm/me/menus':
                data = {'hidden': [], 'order': [], 'custom': []}
            elif path == '/acm/integrations/catalog':
                data = CATALOG
            elif path == '/acm/integrations/openapi.json':
                return route.fulfill(status=200, content_type='application/json', body=json.dumps(OPENAPI))
            elif path == '/acm/integrations/settings':
                if method == 'PUT':
                    self.settings = route.request.post_data_json
                data = self.settings
            elif path == '/acm/integrations/clients':
                if method == 'POST':
                    body = route.request.post_data_json
                    self.clients.append({'id': 'fixture-client', 'name': body['name'], 'active': True, 'keys': []})
                    data = {'id': 'fixture-client'}
                else:
                    data = self.clients
            elif path == '/acm/integrations/clients/fixture-client/keys':
                body = route.request.post_data_json
                self.clients[0]['keys'].append({'id': 'fixture-key', 'name': body['name'], 'scopes': body['scopes'], 'expiresAt': body['expiresAt'], 'revokedAt': None, 'lastUsedAt': None})
                data = {'secret': 'acm_sk_SYNTHETIC_ONCE_ONLY_NOT_A_REAL_KEY'}
            elif path == '/acm/integrations/clients/fixture-client':
                self.clients[0]['active'] = route.request.post_data_json['active']
                data = {'id': 'fixture-client'}
            elif path == '/acm/integrations/keys/fixture-key':
                self.clients[0]['keys'][0]['revokedAt'] = '2026-11-25T00:00:00Z'
                data = {'revoked': True}
            elif path.endswith('/channels'):
                data = []
            elif path.endswith('/my-settings'):
                data = {'spec': {}, 'prefs': {'types': {}}, 'tenant': {'types': {}}, 'types': []}
            elif 'unread' in path:
                data = {'unreadCount': 0}
            if self.error and path.startswith('/acm/integrations/'):
                status = 500
            route.fulfill(status=status, content_type='application/json', body=json.dumps({'success': status == 200, 'data': data}))
        context.route('**/*', route_handler)
        return context, errors


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    try:
        fixture = Fixture()
        context, errors = fixture.context(browser)
        page = context.new_page()
        page.goto(BASE + '/admin/config')
        page.wait_for_load_state('networkidle')
        expect(page.get_by_role('link', name='API 사용안내', exact=False)).to_be_visible()
        page.get_by_role('link', name='API 사용안내', exact=False).click()
        expect(page.get_by_role('tab', name='외부 오픈 API')).to_have_attribute('aria-selected', 'true')
        page.locator('details').filter(has_text='수업 등록·수정').locator('summary').click()
        expect(page.get_by_role('cell', name='body: deliveryMode', exact=True)).to_be_visible()
        expect(page.get_by_role('cell', name='ONSITE / ONLINE', exact=False)).to_be_visible()
        page.get_by_role('button', name='curl 예제 복사').click()
        expect(page.get_by_role('status').filter(has_text='복사했습니다.')).to_be_visible()
        page.get_by_role('textbox', name='API 이름·엔드포인트 검색').fill('/teachers')
        expect(page.locator('details')).to_have_count(2)  # teacher + error reference
        page.get_by_role('textbox', name='API 이름·엔드포인트 검색').fill('')
        with page.expect_download() as download:
            page.get_by_role('button', name='OpenAPI 다운로드').click()
        download.value.save_as(ARTIFACTS / 'openapi.json')
        assert json.loads((ARTIFACTS / 'openapi.json').read_text())['openapi'] == '3.0.3'
        assert all(method == 'GET' for path, method in fixture.calls if path.startswith('/acm/integrations/'))
        print('PASS catalog / parameter types / search / copy / OpenAPI, no writes')
        page.get_by_role('tab', name='API 연동', exact=True).click()
        expect(page.get_by_text('브라우저 코드에 넣지 마세요.', exact=False)).to_be_visible()
        page.get_by_role('tab', name='API 사용 설정').click()
        enabled = page.get_by_role('checkbox', name='외부 API 사용', exact=True)
        expect(enabled).not_to_be_checked()
        enabled.check()
        page.get_by_role('button', name='설정 저장').click()
        page.reload()
        expect(page.get_by_role('checkbox', name='외부 API 사용', exact=True)).to_be_checked()
        page.get_by_label('연동 앱 이름', exact=True).first.fill('Internal fixture')
        page.get_by_role('button', name='연동 앱 추가', exact=True).click()
        page.get_by_role('combobox', name='키 발급 대상 앱', exact=True).select_option('fixture-client')
        page.get_by_label('키 이름', exact=True).fill('Fixture key')
        page.get_by_role('button', name='새 API 키 발급', exact=True).click()
        secret = page.get_by_role('region', name='API 키 발급 완료', exact=True)
        expect(secret).to_be_visible()
        expect(secret.get_by_text('acm_sk_SYNTHETIC_ONCE_ONLY_NOT_A_REAL_KEY')).to_be_visible()
        page.get_by_role('button', name='확인·키 숨기기').click()
        expect(page.get_by_text('acm_sk_SYNTHETIC_ONCE_ONLY_NOT_A_REAL_KEY')).to_have_count(0)
        page.reload()
        expect(page.get_by_text('Fixture key', exact=True)).to_be_visible()
        expect(page.get_by_text('acm_sk_SYNTHETIC_ONCE_ONLY_NOT_A_REAL_KEY')).to_have_count(0)
        page.on('dialog', lambda dialog: dialog.accept())
        page.get_by_role('button', name='키 폐기', exact=True).click()
        expect(page.get_by_text('폐기됨', exact=True)).to_be_visible()
        page.get_by_role('button', name='사용 중지', exact=True).click()
        expect(page.get_by_role('button', name='사용 재개', exact=True)).to_be_visible()
        page.screenshot(path=str(ARTIFACTS / 'settings-desktop.png'), full_page=True)
        assert not errors, errors
        context.close()
        print('PASS settings persistence / app / one-time key / revoke / stop')
        readonly = Fixture(master=False)
        context, errors = readonly.context(browser)
        page = context.new_page()
        page.goto(BASE + '/admin/config/api?tab=settings')
        expect(page.get_by_text('API 사용 설정과 키 관리는 테넌트 마스터만 사용할 수 있습니다.')).to_be_visible()
        assert not any(path.endswith('/settings') or path.endswith('/clients') for path, _ in readonly.calls)
        context.close()
        print('PASS permission-restricted settings')
        mobile = Fixture()
        context, errors = mobile.context(browser, mobile=True)
        page = context.new_page()
        page.goto(BASE + '/admin/config/api')
        page.wait_for_load_state('networkidle')
        page.locator('details').filter(has_text='수업 등록·수정').locator('summary').click()
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
        page.screenshot(path=str(ARTIFACTS / 'catalog-mobile.png'), full_page=True)
        context.close()
        print('PASS mobile catalog layout')
        failed = Fixture()
        failed.error = True
        context, errors = failed.context(browser)
        page = context.new_page()
        page.goto(BASE + '/admin/config/api')
        expect(page.get_by_role('alert')).to_contain_text('API 정보를 불러오지 못했습니다.')
        context.close()
        print('PASS API load error')
    finally:
        browser.close()
