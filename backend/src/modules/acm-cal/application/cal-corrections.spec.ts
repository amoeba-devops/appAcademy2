import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateCalEventDto,
  UpdateCalEventDto,
  DeleteCalEventDto,
} from './dto/cal-event.dto';
import { ChangeRecurrenceDto } from './dto/recurrence.dto';
import { RecurrenceService } from './recurrence.service';
import { normalizeCalCategory, storedCalCategories } from './cal-category';
import type { AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';

describe('calendar correction contracts', () => {
  it.each([undefined, null, '', '   ', '시간 변경'])(
    'accepts optional edit reason %p',
    async (reason) => {
      const event = plainToInstance(UpdateCalEventDto, {
        evtTitle: 'Updated',
        evtEditReason: reason,
      });
      expect(await validate(event)).toEqual([]);
      const dto = plainToInstance(ChangeRecurrenceDto, {
        scope: 'ALL',
        version: 1,
        reason,
        event: { evtTitle: 'Updated', evtEditReason: reason },
      });
      expect(await validate(dto)).toEqual([]);
    },
  );
  it.each(['x', 'x'.repeat(501), 12])(
    'rejects invalid supplied reasons %p',
    async (reason) => {
      expect(
        (
          await validate(
            plainToInstance(UpdateCalEventDto, { evtEditReason: reason }),
          )
        ).length,
      ).toBeGreaterThan(0);
    },
  );
  it.each([undefined, null, '', ' '])(
    'retains deletion validation %p',
    async (reason) => {
      expect(
        (await validate(plainToInstance(DeleteCalEventDto, { reason }))).length,
      ).toBeGreaterThan(0);
      // Guard precedes all persistence, including internal callers bypassing HTTP DTOs.
      const svc = Object.create(
        RecurrenceService.prototype,
      ) as RecurrenceService;
      await expect(
        svc.change(
          {} as AcmCurrentUser,
          'event',
          { scope: 'ALL', version: 1, reason },
          true,
        ),
      ).rejects.toThrow('DELETE_REASON_REQUIRED');
    },
  );
  it.each(['CLASS', 'PERSONAL', 'EVENT'])(
    'rejects retired input category %s but reads existing rows',
    async (category) => {
      const errors = await validate(
        plainToInstance(CreateCalEventDto, { evtCategory: category }),
      );
      expect(errors.some((e) => e.property === 'evtCategory')).toBe(true);
      expect(normalizeCalCategory(category)).toBe(
        category === 'CLASS' ? 'REGULAR_CLASS' : 'OTHER',
      );
      expect(storedCalCategories(normalizeCalCategory(category))).toContain(
        category,
      );
    },
  );
});

describe('actual-start cutoff after recurrence shifts', () => {
  it('keeps an October occurrence moved from November and excludes starts moved into November', async () => {
    const persisted: string[] = [];
    const svc = Object.create(RecurrenceService.prototype) as {
      persist: (
        _m: unknown,
        _s: unknown,
        dto: { evtStartAt: string },
      ) => Promise<{ id: string }>;
      generate: (
        manager: unknown,
        series: unknown,
        horizon: Date,
      ) => Promise<void>;
    };
    svc.persist = async (
      _m: unknown,
      _s: unknown,
      dto: { evtStartAt: string },
    ) => {
      persisted.push(dto.evtStartAt);
      return { id: String(persisted.length) };
    };
    const manager = { query: jest.fn().mockResolvedValue([]) };
    const base = {
      crs_id: 'series',
      ent_id: 'tenant',
      crs_template: {
        evtCategory: 'REGULAR_CLASS',
        evtTitle: 'class',
        evtStartAt: '2026-10-30T00:00:00Z',
        evtEndAt: '2026-10-30T01:00:00Z',
      },
      crs_timezone: 'Asia/Seoul',
      crs_rule: { kind: 'DAILY', interval: 1, end: 'COUNT', count: 6 },
      crs_stop_at: null,
      crs_start_before: new Date('2026-10-31T15:00:00Z'),
      crs_changes: [
        { from: null, patch: {}, startShift: -86400000, endShift: -86400000 },
      ],
    };
    await svc.generate(manager, base, new Date('2027-01-01'));
    expect(persisted).toEqual([
      '2026-10-29T00:00:00.000Z',
      '2026-10-30T00:00:00.000Z',
      '2026-10-31T00:00:00.000Z',
    ]);
    persisted.length = 0;
    await svc.generate(
      manager,
      {
        ...base,
        crs_changes: [
          { from: null, patch: {}, startShift: 86400000, endShift: 86400000 },
        ],
      },
      new Date('2027-01-01'),
    );
    expect(persisted).toEqual(['2026-10-31T00:00:00.000Z']);
  });
});
