import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParentEntity } from '../entities/parent.entity';
import { IParentRepository } from '../../../domain/repositories/parent-repository.interface';
import { Parent } from '../../../domain/entities/parent';

/**
 * ParentRepository — Infrastructure layer
 * phone/email are stored encrypted (VARBINARY).
 * For Phase 1 MVP, we store/retrieve plain text via Buffer conversion.
 * TODO: Replace with AES-GCM encryption service (NFR-005).
 */
@Injectable()
export class ParentRepository implements IParentRepository {
  constructor(
    @InjectRepository(ParentEntity)
    private readonly repo: Repository<ParentEntity>,
  ) {}

  async findById(id: number): Promise<Parent | null> {
    const entity = await this.repo.findOne({ where: { prtId: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAll(): Promise<Parent[]> {
    const entities = await this.repo.find();
    return entities.map((e) => this.toDomain(e));
  }

  async findByAcademyId(academyId: number): Promise<Parent[]> {
    const entities = await this.repo.find({ where: { acdId: academyId } });
    return entities.map((e) => this.toDomain(e));
  }

  async findByPhone(academyId: number, phone: string): Promise<Parent | null> {
    // Phase 1: simple buffer comparison. Replace with encrypted lookup later.
    const parents = await this.repo.find({ where: { acdId: academyId } });
    for (const p of parents) {
      if (p.prtPhoneEncrypted && this.decryptField(p.prtPhoneEncrypted) === phone) {
        return this.toDomain(p);
      }
    }
    return null;
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { search?: string },
  ): Promise<Parent[]> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.acd_id = :academyId', { academyId });

    if (filters.search) {
      qb.andWhere('p.prt_name LIKE :search', { search: `%${filters.search}%` });
    }

    qb.orderBy('p.prt_created_at', 'DESC');
    const entities = await qb.getMany();
    return entities.map((e) => this.toDomain(e));
  }

  async create(data: Partial<Parent>): Promise<Parent> {
    const entity = this.repo.create({
      acdId: data.academyId!,
      prtName: data.name!,
      prtPhoneEncrypted: data.phone ? this.encryptField(data.phone) : null,
      prtEmailEncrypted: data.email ? this.encryptField(data.email) : null,
      prtPreferredChannel: data.preferredChannel ?? 'SMS',
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async update(id: number, data: Partial<Parent>): Promise<Parent> {
    const updateData: Partial<ParentEntity> = {};
    if (data.name !== undefined) updateData.prtName = data.name;
    if (data.phone !== undefined)
      updateData.prtPhoneEncrypted = data.phone ? this.encryptField(data.phone) : null;
    if (data.email !== undefined)
      updateData.prtEmailEncrypted = data.email ? this.encryptField(data.email) : null;
    if (data.preferredChannel !== undefined)
      updateData.prtPreferredChannel = data.preferredChannel;

    await this.repo.update({ prtId: id }, updateData);
    const updated = await this.repo.findOneOrFail({ where: { prtId: id } });
    return this.toDomain(updated);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ prtId: id });
  }

  private toDomain(e: ParentEntity): Parent {
    const p = new Parent();
    p.id = e.prtId;
    p.academyId = e.acdId;
    p.name = e.prtName;
    p.phone = e.prtPhoneEncrypted ? this.decryptField(e.prtPhoneEncrypted) : null;
    p.email = e.prtEmailEncrypted ? this.decryptField(e.prtEmailEncrypted) : null;
    p.preferredChannel = e.prtPreferredChannel;
    p.createdAt = e.prtCreatedAt;
    p.updatedAt = e.prtUpdatedAt;
    return p;
  }

  // Phase 1 MVP: simple UTF-8 encode/decode. Replace with AES-GCM.
  private encryptField(value: string): Buffer {
    return Buffer.from(value, 'utf-8');
  }

  private decryptField(buf: Buffer): string {
    return buf.toString('utf-8');
  }
}
