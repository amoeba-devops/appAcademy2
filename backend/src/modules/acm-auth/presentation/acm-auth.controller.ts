import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AcmAuthService } from '../application/acm-auth.service';
import {
  AcmLoginDto,
  AcmAuthUser,
  AmaExchangeDto,
  AcmChangePasswordDto,
} from '../application/dto/acm-auth.dto';
import { AcmJwtAuthGuard } from '../guards/acm-jwt-auth.guard';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';

@ApiTags('acm-auth')
@Controller('acm/auth')
export class AcmAuthController {
  constructor(private readonly service: AcmAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ACM login (email + password) — returns JWT' })
  login(@Body() dto: AcmLoginDto) {
    return this.service.login(dto.email, dto.password);
  }

  @Post('ama-exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Exchange AMA Custom App JWT for ACM JWT — auto-provisions user on first call',
  })
  amaExchange(@Body() dto: AmaExchangeDto) {
    return this.service.exchangeAmaToken(dto.amaToken);
  }

  @Get('me')
  @UseGuards(AcmJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current ACM user' })
  me(@Req() req: Request): { user: AcmAuthUser } {
    return { user: req.user as AcmAuthUser };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AcmJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Change own password (verifies current) — clears the must-change flag (REQ-260621)',
  })
  async changePassword(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: AcmChangePasswordDto,
  ): Promise<{ success: true }> {
    await this.service.changeOwnPassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true };
  }
}
