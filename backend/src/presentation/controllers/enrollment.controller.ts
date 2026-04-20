import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateEnrollmentDto, UpdateEnrollmentStatusDto } from '../../application/dto/enrollment/index.js';
import {
  CreateEnrollmentUseCase,
  GetEnrollmentsUseCase,
  UpdateEnrollmentStatusUseCase,
} from '../../application/use-cases/enrollment/index.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('enrollments')
export class EnrollmentController {
  constructor(
    private readonly getEnrollments: GetEnrollmentsUseCase,
    private readonly createEnrollment: CreateEnrollmentUseCase,
    private readonly updateEnrollmentStatus: UpdateEnrollmentStatusUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get enrollment list (수강 등록 목록 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'studentId', required: false })
  async list(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.getEnrollments.execute(user.academyId, {
      status,
      classId: classId ? parseInt(classId, 10) : undefined,
      studentId: studentId ? parseInt(studentId, 10) : undefined,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create enrollment (수강 등록)' })
  async create(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreateEnrollmentDto,
  ) {
    return this.createEnrollment.execute(user.academyId, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update enrollment status (수강 상태 변경)' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEnrollmentStatusDto,
  ) {
    return this.updateEnrollmentStatus.execute(id, dto.status);
  }
}