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
import { CreateClassDto, UpdateClassDto, RecordSessionDto } from '../../application/dto/class';
import {
  GetClassesUseCase,
  GetClassDetailUseCase,
  CreateClassUseCase,
  UpdateClassUseCase,
  RecordSessionUseCase,
  GetClassroomsUseCase,
} from '../../application/use-cases/class';

@ApiTags('Classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('classes')
export class ClassController {
  constructor(
    private readonly getClasses: GetClassesUseCase,
    private readonly getClassDetail: GetClassDetailUseCase,
    private readonly createClass: CreateClassUseCase,
    private readonly updateClass: UpdateClassUseCase,
    private readonly recordSession: RecordSessionUseCase,
    private readonly getClassrooms: GetClassroomsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get class list (클래스 목록 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'teacherId', required: false })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('programId') programId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('search') search?: string,
  ) {
    return this.getClasses.execute(user.academyId, {
      status,
      programId: programId ? parseInt(programId, 10) : undefined,
      teacherId: teacherId ? parseInt(teacherId, 10) : undefined,
      search,
    });
  }

  @Get('classrooms')
  @ApiOperation({ summary: 'Get classroom list (교실 목록 조회)' })
  async classrooms(@CurrentUser() user: { academyId: number }) {
    return this.getClassrooms.execute(user.academyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get class detail (클래스 상세 조회)' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.getClassDetail.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create class (클래스 등록)' })
  async create(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreateClassDto,
  ) {
    return this.createClass.execute(user.academyId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update class (클래스 수정)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClassDto,
  ) {
    return this.updateClass.execute(id, dto);
  }

  @Patch('sessions/:sessionId')
  @ApiOperation({ summary: 'Record session (수업 기록)' })
  async record(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: RecordSessionDto,
  ) {
    return this.recordSession.execute(sessionId, dto);
  }
}
