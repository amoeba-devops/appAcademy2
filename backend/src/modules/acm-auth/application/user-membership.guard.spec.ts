import { Test } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  AMA_PLATFORM_CLIENT,
  AmaPlatformUnavailableException,
  IAmaPlatformClient,
} from '../infrastructure/ama-platform.client';
import { UserMembershipGuard } from './user-membership.guard';

describe('UserMembershipGuard', () => {
  let guard: UserMembershipGuard;
  let assertMember: jest.Mock;

  beforeEach(async () => {
    assertMember = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        UserMembershipGuard,
        {
          provide: AMA_PLATFORM_CLIENT,
          useValue: { assertMember } as Partial<IAmaPlatformClient>,
        },
      ],
    }).compile();
    guard = mod.get(UserMembershipGuard);
  });

  it('returns the member record on 200', async () => {
    const member = {
      userId: 'u1',
      entityId: 'e1',
      level: 'MANAGER' as const,
      name: '김',
      email: 'k@t.kr',
    };
    assertMember.mockResolvedValue(member);
    await expect(guard.ensureMember('e1', 'u1')).resolves.toEqual(member);
  });

  it('throws 403 USER_NOT_IN_ENTITY on null (404)', async () => {
    assertMember.mockResolvedValue(null);
    const err = await guard.ensureMember('e1', 'u1').catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect((err as HttpException).getResponse()).toMatchObject({
      code: 'USER_NOT_IN_ENTITY',
      data: { entityId: 'e1', userId: 'u1' },
    });
  });

  it('throws 503 AMA_UNAVAILABLE on platform 5xx', async () => {
    assertMember.mockRejectedValue(
      new AmaPlatformUnavailableException('5xx status=502'),
    );
    const err = await guard.ensureMember('e1', 'u1').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect((err as HttpException).getResponse()).toMatchObject({
      code: 'AMA_UNAVAILABLE',
    });
  });

  it('throws 503 on a non-typed Error (defensive)', async () => {
    assertMember.mockRejectedValue(new Error('socket hang up'));
    const err = await guard.ensureMember('e1', 'u1').catch((e) => e);
    expect((err as HttpException).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  });
});
