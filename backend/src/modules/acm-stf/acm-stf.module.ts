import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcmAuthModule } from '../acm-auth/acm-auth.module';
import { StaffService } from './application/staff.service';
import { StaffTypeormEntity } from './infrastructure/typeorm/staff.typeorm-entity';
import { StaffController } from './presentation/staff.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffTypeormEntity], ACM_DS),
    AcmAuthModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class AcmStfModule {}
