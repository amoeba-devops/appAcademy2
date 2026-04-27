import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { QuestionService } from '../application/question.service';
import {
  ChangeQnaStatusDto,
  CreateQuestionDto,
  MarkResolvedDto,
  PromoteFaqDto,
  RespondQuestionDto,
  UpdateQuestionDto,
} from '../application/dto/question.dto';
import type { QnaStatus } from '../infrastructure/typeorm/question.typeorm-entity';

@ApiTags('acm-qna')
@ApiBearerAuth()
@UseGuards(OwnEntityGuard)
@Controller('acm/qna/questions')
export class QuestionController {
  constructor(private readonly service: QuestionService) {}

  @Post()
  @ApiOperation({ summary: 'Create question (Q-01)' })
  create(@CurrentUser() user: AcmCurrentUser, @Body() dto: CreateQuestionDto) {
    return this.service.create(user.entId, dto, user.id);
  }

  @Get()
  list(
    @CurrentUser() user: AcmCurrentUser,
    @Query('status') status?: QnaStatus,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.service.list(user.entId, status, Number(limit), Number(offset));
  }

  @Get(':id')
  findOne(@CurrentUser() user: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user.entId, id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.service.update(user.entId, id, dto);
  }

  @Post(':id/respond')
  @ApiOperation({ summary: 'Respond to a question (Q-15)' })
  respond(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondQuestionDto,
  ) {
    return this.service.respond(user.entId, id, dto, user.id);
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeQnaStatusDto,
  ) {
    return this.service.changeStatus(user.entId, id, dto, user.id);
  }

  @Patch(':id/resolution')
  @ApiOperation({ summary: 'Mark resolved with resolution_status (FR-QNA-006)' })
  markResolved(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkResolvedDto,
  ) {
    return this.service.markResolved(user.entId, id, dto, user.id);
  }

  @Patch(':id/faq')
  @ApiOperation({ summary: 'Promote/demote FAQ (Q-43)' })
  promoteFaq(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PromoteFaqDto,
  ) {
    return this.service.promoteFaq(user.entId, id, dto);
  }
}
