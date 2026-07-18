import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import {
  ListEnrollmentsQueryDto,
  UpdateEnrollmentStatusDto,
} from '../application/dto/enrollment-admin.dto';
import { EnrollmentAdminService } from '../application/enrollment-admin.service';

@ApiTags('enrollments')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard)
@Controller('enrollments')
export class EnrollmentController {
  constructor(private readonly enrollments: EnrollmentAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List class enrollments for admin management' })
  list(
    @CurrentUser() user: AcmCurrentUser,
    @Query() query: ListEnrollmentsQueryDto,
  ) {
    return this.enrollments.list(user.entId, query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update enrollment status' })
  updateStatus(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnrollmentStatusDto,
  ) {
    return this.enrollments.updateStatus(user.entId, id, dto.status);
  }
}
