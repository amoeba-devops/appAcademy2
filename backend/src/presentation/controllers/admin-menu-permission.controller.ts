import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ManageMenuPermissionsUseCase } from '../../application/use-cases/menu-permission';
import { UpdateMenuPermissionsDto } from '../../application/dto/menu-permission';

@ApiTags('Menu Permissions (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/menu-permissions')
export class AdminMenuPermissionController {
  constructor(private readonly useCase: ManageMenuPermissionsUseCase) {}

  @Get()
  @ApiOperation({ summary: '메뉴 권한 매트릭스 조회 (관리자)' })
  list(@CurrentUser() user: { academyId: number }) {
    return this.useCase.listMatrix(user.academyId);
  }

  @Put()
  @ApiOperation({ summary: '메뉴 권한 매트릭스 일괄 저장 (관리자)' })
  save(
    @CurrentUser() user: { academyId: number },
    @Body() dto: UpdateMenuPermissionsDto,
  ) {
    return this.useCase.bulkUpdate(user.academyId, dto);
  }

  @Get('effective/me')
  @ApiOperation({ summary: '현재 사용자에게 보이는/접근 가능한 메뉴 키 목록' })
  me(@CurrentUser() user: { academyId: number; role: string }) {
    return this.useCase.effectiveForRole(user.academyId, user.role);
  }
}
