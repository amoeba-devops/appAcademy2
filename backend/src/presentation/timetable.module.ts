import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassSessionEntity } from '../infrastructure/database/entities/class-session.entity';
import { ClassEntity } from '../infrastructure/database/entities/class.entity';
import { ClassSessionRepository } from '../infrastructure/database/repositories/class-session.repository';
import { CLASS_SESSION_REPOSITORY } from '../domain/repositories/class-repository.interface';
import { GetTimetableUseCase } from '../application/use-cases/timetable';
import { TimetableController } from './controllers/timetable.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClassSessionEntity, ClassEntity])],
  controllers: [TimetableController],
  providers: [
    { provide: CLASS_SESSION_REPOSITORY, useClass: ClassSessionRepository },
    GetTimetableUseCase,
  ],
})
export class TimetableModule {}
