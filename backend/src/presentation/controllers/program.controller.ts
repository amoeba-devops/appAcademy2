import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateProgramDto, UpdateProgramDto } from '../../application/dto/program';
import {
  GetProgramsUseCase,
  GetProgramDetailUseCase,
  CreateProgramUseCase,
  UpdateProgramUseCase,
} from '../../application/use-cases/program';

@ApiTags('Programs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('programs')
export class ProgramController {
  constructor(
    private readonly getPrograms: GetProgramsUseCase,
    private readonly getProgramDetail: GetProgramDetailUseCase,
    private readonly createProgram: CreateProgramUseCase,
    private readonly updateProgram: UpdateProgramUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get program list (프로그램 목록 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.getPrograms.execute(user.academyId, { status, category, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get program detail (프로그램 상세 조회)' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.getProgramDetail.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create program (프로그램 등록)' })
  async create(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreateProgramDto,
  ) {
    return this.createProgram.execute(user.academyId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update program (프로그램 수정)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProgramDto,
  ) {
    return this.updateProgram.execute(id, dto);
  }
}
