import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { QuestionTypeormEntity } from './infrastructure/typeorm/question.typeorm-entity';
import { QuestionController } from './presentation/question.controller';
import { QuestionService } from './application/question.service';

/**
 * acm-qna — Regular Counseling (Q&A) Module
 * @see acm-v1.0a-fn-qna-001.md (Q-01..Q-53)
 * Dual-tone editor: internal_body (analytical) vs external_body (parent-facing)
 */
@Module({
  imports: [TypeOrmModule.forFeature([QuestionTypeormEntity], ACM_DS)],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class AcmQnaModule {}
