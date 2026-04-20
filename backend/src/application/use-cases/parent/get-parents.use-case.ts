import { Inject, Injectable } from '@nestjs/common';
import type { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { PARENT_REPOSITORY } from '../../../domain/repositories/parent-repository.interface';
import { ParentResponseDto } from '../../dto/parent';

@Injectable()
export class GetParentsUseCase {
  constructor(
    @Inject(PARENT_REPOSITORY)
    private readonly parentRepo: IParentRepository,
  ) {}

  async execute(
    academyId: number,
    filters: { search?: string },
  ): Promise<ParentResponseDto[]> {
    const parents = await this.parentRepo.findByAcademyIdWithFilters(academyId, filters);
    return parents.map((p) => {
      const dto = new ParentResponseDto();
      dto.id = p.id;
      dto.name = p.name;
      dto.phone = p.phone;
      dto.email = p.email;
      dto.preferredChannel = p.preferredChannel;
      dto.createdAt = p.createdAt;
      dto.updatedAt = p.updatedAt;
      return dto;
    });
  }
}
