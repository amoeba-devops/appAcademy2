import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ACM_DS } from '../../acm-common/datasource';
import { QnaCategoryTypeormEntity } from '../infrastructure/typeorm/qna-category.typeorm-entity';
import { QuestionTypeormEntity } from '../infrastructure/typeorm/question.typeorm-entity';
import type { CreateQnaCategoryDto, UpdateQnaCategoryDto } from './dto/qna-category.dto';

@Injectable()
export class QnaCategoryService {
  constructor(
    @InjectRepository(QnaCategoryTypeormEntity, ACM_DS)
    private readonly repo: Repository<QnaCategoryTypeormEntity>,
    @InjectRepository(QuestionTypeormEntity, ACM_DS)
    private readonly questionRepo: Repository<QuestionTypeormEntity>,
  ) {}

  list(entId: string) {
    return this.repo.find({
      where: { entId, deletedAt: IsNull() },
      order: { sortOrder: 'ASC', code: 'ASC' },
    });
  }

  async findOne(entId: string, id: string) {
    const found = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!found) throw new NotFoundException(`Category ${id} not found`);
    return found;
  }

  create(entId: string, dto: CreateQnaCategoryDto) {
    return this.repo.save(this.repo.create({
      id: randomUUID(),
      entId,
      code: dto.code,
      labelKr: dto.labelKr,
      labelEn: dto.labelEn ?? null,
      labelVi: dto.labelVi ?? null,
      labelZh: dto.labelZh ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    }));
  }

  async update(entId: string, id: string, dto: UpdateQnaCategoryDto) {
    const found = await this.findOne(entId, id);
    if (dto.code !== undefined) found.code = dto.code;
    if (dto.labelKr !== undefined) found.labelKr = dto.labelKr;
    if (dto.labelEn !== undefined) found.labelEn = dto.labelEn ?? null;
    if (dto.labelVi !== undefined) found.labelVi = dto.labelVi ?? null;
    if (dto.labelZh !== undefined) found.labelZh = dto.labelZh ?? null;
    if (dto.isActive !== undefined) found.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) found.sortOrder = dto.sortOrder;
    return this.repo.save(found);
  }

  async remove(entId: string, id: string) {
    const found = await this.findOne(entId, id);
    const refs = await this.questionRepo.count({
      where: { entId, categoryId: id, deletedAt: IsNull() },
    });
    if (refs > 0) {
      throw new UnprocessableEntityException({
        code: 'CATEGORY_IN_USE',
        message: `Category is referenced by ${refs} question(s)`,
      });
    }
    await this.repo.softDelete({ id: found.id });
  }
}
