import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../infrastructure/database/entities/user.entity';
import { UserAcademyEntity } from '../infrastructure/database/entities/user-academy.entity';
import { AuthModule } from './auth/auth.module';
import { MeTenantController } from './me/me-tenant.controller';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([UserEntity, UserAcademyEntity]),
  ],
  controllers: [MeTenantController],
})
export class MeModule {}
