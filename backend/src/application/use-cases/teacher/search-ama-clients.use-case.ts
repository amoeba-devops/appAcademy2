import { Inject, Injectable } from '@nestjs/common';
import { AMA_CLIENT_SERVICE } from '../../../infrastructure/external/ama/interfaces/ama-client.interface';
import type { IAmaClientService } from '../../../infrastructure/external/ama/interfaces/ama-client.interface';
import { AmaSearchResultDto } from '../../../infrastructure/external/ama/dto/ama-client.dto';

@Injectable()
export class SearchAmaClientsUseCase {
  constructor(
    @Inject(AMA_CLIENT_SERVICE)
    private readonly ama: IAmaClientService,
  ) {}

  async execute(query: string, page = 1, limit = 20): Promise<AmaSearchResultDto> {
    return this.ama.searchClients(query ?? '', page, limit);
  }
}
