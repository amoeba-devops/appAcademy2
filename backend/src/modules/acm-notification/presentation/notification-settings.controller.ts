import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { ConfigAdminGuard } from '../../acm-common/guards/config-admin.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RequirePasswordRotationGuard } from '../../acm-common/guards/require-password-rotation.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import type { InboxActor } from '../application/inbox.service';
import { NotificationSettingsService } from '../application/notification-settings.service';
import { PushService } from '../application/push.service';

/** REQ-261102B — 서비스 설정 > 알림 설정 (서비스 운영자). */
@ApiTags('acm-config-notifications')
@ApiBearerAuth()
@UseGuards(
  AcmJwtAuthGuard,
  OwnEntityGuard,
  ConfigAdminGuard,
  RequirePasswordRotationGuard,
)
@Controller('acm/config/notifications')
export class NotificationSettingsController {
  constructor(
    private readonly settings: NotificationSettingsService,
    private readonly push: PushService,
  ) {}

  @Get()
  get(@CurrentUser() u: AcmCurrentUser) {
    return this.settings.getTenant(u.entId);
  }

  @Put()
  @ApiOperation({
    summary:
      'Save academy notification settings (per situation channels/roles, device push, reminder hours, AMA types)',
  })
  put(@CurrentUser() u: AcmCurrentUser, @Body() body: Record<string, unknown>) {
    return this.settings.putTenant(u.entId, u.id, body);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Device push status: subscribed devices, last 7 days results',
  })
  async status(@CurrentUser() u: AcmCurrentUser) {
    return {
      push: this.push.info().enabled,
      ...(await this.settings.pushStatus(u.entId)),
    };
  }
}

/** REQ-261102B — 내 알림 설정(콘솔 전 역할). */
@ApiTags('acm-notifications')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF', 'APP_ADMIN', 'TEACHER')
@Controller('acm/notifications/my-settings')
export class MyNotificationSettingsController {
  constructor(
    private readonly settings: NotificationSettingsService,
    private readonly push: PushService,
  ) {}
  @Get() get(@CurrentUser() u: AcmCurrentUser) {
    return this.settings.getPersonal(u);
  }
  @Put() put(
    @CurrentUser() u: AcmCurrentUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.settings.putPersonal(u, body);
  }
  @Post('test-push') test(@CurrentUser() u: AcmCurrentUser) {
    return this.push.sendTest(u, '/admin/notification-inbox');
  }
}

/** REQ-261102B — 내 알림 설정(포털 강사). */
@Controller('portal/notifications/my-settings')
@UseGuards(PortalJwtAuthGuard)
export class PortalMyNotificationSettingsController {
  constructor(
    private readonly settings: NotificationSettingsService,
    private readonly push: PushService,
  ) {}
  private actor(u: PortalAuthUser): InboxActor {
    if (u.kind !== 'TEACHER') throw new ForbiddenException('TEACHER_ONLY');
    return { entId: u.entId, id: u.refId, kind: 'TEACHER' };
  }
  @Get() get(@PortalUser() u: PortalAuthUser) {
    return this.settings.getPersonal(this.actor(u));
  }
  @Put() put(
    @PortalUser() u: PortalAuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.settings.putPersonal(this.actor(u), body);
  }
  @Post('test-push') test(@PortalUser() u: PortalAuthUser) {
    return this.push.sendTest(this.actor(u), '/portal');
  }
}
