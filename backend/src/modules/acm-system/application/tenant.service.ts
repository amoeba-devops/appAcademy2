import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { AcmTenantTypeormEntity } from '../infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AcmTenantMenuTypeormEntity } from '../infrastructure/typeorm/acm-tenant-menu.typeorm-entity';
import {
  ALL_MENU_KEYS,
  isAdminMenuKey,
  isAlwaysOn,
} from './admin-menu-keys';
import {
  CreateTenantDto,
  MenuConfigItem,
  MenuVisibilityItemDto,
  TenantView,
  UpdateTenantDto,
} from './dto/tenant.dto';

/**
 * REQ-260621 v1.1 — ACM tenant registry + per-tenant admin-menu visibility.
 * Cross-tenant (APP_ADMIN) management; reachable only via guarded controllers.
 */
@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(AcmTenantTypeormEntity, ACM_DS)
    private readonly tenantRepo: Repository<AcmTenantTypeormEntity>,
    @InjectRepository(AcmTenantMenuTypeormEntity, ACM_DS)
    private readonly menuRepo: Repository<AcmTenantMenuTypeormEntity>,
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
  ) {}

  async list(): Promise<TenantView[]> {
    const tenants = await this.tenantRepo.find({ order: { createdAt: 'ASC' } });
    const counts = await this.userCountsByTenant();
    return tenants.map((t) => this.toView(t, counts.get(t.entId) ?? 0));
  }

  async get(entId: string): Promise<TenantView> {
    const t = await this.getEntityOrThrow(entId);
    const counts = await this.userCountsByTenant([entId]);
    return this.toView(t, counts.get(entId) ?? 0);
  }

  async create(dto: CreateTenantDto): Promise<TenantView> {
    const dup = await this.tenantRepo.findOne({ where: { entId: dto.entId } });
    if (dup) {
      throw new HttpException(
        { code: 'TENANT_EXISTS', message: 'Tenant already registered' },
        HttpStatus.CONFLICT,
      );
    }
    const code = normalizeTenantCode(dto.code);
    if (code) await this.assertCodeFree(code, dto.entId);
    const saved = await this.tenantRepo.save(
      this.tenantRepo.create({
        entId: dto.entId,
        name: dto.name.trim(),
        code,
        status: dto.status ?? 'ACTIVE',
        isSystem: false,
      }),
    );
    return this.toView(saved, 0);
  }

  async update(entId: string, dto: UpdateTenantDto): Promise<TenantView> {
    const t = await this.getEntityOrThrow(entId);
    if (dto.name !== undefined) t.name = dto.name.trim();
    if (dto.status !== undefined) t.status = dto.status;
    if (dto.code !== undefined) {
      const code = normalizeTenantCode(dto.code);
      if (code) await this.assertCodeFree(code, entId);
      t.code = code;
    }
    await this.tenantRepo.save(t);
    const counts = await this.userCountsByTenant([entId]);
    return this.toView(t, counts.get(entId) ?? 0);
  }

  /**
   * Full menu config for the admin UI — every key with visible/alwaysOn/order.
   * PLN-260728E: order 저장분 우선, 없으면 표준 순서(ALL_MENU_KEYS 인덱스). 정렬 후 반환.
   */
  async getMenuConfig(entId: string): Promise<MenuConfigItem[]> {
    const rows = await this.menuRepo.find({ where: { entId } });
    const byKey = new Map(rows.map((r) => [r.menuKey, r]));
    const items = ALL_MENU_KEYS.map((key, idx) => {
      const row = byKey.get(key);
      return {
        key,
        alwaysOn: isAlwaysOn(key),
        visible: isAlwaysOn(key) ? true : (row?.visible ?? true),
        order: row?.order ?? idx,
      };
    });
    items.sort(
      (a, b) =>
        a.order - b.order ||
        ALL_MENU_KEYS.indexOf(a.key as never) -
          ALL_MENU_KEYS.indexOf(b.key as never),
    );
    return items;
  }

  /** Compact list of hidden keys for the caller's own tenant (admin shell). */
  async getHiddenKeys(entId: string): Promise<string[]> {
    const hidden = await this.hiddenKeySet(entId);
    // never hide always-on keys
    return [...hidden].filter((k) => !isAlwaysOn(k));
  }

  /**
   * PLN-260728E — admin shell 용: 숨김 키 + 표시 순서(전체 키의 순서 리스트).
   */
  async getMenuNav(
    entId: string,
  ): Promise<{ hidden: string[]; order: string[] }> {
    const items = await this.getMenuConfig(entId);
    return {
      hidden: items.filter((i) => !i.visible && !i.alwaysOn).map((i) => i.key),
      order: items.map((i) => i.key),
    };
  }

  async setMenuConfig(
    entId: string,
    items: MenuVisibilityItemDto[],
  ): Promise<MenuConfigItem[]> {
    await this.getEntityOrThrow(entId); // 404 if tenant unknown
    for (const item of items) {
      if (!isAdminMenuKey(item.key)) continue; // ignore unknown
      const canonicalIdx = ALL_MENU_KEYS.indexOf(item.key as never);
      const visible = isAlwaysOn(item.key) ? true : item.visible;
      const order = item.order ?? canonicalIdx;
      // 기본값(표시 + 표준순서)이면 override 행 제거, 아니면 upsert.
      if (visible === true && order === canonicalIdx) {
        await this.menuRepo.delete({ entId, menuKey: item.key });
      } else {
        await this.menuRepo.save(
          this.menuRepo.create({ entId, menuKey: item.key, visible, order }),
        );
      }
    }
    return this.getMenuConfig(entId);
  }

  private async hiddenKeySet(entId: string): Promise<Set<string>> {
    const rows = await this.menuRepo.find({ where: { entId, visible: false } });
    return new Set(rows.map((r) => r.menuKey));
  }

  private async userCountsByTenant(
    entIds?: string[],
  ): Promise<Map<string, number>> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select('u.entId', 'entId')
      .addSelect('COUNT(*)', 'cnt')
      .groupBy('u.entId');
    if (entIds && entIds.length > 0) {
      qb.where({ entId: In(entIds) });
    }
    const rows = await qb.getRawMany<{ entId: string; cnt: string }>();
    return new Map(rows.map((r) => [r.entId, Number.parseInt(r.cnt, 10) || 0]));
  }

  private async getEntityOrThrow(
    entId: string,
  ): Promise<AcmTenantTypeormEntity> {
    const t = await this.tenantRepo.findOne({ where: { entId } });
    if (!t) {
      throw new HttpException({ code: 'TENANT_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    return t;
  }

  /** PLN-260708 — enforce login-code uniqueness across tenants. */
  private async assertCodeFree(code: string, exceptEntId: string): Promise<void> {
    const clash = await this.tenantRepo.findOne({ where: { code } });
    if (clash && clash.entId !== exceptEntId) {
      throw new HttpException(
        { code: 'TENANT_CODE_DUPLICATE', message: 'Tenant code already in use' },
        HttpStatus.CONFLICT,
      );
    }
  }

  private toView(t: AcmTenantTypeormEntity, userCount: number): TenantView {
    return {
      entId: t.entId,
      name: t.name,
      code: t.code ?? null,
      status: t.status,
      isSystem: t.isSystem,
      userCount,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}

/** Normalize a tenant login code → lowercase/trim, or null when blank. */
function normalizeTenantCode(code: string | undefined | null): string | null {
  const c = (code ?? '').trim().toLowerCase();
  return c.length > 0 ? c : null;
}
