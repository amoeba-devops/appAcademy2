import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { UpdateParentDto, ParentResponseDto } from '../../dto/parent';

@Injectable()
export class UpdateParentUseCase {
  constructor(
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(id: number, dto: UpdateParentDto): Promise<ParentResponseDto> {
    const existing = await this.parentRepo.findById(id);
    if (!existing) throw new NotFoundException(`Parent #${id} not found`);

    const updated = await this.parentRepo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.preferredChannel !== undefined && { preferredChannel: dto.preferredChannel }),
    });

    const res = new ParentResponseDto();
    res.id = updated.id;
    res.name = updated.name;
    res.phone = updated.phone;
    res.email = updated.email;
    res.preferredChannel = updated.preferredChannel;
    res.createdAt = updated.createdAt;
    res.updatedAt = updated.updatedAt;
    return res;
  }
}
