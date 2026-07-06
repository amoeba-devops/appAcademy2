import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { MaterialService } from '../application/material.service';

/**
 * PLN-260706 §4.5 — portal materials (자료실). Lists / downloads only the
 * materials for the caller's classes (membership-scoped in MaterialService).
 */
@ApiTags('portal-materials')
@ApiBearerAuth()
@Controller('portal/materials')
@UseGuards(PortalJwtAuthGuard)
export class PortalMaterialController {
  constructor(private readonly svc: MaterialService) {}

  @Get()
  @ApiOperation({ summary: 'List my class materials' })
  list(@PortalUser() u: PortalAuthUser) {
    return this.svc.listForPortal(u.entId, u.kind, u.refId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a material (class-membership scoped)' })
  async download(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mime, filename } = await this.svc.download(u.entId, id, {
      portal: { kind: u.kind, refId: u.refId },
    });
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }
}
