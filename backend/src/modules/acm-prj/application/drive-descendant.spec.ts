import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import type { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import type { DriveClient, GoogleFile } from '../infrastructure/drive.client';
import type { ProjectService } from './project.service';
import { ProjectDriveService } from './drive.service';

/** Google 이 실패한 응답 코드를 붙여 던지는 예외(DriveClient 와 같은 모양). */
const googleError = (status: number) =>
  Object.assign(new BadGatewayException('Google'), { googleStatus: status });

/**
 * 공유받은 폴더의 상위(연결 계정이 볼 수 없는 폴더)까지 올라가면 Google 이 404/403 을 준다.
 * 그 경우 "root 아래가 아님"(403 Forbidden)으로 끝내야 하고, 502 로 새면 안 된다.
 */
describe('ProjectDriveService.descendant', () => {
  const tree: Record<string, GoogleFile | number> = {
    child: { id: 'child', parents: ['shared'] } as GoogleFile,
    shared: { id: 'shared', parents: ['hidden'] } as GoogleFile,
    hidden: 404,
  };
  const google = {
    file: (_t: string, id: string) => {
      const v = tree[id];
      return typeof v === 'number'
        ? Promise.reject(googleError(v))
        : Promise.resolve(v);
    },
  } as unknown as DriveClient;
  const svc = new ProjectDriveService(
    {} as ProjectService,
    google,
    {} as AesGcmService,
  );

  it('accepts a folder under the root', async () => {
    await expect(
      svc.descendant('t', 'child', 'shared'),
    ).resolves.toBeUndefined();
  });

  it('treats an invisible ancestor as outside the root (403, not 502)', async () => {
    await expect(
      svc.descendant('t', 'child', 'project'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still reports a missing requested file', async () => {
    await expect(
      svc.descendant('t', 'hidden', 'project'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
