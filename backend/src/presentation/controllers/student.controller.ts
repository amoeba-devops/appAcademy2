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
import { CreateStudentDto, UpdateStudentDto } from '../../application/dto/student';
import {
  GetStudentsUseCase,
  GetStudentDetailUseCase,
  CreateStudentUseCase,
  UpdateStudentUseCase,
} from '../../application/use-cases/student';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('students')
export class StudentController {
  constructor(
    private readonly getStudents: GetStudentsUseCase,
    private readonly getStudentDetail: GetStudentDetailUseCase,
    private readonly createStudent: CreateStudentUseCase,
    private readonly updateStudent: UpdateStudentUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get student list (학생 목록 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'lifecycleStatus', required: false })
  @ApiQuery({ name: 'grade', required: false })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('lifecycleStatus') lifecycleStatus?: string,
    @Query('grade') grade?: string,
    @Query('search') search?: string,
  ) {
    return this.getStudents.execute(user.academyId, {
      status,
      lifecycleStatus,
      grade,
      search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student detail (학생 상세 조회)' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.getStudentDetail.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create student (학생 등록)' })
  async create(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreateStudentDto,
  ) {
    return this.createStudent.execute(user.academyId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update student (학생 수정)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.updateStudent.execute(id, dto);
  }
}
