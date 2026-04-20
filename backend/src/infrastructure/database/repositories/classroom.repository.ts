import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassroomEntity } from '../entities/classroom.entity';
import { IClassroomRepository } from '../../../domain/repositories/classroom-repository.interface';
import { Classroom } from '../../../domain/entities/class';

@Injectable()
export class ClassroomRepository implements IClassroomRepository {
  constructor(
    @InjectRepository(ClassroomEntity)
    private readonly repo: Repository<ClassroomEntity>,
  ) {}

  async findById(id: number): Promise<Classroom | null> {
    const entity = await this.repo.findOne({ where: { clrId: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<Classroom[]> {
    const entities = await this.repo.find();
    return entities.map((e) => this.toDomain(e));
  }

  async findByAcademyId(academyId: number): Promise<Classroom[]> {
    const entities = await this.repo.find({
      where: { acdId: academyId },
      order: { clrName: 'ASC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async create(data: Partial<Classroom>): Promise<Classroom> {
    const entity = this.repo.create({
      acdId: data.academyId!,
      clrName: data.name!,
      clrCapacity: data.capacity ?? null,
      clrStatus: data.status ?? 'ACTIVE',
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async update(id: number, data: Partial<Classroom>): Promise<Classroom> {
    const updateData: Partial<ClassroomEntity> = {};
    if (data.name !== undefined) updateData.clrName = data.name;
    if (data.capacity !== undefined) updateData.clrCapacity = data.capacity;
    if (data.status !== undefined) updateData.clrStatus = data.status;

    if (Object.keys(updateData).length > 0) {
      await this.repo.update({ clrId: id }, updateData);
    }
    const updated = await this.repo.findOneOrFail({ where: { clrId: id } });
    return this.toDomain(updated);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ clrId: id });
  }

  private toDomain(e: ClassroomEntity): Classroom {
    const c = new Classroom();
    c.id = e.clrId;
    c.academyId = e.acdId;
    c.name = e.clrName;
    c.capacity = e.clrCapacity;
    c.status = e.clrStatus;
    return c;
  }
}
