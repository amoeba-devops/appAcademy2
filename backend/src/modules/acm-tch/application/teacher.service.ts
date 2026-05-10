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
import { AcmUserTypeormEntity } from '../../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { TeacherTypeormEntity } from '../infrastructure/typeorm/teacher.typeorm-entity';
import type {
  CreateTeacherDto,
  ListTeachersQueryDto,
  ResetTeacherPasswordDto,
  UpdateTeacherDto,
} from './dto/teacher.dto';

type AccountMeta = {
  username: string | null;
  lastLoginAt: Date | null;
  lockedAt: Date | null;
};

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(TeacherTypeormEntity, ACM_DS)
    private readonly repo: Repository<TeacherTypeormEntity>,
    @InjectRepository(AcmUserTypeormEntity, ACM_DS)
    private readonly userRepo: Repository<AcmUserTypeormEntity>,
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

    if (q.isInstructor === 'INSTRUCTOR') {
      qb.andWhere('t.isInstructor = TRUE');
    } else if (q.isInstructor === 'NON_INSTRUCTOR') {
      qb.andWhere('t.isInstructor = FALSE');
    }

    if (q.employmentType && q.employmentType !== 'ALL') {
      qb.andWhere('t.employmentType = :etype', { etype: q.employmentType });
    }

    if (q.q) {
      qb.andWhere(
        '(t.name ILIKE :q OR t.englishName ILIKE :q OR t.email ILIKE :q)',
        { q: `%${q.q}%` },
      );
    }

    qb.orderBy('t.name', 'ASC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Account meta join (separate fetch — keeps two-DS scenario simple)
    const userIds = items.map((it) => it.userId).filter((x): x is string => !!x);
    const accounts = userIds.length
      ? await this.userRepo.find({ where: userIds.map((id) => ({ id })) })
      : [];
    const accountMap = new Map<string, AccountMeta>(
      accounts.map((u) => [
        u.id,
        {
          username: u.email ? u.email.split('@')[0] : null,
          lastLoginAt: u.lastLoginAt ?? null,
          lockedAt: u.lockedAt ?? null,
        },
      ]),
    );

    let detailed = items.map((e) => this.toDetail(e, accountMap.get(e.userId ?? '')));

    if (q.accountState && q.accountState !== 'ALL') {
      detailed = detailed.filter((d) => {
        if (q.accountState === 'NO_ACCOUNT') return !d.hasAccount;
        if (q.accountState === 'LOCKED') return d.hasAccount && !!d.accountLockedAt;
        if (q.accountState === 'UNLOCKED') return d.hasAccount && !d.accountLockedAt;
        return true;
      });
    }

    return { items: detailed, total, page, limit };
  }

  async findOne(entId: string, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('TEACHER_NOT_FOUND');
    const meta = e.userId ? await this.fetchAccountMeta(e.userId) : undefined;
    return this.toDetail(e, meta);
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
      isInstructor: dto.tchIsInstructor ?? true,
      employmentType: dto.tchEmploymentType ?? 'FULL_TIME',
      hiredAt: dto.tchHiredAt ?? null,
      attendanceNo: dto.tchAttendanceNo ?? null,
    });
    const saved = await this.repo.save(entity);
    const meta = saved.userId ? await this.fetchAccountMeta(saved.userId) : undefined;
    return this.toDetail(saved, meta);
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
    if (dto.tchIsInstructor !== undefined) e.isInstructor = dto.tchIsInstructor;
    if (dto.tchEmploymentType !== undefined) e.employmentType = dto.tchEmploymentType;
    if (dto.tchHiredAt !== undefined) e.hiredAt = dto.tchHiredAt;
    if (dto.tchAttendanceNo !== undefined) e.attendanceNo = dto.tchAttendanceNo;
    e.updatedAt = new Date();

    const saved = await this.repo.save(e);
    const meta = saved.userId ? await this.fetchAccountMeta(saved.userId) : undefined;
    return this.toDetail(saved, meta);
  }

  async resetPassword(entId: string, id: string, dto: ResetTeacherPasswordDto) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('TEACHER_NOT_FOUND');
    if (!e.userId) throw new BadRequestException('TEACHER_NO_ACCOUNT');
    await this.authService.updateUserPassword(e.userId, dto.tchPassword);
    return { id: e.id };
  }

  async lockAccount(entId: string, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('TEACHER_NOT_FOUND');
    if (!e.userId) throw new BadRequestException('TEACHER_NO_ACCOUNT');
    await this.authService.lockUser(e.userId);
    return { id: e.id, lockedAt: new Date().toISOString() };
  }

  async unlockAccount(entId: string, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('TEACHER_NOT_FOUND');
    if (!e.userId) throw new BadRequestException('TEACHER_NO_ACCOUNT');
    await this.authService.unlockUser(e.userId);
    return { id: e.id, lockedAt: null };
  }

  async remove(entId: string, id: string) {
    const e = await this.repo.findOne({ where: { id, entId, deletedAt: IsNull() } });
    if (!e) throw new NotFoundException('TEACHER_NOT_FOUND');
    e.deletedAt = new Date();
    e.updatedAt = new Date();
    await this.repo.save(e);
    return { id };
  }

  private async fetchAccountMeta(userId: string): Promise<AccountMeta | undefined> {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) return undefined;
    return {
      username: u.email ? u.email.split('@')[0] : null,
      lastLoginAt: u.lastLoginAt ?? null,
      lockedAt: u.lockedAt ?? null,
    };
  }

  private toDetail = (e: TeacherTypeormEntity, account?: AccountMeta) => ({
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
    isInstructor: e.isInstructor,
    employmentType: e.employmentType,
    hiredAt: e.hiredAt,
    attendanceNo: e.attendanceNo,
    accountUsername: account?.username ?? null,
    accountLastLoginAt: account?.lastLoginAt ?? null,
    accountLockedAt: account?.lockedAt ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  });
}
