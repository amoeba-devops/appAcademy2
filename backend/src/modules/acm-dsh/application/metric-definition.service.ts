import { withLifecycleMetrics } from './lifecycle-metrics';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { MetricDefinitionTypeormEntity } from '../infrastructure/typeorm/metric-definition.typeorm-entity';

@Injectable()
export class MetricDefinitionService {
  constructor(
    @InjectRepository(MetricDefinitionTypeormEntity, ACM_DS)
    private readonly repo: Repository<MetricDefinitionTypeormEntity>,
  ) {}

  async list(entId: string) {
    return withLifecycleMetrics(await this.repo.find({
      where: { entId, deletedAt: IsNull(), active: true },
      order: { category: 'ASC', displayOrder: 'ASC' },
    }));
  }

  findByCode(entId: string, code: string) {
    return this.repo.findOne({ where: { entId, code, deletedAt: IsNull() } });
  }
}
