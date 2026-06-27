import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { CourseService } from '../application/course.service';
import {
  CreateCourseDto,
  UpdateCourseDto,
} from '../application/dto/inquiry.dto';

/**
 * REQ-260626 FR-CSL-132 / Q-CSL-109 — per-tenant course master CRUD.
 * Routes under /acm/csl/courses. Enrollment counseling references master
 * rows via enr_course_id (or falls back to enr_course_freetext when the
 * needed course isn't in the master yet).
 */
@ApiTags('acm-csl')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/csl/courses')
export class CourseController {
  constructor(private readonly courses: CourseService) {}

  @Get()
  @ApiOperation({ summary: 'List course master (FR-CSL-132)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  list(
    @CurrentUser() user: AcmCurrentUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.courses.list(user.entId, includeInactive === 'true');
  }

  @Post()
  @ApiOperation({ summary: 'Create course master row' })
  create(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: CreateCourseDto,
  ) {
    return this.courses.create({
      entId: user.entId,
      code: dto.code,
      name: dto.name,
    });
  }

  @Put(':crsId')
  @ApiOperation({ summary: 'Update course name / active flag' })
  update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('crsId', ParseUUIDPipe) crsId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courses.update(user.entId, crsId, dto);
  }
}
