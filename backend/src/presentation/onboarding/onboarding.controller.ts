import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';
import { UserAcademyEntity } from '../../infrastructure/database/entities/user-academy.entity';

class UpdateAcademyDto {
  @IsString()
  @Length(2, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  representative?: string;

  @IsOptional()
  @IsString()
  @Length(0, 30)
  businessRegistrationNo?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/, {
    message: 'slug must be 3-60 chars, lowercase alnum + hyphen',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  phone?: string;
}

class TeacherSyncOptInDto {
  @IsBoolean()
  consent!: boolean;
}

const ACADEMY_RESOLVE = (user: CurrentUserPayload): number => {
  if (user.academyId == null) {
    throw new ForbiddenException('NO_ACTIVE_TENANT');
  }
  return user.academyId;
};

@ApiTags('onboarding')
@ApiBearerAuth()
@Controller('onboarding')
@UseGuards(AuthGuard('jwt'))
export class OnboardingController {
  private readonly logger = new Logger(OnboardingController.name);

  constructor(
    @InjectRepository(AcademyEntity)
    private readonly academyRepo: Repository<AcademyEntity>,
    @InjectRepository(UserAcademyEntity)
    private readonly memberRepo: Repository<UserAcademyEntity>,
  ) {}

  /** Step 1 — academy basic info */
  @Post('academy')
  async updateAcademy(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateAcademyDto,
  ): Promise<{ acdId: number }> {
    const acdId = ACADEMY_RESOLVE(user);
    await this.assertOwnerOrAdmin(user.userId, acdId);

    if (dto.slug) {
      const dup = await this.academyRepo.findOne({ where: { acdSlug: dto.slug } });
      if (dup && dup.acdId !== acdId) {
        throw new BadRequestException('SLUG_TAKEN');
      }
    }

    await this.academyRepo.update(acdId, {
      acdName: dto.name,
      acdSlug: dto.slug ?? null,
      acdBusinessRegistrationNo: dto.businessRegistrationNo ?? null,
    });
    this.logger.log(`Onboarding step1 acdId=${acdId} by usr=${user.userId}`);
    return { acdId };
  }

  /**
   * Step 2 — operating hours.
   * Phase 1: hours table is not yet defined; payload is accepted and logged.
   */
  @Post('hours')
  async upsertHours(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: Record<string, unknown>,
  ): Promise<{ accepted: true }> {
    const acdId = ACADEMY_RESOLVE(user);
    await this.assertOwnerOrAdmin(user.userId, acdId);
    this.logger.log(
      `Onboarding step2 acdId=${acdId} hours=${JSON.stringify(body)}`,
    );
    return { accepted: true };
  }

  /** Step 3 — teacher master sync opt-in */
  @Post('teacher-sync')
  async teacherSyncOptIn(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: TeacherSyncOptInDto,
  ): Promise<{ consent: boolean }> {
    const acdId = ACADEMY_RESOLVE(user);
    await this.assertOwnerOrAdmin(user.userId, acdId);
    this.logger.log(
      `Onboarding step3 acdId=${acdId} teacher-sync consent=${dto.consent}`,
    );
    return { consent: dto.consent };
  }

  private async assertOwnerOrAdmin(usrId: number, acdId: number): Promise<void> {
    const m = await this.memberRepo.findOne({ where: { usrId, acdId } });
    if (!m || m.uamStatus !== 'ACTIVE') {
      throw new ForbiddenException('NOT_ACTIVE_MEMBER');
    }
    if (m.uamRole !== 'OWNER' && m.uamRole !== 'ADMIN') {
      throw new ForbiddenException('INSUFFICIENT_ROLE');
    }
  }
}
