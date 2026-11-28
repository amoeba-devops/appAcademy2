import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import type { DataSource } from 'typeorm';
import { CalCategoryService } from './cal-category.service';
import {
  normalizeCalCategory,
  systemCalCategory,
} from './cal-category';
import { isCalColor } from './cal-color.service';
import { CreateCalEventDto } from './dto/cal-event.dto';

/** REQ-261128-CAL — tenant calendar categories. */
type Q = (sql: string, params?: unknown[]) => Promise<unknown>;

function fakeDs(handler: Q) {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    return handler(sql, params);
  });
  const manager = { query };
  const ds = {
    query,
    manager,
    transaction: async (work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
  } as unknown as DataSource;
  return { ds, calls };
}

const ENT = '00000000-0000-0000-0000-000000000001';

describe('cal-category helpers', () => {
  it('passes tenant codes through, maps legacy and garbage', () => {
    expect(normalizeCalCategory('CLASS')).toBe('REGULAR_CLASS');
    expect(normalizeCalCategory('PERSONAL')).toBe('OTHER');
    expect(normalizeCalCategory('AVAILABLE')).toBe('AVAILABLE');
    expect(normalizeCalCategory('C_1A2B3C4D')).toBe('C_1A2B3C4D');
    expect(normalizeCalCategory('bad code')).toBe('OTHER');
  });
  it('keeps the external contract to system codes', () => {
    expect(systemCalCategory('C_1A2B3C4D')).toBe('OTHER');
    expect(systemCalCategory('DEMO_CLASS')).toBe('DEMO_CLASS');
  });
  it('accepts hex colors and legacy palette names only', () => {
    expect(isCalColor('#3B82F6')).toBe(true);
    expect(isCalColor('blue')).toBe(true);
    expect(isCalColor('#3b82f')).toBe(false);
    expect(isCalColor('red')).toBe(false);
  });
  it('accepts tenant codes in the DTO, rejects malformed ones', async () => {
    const ok = await validate(
      plainToInstance(CreateCalEventDto, { evtCategory: 'UNAVAILABLE' }),
    );
    expect(ok.some((e) => e.property === 'evtCategory')).toBe(false);
    const bad = await validate(
      plainToInstance(CreateCalEventDto, { evtCategory: 'drop table' }),
    );
    expect(bad.some((e) => e.property === 'evtCategory')).toBe(true);
  });
});

describe('CalCategoryService', () => {
  it('seeds the 5 system + 4 default categories once per tenant', async () => {
    const { ds, calls } = fakeDs(async () => []);
    const svc = new CalCategoryService(ds);
    await svc.ensureDefaults(ENT);
    await svc.ensureDefaults(ENT);
    const inserts = calls.filter((c) => c.sql.includes('INSERT INTO amb_acm_cal_category'));
    expect(inserts).toHaveLength(1);
    const [, codes, system, inStats] = inserts[0].params as [string, string[], boolean[], boolean[]];
    expect(codes).toEqual([
      'MEETING', 'LEVEL_TEST', 'DEMO_CLASS', 'REGULAR_CLASS', 'OTHER',
      'AVAILABLE', 'UNAVAILABLE', 'CANCELED', 'ABSENT',
    ]);
    expect(system.filter(Boolean)).toHaveLength(5);
    // The four new defaults are left out of the class statistics.
    expect(inStats.slice(5)).toEqual([false, false, false, false]);
  });

  it('allows system codes and active tenant codes; rejects deleted/unknown', async () => {
    const { ds } = fakeDs(async (sql, p) =>
      sql.includes('SELECT 1 FROM amb_acm_cal_category')
        ? (p![1] === 'C_AAAAAAAA' ? [{}] : p![2] ? [{}] : [])
        : [],
    );
    const svc = new CalCategoryService(ds);
    await expect(svc.assertUsable(ENT, 'REGULAR_CLASS')).resolves.toBeUndefined();
    await expect(svc.assertUsable(ENT, 'C_AAAAAAAA')).resolves.toBeUndefined();
    await expect(svc.assertUsable(ENT, 'C_DELETED0')).rejects.toBeInstanceOf(BadRequestException);
    // Keeping the current (deleted) category on edit is fine.
    await expect(
      svc.assertUsable(ENT, 'C_DELETED0', { previous: 'C_DELETED0' }),
    ).resolves.toBeUndefined();
    await expect(
      svc.assertUsable(ENT, 'C_DELETED0', { allowDeleted: true }),
    ).resolves.toBeUndefined();
  });

  const existing = [
    { code: 'REGULAR_CLASS', system: true, deleted: false },
    { code: 'AVAILABLE', system: false, deleted: false },
    { code: 'C_GONE0000', system: false, deleted: true },
  ];
  const saveDs = () =>
    fakeDs(async (sql) => (sql.includes('deleted_at IS NOT NULL AS deleted') ? existing : []));

  it('protects system category names and the stats flag', async () => {
    const { ds } = saveDs();
    const svc = new CalCategoryService(ds);
    await expect(
      svc.save(ENT, [{ code: 'REGULAR_CLASS', name: 'Class' }]),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      svc.save(ENT, [{ code: 'REGULAR_CLASS', inStats: false }]),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('validates names and colors of new categories', async () => {
    const svc = new CalCategoryService(saveDs().ds);
    await expect(svc.save(ENT, [{ name: ' ' }])).rejects.toThrow('CATEGORY_NAME_REQUIRED');
    await expect(
      svc.save(ENT, [{ name: 'A' }, { name: 'A' }]),
    ).rejects.toThrow('CATEGORY_NAME_DUPLICATE');
    await expect(svc.save(ENT, [{ name: 'A', color: 'red' }])).rejects.toThrow('INVALID_COLOR');
    await expect(
      svc.save(ENT, [{ code: 'C_GONE0000', name: 'x' }]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('inserts a new category with a generated code and stores its color', async () => {
    const { ds, calls } = saveDs();
    const svc = new CalCategoryService(ds);
    await svc.save(ENT, [
      { name: '보강', color: '#AABBCC', inStats: true, sortOrder: 9 },
      { code: 'REGULAR_CLASS', color: '#112233', sortOrder: 0 },
    ]);
    const insert = calls.find((c) => c.sql.includes('VALUES ($1, $2, $3, false, $4, $5)'));
    expect(insert?.params?.[1]).toMatch(/^C_[0-9A-F]{8}$/);
    expect(insert?.params?.[2]).toBe('보강');
    const colors = calls.filter((c) => c.sql.includes("VALUES ($1, 'CATEGORY', $2, $3)"));
    expect(colors.map((c) => c.params?.[2])).toEqual(['#aabbcc', '#112233']);
  });

  it('refuses to delete system categories and soft-deletes others', async () => {
    const { ds, calls } = fakeDs(async (sql) =>
      sql.startsWith('UPDATE') ? [[{ cct_code: 'AVAILABLE' }], 1] : sql.includes('count(*) AS n') ? [{ n: '3' }] : [],
    );
    const svc = new CalCategoryService(ds);
    await expect(svc.remove(ENT, 'OTHER')).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(svc.remove(ENT, 'AVAILABLE')).resolves.toEqual({ code: 'AVAILABLE', eventCount: 3 });
    expect(calls.some((c) => c.sql.includes('SET deleted_at = now()'))).toBe(true);
    expect(calls.some((c) => c.sql.startsWith('DELETE'))).toBe(false);
  });
});
