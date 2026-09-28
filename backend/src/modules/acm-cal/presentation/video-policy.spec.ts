import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { VideoConfigController } from './video-config.controller';
import { VideoConfigService } from '../application/video-config.service';
import { BodaPolicyInterceptor } from './boda-policy.interceptor';

describe('video settings access and BODA request policy', () => {
  const context = (role: string, entId = 'tenant-a', body: object = {}) =>
    ({
      getClass: () => VideoConfigController,
      getHandler: () => VideoConfigController.prototype.update,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role, entId },
          body,
          url: '/cal/boda/launch-context?evtId=event-a',
        }),
      }),
    }) as unknown as ExecutionContext;
  it('allows only ADMIN to change the setting', () => {
    const roles = new RolesGuard(new Reflector());
    expect(roles.canActivate(context('ADMIN'))).toBe(true);
    for (const role of ['STAFF', 'TEACHER', 'PARENT', 'APP_ADMIN']) {
      expect(() => roles.canActivate(context(role))).toThrow(
        'Insufficient role',
      );
    }
  });
  it('rejects spoofed tenant IDs before executing the handler', () => {
    expect(() =>
      new OwnEntityGuard().canActivate(
        context('ADMIN', 'tenant-a', { entId: 'tenant-b' }),
      ),
    ).toThrow('entId mismatch');
  });
  it('does not execute disabled BODA actions or reserve a launch', async () => {
    const video = {
      withLock: async (_id: string, work: () => Promise<unknown>) => work(),
      assertBoda: jest
        .fn()
        .mockRejectedValue(new Error('VIDEO_PROVIDER_DISABLED')),
      reserveLaunch: jest.fn(),
    };
    const handler = { handle: jest.fn(() => of({ ok: true })) };
    const interceptor = new BodaPolicyInterceptor(
      video as unknown as VideoConfigService,
    );
    await expect(
      lastValueFrom(interceptor.intercept(context('ADMIN'), handler)),
    ).rejects.toThrow('VIDEO_PROVIDER_DISABLED');
    expect(handler.handle).not.toHaveBeenCalled();
    expect(video.reserveLaunch).not.toHaveBeenCalled();
  });
  it('reserves only successful authorized launches', async () => {
    const video = {
      withLock: async (_id: string, work: () => Promise<unknown>) => work(),
      assertBoda: jest.fn(),
      reserveLaunch: jest.fn(),
    };
    const interceptor = new BodaPolicyInterceptor(
      video as unknown as VideoConfigService,
    );
    await lastValueFrom(
      interceptor.intercept(context('ADMIN'), {
        handle: () => of({ ok: true }),
      }),
    );
    expect(video.reserveLaunch).toHaveBeenCalledWith('tenant-a');
    video.reserveLaunch.mockClear();
    await expect(
      lastValueFrom(
        interceptor.intercept(context('ADMIN'), {
          handle: () => throwError(() => new Error('NOT_OWNER')),
        }),
      ),
    ).rejects.toThrow('NOT_OWNER');
    expect(video.reserveLaunch).not.toHaveBeenCalled();
  });
});
