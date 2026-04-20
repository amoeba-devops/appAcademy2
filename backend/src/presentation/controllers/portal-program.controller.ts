import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  GetProgramsUseCase,
  GetProgramDetailUseCase,
} from '../../application/use-cases/program';

/**
 * Public portal endpoint — no JWT auth required.
 * Returns only PUBLISHED programs.
 */
@ApiTags('Portal — Programs')
@Controller('portal/programs')
export class PortalProgramController {
  constructor(
    private readonly getPrograms: GetProgramsUseCase,
    private readonly getProgramDetail: GetProgramDetailUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Public: list published programs' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    // academyId=1 (single-tenant public portal); only PUBLISHED
    return this.getPrograms.execute(1, {
      status: 'PUBLISHED',
      category,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Public: program detail' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.getProgramDetail.execute(id);
  }
}
