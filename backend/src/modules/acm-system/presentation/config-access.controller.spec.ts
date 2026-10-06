import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import {
  ConfigAccessController,
  ConfigMenuDto,
} from './config-access.controller';

describe('Config menu visibility', () => {
  const query = jest.fn().mockResolvedValue([]);
  const transaction = jest.fn(
    async (fn: (manager: { query: typeof query }) => Promise<void>) =>
      fn({ query }),
  );
  const getMenuConfig = jest
    .fn()
    .mockResolvedValue([
      { key: 'config', visible: false, alwaysOn: false, order: 5 },
    ]);
  const controller = new ConfigAccessController(
    { transaction } as never,
    { getMenuConfig } as never,
  );
  const user = { id: 'user', entId: 'tenant' };
  beforeEach(() => {
    query.mockClear();
    transaction.mockClear();
  });
  it('updates only visibility and scopes every write to the authenticated tenant', async () => {
    const result = await controller.save(user, {
      items: [{ key: 'pay', visible: false }],
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DO UPDATE SET tnm_visible=EXCLUDED.tnm_visible'),
      ['tenant', 'pay', false],
    );
    expect(query.mock.calls[0][0]).not.toContain('tnm_order');
    expect(result[0]).toMatchObject({
      key: 'config',
      visible: true,
      alwaysOn: true,
    });
  });
  it('rejects hiding fixed recovery entries before writing', async () => {
    for (const key of ['dashboard', 'config'])
      await expect(
        controller.save(user, { items: [{ key, visible: false }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects unknown keys, duplicates, injected tenant/order and nonboolean values', async () => {
    for (const input of [
      { items: [{ key: 'bogus', visible: true }] },
      {
        items: [
          { key: 'pay', visible: true },
          { key: 'pay', visible: false },
        ],
      },
      { entId: 'other', items: [{ key: 'pay', visible: true }] },
      { items: [{ key: 'pay', visible: true, order: 0 }] },
      { items: [{ key: 'pay', visible: 'false' }] },
    ])
      expect(
        (
          await validate(plainToInstance(ConfigMenuDto, input), {
            whitelist: true,
            forbidNonWhitelisted: true,
          })
        ).length,
      ).toBeGreaterThan(0);
  });
});
