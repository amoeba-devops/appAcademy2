import { Inject, Injectable } from '@nestjs/common';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { CreateParentDto, ParentResponseDto } from '../../dto/parent';
import { Parent } from '../../../domain/entities/parent';

@Injectable()
export class CreateParentUseCase {
  constructor(
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(
    academyId: number,
    dto: CreateParentDto,
  ): Promise<ParentResponseDto> {
    const parent = await this.parentRepo.create({
      academyId,
      name: dto.name,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      preferredChannel: dto.preferredChannel ?? 'SMS',
    } as Partial<Parent>);

    const res = new ParentResponseDto();
    res.id = parent.id;
    res.name = parent.name;
    res.phone = parent.phone;
    res.email = parent.email;
    res.preferredChannel = parent.preferredChannel;
    res.createdAt = parent.createdAt;
    res.updatedAt = parent.updatedAt;
    return res;
  }
}
