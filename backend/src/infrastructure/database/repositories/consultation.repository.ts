import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsultationEntity } from '../entities/consultation.entity';
import { IConsultationRepository } from '../../../domain/repositories/consultation-repository.interface';
import { Consultation } from '../../../domain/entities/consultation';

@Injectable()
export class ConsultationRepository implements IConsultationRepository {
  constructor(
    @InjectRepository(ConsultationEntity)
    private readonly repo: Repository<ConsultationEntity>,
  ) {}

  async findById(id: number): Promise<Consultation | null> {
    const e = await this.repo.findOne({ where: { cstId: id } });
    return e ? this.toDomain(e) : null;
  }

  async findAll(): Promise<Consultation[]> {
    return (await this.repo.find()).map((e) => this.toDomain(e));
  }

  async findByAcademyId(academyId: number): Promise<Consultation[]> {
    return (await this.repo.find({ where: { acdId: academyId } })).map((e) => this.toDomain(e));
  }

  async findByAcademyIdWithFilters(
    academyId: number,
    filters: { status?: string; channel?: string; assigneeUserId?: number; search?: string },
  ): Promise<Consultation[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoin('tac_parents', 'p', 'p.prt_id = c.prt_id')
      .where('c.acd_id = :academyId', { academyId });

    if (filters.status) {
      qb.andWhere('c.cst_status = :status', { status: filters.status });
    }
    if (filters.channel) {
      qb.andWhere('c.cst_channel = :channel', { channel: filters.channel });
    }
    if (filters.assigneeUserId) {
      qb.andWhere('c.cst_assignee_user_id = :uid', { uid: filters.assigneeUserId });
    }
    if (filters.search) {
      qb.andWhere('p.prt_name LIKE :search', { search: `%${filters.search}%` });
    }

    qb.orderBy('c.cst_created_at', 'DESC');
    return (await qb.getMany()).map((e) => this.toDomain(e));
  }

  async create(data: Partial<Consultation>): Promise<Consultation> {
    const entity = this.repo.create({
      acdId: data.academyId!,
      prtId: data.parentId ?? null,
      cstInterestedPrgId: data.interestedProgramId ?? null,
      cstChannel: data.channel!,
      cstStatus: data.status ?? 'OPEN',
      cstAssigneeUserId: data.assigneeUserId ?? null,
      cstNote: data.note ?? null,
    });
    const saved = await this.repo.save(entity);
    return this.toDomain(saved);
  }

  async update(id: number, data: Partial<Consultation>): Promise<Consultation> {
    const updateData: Partial<ConsultationEntity> = {};
    if (data.channel !== undefined) updateData.cstChannel = data.channel;
    if (data.status !== undefined) updateData.cstStatus = data.status;
    if (data.assigneeUserId !== undefined) updateData.cstAssigneeUserId = data.assigneeUserId;
    if (data.note !== undefined) updateData.cstNote = data.note;
    if (data.interestedProgramId !== undefined) updateData.cstInterestedPrgId = data.interestedProgramId;
    if (data.convertedEnrollmentId !== undefined) updateData.cstConvertedEnrId = data.convertedEnrollmentId;

    await this.repo.update({ cstId: id }, updateData);
    const updated = await this.repo.findOneOrFail({ where: { cstId: id } });
    return this.toDomain(updated);
  }

  async updateStatus(id: number, status: string): Promise<Consultation> {
    await this.repo.update({ cstId: id }, { cstStatus: status });
    const updated = await this.repo.findOneOrFail({ where: { cstId: id } });
    return this.toDomain(updated);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete({ cstId: id });
  }

  private toDomain(e: ConsultationEntity): Consultation {
    const c = new Consultation();
    c.id = e.cstId;
    c.academyId = e.acdId;
    c.parentId = e.prtId;
    c.interestedProgramId = e.cstInterestedPrgId;
    c.channel = e.cstChannel;
    c.status = e.cstStatus;
    c.assigneeUserId = e.cstAssigneeUserId;
    c.note = e.cstNote;
    c.convertedEnrollmentId = e.cstConvertedEnrId;
    c.createdAt = e.cstCreatedAt;
    c.updatedAt = e.cstUpdatedAt;
    return c;
  }
}
