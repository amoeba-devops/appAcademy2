import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { AcmJwtAuthGuard } from '../guards/acm-jwt-auth.guard';
import { AmaUserDirectoryService } from '../application/ama-user-directory.service';
import type {
  AmaPlatformUser,
  AmaUserLevel,
} from '../infrastructure/ama-platform.client';

/**
 * REQ-260604 v2 FR-3/4 — read-only proxy to AMA platform user directory.
 * Used by the TchFormModal / StfFormModal "add" pickers in frontend-acm.
 *
 * Tenant isolation: entityId is bound to the JWT (`u.entId`) — clients
 * cannot override it. The level whitelist (MANAGER/MEMBER/VIEWER) is
 * re-enforced server-side by AmaUserDirectoryService.
 */
@ApiTags('acm-ama')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard)
@Controller('acm/ama/users')
export class AmaUserController {
  constructor(private readonly directory: AmaUserDirectoryService) {}

  @Get()
  @ApiOperation({
    summary: 'Search AMA platform users in the caller’s entity',
    description:
      'Returns up to `limit` AMA users matching `q` in the caller’s entity (from JWT). ' +
      'Levels accepted: MANAGER, MEMBER, VIEWER. OWNER is never returned ' +
      'regardless of input (REQ-260604 FR-5).',
  })
  async search(
    @CurrentUser() user: AcmCurrentUser,
    @Query('q') q: string | undefined,
    @Query('level') levelCsv: string | undefined,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<AmaPlatformUser[]> {
    const levels = (levelCsv ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean) as AmaUserLevel[];
    return this.directory.search(user.entId, levels, q ?? '', limit);
  }
}
