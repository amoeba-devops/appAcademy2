import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';

export const PORTAL_MENU_KINDS = ['TEACHER', 'STUDENT'] as const;
export type PortalMenuKind = (typeof PORTAL_MENU_KINDS)[number];
export const PORTAL_MENU_KEYS = [
  'notices',
  'calendar',
  'students',
  'links',
  'materials',
  'chat',
  'me',
] as const;
export type PortalMenuKey = (typeof PORTAL_MENU_KEYS)[number];
export interface PortalMenuItem {
  key: PortalMenuKey;
  roles: Record<PortalMenuKind, boolean>;
  locked: PortalMenuKind[];
  alwaysOn: boolean;
}
export interface PortalMenuUpdate {
  key: PortalMenuKey;
  kind: PortalMenuKind;
  visible: boolean;
}
interface StoredMenu {
  tpm_kind: PortalMenuKind;
  tpm_menu_key: PortalMenuKey;
  tpm_is_visible: boolean;
}
const ELIGIBLE: Record<PortalMenuKey, readonly PortalMenuKind[]> = {
  notices: PORTAL_MENU_KINDS,
  calendar: ['TEACHER'],
  students: ['TEACHER'],
  links: ['STUDENT'],
  materials: PORTAL_MENU_KINDS,
  chat: ['TEACHER'],
  me: PORTAL_MENU_KINDS,
};
const ENTITLEMENTS: Partial<Record<PortalMenuKey, string>> = {
  notices: 'posts',
  calendar: 'cal',
  students: 'std',
  chat: 'chat',
};
const PATHS: Record<PortalMenuKey, string> = {
  notices: '/portal/notices',
  calendar: '/portal/calendar',
  students: '/portal/students',
  links: '/portal/links',
  materials: '/portal/materials',
  chat: '/portal/chat',
  me: '/portal/me',
};

@Injectable()
export class PortalMenuService {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  async matrix(entId: string): Promise<PortalMenuItem[]> {
    const [stored, denied] = await Promise.all([
      this.ds.query<StoredMenu[]>(
        'SELECT tpm_kind, tpm_menu_key, tpm_is_visible FROM amb_acm_tenant_portal_menu WHERE ent_id=$1',
        [entId],
      ),
      this.ds.query<{ tnm_menu_key: string }[]>(
        'SELECT tnm_menu_key FROM amb_acm_tenant_menu WHERE tnm_ent_id=$1 AND tnm_visible=false',
        [entId],
      ),
    ]);
    const overrides = new Map(
      stored.map((r) => [`${r.tpm_kind}:${r.tpm_menu_key}`, r.tpm_is_visible]),
    );
    const blocked = new Set(denied.map((r) => r.tnm_menu_key));
    return PORTAL_MENU_KEYS.map((key) => {
      const entitlement = ENTITLEMENTS[key];
      const locked = PORTAL_MENU_KINDS.filter(
        (kind) =>
          !ELIGIBLE[key].includes(kind) ||
          (!!entitlement && blocked.has(entitlement)),
      );
      return {
        key,
        locked,
        alwaysOn: key === 'me',
        roles: Object.fromEntries(
          PORTAL_MENU_KINDS.map((kind) => [
            kind,
            key === 'me' ||
              (!locked.includes(kind) &&
                (overrides.get(`${kind}:${key}`) ?? key !== 'notices')),
          ]),
        ) as Record<PortalMenuKind, boolean>,
      };
    });
  }

  async save(
    entId: string,
    items: PortalMenuUpdate[],
  ): Promise<PortalMenuItem[]> {
    const current = new Map(
      (await this.matrix(entId)).map((item) => [item.key, item]),
    );
    const seen = new Set<string>();
    for (const item of items) {
      const row = current.get(item.key);
      const pair = `${item.kind}:${item.key}`;
      if (
        !row ||
        !PORTAL_MENU_KINDS.includes(item.kind) ||
        typeof item.visible !== 'boolean' ||
        row.alwaysOn ||
        row.locked.includes(item.kind) ||
        seen.has(pair)
      ) {
        throw new BadRequestException('INVALID_PORTAL_MENU');
      }
      seen.add(pair);
    }
    await this.ds.transaction(async (manager) => {
      for (const item of items) {
        await manager.query(
          `INSERT INTO amb_acm_tenant_portal_menu (ent_id, tpm_kind, tpm_menu_key, tpm_is_visible)
           VALUES ($1,$2,$3,$4) ON CONFLICT (ent_id,tpm_kind,tpm_menu_key)
           DO UPDATE SET tpm_is_visible=EXCLUDED.tpm_is_visible`,
          [entId, item.kind, item.key, item.visible],
        );
      }
    });
    return this.matrix(entId);
  }

  async nav(entId: string, kind: 'TEACHER' | 'STUDENT' | 'PARENT') {
    // Parent settings are outside this change; preserve existing parent navigation.
    const visible =
      kind === 'PARENT'
        ? (['notices', 'links', 'materials', 'me'] as PortalMenuKey[])
        : (await this.matrix(entId))
            .filter((item) => item.roles[kind])
            .map((item) => item.key);
    return { visible, home: PATHS[visible[0] ?? 'me'] };
  }

  async assertNoticeAccess(
    entId: string,
    kind: 'TEACHER' | 'STUDENT' | 'PARENT',
  ) {
    if (!(await this.nav(entId, kind)).visible.includes('notices')) {
      throw new ForbiddenException('PORTAL_MENU_HIDDEN');
    }
  }
}
