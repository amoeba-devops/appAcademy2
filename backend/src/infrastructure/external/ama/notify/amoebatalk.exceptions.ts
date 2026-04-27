import { ServiceUnavailableException, BadRequestException } from '@nestjs/common';

export class AmoebaTalkServiceUnavailableException extends ServiceUnavailableException {
  constructor(reason: string) {
    super({
      error: {
        code: 'AMOEBATALK_UNAVAILABLE',
        message: `AmoebaTalk service unavailable: ${reason}`,
      },
    });
  }
}

export class AmoebaTalkBadRequestException extends BadRequestException {
  constructor(reason: string) {
    super({
      error: {
        code: 'AMOEBATALK_BAD_REQUEST',
        message: `AmoebaTalk rejected request: ${reason}`,
      },
    });
  }
}
