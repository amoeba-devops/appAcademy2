import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { AcmAuthService } from '../../acm-auth/application/acm-auth.service';
import type { AcmRole } from '../../acm-auth/application/acm-role.mapper';
import { AcmTenantTypeormEntity } from '../infrastructure/typeorm/acm-tenant.typeorm-entity';
import {
  CreateSystemUserDto,
  ListSystemUsersQueryDto,
  SystemUserPermission,
  SystemUserView,
  UpdateSystemUserDto,
} from './dto/system-user.dto';

/**
 * REQ-260621 — cross-tenant ACM user administration for APP_ADMIN.
 *
 * ⚠️  Tenant-boundary crossing: unlike every other ACM service, this one is
 * NOT scoped by ent_id. It is reachable only via SystemUserController which is
 * gated by @Roles('APP_ADMIN') + RolesGuard. Do not import elsewhere.
 */
@Injectable()
export class SystemUserService {
  constructor(
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
    @InjectRepository(AcmTenantTypeormEntity, ACM_DS)
    private readonly tenantRepo: Repository<AcmTenantTypeormEntity>,
    private readonly authService: AcmAuthService,
  ) {}

  async list(
    q: ListSystemUsersQueryDto,
  ): Promise<{
    items: SystemUserView[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, Number.parseInt(q.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(q.limit ?? '20', 10) || 20),
    );

    const qb = this.userRepo.createQueryBuilder('u');
    if (q.q?.trim()) {
      const term = `%${q.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(u.email) LIKE :term', { term }).orWhere(
            'LOWER(u.name) LIKE :term',
            { term },
          );
        }),
      );
    }
    if (q.role) qb.andWhere('u.role = :role', { role: q.role });
    if (q.entId) qb.andWhere('u.entId = :entId', { entId: q.entId });

    qb.orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();
    const names = await this.tenantNames(rows.map((u) => u.entId));
    const perms = await this.permissionsOf(rows);
    return {
      items: rows.map((u) =>
        this.toView(u, names.get(u.entId) ?? null, perms.get(u.id) ?? []),
      ),
      total,
      page,
      limit,
    };
  }

  async getDetail(id: string): Promise<SystemUserView> {
    const u = await this.getEntityOrThrow(id);
    const names = await this.tenantNames([u.entId]);
    return this.toView(
      u,
      names.get(u.entId) ?? null,
      (await this.permissionsOf([u])).get(u.id) ?? [],
    );
  }

  async create(dto: CreateSystemUserDto): Promise<SystemUserView> {
    const { id } = await this.authService.createUserWithPassword({
      entId: dto.entId,
      email: dto.email,
      plainPassword: dto.password,
      name: dto.name,
      role: dto.role as AcmRole,
    });
    return this.getOrThrow(id);
  }

  async update(id: string, dto: UpdateSystemUserDto): Promise<SystemUserView> {
    const u = await this.getEntityOrThrow(id);
    if (dto.name !== undefined) u.name = dto.name;
    if (dto.role !== undefined) u.role = dto.role;
    if (dto.status !== undefined) u.status = dto.status;
    await this.userRepo.save(u);
    const names = await this.tenantNames([u.entId]);
    return this.toView(
      u,
      names.get(u.entId) ?? null,
      (await this.permissionsOf([u])).get(u.id) ?? [],
    );
  }

  async resetPassword(id: string, password: string): Promise<void> {
    await this.getEntityOrThrow(id); // 404 if missing
    await this.authService.updateUserPassword(id, password);
  }

  async lock(id: string): Promise<SystemUserView> {
    await this.getEntityOrThrow(id);
    await this.authService.lockUser(id);
    return this.getOrThrow(id);
  }

  async unlock(id: string): Promise<SystemUserView> {
    await this.getEntityOrThrow(id);
    await this.authService.unlockUser(id);
    return this.getOrThrow(id);
  }

  private async getOrThrow(id: string): Promise<SystemUserView> {
    return this.getDetail(id);
  }

  private async tenantNames(entIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(entIds)];
    if (unique.length === 0) return new Map();
    const rows = await this.tenantRepo.find({ where: { entId: In(unique) } });
    return new Map(rows.map((t) => [t.entId, t.name]));
  }

  private async getEntityOrThrow(id: string): Promise<AcmUserTypeormEntity> {
    const u = await this.userRepo.findOne({ where: { id } });
    if (!u) {
      throw new HttpException({ code: 'USER_NOT_FOUND' }, HttpStatus.NOT_FOUND);
    }
    return u;
  }

  /** REQ-261016D — 사용자별 보조 권한(소속 테넌트 기준). */
  private async permissionsOf(
    users: Pick<AcmUserTypeormEntity, 'id' | 'entId'>[],
  ): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (!users.length) return map;
    const rows = await this.userRepo.manager.query<
      { usr_id: string; upr_permission: string }[]
    >(
      `SELECT p.usr_id, p.upr_permission FROM amb_acm_user_permission p
        JOIN amb_acm_user u ON u.usr_id = p.usr_id AND u.ent_id = p.ent_id
       WHERE p.usr_id = ANY($1::uuid[]) ORDER BY p.upr_permission`,
      [users.map((u) => u.id)],
    );
    for (const r of rows)
      map.set(r.usr_id, [...(map.get(r.usr_id) ?? []), r.upr_permission]);
    return map;
  }

  /** REQ-261016D — 보조 권한 전체 교체(사용자 소속 테넌트 범위). */
  async setPermissions(
    id: string,
    permissions: SystemUserPermission[],
    grantedBy: string,
  ): Promise<SystemUserView> {
    const u = await this.getEntityOrThrow(id);
    const wanted = [...new Set(permissions)];
    await this.userRepo.manager.transaction(async (m) => {
      await m.query(
        `DELETE FROM amb_acm_user_permission
          WHERE ent_id = $1 AND usr_id = $2 AND NOT (upr_permission = ANY($3::text[]))`,
        [u.entId, u.id, wanted],
      );
      for (const p of wanted)
        await m.query(
          `INSERT INTO amb_acm_user_permission (ent_id, usr_id, upr_permission, upr_granted_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (ent_id, usr_id, upr_permission) DO NOTHING`,
          [u.entId, u.id, p, grantedBy],
        );
    });
    return this.getDetail(id);
  }

  private toView(
    u: AcmUserTypeormEntity,
    tenantName: string | null,
    permissions: string[] = [],
  ): SystemUserView {
    return {
      id: u.id,
      entId: u.entId,
      tenantName,
      email: u.email,
      name: u.name,
      role: u.role ?? 'ADMIN',
      status: u.status,
      authSource: u.authSource,
      locked: !!u.lockedAt,
      mustChangePassword: u.mustChangePassword ?? false,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
      permissions,
    };
  }
}
