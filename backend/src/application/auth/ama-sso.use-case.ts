import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { UserAcademyEntity } from '../../infrastructure/database/entities/user-academy.entity';
import {
  AMA_OIDC_SERVICE,
  AmaOidcUserInfo,
} from '../../infrastructure/external/ama/auth/interfaces/ama-oidc.interface';
import type { AmaOidcService } from '../../infrastructure/external/ama/auth/interfaces/ama-oidc.interface';
import type { JwtPayload } from '../../presentation/auth/auth.service';

export interface AmaSsoResult {
  accessToken: string;
  user: {
    id: number;
    amaUserId: string;
    email: string | null;
    name: string;
    role: string;
  };
  memberships: Array<{
    academyId: number;
    role: string;
    status: string;
  }>;
  activeAcademyId: number | null;
  /**
   * Next-step hint for the frontend:
   *   - 'onboarding'      : 멤버십 0 → 신규 학원 wizard 로
   *   - 'select-tenant'   : 멤버십 ≥ 2 → 선택 화면
   *   - 'dashboard'       : 멤버십 1 → 곧장 대시보드
   */
  nextStep: 'onboarding' | 'select-tenant' | 'dashboard';
}

/**
 * AmaSsoUseCase — OIDC callback 의 핵심 처리.
 *
 * 1) accessToken → userinfo 조회 (AmaOidcService)
 * 2) usr_ama_user_id 로 user upsert
 * 3) 멤버십(tac_user_academies) 조회 → active tenant 결정
 * 4) JWT 발급 (JwtPayload + activeAcdId/amaUserId 확장)
 *
 * 멤버십 자동 부여 로직(A-4 미확정):
 *   - userinfo.tenantMemberships 가 있을 경우 → AMA 측이 신뢰원
 *     · ama_tenant_id 로 academy 조회 후 멤버십이 없으면 INSERT
 *   - 비어있을 경우 → 본 앱이 자체 멤버십 관리 (직원 초대 모델)
 */
@Injectable()
export class AmaSsoUseCase {
  private readonly logger = new Logger(AmaSsoUseCase.name);

  constructor(
    @Inject(AMA_OIDC_SERVICE)
    private readonly oidc: AmaOidcService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserAcademyEntity)
    private readonly memberRepo: Repository<UserAcademyEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async exchangeCodeAndIssueSession(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<AmaSsoResult> {
    const tokens = await this.oidc.exchangeCode(input);
    const userInfo = await this.oidc.fetchUserInfo(tokens.accessToken);
    if (!userInfo.sub) {
      throw new Error('AMA OIDC userinfo missing sub');
    }
    return this.upsertAndIssue(userInfo);
  }

  /** Test seam — userinfo 가 이미 있을 때 직접 호출 */
  async upsertAndIssue(userInfo: AmaOidcUserInfo): Promise<AmaSsoResult> {
    const user = await this.upsertUser(userInfo);
    const memberships = await this.memberRepo.find({
      where: { usrId: user.usrId, uamStatus: 'ACTIVE' },
    });

    let activeAcdId = user.usrActiveAcdId ?? null;
    let nextStep: AmaSsoResult['nextStep'];
    if (memberships.length === 0) {
      activeAcdId = null;
      nextStep = 'onboarding';
    } else if (memberships.length === 1) {
      activeAcdId = memberships[0].acdId;
      nextStep = 'dashboard';
    } else {
      // 다중 멤버십 — 기존 active 가 유효하면 유지, 아니면 select 화면
      const stillValid =
        activeAcdId != null && memberships.some((m) => m.acdId === activeAcdId);
      if (!stillValid) {
        activeAcdId = null;
        nextStep = 'select-tenant';
      } else {
        nextStep = 'dashboard';
      }
    }

    if (activeAcdId !== user.usrActiveAcdId) {
      await this.userRepo.update(user.usrId, { usrActiveAcdId: activeAcdId });
    }

    const role = activeAcdId
      ? (memberships.find((m) => m.acdId === activeAcdId)?.uamRole ??
        user.usrRole)
      : user.usrRole;

    const payload: JwtPayload = {
      sub: user.usrId,
      acdId: activeAcdId,
      email: user.usrEmail,
      name: user.usrName,
      role,
      amaUserId: userInfo.sub,
      activeAcdId,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.usrId,
        amaUserId: userInfo.sub,
        email: user.usrEmail ?? null,
        name: user.usrName,
        role,
      },
      memberships: memberships.map((m) => ({
        academyId: m.acdId,
        role: m.uamRole,
        status: m.uamStatus,
      })),
      activeAcademyId: activeAcdId,
      nextStep,
    };
  }

  private async upsertUser(info: AmaOidcUserInfo): Promise<UserEntity> {
    const existing = await this.userRepo.findOne({
      where: { usrAmaUserId: info.sub },
    });
    const now = new Date();
    if (existing) {
      // 변경된 displayable 필드만 갱신
      const patch: Partial<UserEntity> = { usrLastLoginAt: now };
      if (info.email && existing.usrEmail !== info.email) {
        patch.usrEmail = info.email;
      }
      if (info.name && existing.usrName !== info.name) {
        patch.usrName = info.name;
      }
      if (existing.usrAcceptedAt == null) {
        patch.usrAcceptedAt = now;
      }
      await this.userRepo.update(existing.usrId, patch);
      return Object.assign(existing, patch);
    }
    const created = this.userRepo.create({
      acdId: null,
      usrActiveAcdId: null,
      usrAmaUserId: info.sub,
      usrEmail: info.email ?? `${info.sub}@ama.local`,
      usrPassword: null,
      usrName: info.name ?? info.sub,
      usrRole: 'STAFF',
      usrStatus: 'ACTIVE',
      usrLastLoginAt: now,
      usrAcceptedAt: now,
    });
    return this.userRepo.save(created);
  }
}
