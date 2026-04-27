import { Injectable, Logger } from '@nestjs/common';
import { IAmaClientService } from './interfaces/ama-client.interface';
import { AmaClientDto, AmaSearchResultDto } from './dto/ama-client.dto';

/**
 * In-memory mock AMA service for development and testing.
 *
 * Activated by env: AMA_MODE=mock
 */
@Injectable()
export class AmaMockService implements IAmaClientService {
  private readonly logger = new Logger(AmaMockService.name);

  // Dev fixture — 5 sample AMA Clients
  private readonly fixture: AmaClientDto[] = [
    {
      amaClientId: 'CL-2026-0001',
      name: '홍길동',
      phone: '010-1234-5678',
      email: 'hong@example.com',
      status: 'ACTIVE',
      employmentType: 'FULL_TIME',
      profileImageUrl: null,
      updatedAt: '2026-04-01T00:00:00Z',
    },
    {
      amaClientId: 'CL-2026-0002',
      name: '김선생',
      phone: '010-2222-3333',
      email: 'kim@example.com',
      status: 'ACTIVE',
      employmentType: 'PART_TIME',
      profileImageUrl: null,
      updatedAt: '2026-04-05T00:00:00Z',
    },
    {
      amaClientId: 'CL-2026-0003',
      name: '박교사',
      phone: '010-4444-5555',
      email: 'park@example.com',
      status: 'ACTIVE',
      employmentType: 'FULL_TIME',
      profileImageUrl: null,
      updatedAt: '2026-04-10T00:00:00Z',
    },
    {
      amaClientId: 'CL-2026-0004',
      name: '이영어',
      phone: '010-7777-8888',
      email: 'lee@example.com',
      status: 'ACTIVE',
      employmentType: 'FREELANCE',
      profileImageUrl: null,
      updatedAt: '2026-04-15T00:00:00Z',
    },
    {
      amaClientId: 'CL-2025-9999',
      name: '최퇴직',
      phone: null,
      email: null,
      status: 'INACTIVE',
      employmentType: 'FULL_TIME',
      profileImageUrl: null,
      updatedAt: '2025-12-31T00:00:00Z',
    },
  ];

  async getClient(amaClientId: string): Promise<AmaClientDto | null> {
    this.logger.debug(`[mock] getClient(${amaClientId})`);
    const found = this.fixture.find((c) => c.amaClientId === amaClientId);
    return found ?? null;
  }

  async searchClients(
    query: string,
    page = 1,
    limit = 20,
  ): Promise<AmaSearchResultDto> {
    this.logger.debug(`[mock] searchClients(q='${query}', page=${page}, limit=${limit})`);
    const q = (query ?? '').trim().toLowerCase();
    const matched = q
      ? this.fixture.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.amaClientId.toLowerCase().includes(q),
        )
      : this.fixture;
    const start = (page - 1) * limit;
    const data = matched.slice(start, start + limit);
    return { data, meta: { page, limit, total: matched.length } };
  }
}
