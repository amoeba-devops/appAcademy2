import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { ClassGuidelineTypeormEntity } from './infrastructure/typeorm/class-guideline.typeorm-entity';
import { LevelTestGuideTypeormEntity } from './infrastructure/typeorm/level-test-guide.typeorm-entity';
import { ScoreBenchmarkTypeormEntity } from './infrastructure/typeorm/score-benchmark.typeorm-entity';
import { ScoreBenchmarkGradeTypeormEntity } from './infrastructure/typeorm/score-benchmark-grade.typeorm-entity';
import { ScoreBenchmarkModifierTypeormEntity } from './infrastructure/typeorm/score-benchmark-modifier.typeorm-entity';
import { ClassGuidelineService } from './application/class-guideline.service';
import { LevelTestGuideService } from './application/level-test-guide.service';
import { ScoreBenchmarkService } from './application/score-benchmark.service';
import { ClassGuidelineController } from './presentation/class-guideline.controller';
import { LevelTestGuideController } from './presentation/level-test-guide.controller';
import { ScoreBenchmarkController } from './presentation/score-benchmark.controller';

/**
 * acm-ref — Reference Materials Module (per acm-req-ref-001 v1.0)
 * 5 tables: class guidelines, level test guides, score benchmarks (+ grades N:N + modifiers).
 * Per-update versioning per Q-003 / ADR-006.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        ClassGuidelineTypeormEntity,
        LevelTestGuideTypeormEntity,
        ScoreBenchmarkTypeormEntity,
        ScoreBenchmarkGradeTypeormEntity,
        ScoreBenchmarkModifierTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [
    ClassGuidelineController,
    LevelTestGuideController,
    ScoreBenchmarkController,
  ],
  providers: [ClassGuidelineService, LevelTestGuideService, ScoreBenchmarkService],
  exports: [ClassGuidelineService, LevelTestGuideService, ScoreBenchmarkService],
})
export class AcmRefModule {}
