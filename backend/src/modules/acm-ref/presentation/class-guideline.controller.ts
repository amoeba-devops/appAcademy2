import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { ClassGuidelineService } from '../application/class-guideline.service';
import {
  CreateClassGuidelineDto,
  UpdateClassGuidelineDto,
} from '../application/dto/class-guideline.dto';

@ApiTags('acm-ref')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/ref/class-guidelines')
export class ClassGuidelineController {
  constructor(private readonly service: ClassGuidelineService) {}

  @Post()
  @ApiOperation({ summary: 'Create class guideline (FR-REF-E01)' })
  create(@CurrentUser() user: AcmCurrentUser, @Body() dto: CreateClassGuidelineDto) {
    return this.service.create(user.entId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List active class guidelines (FR-REF-001)' })
  list(@CurrentUser() user: AcmCurrentUser, @Query('examType') examType?: string) {
    return this.service.list(user.entId, examType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail (FR-REF-002)' })
  findOne(@CurrentUser() user: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user.entId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update (creates new version per BR-REF-002)' })
  update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassGuidelineDto,
  ) {
    return this.service.update(user.entId, id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete' })
  remove(@CurrentUser() user: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.softDelete(user.entId, id);
  }
}
