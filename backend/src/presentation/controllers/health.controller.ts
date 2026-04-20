import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      success: true,
      data: {
        status: 'ok',
        service: 'trinity-academy-api',
        version: '1.3.0',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
