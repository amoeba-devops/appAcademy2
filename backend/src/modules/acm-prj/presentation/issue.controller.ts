import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { IssueService } from '../application/issue.service';
import {
  IssueAssigneeDto,
  IssueCommentDto,
  IssueListQuery,
  IssueStatusDto,
} from '../application/issue.dto';

/** REQ-261015C — 이슈(전체 프로젝트) + 내 업무. */
@Controller('acm/prj')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'STAFF', 'TEACHER', 'APP_ADMIN')
export class IssueController {
  constructor(private readonly issues: IssueService) {}

  @Get('issues') list(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: IssueListQuery,
  ) {
    return this.issues.list(u, q);
  }
  @Get('my-work') myWork(@CurrentUser() u: AcmCurrentUser) {
    return this.issues.myWork(u);
  }
  @Get('issues/:id') get(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.issues.get(u, id);
  }
  @Patch('issues/:id/status') status(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: IssueStatusDto,
  ) {
    return this.issues.changeStatus(u, id, d.status, d.note);
  }
  /** REQ-261016D — 담당자 지정/해제. */
  @Patch('issues/:id/assignee') assignee(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: IssueAssigneeDto,
  ) {
    return this.issues.changeAssignee(u, id, d.assigneeId ?? null);
  }
  @Delete('issues/:id') remove(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.issues.remove(u, id);
  }
  @Get('issues/:id/status-logs') logs(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.issues.statusLogs(u, id);
  }
  @Get('issues/:id/comments') comments(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.issues.comments(u, id);
  }
  @Post('issues/:id/comments') addComment(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: IssueCommentDto,
  ) {
    return this.issues.addComment(u, id, d.body);
  }
  @Put('issues/:id/comments/:comment') editComment(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('comment', ParseUUIDPipe) comment: string,
    @Body() d: IssueCommentDto,
  ) {
    return this.issues.editComment(u, id, comment, d.body);
  }
  @Delete('issues/:id/comments/:comment') removeComment(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('comment', ParseUUIDPipe) comment: string,
  ) {
    return this.issues.editComment(u, id, comment, null);
  }
}
