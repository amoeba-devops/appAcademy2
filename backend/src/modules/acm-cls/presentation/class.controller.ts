import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { ClassService } from '../application/class.service';
import {
  ChangeClassStatusDto,
  CreateClassDto,
  ListClassesQueryDto,
  UpdateClassDto,
} from '../application/dto/class.dto';
import { SessionService } from '../application/session.service';

@ApiTags('acm-cls')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/cls/classes')
export class ClassController {
  constructor(
    private readonly service: ClassService,
    private readonly sessions: SessionService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create class (FR-CLS-001)' })
  create(@CurrentUser() u: AcmCurrentUser, @Body() dto: CreateClassDto) {
    return this.service.create(u.entId, dto, u.id);
  }

  @Get()
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: ListClassesQueryDto) {
    return this.service.list(u.entId, q);
  }

  @Get(':id')
  findOne(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(u.entId, id);
  }

  @Put(':id')
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.service.update(u.entId, id, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeClassStatusDto,
  ) {
    return this.service.changeStatus(u.entId, id, dto, u.id);
  }

  @Post(':id/sessions/generate')
  @ApiOperation({ summary: 'Generate sessions from recurrence (manual trigger)' })
  generate(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('horizonDays') horizonDays?: string,
  ) {
    return this.sessions.generateForClass(u.entId, id, horizonDays ? Number(horizonDays) : 35);
  }
}
