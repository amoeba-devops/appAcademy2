import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { QuestionTypeormEntity } from './infrastructure/typeorm/question.typeorm-entity';
import { QnaCategoryTypeormEntity } from './infrastructure/typeorm/qna-category.typeorm-entity';
import { QuestionController } from './presentation/question.controller';
import { QnaCategoryController } from './presentation/qna-category.controller';
import { QnaStudentController } from './presentation/qna-student.controller';
import { QuestionService } from './application/question.service';
import { QnaCategoryService } from './application/qna-category.service';
import { QnaPublicService } from './application/qna-public.service';

/**
 * acm-qna — Regular Counseling (Q&A) Module
 * @see acm-v1.0a-fn-qna-001.md (Q-01..Q-53)
 * @see docs/analysis/acm-fn-sch-qna-p1-requirements.md
 */
@Module({
  imports: [TypeOrmModule.forFeature([QuestionTypeormEntity, QnaCategoryTypeormEntity], ACM_DS)],
  controllers: [QuestionController, QnaCategoryController, QnaStudentController],
  providers: [QuestionService, QnaCategoryService, QnaPublicService],
  exports: [QuestionService, QnaCategoryService, QnaPublicService],
})
export class AcmQnaModule {}
