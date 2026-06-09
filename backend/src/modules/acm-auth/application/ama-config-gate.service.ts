import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AmaConfigTypeormEntity } from '../infrastructure/typeorm/ama-config.typeorm-entity';

/**
 * REQ-260609B FR-3 — AMA 커스텀앱 SSO 로그인 게이트.
 *
 * 어드민이 `/admin/config` 에 등록한 **entityId** 와 토큰(또는 introspect)의
 * 법인 식별자가 **일치하고 활성 상태일 때만** 로그인을 허용한다. 그 외(설정
 * 없음 / 비활성 / entityId 불일치) 는 **전면 거부 403 ENTITY_NOT_ALLOWED**
 * (fail-closed, 결정 2026-06-09).
 *
 * REQ-260609C D-1 — appCode 는 게이트에서 제외한다. ama_session OAuth 흐름에서
 * 앱 정체성은 교환에 사용하는 client_id/secret 로 이미 결속되며, introspect 는
 * appCode 를 반환하지 않는다. `amb_acm_ama_config.amc_app_code` 컬럼은 정보성
 * 으로만 보존(게이트 비사용).
 *
 * REQ-260609 FR-A 의 env/MySQL 기반 {@link EntityGateService} 를 승계한다 —
 * 단일 진실원천을 어드민 편집 가능한 DB(`amb_acm_ama_config`)로 이전.
 * 부트스트랩 lockout 방지는 배포 seed(`921-seed-ama-config.sql`)가 담당.
 */
@Injectable()
export class AmaConfigGateService {
  private readonly logger = new Logger(AmaConfigGateService.name);

  constructor(
    @InjectRepository(AmaConfigTypeormEntity, ACM_DS)
    private readonly repo: Repository<AmaConfigTypeormEntity>,
  ) {}

  /**
   * @param entityId 토큰/introspect 의 AMA 법인 식별자.
   * @throws 403 ENTITY_NOT_ALLOWED 등록값과 불일치/미설정/비활성 시.
   */
  async ensureAllowed(entityId: string): Promise<void> {
    const cfg = await this.repo.findOne({
      where: { amaEntityId: entityId, isActive: true },
    });

    if (!cfg) {
      this.deny(entityId, 'no active AMA config for entityId');
    }
  }

  private deny(entityId: string, reason: string): never {
    this.logger.warn(`login gate denied entityId=${entityId} — ${reason}`);
    throw new HttpException(
      {
        code: 'ENTITY_NOT_ALLOWED',
        message: 'This AMA entity/app is not allowed to sign in',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
