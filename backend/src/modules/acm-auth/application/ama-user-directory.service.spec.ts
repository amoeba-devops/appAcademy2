import { Test } from '@nestjs/testing';
import {
  AMA_PLATFORM_CLIENT,
  AmaPlatformUnavailableException,
  type AmaPlatformUser,
  type IAmaPlatformClient,
} from '../infrastructure/ama-platform.client';
import { AmaUserDirectoryService } from './ama-user-directory.service';

const user = (overrides: Partial<AmaPlatformUser>): AmaPlatformUser => ({
  userId: 'u',
  entityId: 'e1',
  level: 'MANAGER',
  name: 'n',
  email: 'n@x',
  ...overrides,
});

describe('AmaUserDirectoryService', () => {
  let svc: AmaUserDirectoryService;
  let searchUsers: jest.Mock;

  beforeEach(async () => {
    searchUsers = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        AmaUserDirectoryService,
        {
          provide: AMA_PLATFORM_CLIENT,
          useValue: { searchUsers } as Partial<IAmaPlatformClient>,
        },
      ],
    }).compile();
    svc = mod.get(AmaUserDirectoryService);
  });

  describe('level whitelisting', () => {
    it('strips OWNER from input levels before calling platform', async () => {
      searchUsers.mockResolvedValue([]);
      await svc.search('e1', ['OWNER', 'MANAGER'], '', 10);
      expect(searchUsers).toHaveBeenCalledWith(
        'e1',
        '',
        ['MANAGER'],
        10,
      );
    });

    it('drops unknown level strings', async () => {
      searchUsers.mockResolvedValue([]);
      await svc.search('e1', ['SUPERADMIN', 'MEMBER'], '', 10);
      expect(searchUsers).toHaveBeenCalledWith('e1', '', ['MEMBER'], 10);
    });

    it('defaults to all 3 allowed levels when none given', async () => {
      searchUsers.mockResolvedValue([]);
      await svc.search('e1', undefined, '', 10);
      expect(searchUsers).toHaveBeenCalledWith(
        'e1',
        '',
        ['MANAGER', 'MEMBER', 'VIEWER'],
        10,
      );
    });

    it('defaults when only-OWNER input is filtered to empty', async () => {
      searchUsers.mockResolvedValue([]);
      await svc.search('e1', ['OWNER'], '', 10);
      expect(searchUsers).toHaveBeenCalledWith(
        'e1',
        '',
        ['MANAGER', 'MEMBER', 'VIEWER'],
        10,
      );
    });

    it('drops OWNER from the PLATFORM RESPONSE too (defense in depth)', async () => {
      // Even if the platform returns an OWNER (compromised or misbehaving),
      // we filter it out before returning to the client. AC-3-3.
      searchUsers.mockResolvedValue([
        user({ userId: 'a', level: 'MANAGER' }),
        user({ userId: 'b', level: 'OWNER' }),
        user({ userId: 'c', level: 'MEMBER' }),
      ]);
      const result = await svc.search('e1', ['MANAGER', 'MEMBER'], '', 10);
      expect(result.map((u) => u.userId)).toEqual(['a', 'c']);
    });
  });

  describe('limit clamping', () => {
    it('clamps limit to [1, 50]', async () => {
      searchUsers.mockResolvedValue([]);
      await svc.search('e1', undefined, '', 999);
      expect(searchUsers.mock.calls[0][3]).toBe(50);
      await svc.search('e1', undefined, '', -5);
      expect(searchUsers.mock.calls[1][3]).toBe(1);
    });
  });

  describe('caching', () => {
    it('hits cache on second identical call within TTL', async () => {
      searchUsers.mockResolvedValue([user({ userId: 'a' })]);
      const r1 = await svc.search('e1', ['MANAGER'], 'kim', 10);
      const r2 = await svc.search('e1', ['MANAGER'], 'kim', 10);
      expect(searchUsers).toHaveBeenCalledTimes(1);
      expect(r2).toEqual(r1);
    });

    it('cache key is order-insensitive on levels but lower-cased on q', async () => {
      searchUsers.mockResolvedValue([]);
      await svc.search('e1', ['MEMBER', 'MANAGER'], 'KIM', 10);
      await svc.search('e1', ['MANAGER', 'MEMBER'], 'kim', 10);
      expect(searchUsers).toHaveBeenCalledTimes(1);
    });

    it('cache key segregates by entityId', async () => {
      searchUsers.mockResolvedValue([]);
      await svc.search('e1', ['MANAGER'], 'kim', 10);
      await svc.search('e2', ['MANAGER'], 'kim', 10);
      expect(searchUsers).toHaveBeenCalledTimes(2);
    });
  });

  describe('failure modes', () => {
    it('returns empty array on AmaPlatformUnavailableException', async () => {
      searchUsers.mockRejectedValue(
        new AmaPlatformUnavailableException('timeout'),
      );
      const result = await svc.search('e1', undefined, 'kim', 10);
      expect(result).toEqual([]);
    });

    it('returns empty array on generic Error too', async () => {
      searchUsers.mockRejectedValue(new Error('socket'));
      const result = await svc.search('e1', undefined, 'kim', 10);
      expect(result).toEqual([]);
    });
  });
});
