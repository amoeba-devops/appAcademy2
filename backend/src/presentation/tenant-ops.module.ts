import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademyEntity } from '../infrastructure/database/entities/academy.entity';
import { UserAcademyEntity } from '../infrastructure/database/entities/user-academy.entity';
import { AuthModule } from './auth/auth.module';
import { OnboardingController } from './onboarding/onboarding.controller';
import { BillingController } from './billing/billing.controller';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TypeOrmModule.forFeature([AcademyEntity, UserAcademyEntity]),
  ],
  controllers: [OnboardingController, BillingController],
})
export class TenantOpsModule {}
