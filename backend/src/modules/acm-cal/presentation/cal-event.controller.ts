import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { CalEventService } from '../application/cal-event.service';
import {
  CreateCalEventDto,
  ListCalEventsQueryDto,
  UpdateCalEventDto,
} from '../application/dto/cal-event.dto';

@ApiTags('acm-cal')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/cal/events')
export class CalEventController {
  constructor(private readonly svc: CalEventService) {}

  @Get()
  @ApiOperation({ summary: 'List calendar events in range (FR-CAL-001)' })
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: ListCalEventsQueryDto) {
    return this.svc.list(u.entId, u.id, u.role ?? 'ADMIN', q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event detail (FR-CAL-002)' })
  findOne(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(u.entId, u.id, u.role ?? 'ADMIN', id);
  }

  @Post()
  @ApiOperation({ summary: 'Create event (FR-CAL-003)' })
  create(@CurrentUser() u: AcmCurrentUser, @Body() dto: CreateCalEventDto) {
    return this.svc.create(u.entId, u.id, u.role ?? 'ADMIN', dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update event (FR-CAL-004)' })
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalEventDto,
  ) {
    return this.svc.update(u.entId, u.id, u.role ?? 'ADMIN', id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete event (FR-CAL-005)' })
  remove(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(u.entId, u.id, u.role ?? 'ADMIN', id);
  }
}
