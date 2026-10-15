import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { isAlwaysOn } from './admin-menu-keys';
import { TenantService } from './tenant.service';

/** REQ-261015C — 테넌트 마스터가 등급별 노출을 정하는 콘솔 등급. */
export const MENU_ROLES = ['ADMIN', 'TEACHER', 'STAFF'] as const;
export type MenuRole = (typeof MENU_ROLES)[number];

/** 권한 기반 메뉴(설정)는 등급 설정 대상이 아니다. */
const PERMISSION_KEYS = ['config'];
/** 기존 정책상 등급에 열 수 없는 메뉴 (app-shell 의 수납 제한과 동일). */
const LOCKED: Partial<Record<MenuRole, string[]>> = { TEACHER: ['pay'] };

export interface RoleMenuItem {
  key: string;
  /** role → visible. 고정/잠김 등급은 locked 에 표시된다. */
  roles: Record<MenuRole, boolean>;
  alwaysOn: boolean;
  locked: MenuRole[];
}

export function isMenuRole(v: unknown): v is MenuRole {
  return (MENU_ROLES as readonly unknown[]).includes(v);
}

/** 등급 숨김을 테넌트 허가 결과에 합친다. APP_ADMIN 등 비대상 역할은 그대로. */
export function mergeRoleHidden(
  nav: { hidden: string[]; order: string[] },
  role: string | undefined,
  roleHidden: string[],
): { hidden: string[]; order: string[] } {
  if (!isMenuRole(role)) return nav;
  const hidden = new Set(nav.hidden);
  for (const key of roleHidden)
    if (!isAlwaysOn(key) && !PERMISSION_KEYS.includes(key)) hidden.add(key);
  return { hidden: [...hidden], order: nav.order };
}

@Injectable()
export class TenantRoleMenuService {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly tenants: TenantService,
  ) {}

  /** 시스템 어드민이 허가한 메뉴만 등급 매트릭스로 반환. */
  async matrix(entId: string): Promise<RoleMenuItem[]> {
    const allowed = (await this.tenants.getMenuConfig(entId)).filter(
      (i) => i.visible && !PERMISSION_KEYS.includes(i.key),
    );
    const rows = await this.ds.query<
      { trm_role: MenuRole; trm_menu_key: string; trm_visible: boolean }[]
    >(
      `SELECT trm_role, trm_menu_key, trm_visible
         FROM amb_acm_tenant_role_menu WHERE ent_id = $1`,
      [entId],
    );
    const stored = new Map(
      rows.map((r) => [`${r.trm_role}:${r.trm_menu_key}`, r.trm_visible]),
    );
    return allowed.map((i) => {
      const locked = MENU_ROLES.filter((r) => LOCKED[r]?.includes(i.key));
      const roles = Object.fromEntries(
        MENU_ROLES.map((r) => [
          r,
          i.alwaysOn
            ? true
            : locked.includes(r)
              ? false
              : (stored.get(`${r}:${i.key}`) ?? true),
        ]),
      ) as Record<MenuRole, boolean>;
      return { key: i.key, roles, alwaysOn: i.alwaysOn, locked };
    });
  }

  async save(
    entId: string,
    items: { key: string; role: MenuRole; visible: boolean }[],
  ): Promise<RoleMenuItem[]> {
    const editable = new Map(
      (await this.matrix(entId)).map((i) => [i.key, i] as const),
    );
    for (const item of items) {
      const target = editable.get(item.key);
      if (!target || target.alwaysOn || target.locked.includes(item.role))
        throw new BadRequestException(
          `Menu ${item.key} cannot be configured for ${item.role}`,
        );
    }
    await this.ds.transaction(async (m) => {
      for (const item of items) {
        // 기본값(노출)은 행을 지워 하위 호환 상태로 되돌린다.
        if (item.visible)
          await m.query(
            `DELETE FROM amb_acm_tenant_role_menu
              WHERE ent_id=$1 AND trm_role=$2 AND trm_menu_key=$3`,
            [entId, item.role, item.key],
          );
        else
          await m.query(
            `INSERT INTO amb_acm_tenant_role_menu (ent_id, trm_role, trm_menu_key, trm_visible)
             VALUES ($1,$2,$3,false)
             ON CONFLICT (ent_id, trm_role, trm_menu_key)
             DO UPDATE SET trm_visible = false`,
            [entId, item.role, item.key],
          );
      }
    });
    return this.matrix(entId);
  }

  /** 시스템 어드민 — 테넌트 마스터 목록/지정/해제. */
  async masters(
    entId: string,
  ): Promise<{ id: string; email: string; name: string }[]> {
    return this.ds.query(
      `SELECT u.usr_id AS id, u.usr_email AS email, u.usr_name AS name
         FROM amb_acm_user_permission p
         JOIN amb_acm_user u ON u.usr_id = p.usr_id AND u.ent_id = p.ent_id
        WHERE p.ent_id = $1 AND p.upr_permission = 'TENANT_MASTER'
        ORDER BY u.usr_email`,
      [entId],
    );
  }

  async grantMaster(entId: string, usrId: string, grantedBy?: string) {
    const rows = await this.ds.query<{ usr_id: string }[]>(
      `SELECT usr_id FROM amb_acm_user WHERE ent_id = $1 AND usr_id = $2`,
      [entId, usrId],
    );
    if (!rows.length) throw new NotFoundException('User not found in tenant');
    await this.ds.query(
      `INSERT INTO amb_acm_user_permission (ent_id, usr_id, upr_permission, upr_granted_by)
       VALUES ($1, $2, 'TENANT_MASTER', $3)
       ON CONFLICT (ent_id, usr_id, upr_permission) DO NOTHING`,
      [entId, usrId, grantedBy ?? null],
    );
    return this.masters(entId);
  }

  async revokeMaster(entId: string, usrId: string) {
    await this.ds.query(
      `DELETE FROM amb_acm_user_permission
        WHERE ent_id = $1 AND usr_id = $2 AND upr_permission = 'TENANT_MASTER'`,
      [entId, usrId],
    );
    return this.masters(entId);
  }

  async navFor(
    entId: string,
    role: string | undefined,
  ): Promise<{ hidden: string[]; order: string[] }> {
    const nav = await this.tenants.getMenuNav(entId);
    if (!isMenuRole(role)) return nav;
    const rows = await this.ds.query<{ trm_menu_key: string }[]>(
      `SELECT trm_menu_key FROM amb_acm_tenant_role_menu
        WHERE ent_id=$1 AND trm_role=$2 AND trm_visible = false`,
      [entId, role],
    );
    return mergeRoleHidden(
      nav,
      role,
      rows.map((r) => r.trm_menu_key),
    );
  }
}
