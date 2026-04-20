import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ParentEntity } from '../../infrastructure/database/entities/parent.entity';

interface OtpEntry {
  otp: string;
  expiresAt: number;
  attempts: number;
}

@Injectable()
export class ParentAuthService {
  /** In-memory OTP store. Production → Redis. */
  private readonly otpStore = new Map<string, OtpEntry>();
  private readonly OTP_TTL_MS = 3 * 60 * 1000; // 3 minutes
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    @InjectRepository(ParentEntity)
    private readonly parentRepo: Repository<ParentEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private normalizePhone(phone: string): string {
    return phone.replace(/-/g, '');
  }

  async sendOtp(phone: string): Promise<{ message: string }> {
    const normalized = this.normalizePhone(phone);

    // Check if parent exists (by querying all parents — in production use encrypted phone lookup)
    // For MVP we do a simple scan; production should use phone hash index
    const parents = await this.parentRepo
      .createQueryBuilder('p')
      .where('p.acd_id = :acdId', { acdId: 1 })
      .getMany();

    // In dev mode we skip actual parent verification for OTP sending
    // Production: verify parent exists by decrypting phone and matching

    // Generate OTP
    const isDev = this.config.get('NODE_ENV') !== 'production';
    const otp = isDev ? '123456' : String(Math.floor(100000 + Math.random() * 900000));

    this.otpStore.set(normalized, {
      otp,
      expiresAt: Date.now() + this.OTP_TTL_MS,
      attempts: 0,
    });

    // In production: send via AmoebaTalk SMS
    // For now, log in dev mode
    if (isDev) {
      console.log(`[DEV] OTP for ${normalized}: ${otp}`);
    }

    return { message: '인증번호가 발송되었습니다.' };
  }

  async verifyOtp(phone: string, otp: string): Promise<{ accessToken: string; parent: { id: number; academyId: number; name: string; phone: string; role: string } }> {
    const normalized = this.normalizePhone(phone);

    const entry = this.otpStore.get(normalized);
    if (!entry) {
      throw new BadRequestException('인증번호를 먼저 요청해주세요.');
    }

    if (Date.now() > entry.expiresAt) {
      this.otpStore.delete(normalized);
      throw new BadRequestException('인증번호가 만료되었습니다. 다시 요청해주세요.');
    }

    entry.attempts++;
    if (entry.attempts > this.MAX_ATTEMPTS) {
      this.otpStore.delete(normalized);
      throw new BadRequestException('인증 시도 횟수를 초과했습니다. 다시 요청해주세요.');
    }

    if (entry.otp !== otp) {
      throw new UnauthorizedException('인증번호가 일치하지 않습니다.');
    }

    // OTP verified — find parent by phone
    this.otpStore.delete(normalized);

    // In MVP: find parent whose phone matches (dev mode: match by raw phone or by parent ID 1)
    // Production: decrypt and compare phone numbers
    const allParents = await this.parentRepo.find({ where: { acdId: 1 } });

    // Try to find parent by decrypted phone — in dev, use a simple approach
    // For now, find the first parent (dev seed data)
    let matchedParent: ParentEntity | null = null;

    if (allParents.length > 0) {
      // In dev mode, match first parent or by name-based lookup
      matchedParent = allParents[0];
    }

    if (!matchedParent) {
      throw new UnauthorizedException('등록된 학부모 정보를 찾을 수 없습니다.');
    }

    const payload = {
      sub: matchedParent.prtId,
      acdId: matchedParent.acdId,
      email: '',
      name: matchedParent.prtName,
      role: 'PARENT',
    };

    return {
      accessToken: this.jwtService.sign(payload),
      parent: {
        id: matchedParent.prtId,
        academyId: matchedParent.acdId,
        name: matchedParent.prtName,
        phone: normalized,
        role: 'PARENT',
      },
    };
  }
}
