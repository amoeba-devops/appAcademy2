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
import { TeacherTypeormEntity } from '../infrastructure/typeorm/teacher.typeorm-entity';
import type {
  CreateTeacherDto,
  ListTeachersQueryDto,
  ResetTeacherPasswordDto,
  UpdateTeacherDto,
} from './dto/teacher.dto';

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(TeacherTypeormEntity, ACM_DS)
    private readonly repo: Repository<TeacherTypeormEntity>,
    private readonly authService: AcmAuthService,
  ) {}

  async list(entId: string, q: ListTeachersQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.entId = :entId', { entId })
      .andWhere('t.deletedAt IS NULL');

    if (q.status && q.status !== 'ALL') {
      qb.andWhere('t.status = :status', { status: q.status });
    } else if (!q.status) {
      qb.andWhere('t.status = :status', { status: 'ACTIVE' });
    }

    if (q.q) {
      qb.andWhere(
        '(t.name ILIKE :q OR t.englishName ILIKE :q OR t.email ILIKE :q)',
        { q: `%${q.q}%` },
      );
    }

    qb.orderBy('t.name', 'ASC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items: items.map(this.toDetail), total, page, limit };
  }

  async findOne(entId: string, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('TEACHER_NOT_FOUND');
    return this.toDetail(e);
  }

  async create(entId: string, dto: CreateTeacherDto) {
    const email = dto.tchEmail.trim().toLowerCase();
    const dup = await this.repo.findOne({
      where: { entId, email, deletedAt: IsNull() },
    });
    if (dup) throw new ConflictException('TEACHER_EMAIL_DUPLICATE');

    let userId: string | null = null;
    if (dto.tchCreateAccount) {
      if (!dto.tchPassword) {
        throw new BadRequestException('PASSWORD_REQUIRED');
      }
      const created = await this.authService.createUserWithPassword({
        entId,
        email,
        plainPassword: dto.tchPassword,
        name: dto.tchName,
        role: 'TEACHER',
      });
      userId = created.id;
    }

    const entity = this.repo.create({
      entId,
      name: dto.tchName,
      englishName: dto.tchEnglishName ?? null,
      email,
      phone: dto.tchPhone ?? null,
      birthDate: dto.tchBirthDate ?? null,
      subjects: dto.tchSubjects ?? [],
      memo: dto.tchMemo ?? null,
      userId,
      status: dto.tchStatus ?? 'ACTIVE',
    });
    const saved = await this.repo.save(entity);
    return this.toDetail(saved);
  }

  async update(entId: string, id: string, dto: UpdateTeacherDto) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('TEACHER_NOT_FOUND');

    if (dto.tchName !== undefined) e.name = dto.tchName;
    if (dto.tchEnglishName !== undefined) e.englishName = dto.tchEnglishName;
    if (dto.tchEmail !== undefined) e.email = dto.tchEmail.trim().toLowerCase();
    if (dto.tchPhone !== undefined) e.phone = dto.tchPhone;
    if (dto.tchBirthDate !== undefined) e.birthDate = dto.tchBirthDate;
    if (dto.tchSubjects !== undefined) e.subjects = dto.tchSubjects;
    if (dto.tchMemo !== undefined) e.memo = dto.tchMemo;
    if (dto.tchStatus !== undefined) e.status = dto.tchStatus;
    e.updatedAt = new Date();

    const saved = await this.repo.save(e);
    return this.toDetail(saved);
  }

  async resetPassword(entId: string, id: string, dto: ResetTeacherPasswordDto) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('TEACHER_NOT_FOUND');
    if (!e.userId) throw new BadRequestException('TEACHER_NO_ACCOUNT');
    await this.authService.updateUserPassword(e.userId, dto.tchPassword);
    return { id: e.id };
  }

  async remove(entId: string, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('TEACHER_NOT_FOUND');
    e.deletedAt = new Date();
    e.updatedAt = new Date();
    await this.repo.save(e);
    return { id };
  }

  private toDetail = (e: TeacherTypeormEntity) => ({
    id: e.id,
    entId: e.entId,
    name: e.name,
    englishName: e.englishName,
    email: e.email,
    phone: e.phone,
    birthDate: e.birthDate,
    subjects: e.subjects ?? [],
    memo: e.memo,
    userId: e.userId,
    hasAccount: !!e.userId,
    status: e.status,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  });
}
