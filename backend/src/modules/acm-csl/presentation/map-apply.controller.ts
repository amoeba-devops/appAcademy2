import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { MapApplyService } from '../application/map-apply.service';
import {
  ImportMapApplyDto,
  ListMapApplyQueryDto,
  UpdateMapApplyDto,
} from '../application/dto/map-apply.dto';

/**
 * CSL-PLN-260916 — 맵테스트 신청 관리 (`/admin/test`).
 * 접수 자체는 공개 엔드포인트(`/api/web/external-intake/map-test`)가 담당한다.
 */
@ApiTags('acm-csl')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/csl/map-applications')
export class MapApplyController {
  constructor(private readonly svc: MapApplyService) {}

  @Get()
  @ApiOperation({ summary: '맵테스트 신청 목록 (검색·사이트·단계·기간 필터)' })
  list(@CurrentUser() u: AcmCurrentUser, @Query() query: ListMapApplyQueryDto) {
    return this.svc.list(u.entId, query);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="map-applications.csv"')
  @ApiOperation({ summary: '맵테스트 신청 목록 CSV 내보내기 (최대 200건)' })
  async exportCsv(
    @CurrentUser() u: AcmCurrentUser,
    @Query() query: ListMapApplyQueryDto,
  ): Promise<StreamableFile> {
    const csv = await this.svc.exportCsv(u.entId, query);
    // StreamableFile 은 TransformInterceptor 를 그대로 통과한다 (원문 CSV 유지).
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get(':id')
  @ApiOperation({ summary: '맵테스트 신청 상세' })
  detail(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.detail(u.entId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '신청서 원본 항목 보정 (영문명·생년월일·성별·응시지·희망슬롯)',
  })
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMapApplyDto,
  ) {
    return this.svc.update(u.entId, id, dto);
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: '아임웹 누적 접수 CSV 일괄 이관 (ADMIN, 중복 건너뜀)',
  })
  import(@CurrentUser() u: AcmCurrentUser, @Body() dto: ImportMapApplyDto) {
    return this.svc.importRows(u.entId, dto);
  }
}
