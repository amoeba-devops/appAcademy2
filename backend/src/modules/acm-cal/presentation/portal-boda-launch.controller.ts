import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { BodaLaunchContextService } from '../application/boda-launch-context.service';

/**
 * PLN-260715 — portal (student/parent) BODA classroom entry. Browser mode:
 * the portal client opens the returned `webBrowserUrl` in a new tab.
 * Authorized by portal identity + class enrollment (see buildForPortal).
 */
@ApiTags('portal-cal')
@ApiBearerAuth()
@UseGuards(PortalJwtAuthGuard)
@Controller('portal/cal/boda')
export class PortalBodaLaunchController {
  constructor(private readonly svc: BodaLaunchContextService) {}

  @Get('launch-context')
  @ApiOperation({
    summary: 'BODA launch context for my (student/parent) class event',
  })
  launch(
    @PortalUser() u: PortalAuthUser,
    @Query('evtId') evtId: string,
    @Query('lang') lang?: string,
  ) {
    return this.svc.buildForPortal(evtId, u.entId, u.kind, u.refId, lang);
  }
}
