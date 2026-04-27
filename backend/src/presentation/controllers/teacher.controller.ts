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
import { CreateTeacherDto, UpdateTeacherDto } from '../../application/dto/teacher';
import {
  GetTeachersUseCase,
  GetTeacherDetailUseCase,
  CreateTeacherUseCase,
  UpdateTeacherUseCase,
  SyncTeacherUseCase,
  SearchAmaClientsUseCase,
} from '../../application/use-cases/teacher';

@ApiTags('Teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('teachers')
export class TeacherController {
  constructor(
    private readonly getTeachers: GetTeachersUseCase,
    private readonly getTeacherDetail: GetTeacherDetailUseCase,
    private readonly createTeacher: CreateTeacherUseCase,
    private readonly updateTeacher: UpdateTeacherUseCase,
    private readonly syncTeacher: SyncTeacherUseCase,
    private readonly searchAma: SearchAmaClientsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get teacher list (교사 목록 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'subject', required: false })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('subject') subject?: string,
    @Query('search') search?: string,
  ) {
    return this.getTeachers.execute(user.academyId, { status, subject, search });
  }

  @Get('ama-search')
  @ApiOperation({ summary: 'Search AMA Clients (Teacher Picker)' })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text query (name or clientId)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchAmaClients(
    @Query('q') q = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.searchAma.execute(
      q,
      Math.max(1, Number(page) || 1),
      Math.min(50, Math.max(1, Number(limit) || 20)),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get teacher detail (교사 상세 조회)' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.getTeacherDetail.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create teacher (교사 등록)' })
  async create(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreateTeacherDto,
  ) {
    return this.createTeacher.execute(user.academyId, dto);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Force sync teacher with AMA Client master' })
  async sync(@Param('id', ParseIntPipe) id: number) {
    return this.syncTeacher.execute(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update teacher (교사 수정)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeacherDto,
  ) {
    return this.updateTeacher.execute(id, dto);
  }
}
