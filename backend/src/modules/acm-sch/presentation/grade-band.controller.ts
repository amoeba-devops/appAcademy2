import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { GradeBandService } from '../application/grade-band.service';
import { CreateGradeBandDto, UpdateGradeBandDto } from '../application/dto/grade-band.dto';

/**
 * Grade Bands per School (S-10..S-13).
 * RBAC (per spec): viewer=GET, advisor+=POST/PATCH/DELETE.
 * Enforcement deferred to AMA Auth integration cycle (Decision-D5).
 */
@ApiTags('acm-sch')
@ApiBearerAuth()
@UseGuards(OwnEntityGuard)
@Controller('acm/sch/schools/:schId/grade-bands')
export class GradeBandController {
  constructor(private readonly service: GradeBandService) {}

  @Get()
  @ApiOperation({ summary: 'List grade bands of a school (S-10)' })
  list(@CurrentUser() user: AcmCurrentUser, @Param('schId', ParseUUIDPipe) schId: string) {
    return this.service.list(user.entId, schId);
  }

  @Post()
  @ApiOperation({ summary: 'Create grade band (S-11) — Authorized schools only' })
  create(
    @CurrentUser() user: AcmCurrentUser,
    @Param('schId', ParseUUIDPipe) schId: string,
    @Body() dto: CreateGradeBandDto,
  ) {
    return this.service.create(user.entId, schId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update grade band (S-12)' })
  update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('schId', ParseUUIDPipe) schId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradeBandDto,
  ) {
    return this.service.update(user.entId, schId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete grade band (S-13)' })
  async remove(
    @CurrentUser() user: AcmCurrentUser,
    @Param('schId', ParseUUIDPipe) schId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.remove(user.entId, schId, id);
  }
}
