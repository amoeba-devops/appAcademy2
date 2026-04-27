import { Injectable, Logger } from '@nestjs/common';
import type { IAmoebaTalkClient } from './interfaces/amoebatalk-client.interface';
import type {
  AmoebaTalkSendDto,
  AmoebaTalkSendResultDto,
} from './dto/amoebatalk-message.dto';

/**
 * Mock AmoebaTalk client — logs to console, returns synthetic message id.
 * Activated when AMA_MODE=mock (P0-3 §2.4 B-01).
 */
@Injectable()
export class AmoebaTalkMockService implements IAmoebaTalkClient {
  private readonly logger = new Logger(AmoebaTalkMockService.name);
  private counter = 0;

  async send(message: AmoebaTalkSendDto): Promise<AmoebaTalkSendResultDto> {
    this.counter += 1;
    const id = `mock-${Date.now()}-${this.counter}`;
    this.logger.log(
      `[AmoebaTalk mock] to=${maskPhone(message.to)} template=${message.templateCode} → ${id}`,
    );
    return { messageId: id, status: 'SENT' };
  }
}

function maskPhone(p: string): string {
  if (!p) return '';
  const digits = p.replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(digits.length);
  const last = digits.slice(-4);
  return p.replace(/\d(?=\d{4})/g, '*').replace(/\d{4}$/, last);
}
