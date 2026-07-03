import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ParentAuthService } from '../application/parent-auth.service';
import {
  SendParentOtpDto,
  VerifyParentOtpDto,
} from '../application/dto/parent-auth.dto';

@ApiTags('parent-auth')
@Controller('auth/parent')
export class ParentAuthController {
  constructor(private readonly parentAuthService: ParentAuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to a registered parent phone number' })
  @ApiBody({ type: SendParentOtpDto })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  sendOtp(@Body() dto: SendParentOtpDto) {
    return this.parentAuthService.sendOtp(dto.phone);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and issue a parent portal JWT' })
  @ApiBody({ type: VerifyParentOtpDto })
  @ApiResponse({ status: 200, description: 'Parent login successful' })
  verifyOtp(@Body() dto: VerifyParentOtpDto) {
    return this.parentAuthService.verifyOtp(dto.phone, dto.otp);
  }
}
