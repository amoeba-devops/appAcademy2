import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomMenuDto } from '../presentation/tenant-master.controller';
import {
  CUSTOM_MENU_URL_PATTERN,
  assertCustomMenuInput,
  customMenusFor,
  type CustomMenuInput,
  type CustomMenu,
} from './tenant-custom-menu.service';

// REQ-261026 — 사용자 메뉴(북마크) 링크 검증·등급 필터.
const ok = (): CustomMenuInput => ({
  name: 'x',
  url: '/admin',
  newTab: false,
  roles: ['ADMIN'],
  group: 'BOOKMARKS',
  openMode: 'LINK',
});
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
      group: 'BOOKMARKS',
      openMode: 'LINK',
    },
    {
      id: 'b',
      name: 'Admin',
      url: 'https://x.com',
      newTab: true,
      roles: ['ADMIN'],
      group: 'WORK',
      openMode: 'EMBED',
    },
  ];

  it('filters by role and drops role data', () => {
    expect(customMenusFor(items, 'TEACHER', false)).toEqual([
      {
        id: 'a',
        name: 'All',
        url: '/admin/csl',
        newTab: false,
        group: 'BOOKMARKS',
        openMode: 'LINK',
      },
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
    // REQ-261026B — 생략 시 기본값, 알 수 없는 값 거부.
    const dto = plainToInstance(CustomMenuDto, ok);
    expect([dto.group, dto.openMode]).toEqual(['BOOKMARKS', 'LINK']);
    expect(await check({ ...ok, group: 'ACADEMY' })).toEqual(['group']);
    expect(await check({ ...ok, openMode: 'POPUP' })).toEqual(['openMode']);
  });

  it('embedding requires https', () => {
    const base = { ...ok(), openMode: 'EMBED' as const };
    expect(() =>
      assertCustomMenuInput({ ...base, url: 'https://x.com' }),
    ).not.toThrow();
    expect(() =>
      assertCustomMenuInput({ ...base, url: 'http://x.com' }),
    ).toThrow();
    expect(() => assertCustomMenuInput({ ...base, url: '/admin' })).toThrow();
    expect(() =>
      assertCustomMenuInput({ ...ok(), url: 'http://x.com' }),
    ).not.toThrow();
  });
});
