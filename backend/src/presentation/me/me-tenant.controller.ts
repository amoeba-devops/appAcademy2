import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { IsInt, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { UserAcademyEntity } from '../../infrastructure/database/entities/user-academy.entity';

class SetActiveTenantDto {
  @IsInt()
  @Min(1)
  acdId!: number;
}

interface MyTenantDto {
  acdId: number;
  name: string;
  slug: string | null;
  role: string;
  status: string;
  subscriptionStatus: string;
  isActive: boolean;
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
@UseGuards(AuthGuard('jwt'))
export class MeTenantController {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserAcademyEntity)
    private readonly memberRepo: Repository<UserAcademyEntity>,
  ) {}

  @Get('tenants')
  async listTenants(@CurrentUser() user: CurrentUserPayload): Promise<{ tenants: MyTenantDto[] }> {
    const memberships = await this.memberRepo.find({
      where: { usrId: user.userId },
      relations: ['academy'],
    });
    const me = await this.userRepo.findOne({ where: { usrId: user.userId } });
    const activeId = me?.usrActiveAcdId ?? null;
    const tenants: MyTenantDto[] = memberships
      .filter((m) => m.uamStatus !== 'REMOVED' && m.academy)
      .map((m) => ({
        acdId: m.acdId,
        name: m.academy.acdName,
        slug: m.academy.acdSlug,
        role: m.uamRole,
        status: m.uamStatus,
        subscriptionStatus: m.academy.acdSubscriptionStatus,
        isActive: m.acdId === activeId,
      }));
    return { tenants };
  }

  @Put('active-tenant')
  async setActive(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SetActiveTenantDto,
  ): Promise<{ acdId: number }> {
    const membership = await this.memberRepo.findOne({
      where: { usrId: user.userId, acdId: dto.acdId },
      relations: ['academy'],
    });
    if (!membership) {
      throw new NotFoundException('NOT_A_MEMBER');
    }
    if (membership.uamStatus !== 'ACTIVE') {
      throw new BadRequestException(`MEMBERSHIP_${membership.uamStatus}`);
    }
    if (membership.academy?.acdSubscriptionStatus === 'DEPROVISIONED') {
      throw new BadRequestException('TENANT_DEPROVISIONED');
    }
    await this.userRepo.update(user.userId, { usrActiveAcdId: dto.acdId });
    return { acdId: dto.acdId };
  }
}
