import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { LinkParentDto } from '../application/dto/student-parent.dto';
import { ParentService } from '../application/parent.service';

/**
 * REQ-260511 — Student-Parent atomic link/unlink/primary endpoints.
 * Distinct from ParentController (parent CRUD) and StudentController (student CRUD).
 */
@ApiTags('acm-std')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/std/students/:stdId/parents')
export class StudentParentController {
  constructor(private readonly parents: ParentService) {}

  @Get()
  @ApiOperation({ summary: 'List parents linked to a student' })
  list(
    @CurrentUser() u: AcmCurrentUser,
    @Param('stdId', ParseUUIDPipe) stdId: string,
  ) {
    return this.parents.listForStudent(u.entId, stdId);
  }

  @Post()
  @ApiOperation({ summary: 'Link a parent to a student (existing or new)' })
  link(
    @CurrentUser() u: AcmCurrentUser,
    @Param('stdId', ParseUUIDPipe) stdId: string,
    @Body() dto: LinkParentDto,
  ) {
    return this.parents.linkToStudent(u.entId, stdId, dto);
  }

  @Delete(':parId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Unlink a parent from a student (parent entity preserved)' })
  unlink(
    @CurrentUser() u: AcmCurrentUser,
    @Param('stdId', ParseUUIDPipe) stdId: string,
    @Param('parId', ParseUUIDPipe) parId: string,
  ) {
    return this.parents.unlinkFromStudent(u.entId, stdId, parId);
  }

  @Patch(':parId/primary')
  @ApiOperation({ summary: 'Set a parent as primary for a student' })
  setPrimary(
    @CurrentUser() u: AcmCurrentUser,
    @Param('stdId', ParseUUIDPipe) stdId: string,
    @Param('parId', ParseUUIDPipe) parId: string,
  ) {
    return this.parents.setPrimaryForStudent(u.entId, stdId, parId);
  }
}
