import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalAccountService } from '../application/portal-account.service';
import { IssuePortalAccountDto } from '../application/dto/portal-account.dto';
import { AcmJwtAuthGuard } from '../guards/acm-jwt-auth.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import type { PortalKind } from '../infrastructure/typeorm/portal-account.typeorm-entity';

/**
 * PLN-260706 — admin issuance surface for portal accounts. The temp password
 * is returned ONCE on issue/reset for the operator to hand over (§4.6).
 */
@ApiTags('acm-portal-accounts')
@ApiBearerAuth()
@Controller('acm/portal-accounts')
@UseGuards(AcmJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'APP_ADMIN')
export class PortalAccountAdminController {
  constructor(private readonly accounts: PortalAccountService) {}

  @Get()
  @ApiOperation({ summary: 'Get the portal account for a subject (kind + refId)' })
  get(
    @CurrentUser() user: AcmCurrentUser,
    @Query('kind') kind: PortalKind,
    @Query('refId', ParseUUIDPipe) refId: string,
  ) {
    return this.accounts.getByRef(user.entId, kind, refId);
  }

  @Post()
  @ApiOperation({ summary: 'Issue a portal account (returns temp password once)' })
  issue(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: IssuePortalAccountDto,
  ) {
    return this.accounts.issue(user.entId, dto.kind, dto.refId);
  }

  @Post(':id/reset')
  @ApiOperation({ summary: 'Reset the portal password (returns temp password once)' })
  reset(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accounts.reissuePassword(user.entId, id);
  }
}
