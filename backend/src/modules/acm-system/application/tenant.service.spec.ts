import { HttpException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { AcmTenantTypeormEntity } from '../infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AcmTenantMenuTypeormEntity } from '../infrastructure/typeorm/acm-tenant-menu.typeorm-entity';

function tenant(over: Partial<AcmTenantTypeormEntity> = {}): AcmTenantTypeormEntity {
  return {
    entId: '00000000-0000-0000-0000-000000000001',
    name: 'Trinity Academy',
    status: 'ACTIVE',
    isSystem: false,
    createdAt: new Date('2026-06-21T00:00:00Z'),
    updatedAt: new Date('2026-06-21T00:00:00Z'),
    ...over,
  } as AcmTenantTypeormEntity;
}

describe('TenantService — menu visibility', () => {
  let tenantRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock; create: jest.Mock };
  let menuRepo: { find: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock };
  let userRepo: { createQueryBuilder: jest.Mock };
  let svc: TenantService;

  beforeEach(() => {
    tenantRepo = {
      findOne: jest.fn().mockResolvedValue(tenant()),
      find: jest.fn(),
      save: jest.fn((x) => x),
      create: jest.fn((x) => x),
    };
    menuRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((x) => x),
      create: jest.fn((x) => x),
      delete: jest.fn(),
    };
    userRepo = { createQueryBuilder: jest.fn() };
    svc = new TenantService(
      tenantRepo as never,
      menuRepo as never,
      userRepo as never,
    );
  });

  it('getMenuConfig: no overrides → all visible, dashboard alwaysOn', async () => {
    const cfg = await svc.getMenuConfig('00000000-0000-0000-0000-000000000001');
    expect(cfg.every((c) => c.visible)).toBe(true);
    const dash = cfg.find((c) => c.key === 'dashboard');
    expect(dash?.alwaysOn).toBe(true);
  });

  it('getMenuConfig: a hidden override flips that key to not visible', async () => {
    menuRepo.find.mockResolvedValueOnce([
      { entId: 'x', menuKey: 'csl', visible: false } as AcmTenantMenuTypeormEntity,
    ]);
    const cfg = await svc.getMenuConfig('00000000-0000-0000-0000-000000000001');
    expect(cfg.find((c) => c.key === 'csl')?.visible).toBe(false);
  });

  it('getHiddenKeys: never returns always-on keys even if stored hidden', async () => {
    menuRepo.find.mockResolvedValueOnce([
      { entId: 'x', menuKey: 'dashboard', visible: false } as AcmTenantMenuTypeormEntity,
      { entId: 'x', menuKey: 'qna', visible: false } as AcmTenantMenuTypeormEntity,
    ]);
    const hidden = await svc.getHiddenKeys('00000000-0000-0000-0000-000000000001');
    expect(hidden).toContain('qna');
    expect(hidden).not.toContain('dashboard');
  });

  it('setMenuConfig: visible=true removes override, visible=false upserts; always-on ignored', async () => {
    await svc.setMenuConfig('00000000-0000-0000-0000-000000000001', [
      { key: 'csl', visible: false },
      { key: 'std', visible: true },
      { key: 'dashboard', visible: false }, // ignored (always-on)
      { key: 'bogus', visible: false }, // ignored (unknown)
    ]);
    expect(menuRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ menuKey: 'csl', visible: false }),
    );
    expect(menuRepo.delete).toHaveBeenCalledWith({
      entId: '00000000-0000-0000-0000-000000000001',
      menuKey: 'std',
    });
    expect(menuRepo.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ menuKey: 'dashboard' }),
    );
  });

  it('update throws 404 for unknown tenant', async () => {
    tenantRepo.findOne.mockResolvedValueOnce(null);
    await expect(svc.update('missing', { name: 'x' })).rejects.toBeInstanceOf(HttpException);
  });
});
