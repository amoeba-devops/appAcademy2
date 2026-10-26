import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import {
  MENU_ROLES,
  isMenuRole,
  type MenuRole,
} from './tenant-role-menu.service';

/** REQ-261026 — 테넌트당 사용자 메뉴(북마크) 최대 개수. */
export const CUSTOM_MENU_LIMIT = 20;
/** 내부 경로(/…, 프로토콜 상대 // 제외) 또는 http(s) URL 만 허용. SQL 1053 CHECK 와 동일. */
export const CUSTOM_MENU_URL_PATTERN = /^(\/($|[^/])|https?:\/\/)/;

export interface CustomMenu {
  id: string;
  name: string;
  url: string;
  newTab: boolean;
  roles: MenuRole[];
}
export type CustomMenuInput = Omit<CustomMenu, 'id'>;
/** 사이드바용 — 등급 정보는 내려보내지 않는다. */
export type NavCustomMenu = Omit<CustomMenu, 'roles'>;

interface Row {
  tcm_id: string;
  tcm_name: string;
  tcm_url: string;
  tcm_new_tab: boolean;
  tcm_roles: MenuRole[];
}
const toMenu = (r: Row): CustomMenu => ({
  id: r.tcm_id,
  name: r.tcm_name,
  url: r.tcm_url,
  newTab: r.tcm_new_tab,
  roles: MENU_ROLES.filter((role) => r.tcm_roles.includes(role)),
});

/** 등급 사용자는 자기 등급에 열린 항목만, 테넌트 마스터·등급 외 역할은 전부 본다. */
export function customMenusFor(
  items: CustomMenu[],
  role: string | undefined,
  tenantMaster: boolean,
): NavCustomMenu[] {
  return items
    .filter((i) => tenantMaster || !isMenuRole(role) || i.roles.includes(role))
    .map(({ id, name, url, newTab }) => ({ id, name, url, newTab }));
}

@Injectable()
export class TenantCustomMenuService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async list(entId: string): Promise<CustomMenu[]> {
    const rows = await this.ds.query<Row[]>(
      `SELECT tcm_id, tcm_name, tcm_url, tcm_new_tab, tcm_roles
         FROM amb_acm_tenant_custom_menu
        WHERE ent_id = $1
        ORDER BY tcm_order, created_at`,
      [entId],
    );
    return rows.map(toMenu);
  }

  async navFor(
    entId: string,
    role: string | undefined,
    tenantMaster: boolean,
  ): Promise<NavCustomMenu[]> {
    return customMenusFor(await this.list(entId), role, tenantMaster);
  }

  async create(entId: string, input: CustomMenuInput): Promise<CustomMenu[]> {
    await this.ds.transaction(async (m) => {
      // 같은 테넌트 동시 추가가 제한을 넘지 않도록 테넌트 단위로 잠근다.
      await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `tcm:${entId}`,
      ]);
      const [{ count, next }] = await m.query<
        { count: number; next: number }[]
      >(
        `SELECT COUNT(*)::int AS count, COALESCE(MAX(tcm_order) + 1, 0)::int AS next
           FROM amb_acm_tenant_custom_menu WHERE ent_id = $1`,
        [entId],
      );
      if (count >= CUSTOM_MENU_LIMIT)
        throw new UnprocessableEntityException({
          code: 'CUSTOM_MENU_LIMIT',
          message: `At most ${CUSTOM_MENU_LIMIT} custom menus per tenant`,
        });
      await m.query(
        `INSERT INTO amb_acm_tenant_custom_menu
           (ent_id, tcm_name, tcm_url, tcm_new_tab, tcm_roles, tcm_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [entId, input.name, input.url, input.newTab, input.roles, next],
      );
    });
    return this.list(entId);
  }

  async update(
    entId: string,
    id: string,
    input: CustomMenuInput,
  ): Promise<CustomMenu[]> {
    const [, count] = await this.ds.query<[unknown[], number]>(
      `UPDATE amb_acm_tenant_custom_menu
          SET tcm_name = $3, tcm_url = $4, tcm_new_tab = $5, tcm_roles = $6
        WHERE ent_id = $1 AND tcm_id = $2`,
      [entId, id, input.name, input.url, input.newTab, input.roles],
    );
    if (!count) throw new NotFoundException('Custom menu not found');
    return this.list(entId);
  }

  async remove(entId: string, id: string): Promise<CustomMenu[]> {
    const [, count] = await this.ds.query<[unknown[], number]>(
      `DELETE FROM amb_acm_tenant_custom_menu WHERE ent_id = $1 AND tcm_id = $2`,
      [entId, id],
    );
    if (!count) throw new NotFoundException('Custom menu not found');
    return this.list(entId);
  }

  /** ids 순서대로 저장. 목록에 없는 항목은 기존 순서로 뒤에 붙는다. */
  async reorder(entId: string, ids: string[]): Promise<CustomMenu[]> {
    const current = (await this.list(entId)).map((i) => i.id);
    const order = [
      ...ids.filter((id) => current.includes(id)),
      ...current.filter((id) => !ids.includes(id)),
    ];
    await this.ds.transaction(async (m) => {
      for (const [i, id] of order.entries())
        await m.query(
          `UPDATE amb_acm_tenant_custom_menu SET tcm_order = $3
            WHERE ent_id = $1 AND tcm_id = $2`,
          [entId, id, i],
        );
    });
    return this.list(entId);
  }
}
