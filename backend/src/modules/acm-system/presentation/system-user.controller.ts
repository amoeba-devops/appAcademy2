import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { RequirePasswordRotationGuard } from '../../acm-common/guards/require-password-rotation.guard';
import { SystemUserService } from '../application/system-user.service';
import {
  CreateSystemUserDto,
  ListSystemUsersQueryDto,
  ResetSystemUserPasswordDto,
  UpdateSystemUserDto,
} from '../application/dto/system-user.dto';

/**
 * REQ-260621 — System administration (cross-tenant ACM user management).
 *
 * ⚠️  Crosses the ent_id tenant-isolation boundary (NFR-004) BY DESIGN.
 * Every route is restricted to APP_ADMIN via @Roles + RolesGuard. There is
 * deliberately NO OwnEntityGuard here — these endpoints operate across all
 * tenants. See docs/analysis/REQ-260621-acm-ui-system-admin.md § security.
 */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, RolesGuard, RequirePasswordRotationGuard)
@Roles('APP_ADMIN')
@Controller('acm/system/users')
export class SystemUserController {
  constructor(private readonly svc: SystemUserService) {}

  @Get()
  @ApiOperation({ summary: 'List ACM users across all tenants (APP_ADMIN)' })
  list(@Query() q: ListSystemUsersQueryDto) {
    return this.svc.list(q);
  }

  @Post()
  @ApiOperation({ summary: 'Create ACM user in any tenant (APP_ADMIN)' })
  create(@Body() dto: CreateSystemUserDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update name / role / status (APP_ADMIN)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSystemUserDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Reset password (APP_ADMIN)' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetSystemUserPasswordDto,
  ) {
    return this.svc.resetPassword(id, dto.password);
  }

  @Patch(':id/lock')
  @ApiOperation({ summary: 'Lock account (APP_ADMIN)' })
  lock(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.lock(id);
  }

  @Patch(':id/unlock')
  @ApiOperation({ summary: 'Unlock account (APP_ADMIN)' })
  unlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.unlock(id);
  }
}
