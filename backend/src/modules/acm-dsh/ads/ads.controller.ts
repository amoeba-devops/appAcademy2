import { AdsOAuthService } from './ads-oauth.service';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { AdsService } from './ads.service';
import {
  SaveConnectionDto,
  RevisionDto,
  SyncDto,
  AdjustmentDto,
  OAuthFinishDto,
} from './ads.dto';
@Controller('acm/admin/ad-connections')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN')
export class AdsController {
  constructor(
    private readonly svc: AdsService,
    private readonly oauth: AdsOAuthService,
  ) {}
  @Post('oauth/complete') finish(
    @CurrentUser() u: AcmCurrentUser,
    @Body() d: OAuthFinishDto,
  ) {
    return this.oauth.finish(u.entId, u.id, d.state, d.code);
  }
  @Post(':id/oauth') start(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.oauth.start(u.entId, u.id, id);
  }
  @Get() list(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.list(u.entId);
  }
  @Post() save(@CurrentUser() u: AcmCurrentUser, @Body() d: SaveConnectionDto) {
    return this.svc.save(u.entId, u.id, d);
  }
  @Put(':id') update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: SaveConnectionDto,
  ) {
    return this.svc.save(u.entId, u.id, d, id);
  }
  @Post(':id/test') test(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.test(u.entId, id);
  }
  @Post(':id/enable') enable(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RevisionDto,
  ) {
    return this.svc.state(u.entId, u.id, id, d.expectedRevision, 'enable');
  }
  @Post(':id/pause') pause(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RevisionDto,
  ) {
    return this.svc.state(u.entId, u.id, id, d.expectedRevision, 'pause');
  }
  @Post(':id/disconnect') disconnect(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RevisionDto,
  ) {
    return this.svc.state(u.entId, u.id, id, d.expectedRevision, 'disconnect');
  }
  @Post(':id/sync') sync(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: SyncDto,
  ) {
    return this.svc.enqueue(u.entId, id, d.from, d.to);
  }
  @Get(':id/runs') runs(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.runs(u.entId, id);
  }
}
@Controller('acm/dsh/automatic-ad-costs')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
export class AdsCostController {
  constructor(private readonly svc: AdsService) {}
  @Get(':date/history') history(
    @CurrentUser() u: AcmCurrentUser,
    @Param('date') date: string,
  ) {
    return this.svc.costHistory(u.entId, date);
  }
  @Get(':date') get(
    @CurrentUser() u: AcmCurrentUser,
    @Param('date') date: string,
  ) {
    return this.svc.costDetails(u.entId, date);
  }
  @Put(':date') adjust(
    @CurrentUser() u: AcmCurrentUser,
    @Param('date') date: string,
    @Body() d: AdjustmentDto,
  ) {
    return this.svc.adjust(u.entId, u.id, date, d);
  }
}
