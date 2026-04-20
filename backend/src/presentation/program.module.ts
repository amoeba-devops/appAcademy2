import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramEntity } from '../infrastructure/database/entities/program.entity';
import { ProgramSettingEntity } from '../infrastructure/database/entities/program-setting.entity';
import { ProgramRepository } from '../infrastructure/database/repositories/program.repository';
import { PROGRAM_REPOSITORY } from '../domain/repositories/program-repository.interface';
import {
  GetProgramsUseCase,
  GetProgramDetailUseCase,
  CreateProgramUseCase,
  UpdateProgramUseCase,
} from '../application/use-cases/program';
import { ProgramController } from './controllers/program.controller';
import { PortalProgramController } from './controllers/portal-program.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProgramEntity, ProgramSettingEntity])],
  controllers: [ProgramController, PortalProgramController],
  providers: [
    { provide: PROGRAM_REPOSITORY, useClass: ProgramRepository },
    GetProgramsUseCase,
    GetProgramDetailUseCase,
    CreateProgramUseCase,
    UpdateProgramUseCase,
  ],
  exports: [PROGRAM_REPOSITORY],
})
export class ProgramModule {}
