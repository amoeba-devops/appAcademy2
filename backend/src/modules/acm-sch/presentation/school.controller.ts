import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { SchoolService } from '../application/school.service';
import { CreateSchoolDto, SearchSchoolDto, UpdateSchoolDto } from '../application/dto/school.dto';

@ApiTags('acm-sch')
@ApiBearerAuth()
@UseGuards(OwnEntityGuard)
@Controller('acm/sch/schools')
export class SchoolController {
  constructor(private readonly service: SchoolService) {}

  @Post()
  @ApiOperation({ summary: 'Create a school (S-01)' })
  create(@CurrentUser() user: AcmCurrentUser, @Body() dto: CreateSchoolDto) {
    return this.service.create(user.entId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List/search schools (S-02)' })
  list(
    @CurrentUser() user: AcmCurrentUser,
    @Query() q: SearchSchoolDto,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.service.search({
      entId: user.entId, ...q,
      limit: Number(limit), offset: Number(offset),
    });
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Autocomplete schools by prefix (S-03)' })
  autocomplete(@CurrentUser() user: AcmCurrentUser, @Query('q') q: string, @Query('limit') limit = '10') {
    return this.service.autocomplete(user.entId, q ?? '', Number(limit));
  }

  @Get(':id')
  findOne(@CurrentUser() user: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(user.entId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update school (S-04)' })
  update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchoolDto,
  ) {
    return this.service.update(user.entId, id, dto, user.id);
  }

  /** @deprecated Prefer PATCH. Kept for backward compatibility (Decision-D-impact §7). */
  @Put(':id')
  @ApiOperation({ summary: '[DEPRECATED] Update school via PUT — use PATCH (S-04)' })
  updatePut(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchoolDto,
  ) {
    return this.service.update(user.entId, id, dto, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(user.entId, id);
  }
}
