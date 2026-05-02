import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { QuestionService } from '../application/question.service';

/** Per-student QNA timeline (FR-QNA-P1-06). */
@ApiTags('acm-qna')
@ApiBearerAuth()
@UseGuards(OwnEntityGuard)
@Controller('acm/qna/students')
export class QnaStudentController {
  constructor(private readonly service: QuestionService) {}

  @Get(':userId/qna')
  @ApiOperation({ summary: 'List QNA records for a student (timeline)' })
  list(
    @CurrentUser() user: AcmCurrentUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.service.listByStudent(user.entId, userId, Number(limit), Number(offset));
  }
}
