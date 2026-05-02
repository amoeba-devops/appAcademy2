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
import { AcmLoginDto, AcmAuthUser } from '../application/dto/acm-auth.dto';
import { AcmJwtAuthGuard } from '../guards/acm-jwt-auth.guard';

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

  @Get('me')
  @UseGuards(AcmJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current ACM user' })
  me(@Req() req: Request): { user: AcmAuthUser } {
    return { user: req.user as AcmAuthUser };
  }
}
