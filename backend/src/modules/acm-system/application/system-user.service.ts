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

  async list(q: ListSystemUsersQueryDto): Promise<{
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
    // REQ-261112J — 소프트삭제된 계정은 관리자 관리에서 복구한 뒤 수정한다.
    if (u.deletedAt) {
      throw new HttpException({ code: 'USER_DELETED' }, HttpStatus.CONFLICT);
    }
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

  async lock(
    id: string,
    byUserId: string | null = null,
  ): Promise<SystemUserView> {
    await this.getEntityOrThrow(id);
    await this.authService.lockUser(id, byUserId);
    return this.getOrThrow(id);
  }

  async unlock(
    id: string,
    byUserId: string | null = null,
  ): Promise<SystemUserView> {
    await this.getEntityOrThrow(id);
    await this.authService.unlockUser(id, byUserId);
    return this.getOrThrow(id);
  }

  /**
   * REQ-261112J — 완전삭제 (APP_ADMIN, 테넌트 화면).
   * 개인 데이터(권한·멤버십·알림·푸시·채팅 참여·OAuth·비밀번호 요청)는 지우고,
   * 이슈·일정·로그 등 이력은 FK 없는 uuid 로 남는다(이름은 빈칸으로 보임).
   * 자기 자신·APP_ADMIN, ICS 가져오기 소유자(반복 일정 생성에 필요)는 삭제할 수 없다.
   */
  async remove(id: string, actorId: string): Promise<void> {
    const u = await this.getEntityOrThrow(id);
    if (u.id === actorId) {
      throw new HttpException(
        { code: 'CANNOT_DELETE_SELF' },
        HttpStatus.FORBIDDEN,
      );
    }
    if (u.role === 'APP_ADMIN') {
      throw new HttpException(
        { code: 'CANNOT_DELETE_APP_ADMIN' },
        HttpStatus.FORBIDDEN,
      );
    }
    await this.userRepo.manager.transaction(async (m) => {
      const [ics] = await m.query<{ n: number }[]>(
        `SELECT count(*)::int n FROM amb_acm_cal_ics_source WHERE owner_user_id=$1`,
        [id],
      );
      if (ics.n > 0) {
        throw new HttpException(
          { code: 'USER_OWNS_ICS_SOURCES', message: 'USER_OWNS_ICS_SOURCES' },
          HttpStatus.CONFLICT,
        );
      }
      const p = [u.entId, id];
      for (const sql of [
        `DELETE FROM amb_acm_prj_member WHERE ent_id=$1 AND usr_id=$2`,
        `DELETE FROM amb_acm_drv_member WHERE ent_id=$1 AND usr_id=$2`,
        `DELETE FROM amb_acm_prj_issue_participant WHERE ent_id=$1 AND usr_id=$2`,
        `DELETE FROM amb_acm_prj_oauth WHERE ent_id=$1 AND usr_id=$2`,
        `DELETE FROM amb_acm_notification_inbox WHERE ent_id=$1 AND usr_id=$2`,
        `DELETE FROM amb_acm_password_reset_request WHERE ent_id=$1 AND usr_id=$2`,
        `DELETE FROM amb_acm_push_subscription WHERE ent_id=$1 AND psu_kind='USER' AND psu_recipient_id=$2`,
        `DELETE FROM amb_acm_notification_pref WHERE ent_id=$1 AND npf_kind='USER' AND npf_recipient_id=$2`,
        `UPDATE amb_acm_talk_member SET tlm_left_at=COALESCE(tlm_left_at, now()) WHERE ent_id=$1 AND tlm_kind='USER' AND tlm_ref_id=$2`,
        `UPDATE amb_acm_user_invite SET accepted_usr_id=NULL WHERE ent_id=$1 AND accepted_usr_id=$2`,
      ]) {
        await m.query(sql, p);
      }
      // 권한은 FK CASCADE, 강사·직원 연결은 FK SET NULL.
      await m.query(
        `DELETE FROM amb_acm_user WHERE ent_id=$1 AND usr_id=$2`,
        p,
      );
    });
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
