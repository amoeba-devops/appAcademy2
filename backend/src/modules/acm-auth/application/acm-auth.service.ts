import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmUserTypeormEntity } from '../infrastructure/typeorm/acm-user.typeorm-entity';
import { AcmAuthUser, AcmLoginResponse } from './dto/acm-auth.dto';

export interface AcmJwtPayload {
  sub: string;
  entId: string;
  email: string;
  name: string;
}

interface FailureWindow {
  count: number;
  firstAt: number;
  lockedUntil: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;
const LOCKOUT_MS = 60_000;

@Injectable()
export class AcmAuthService {
  private readonly failures = new Map<string, FailureWindow>();

  constructor(
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AcmLoginResponse> {
    this.assertNotLocked(email);

    const user = await this.userRepo.findOne({
      where: { email, status: 'ACTIVE' },
    });
    const ok =
      !!user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok || !user) {
      this.recordFailure(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.failures.delete(email);
    user.lastLoginAt = new Date();
    await this.userRepo.update(user.id, { lastLoginAt: user.lastLoginAt });

    const payload: AcmJwtPayload = {
      sub: user.id,
      entId: user.entId,
      email: user.email,
      name: user.name,
    };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        entId: user.entId,
        email: user.email,
        name: user.name,
      },
    };
  }

  async findById(id: string): Promise<AcmAuthUser | null> {
    const u = await this.userRepo.findOne({ where: { id, status: 'ACTIVE' } });
    if (!u) return null;
    return { id: u.id, entId: u.entId, email: u.email, name: u.name };
  }

  private assertNotLocked(email: string): void {
    const w = this.failures.get(email);
    if (w && w.lockedUntil > Date.now()) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many attempts. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(email: string): void {
    const now = Date.now();
    const w = this.failures.get(email);
    if (!w || now - w.firstAt > WINDOW_MS) {
      this.failures.set(email, { count: 1, firstAt: now, lockedUntil: 0 });
      return;
    }
    w.count += 1;
    if (w.count >= MAX_ATTEMPTS) {
      w.lockedUntil = now + LOCKOUT_MS;
    }
    this.failures.set(email, w);
  }
}
