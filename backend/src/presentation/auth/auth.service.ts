import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';

export interface JwtPayload {
  sub: number;
  acdId: number | null;
  email: string;
  name: string;
  role: string;
  /** AMA SSO sub claim (선택 — break-glass login 은 미발급) */
  amaUserId?: string;
  /** 현재 활성 academy. acdId 와 동일하나, 다중 멤버십 사용자에서는 헤더로 변경 가능. */
  activeAcdId?: number | null;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: number;
    academyId: number | null;
    email: string;
    name: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({
      where: { usrEmail: email, usrStatus: 'ACTIVE' },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid =
      user.usrPassword != null &&
      (await bcrypt.compare(password, user.usrPassword));
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.validateUser(email, password);

    // Update last login
    await this.userRepo.update(user.usrId, {
      usrLastLoginAt: new Date(),
    });

    const payload: JwtPayload = {
      sub: user.usrId,
      acdId: user.acdId,
      email: user.usrEmail,
      name: user.usrName,
      role: user.usrRole,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.usrId,
        academyId: user.acdId,
        email: user.usrEmail,
        name: user.usrName,
        role: user.usrRole,
      },
    };
  }
}
