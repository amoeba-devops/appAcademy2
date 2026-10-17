import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { PUBLIC_SEED_PASSWORD_HASHES } from './public-seed-password';

/** 초기 관리자 비밀번호 최소 조건(일반 정책보다 길게). */
export const INITIAL_PASSWORD_MIN = 12;
export const isStrongInitialPassword = (pw: string): boolean =>
  pw.length >= INITIAL_PASSWORD_MIN && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);

/**
 * REQ-261017B — 기동 시 공개 시드 비밀번호를 쓰는 계정을 점검한다.
 * - ACM_INITIAL_ADMIN_PASSWORD 가 있으면 그 값으로 바꾸고 첫 로그인 때 변경을 강제한다.
 * - 없으면 경고만 남긴다(운영 모드에서는 해당 계정 로그인이 거부된다).
 * 비밀번호 값은 로그하지 않는다.
 */
@Injectable()
export class AcmSeedPasswordService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AcmSeedPasswordService.name);

  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.run();
    } catch (e) {
      // 점검 실패로 기동을 막지 않는다(로그인 단계에서 다시 막힌다).
      this.logger.warn(`seed password check skipped: ${(e as Error).message}`);
    }
  }

  async run(): Promise<{ found: number; replaced: number }> {
    const users = await this.ds.query<{ usr_id: string; usr_email: string }[]>(
      `SELECT usr_id, usr_email FROM amb_acm_user WHERE usr_password_hash = ANY($1::text[])`,
      [PUBLIC_SEED_PASSWORD_HASHES],
    );
    if (users.length === 0) return { found: 0, replaced: 0 };
    const initial = this.config.get<string>('ACM_INITIAL_ADMIN_PASSWORD') ?? '';
    if (!initial) {
      this.logger.warn(
        `${users.length} account(s) still use a public seed password (${users
          .map((u) => u.usr_email)
          .join(
            ', ',
          )}). Set ACM_INITIAL_ADMIN_PASSWORD or change it after login.`,
      );
      return { found: users.length, replaced: 0 };
    }
    if (!isStrongInitialPassword(initial)) {
      this.logger.error(
        `ACM_INITIAL_ADMIN_PASSWORD ignored: needs ${INITIAL_PASSWORD_MIN}+ chars with letters and digits`,
      );
      return { found: users.length, replaced: 0 };
    }
    const hash = await bcrypt.hash(initial, 12);
    const rows = await this.ds.query<{ usr_email: string }[]>(
      `UPDATE amb_acm_user
          SET usr_password_hash = $1, usr_must_change_password = true,
              usr_temp_password_expires_at = NULL, updated_at = now()
        WHERE usr_password_hash = ANY($2::text[])
        RETURNING usr_email`,
      [hash, PUBLIC_SEED_PASSWORD_HASHES],
    );
    this.logger.log(
      `public seed password replaced from ACM_INITIAL_ADMIN_PASSWORD for ${rows.length} account(s): ${rows
        .map((r) => r.usr_email)
        .join(', ')} — change required on first login`,
    );
    return { found: users.length, replaced: rows.length };
  }
}
