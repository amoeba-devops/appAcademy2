import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomMenuDto } from '../presentation/tenant-master.controller';
import {
  CUSTOM_MENU_URL_PATTERN,
  customMenusFor,
  type CustomMenu,
} from './tenant-custom-menu.service';

// REQ-261026 — 사용자 메뉴(북마크) 링크 검증·등급 필터.
describe('tenant custom menus', () => {
  it.each([
    '/admin/csl',
    '/admin/csl?status=NEW',
    '/',
    'https://trinityacademy.kr/admin',
    'http://example.com',
  ])('accepts %s', (url) =>
    expect(CUSTOM_MENU_URL_PATTERN.test(url)).toBe(true),
  );

  it.each([
    'javascript:alert(1)',
    '//evil.example.com',
    'admin/csl',
    'ftp://example.com',
    'data:text/html,x',
    ' https://x.com',
  ])('rejects %s', (url) =>
    expect(CUSTOM_MENU_URL_PATTERN.test(url)).toBe(false),
  );

  const items: CustomMenu[] = [
    {
      id: 'a',
      name: 'All',
      url: '/admin/csl',
      newTab: false,
      roles: ['ADMIN', 'TEACHER', 'STAFF'],
    },
    {
      id: 'b',
      name: 'Admin',
      url: 'https://x.com',
      newTab: true,
      roles: ['ADMIN'],
    },
  ];

  it('filters by role and drops role data', () => {
    expect(customMenusFor(items, 'TEACHER', false)).toEqual([
      { id: 'a', name: 'All', url: '/admin/csl', newTab: false },
    ]);
    expect(customMenusFor(items, 'ADMIN', false).map((i) => i.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('shows every item to tenant masters and non-console roles', () => {
    expect(customMenusFor(items, 'TEACHER', true)).toHaveLength(2);
    expect(customMenusFor(items, 'APP_ADMIN', false)).toHaveLength(2);
  });

  it('validates the dto (trim, url, roles)', async () => {
    const check = async (body: object) =>
      (await validate(plainToInstance(CustomMenuDto, body))).map(
        (e) => e.property,
      );
    const ok = {
      name: '  신규 상담 ',
      url: '/admin/csl',
      newTab: false,
      roles: ['ADMIN'],
    };
    expect(await check(ok)).toEqual([]);
    expect(plainToInstance(CustomMenuDto, ok).name).toBe('신규 상담');
    expect(await check({ ...ok, name: '   ' })).toEqual(['name']);
    expect(await check({ ...ok, name: 'x'.repeat(31) })).toEqual(['name']);
    expect(await check({ ...ok, url: 'javascript:alert(1)' })).toEqual(['url']);
    expect(await check({ ...ok, roles: [] })).toEqual(['roles']);
    expect(await check({ ...ok, roles: ['APP_ADMIN'] })).toEqual(['roles']);
  });
});
