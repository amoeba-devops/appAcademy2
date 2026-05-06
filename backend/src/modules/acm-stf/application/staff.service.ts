import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { AcmAuthService } from '../../acm-auth/application/acm-auth.service';
import { StaffTypeormEntity } from '../infrastructure/typeorm/staff.typeorm-entity';
import type {
  CreateStaffDto,
  ListStaffQueryDto,
  ResetStaffPasswordDto,
  UpdateStaffDto,
} from './dto/staff.dto';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffTypeormEntity, ACM_DS)
    private readonly repo: Repository<StaffTypeormEntity>,
    private readonly authService: AcmAuthService,
  ) {}

  async list(entId: string, q: ListStaffQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.entId = :entId', { entId })
      .andWhere('s.deletedAt IS NULL');

    if (q.status && q.status !== 'ALL') {
      qb.andWhere('s.status = :status', { status: q.status });
    } else if (!q.status) {
      qb.andWhere('s.status = :status', { status: 'ACTIVE' });
    }

    if (q.q) {
      qb.andWhere(
        '(s.name ILIKE :q OR s.englishName ILIKE :q OR s.email ILIKE :q OR s.position ILIKE :q OR s.department ILIKE :q)',
        { q: `%${q.q}%` },
      );
    }

    qb.orderBy('s.name', 'ASC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(this.toDetail), total, page, limit };
  }

  async findOne(entId: string, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('STAFF_NOT_FOUND');
    return this.toDetail(e);
  }

  async create(entId: string, dto: CreateStaffDto) {
    const email = dto.stfEmail.trim().toLowerCase();
    const dup = await this.repo.findOne({
      where: { entId, email, deletedAt: IsNull() },
    });
    if (dup) throw new ConflictException('STAFF_EMAIL_DUPLICATE');

    let userId: string | null = null;
    if (dto.stfCreateAccount) {
      if (!dto.stfPassword) throw new BadRequestException('PASSWORD_REQUIRED');
      const created = await this.authService.createUserWithPassword({
        entId,
        email,
        plainPassword: dto.stfPassword,
        name: dto.stfName,
        role: 'STAFF',
      });
      userId = created.id;
    }

    const entity = this.repo.create({
      entId,
      name: dto.stfName,
      englishName: dto.stfEnglishName ?? null,
      email,
      phone: dto.stfPhone ?? null,
      position: dto.stfPosition ?? null,
      department: dto.stfDepartment ?? null,
      hiredAt: dto.stfHiredAt ?? null,
      memo: dto.stfMemo ?? null,
      userId,
      status: dto.stfStatus ?? 'ACTIVE',
    });
    const saved = await this.repo.save(entity);
    return this.toDetail(saved);
  }

  async update(entId: string, id: string, dto: UpdateStaffDto) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('STAFF_NOT_FOUND');

    if (dto.stfName !== undefined) e.name = dto.stfName;
    if (dto.stfEnglishName !== undefined) e.englishName = dto.stfEnglishName;
    if (dto.stfEmail !== undefined) e.email = dto.stfEmail.trim().toLowerCase();
    if (dto.stfPhone !== undefined) e.phone = dto.stfPhone;
    if (dto.stfPosition !== undefined) e.position = dto.stfPosition;
    if (dto.stfDepartment !== undefined) e.department = dto.stfDepartment;
    if (dto.stfHiredAt !== undefined) e.hiredAt = dto.stfHiredAt;
    if (dto.stfMemo !== undefined) e.memo = dto.stfMemo;
    if (dto.stfStatus !== undefined) e.status = dto.stfStatus;
    e.updatedAt = new Date();

    const saved = await this.repo.save(e);
    return this.toDetail(saved);
  }

  async resetPassword(entId: string, id: string, dto: ResetStaffPasswordDto) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('STAFF_NOT_FOUND');
    if (!e.userId) throw new BadRequestException('STAFF_NO_ACCOUNT');
    await this.authService.updateUserPassword(e.userId, dto.stfPassword);
    return { id: e.id };
  }

  async remove(entId: string, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('STAFF_NOT_FOUND');
    e.deletedAt = new Date();
    e.updatedAt = new Date();
    await this.repo.save(e);
    return { id };
  }

  private toDetail = (e: StaffTypeormEntity) => ({
    id: e.id,
    entId: e.entId,
    name: e.name,
    englishName: e.englishName,
    email: e.email,
    phone: e.phone,
    position: e.position,
    department: e.department,
    hiredAt: e.hiredAt,
    memo: e.memo,
    userId: e.userId,
    hasAccount: !!e.userId,
    status: e.status,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  });
}
