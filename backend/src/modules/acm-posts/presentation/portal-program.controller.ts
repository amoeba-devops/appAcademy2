import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProgramService } from '../application/services/program.service';

const DEFAULT_ENT_ID =
  process.env.ACM_DEFAULT_ENT_ID ?? '00000000-0000-0000-0000-000000000001';

@ApiTags('portal-programs')
@Controller('portal/programs')
export class PortalProgramController {
  constructor(private readonly programs: ProgramService) {}

  @Get()
  @ApiOperation({ summary: 'Public program catalog' })
  async list(@Query('category') category?: string) {
    const rows = await this.programs.list(DEFAULT_ENT_ID, 'ACTIVE');
    const filtered = category
      ? rows.filter((row) => row.category === category)
      : rows;

    return Promise.all(
      filtered.map(async (row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description ?? null,
        durationWeeks: row.durationWeeks ?? null,
        targetAgeMin: row.targetAgeMin ?? null,
        targetAgeMax: row.targetAgeMax ?? null,
        level: row.level ?? null,
        status: row.status,
        setting: await this.mapSetting(row.id),
      })),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Public program detail' })
  async findOne(@Param('id') id: string) {
    const row = await this.programs.findById(DEFAULT_ENT_ID, id);
    if (row.status !== 'ACTIVE') {
      throw new NotFoundException({ code: 'PROGRAM_NOT_FOUND', id });
    }

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description ?? null,
      durationWeeks: row.durationWeeks ?? null,
      targetAgeMin: row.targetAgeMin ?? null,
      targetAgeMax: row.targetAgeMax ?? null,
      level: row.level ?? null,
      status: row.status,
      setting: await this.mapSetting(row.id),
    };
  }

  private async mapSetting(programId: string) {
    const setting = await this.programs.findSetting(programId);
    if (!setting) return null;
    return {
      feeAmount: setting.feeAmount ?? null,
      capacityMax: setting.capacityMax ?? null,
      sessionCount: setting.sessionCount ?? null,
    };
  }
}
