import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuPermissionEntity } from '../../../infrastructure/database/entities/menu-permission.entity';
import {
  MENU_KEYS,
  MENU_ROLES,
  MenuKey,
  MenuRole,
  UpdateMenuPermissionsDto,
} from '../../dto/menu-permission';

export interface MenuPermissionView {
  menuKey: MenuKey;
  role: MenuRole;
  visible: boolean;
  accessible: boolean;
}

/**
 * Normalize a raw `usr_role` value (legacy or per-tenant uam_role) to one of
 * the four canonical menu roles.
 */
export function normalizeMenuRole(rawRole: string | null | undefined): MenuRole {
  const r = String(rawRole || '').toUpperCase();
  if (r === 'MASTER' || r === 'OWNER') return 'OWNER';
  if (r === 'ADMIN' || r === 'SUPERADMIN') return 'ADMIN';
  if (r === 'READONLY' || r === 'VIEWER') return 'READONLY';
  return 'STAFF';
}

@Injectable()
export class ManageMenuPermissionsUseCase {
  constructor(
    @InjectRepository(MenuPermissionEntity)
    private readonly repo: Repository<MenuPermissionEntity>,
  ) {}

  /**
   * Return the full matrix for the tenant. Missing rows are defaulted to
   * (visible=true, accessible=true) so that newly added menu keys do not
   * silently disappear before the admin saves.
   */
  async listMatrix(academyId: number): Promise<MenuPermissionView[]> {
    const rows = await this.repo.find({ where: { acdId: academyId } });
    const map = new Map<string, MenuPermissionEntity>();
    for (const row of rows) map.set(`${row.mnpMenuKey}::${row.mnpRole}`, row);

    const out: MenuPermissionView[] = [];
    for (const menuKey of MENU_KEYS) {
      for (const role of MENU_ROLES) {
        const r = map.get(`${menuKey}::${role}`);
        out.push({
          menuKey,
          role,
          visible: r ? r.mnpVisible === 1 : true,
          accessible: r ? r.mnpAccessible === 1 : true,
        });
      }
    }
    return out;
  }

  /**
   * Bulk upsert. Items not present in dto are left untouched.
   * The admin UI always sends the full matrix so this is effectively a
   * full replace per submit.
   */
  async bulkUpdate(academyId: number, dto: UpdateMenuPermissionsDto): Promise<MenuPermissionView[]> {
    if (!dto.items || dto.items.length === 0) {
      return this.listMatrix(academyId);
    }

    // Validate keys/roles defensively (DTO already enforces via @IsIn).
    const valid = dto.items.filter(
      (it) =>
        (MENU_KEYS as readonly string[]).includes(it.menuKey) &&
        (MENU_ROLES as readonly string[]).includes(it.role),
    );

    await this.repo
      .createQueryBuilder()
      .insert()
      .into(MenuPermissionEntity)
      .values(
        valid.map((it) => ({
          acdId: academyId,
          mnpMenuKey: it.menuKey,
          mnpRole: it.role,
          mnpVisible: it.visible ? 1 : 0,
          mnpAccessible: it.accessible ? 1 : 0,
        })),
      )
      .orUpdate(['mnp_visible', 'mnp_accessible'], ['acd_id', 'mnp_menu_key', 'mnp_role'])
      .execute();

    return this.listMatrix(academyId);
  }

  /**
   * Effective view for a single user — the list of menu keys they can see
   * and access, after role normalization.
   */
  async effectiveForRole(
    academyId: number,
    rawRole: string,
  ): Promise<{ role: MenuRole; visible: MenuKey[]; accessible: MenuKey[] }> {
    const role = normalizeMenuRole(rawRole);
    const matrix = await this.listMatrix(academyId);
    const visible: MenuKey[] = [];
    const accessible: MenuKey[] = [];
    for (const row of matrix) {
      if (row.role !== role) continue;
      if (row.visible) visible.push(row.menuKey);
      if (row.accessible) accessible.push(row.menuKey);
    }
    return { role, visible, accessible };
  }
}
