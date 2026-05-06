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
import { StaffService } from '../application/staff.service';
import {
  CreateStaffDto,
  ListStaffQueryDto,
  ResetStaffPasswordDto,
  UpdateStaffDto,
} from '../application/dto/staff.dto';

@ApiTags('acm-stf')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN')
@Controller('acm/stf/staff')
export class StaffController {
  constructor(private readonly svc: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'List staff (FR-STF-001) — admin only' })
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: ListStaffQueryDto) {
    return this.svc.list(u.entId, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staff detail (FR-STF-002)' })
  findOne(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(u.entId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create staff (FR-STF-003)' })
  create(@CurrentUser() u: AcmCurrentUser, @Body() dto: CreateStaffDto) {
    return this.svc.create(u.entId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update staff (FR-STF-004)' })
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.svc.update(u.entId, id, dto);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Reset staff login password (FR-STF-006)' })
  resetPassword(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetStaffPasswordDto,
  ) {
    return this.svc.resetPassword(u.entId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete staff (FR-STF-005)' })
  remove(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(u.entId, id);
  }
}
