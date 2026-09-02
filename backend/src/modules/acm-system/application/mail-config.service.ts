import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import {
  packEncrypted,
  unpackEncrypted,
} from '../../acm-auth/infrastructure/ama-secret.codec';
import { MailConfigTypeormEntity } from '../infrastructure/typeorm/mail-config.typeorm-entity';

/**
 * REQ-260902B — 테넌트별 메일(SMTP) 설정 (Gmail 1차).
 * 비밀번호는 ACM_PII_KEY AES-256-GCM 암호화 저장, 응답에는 passwordIsSet만.
 */
export interface MailConfigView {
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  passwordIsSet: boolean;
  fromName: string | null;
  fromAddress: string | null;
  isActive: boolean;
  updatedAt: string | null;
}

export interface MailTransport {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
}

@Injectable()
export class MailConfigService {
  private readonly log = new Logger(MailConfigService.name);

  constructor(
    @InjectRepository(MailConfigTypeormEntity, ACM_DS)
    private readonly repo: Repository<MailConfigTypeormEntity>,
    private readonly aes: AesGcmService,
  ) {}

  async findByEntId(entId: string): Promise<MailConfigView> {
    const row = await this.repo.findOne({ where: { entId } });
    return this.toView(row);
  }

  async upsertByEntId(
    entId: string,
    dto: {
      host?: string;
      port?: number;
      secure?: boolean;
      username?: string;
      password?: string;
      fromName?: string;
      fromAddress?: string;
      isActive?: boolean;
    },
  ): Promise<MailConfigView> {
    let row = await this.repo.findOne({ where: { entId } });
    if (!row) {
      row = this.repo.create({ entId });
    }
    if (dto.host !== undefined) row.host = dto.host.trim();
    if (dto.port !== undefined) row.port = dto.port;
    if (dto.secure !== undefined) row.secure = dto.secure;
    if (dto.username !== undefined) row.username = dto.username.trim() || null;
    if (dto.fromName !== undefined) row.fromName = dto.fromName.trim() || null;
    if (dto.fromAddress !== undefined) {
      row.fromAddress = dto.fromAddress.trim() || null;
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    // password: undefined = 유지, '' = 삭제, 값 = 암호화 교체
    if (dto.password !== undefined) {
      row.passwordEnc = dto.password
        ? packEncrypted(this.aes.encrypt(dto.password))
        : null;
    }
    const saved = await this.repo.save(row);
    this.log.log(
      `mail-config upsert ent=${entId} active=${saved.isActive} passwordChanged=${dto.password !== undefined}`,
    );
    return this.toView(saved);
  }

  /** 발송용 접속정보 — 활성 설정 없으면 null (호출부가 env fallback). */
  async getTransport(entId: string): Promise<MailTransport | null> {
    const row = await this.repo.findOne({ where: { entId } });
    if (!row || !row.isActive || !row.host?.trim()) return null;
    const user = row.username?.trim() || null;
    const from = row.fromAddress?.trim() || user;
    if (!from) return null;
    let pass: string | null = null;
    if (row.passwordEnc?.length) {
      pass = this.aes.decrypt(unpackEncrypted(row.passwordEnc));
    }
    return {
      host: row.host.trim(),
      port: row.port,
      secure: row.secure,
      user,
      pass,
      from: row.fromName ? `"${row.fromName}" <${from}>` : from,
    };
  }

  private toView(row: MailConfigTypeormEntity | null): MailConfigView {
    return {
      host: row?.host ?? 'smtp.gmail.com',
      port: row?.port ?? 587,
      secure: row?.secure ?? false,
      username: row?.username ?? null,
      passwordIsSet: !!row?.passwordEnc?.length,
      fromName: row?.fromName ?? null,
      fromAddress: row?.fromAddress ?? null,
      isActive: row?.isActive ?? true,
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    };
  }
}
