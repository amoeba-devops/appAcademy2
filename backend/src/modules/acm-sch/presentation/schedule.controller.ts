import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { ScheduleService } from '../application/schedule.service';
import { CreateScheduleDto, UpdateScheduleDto } from '../application/dto/schedule.dto';

/**
 * School Schedules (S-20..S-23).
 * RBAC: viewer=GET, advisor+=POST/PATCH/DELETE.
 */
@ApiTags('acm-sch')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/sch/schools/:schId/schedules')
export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  @Get()
  @ApiOperation({ summary: 'List schedules of a school (S-20)' })
  list(@CurrentUser() user: AcmCurrentUser, @Param('schId', ParseUUIDPipe) schId: string) {
    return this.service.list(user.entId, schId);
  }

  @Post()
  @ApiOperation({ summary: 'Create schedule (S-21)' })
  create(
    @CurrentUser() user: AcmCurrentUser,
    @Param('schId', ParseUUIDPipe) schId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.service.create(user.entId, schId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update schedule (S-22)' })
  update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('schId', ParseUUIDPipe) schId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.update(user.entId, schId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete schedule (S-23)' })
  async remove(
    @CurrentUser() user: AcmCurrentUser,
    @Param('schId', ParseUUIDPipe) schId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.remove(user.entId, schId, id);
  }
}
