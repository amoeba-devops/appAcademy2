import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { LevelTestGuideService } from '../application/level-test-guide.service';
import {
  CreateLevelTestGuideDto,
  UpdateLevelTestGuideDto,
} from '../application/dto/level-test-guide.dto';

@ApiTags('acm-ref')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/ref/level-test-guides')
export class LevelTestGuideController {
  constructor(private readonly service: LevelTestGuideService) {}

  @Post()
  create(@CurrentUser() user: AcmCurrentUser, @Body() dto: CreateLevelTestGuideDto) {
    return this.service.create(user.entId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'FR-REF-003 — ISEE/SSAT side-by-side' })
  list(@CurrentUser() user: AcmCurrentUser) {
    return this.service.list(user.entId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user.entId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update (creates new version per BR-REF-002)' })
  update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLevelTestGuideDto,
  ) {
    return this.service.update(user.entId, id, dto, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.softDelete(user.entId, id);
  }
}
