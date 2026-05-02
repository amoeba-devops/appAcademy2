import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { QuestionService } from '../application/question.service';
import {
  ChangeQnaStatusDto,
  CreateQuestionDto,
  EscalateQnaDto,
  MarkResolvedDto,
  PromoteFaqDto,
  ReplyQuestionDto,
  RespondQuestionDto,
  UpdateQuestionDto,
} from '../application/dto/question.dto';
import type { QnaStatus } from '../infrastructure/typeorm/question.typeorm-entity';

@ApiTags('acm-qna')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
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
    @Query('faqOnly') faqOnly?: string,
    @Query('categoryId') categoryId?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.service.list(user.entId, {
      status,
      faqOnly: faqOnly === 'true' || faqOnly === '1',
      categoryId,
      limit: Number(limit),
      offset: Number(offset),
    });
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

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Soft delete (Q-05) — team_lead+' })
  async remove(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.softDelete(user.entId, id, user.id);
  }

  @Post(':id/escalate')
  @ApiOperation({ summary: 'Escalate (Q-08)' })
  escalate(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalateQnaDto,
  ) {
    return this.service.escalate(user.entId, id, dto, user.id);
  }

  @Post(':id/reply')
  @ApiOperation({ summary: 'Create child record in thread (Q-09)' })
  reply(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyQuestionDto,
  ) {
    return this.service.reply(user.entId, id, dto, user.id);
  }

  @Get(':id/thread')
  @ApiOperation({ summary: 'Thread chain — root + descendants (Q-10)' })
  thread(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.thread(user.entId, id);
  }

  @Post(':id/use-faq')
  @ApiOperation({ summary: 'Track FAQ usage + return externalBody (Q-23)' })
  useFaq(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.useFaq(user.entId, id, user.id);
  }
}
