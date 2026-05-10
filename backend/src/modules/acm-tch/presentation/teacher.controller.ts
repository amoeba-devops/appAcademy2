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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { TeacherService } from '../application/teacher.service';
import {
  CreateTeacherDto,
  ListTeachersQueryDto,
  ResetTeacherPasswordDto,
  UpdateTeacherDto,
} from '../application/dto/teacher.dto';

@ApiTags('acm-tch')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('acm/tch/teachers')
export class TeacherController {
  constructor(private readonly svc: TeacherService) {}

  @Get()
  @ApiOperation({ summary: 'List teachers (FR-TCH-001)' })
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: ListTeachersQueryDto) {
    return this.svc.list(u.entId, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get teacher detail (FR-TCH-002)' })
  findOne(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(u.entId, id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create teacher (FR-TCH-003) — admin only' })
  create(@CurrentUser() u: AcmCurrentUser, @Body() dto: CreateTeacherDto) {
    return this.svc.create(u.entId, dto);
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update teacher (FR-TCH-004) — admin only' })
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.svc.update(u.entId, id, dto);
  }

  @Patch(':id/password')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reset teacher login password (FR-TCH-006) — admin only' })
  resetPassword(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetTeacherPasswordDto,
  ) {
    return this.svc.resetPassword(u.entId, id, dto);
  }

  @Patch(':id/account/lock')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lock teacher login account (REQ-260510)' })
  lockAccount(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.lockAccount(u.entId, id);
  }

  @Patch(':id/account/unlock')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Unlock teacher login account (REQ-260510)' })
  unlockAccount(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.unlockAccount(u.entId, id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft-delete teacher (FR-TCH-005) — admin only' })
  remove(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(u.entId, id);
  }
}
