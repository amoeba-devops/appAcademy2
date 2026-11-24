import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { PortalTeacherStudentsService } from '../application/portal-teacher-students.service';
import { PortalTeacherStudentsController } from './portal-teacher-students.controller';

describe('Portal teacher student list HTTP contract', () => {
  let app: INestApplication;
  let kind: PortalAuthUser['kind'] = 'TEACHER';
  const listMyStudents = jest.fn().mockResolvedValue([]);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PortalTeacherStudentsController],
      providers: [{ provide: PortalTeacherStudentsService, useValue: { listMyStudents } }],
    })
      .overrideGuard(PortalJwtAuthGuard)
      .useValue({
        canActivate(ctx: ExecutionContext) {
          ctx.switchToHttp().getRequest<{ user: PortalAuthUser }>().user = {
            id: 'account-a', entId: 'tenant-a', refId: 'teacher-a',
            loginId: 'teacher', kind, mustChangePassword: false,
          };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => { kind = 'TEACHER'; listMyStudents.mockClear(); });
  afterAll(async () => { await app.close(); });

  it.each([
    ['', false], ['?includeWithdrawn=false', false], ['?includeWithdrawn=true', true],
  ])('parses %s and retains the authenticated scope', async (query, expected) => {
    await request(app.getHttpServer()).get(`/portal/teacher/students${query}`).expect(200);
    expect(listMyStudents).toHaveBeenCalledWith('tenant-a', 'teacher-a', expected);
  });

  it.each(['1', 'yes', 'false OR true'])('rejects invalid flag %s', async (value) => {
    await request(app.getHttpServer()).get('/portal/teacher/students').query({ includeWithdrawn: value }).expect(400);
    expect(listMyStudents).not.toHaveBeenCalled();
  });

  it.each(['STUDENT', 'PARENT'] as const)('rejects %s even with all view requested', async (role) => {
    kind = role;
    await request(app.getHttpServer()).get('/portal/teacher/students?includeWithdrawn=true').expect(403);
    expect(listMyStudents).not.toHaveBeenCalled();
  });
});
