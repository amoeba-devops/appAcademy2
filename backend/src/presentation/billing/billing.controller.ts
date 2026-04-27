import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';

interface BillingStatus {
  acdId: number;
  plan: string | null;
  subscriptionStatus: string;
  provisionedAt: string | null;
  canceledAt: string | null;
  amaPortalUrl: string;
}

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
@UseGuards(AuthGuard('jwt'))
export class BillingController {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AcademyEntity)
    private readonly academyRepo: Repository<AcademyEntity>,
  ) {}

  @Get('status')
  async status(@CurrentUser() user: CurrentUserPayload): Promise<BillingStatus> {
    if (user.academyId == null) {
      throw new ForbiddenException('NO_ACTIVE_TENANT');
    }
    const a = await this.academyRepo.findOne({ where: { acdId: user.academyId } });
    if (!a) throw new NotFoundException('ACADEMY_NOT_FOUND');

    const portalBase = this.config.get<string>(
      'AMA_BILLING_PORTAL_URL',
      'https://amoeba.site/billing',
    );
    return {
      acdId: a.acdId,
      plan: a.acdSubscriptionPlan,
      subscriptionStatus: a.acdSubscriptionStatus,
      provisionedAt: a.acdProvisionedAt?.toISOString() ?? null,
      canceledAt: a.acdCanceledAt?.toISOString() ?? null,
      amaPortalUrl: a.acdAmaTenantId
        ? `${portalBase}?tenant=${encodeURIComponent(a.acdAmaTenantId)}`
        : portalBase,
    };
  }
}
