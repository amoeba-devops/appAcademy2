import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { ParentTypeormEntity } from '../../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import type {
  ParentAuthUser,
  ParentLoginResponse,
} from './dto/parent-auth.dto';

interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
  parentId: string;
  entId: string;
}

export interface ParentJwtPayload {
  sub: string;
  entId: string;
  name: string;
  phone?: string | null;
  role: 'PARENT';
}

@Injectable()
export class ParentAuthService {
  private readonly logger = new Logger(ParentAuthService.name);
  private readonly otpStore = new Map<string, OtpEntry>();
  private readonly otpTtlMs: number;
  private readonly maxAttempts: number;
  private readonly fixedOtp: string | null;

  constructor(
    @InjectRepository(ParentTypeormEntity, ACM_DS)
    private readonly parentRepo: Repository<ParentTypeormEntity>,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.otpTtlMs = Number(config.get('PARENT_OTP_TTL_MS', 180_000));
    this.maxAttempts = Number(config.get('PARENT_OTP_MAX_ATTEMPTS', 5));
    const configuredFixedOtp = config.get<string>('PARENT_OTP_FIXED_CODE');
    const isProduction = String(config.get('NODE_ENV', 'development')) === 'production';
    this.fixedOtp = configuredFixedOtp || (isProduction ? null : '123456');
  }

  async sendOtp(phone: string): Promise<{ message: string }> {
    const parent = await this.findParentByPhone(phone);
    if (!parent) {
      throw new UnauthorizedException('등록된 학부모 정보를 찾을 수 없습니다.');
    }

    const normalized = this.normalizePhone(phone);
    const otp = this.fixedOtp ?? this.generateOtp();
    this.otpStore.set(normalized, {
      otp,
      expiresAt: Date.now() + this.otpTtlMs,
      attempts: 0,
      parentId: parent.id,
      entId: parent.entId,
    });

    if (this.fixedOtp) {
      this.logger.log(`Parent OTP issued in dev mode phone=${normalized} otp=${otp}`);
    } else {
      this.logger.log(`Parent OTP issued phone=${normalized}`);
    }

    return { message: '인증번호가 발송되었습니다.' };
  }

  async verifyOtp(phone: string, otp: string): Promise<ParentLoginResponse> {
    const normalized = this.normalizePhone(phone);
    const entry = this.otpStore.get(normalized);

    if (!entry) {
      throw new BadRequestException('인증번호를 먼저 요청해주세요.');
    }
    if (Date.now() > entry.expiresAt) {
      this.otpStore.delete(normalized);
      throw new BadRequestException('인증번호가 만료되었습니다. 다시 요청해주세요.');
    }

    entry.attempts += 1;
    if (entry.attempts > this.maxAttempts) {
      this.otpStore.delete(normalized);
      throw new BadRequestException('인증 시도 횟수를 초과했습니다. 다시 요청해주세요.');
    }

    if (entry.otp !== otp) {
      throw new UnauthorizedException('인증번호가 일치하지 않습니다.');
    }

    const parent = await this.parentRepo.findOne({
      where: { id: entry.parentId, entId: entry.entId, deletedAt: IsNull() },
    });
    this.otpStore.delete(normalized);

    if (!parent) {
      throw new UnauthorizedException('등록된 학부모 정보를 찾을 수 없습니다.');
    }

    const payload: ParentJwtPayload = {
      sub: parent.id,
      entId: parent.entId,
      name: parent.name,
      phone: parent.phone ?? normalized,
      role: 'PARENT',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      parent: this.toAuthUser(parent),
    };
  }

  async findParentUser(id: string, entId: string): Promise<ParentAuthUser | null> {
    const parent = await this.parentRepo.findOne({
      where: { id, entId, deletedAt: IsNull() },
    });
    return parent ? this.toAuthUser(parent) : null;
  }

  private async findParentByPhone(phone: string): Promise<ParentTypeormEntity | null> {
    const candidates = this.phoneCandidates(phone);
    if (candidates.length === 0) return null;

    return this.parentRepo
      .createQueryBuilder('p')
      .where('p.deleted_at IS NULL')
      .andWhere(
        "regexp_replace(coalesce(p.par_phone, ''), '[^0-9]+', '', 'g') IN (:...phones)",
        { phones: candidates },
      )
      .orderBy('p.updated_at', 'DESC')
      .addOrderBy('p.created_at', 'DESC')
      .getOne();
  }

  private toAuthUser(parent: ParentTypeormEntity): ParentAuthUser {
    return {
      id: parent.id,
      entId: parent.entId,
      name: parent.name,
      phone: parent.phone ?? null,
      role: 'PARENT',
    };
  }

  private phoneCandidates(phone: string): string[] {
    const digits = this.normalizePhone(phone);
    const values = new Set<string>();
    if (digits) values.add(digits);
    if (digits.startsWith('82')) {
      values.add(`0${digits.slice(2)}`);
    }
    if (digits.startsWith('0')) {
      values.add(`82${digits.slice(1)}`);
    }
    return Array.from(values).filter((v) => v.length >= 7);
  }

  private normalizePhone(phone: string): string {
    return String(phone ?? '').replace(/\D/g, '');
  }

  private generateOtp(): string {
    return String(Math.floor(100_000 + Math.random() * 900_000));
  }
}
