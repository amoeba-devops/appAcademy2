import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalAccountService } from '../application/portal-account.service';
import {
  PortalChangePasswordDto,
  PortalLoginDto,
} from '../application/dto/portal-account.dto';
import { PortalJwtAuthGuard } from '../guards/portal-jwt-auth.guard';
import { PortalUser } from '../decorators/portal-user.decorator';
import type { PortalAuthUser } from '../application/portal-account.service';

/**
 * PLN-260706 — unified portal login (student / parent / teacher).
 * `POST /api/portal/auth/login` issues a portal JWT; `change-password`
 * clears the temp-password rotation requirement.
 */
@ApiTags('portal-auth')
@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly accounts: PortalAccountService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Portal login by loginId + password' })
  login(@Body() dto: PortalLoginDto) {
    return this.accounts.login(dto.loginId, dto.password);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PortalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own portal password (clears rotation flag)' })
  async changePassword(
    @PortalUser() user: PortalAuthUser,
    @Body() dto: PortalChangePasswordDto,
  ) {
    await this.accounts.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }
}
