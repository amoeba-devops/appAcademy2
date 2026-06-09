import { BodaeduServerMockClient } from './bodaedu-server-mock.client';

describe('BodaeduServerMockClient', () => {
  let client: BodaeduServerMockClient;

  beforeEach(() => {
    client = new BodaeduServerMockClient();
  });

  describe('getMeetInfo', () => {
    it('returns STARTED by default (most meetKeys)', async () => {
      const info = await client.getMeetInfo('tac-0123456789abcdef0123456789abcde0');
      expect(info?.status).toBe('STARTED');
      expect(info?.meetIdx).toMatch(/^m-/);
      expect(info?.currentUserCount).toBe(2);
    });

    it('returns PENDING when meetKey ends in "2"', async () => {
      const info = await client.getMeetInfo('tac-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2');
      expect(info?.status).toBe('PENDING');
      expect(info?.meetIdx).toBeNull();
    });

    it('returns ENDED when meetKey ends in "1"', async () => {
      const info = await client.getMeetInfo('tac-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1');
      expect(info?.status).toBe('ENDED');
      expect(info?.openedAt).toBeTruthy();
      expect(info?.endedAt).toBeTruthy();
    });

    it('throws when meetKey ends in "f" (simulated 5xx)', async () => {
      await expect(
        client.getMeetInfo('tac-cccccccccccccccccccccccccccccccf'),
      ).rejects.toThrow(/MOCK_FAIL/);
    });
  });

  describe('closeMeet', () => {
    it('resolves without throwing for happy path', async () => {
      await expect(
        client.closeMeet({ meetKey: 'tac-0', reason: 'admin_force' }),
      ).resolves.toBeUndefined();
    });

    it('throws when meetKey ends in "f"', async () => {
      await expect(
        client.closeMeet({ meetKey: 'tac-xxxxf' }),
      ).rejects.toThrow(/MOCK_FAIL/);
    });
  });

  describe('getJoinLog', () => {
    it('returns 2 entries (teacher + student)', async () => {
      const entries = await client.getJoinLog('tac-0');
      expect(entries).toHaveLength(2);
      expect(entries[0].userId).toBe('ama-user-mgr-1');
      expect(entries[1].userId).toBe('ama-user-mem-1');
      // Both have full join/leave windows.
      expect(entries.every((e) => e.leftAt && e.totalSeconds)).toBe(true);
    });

    it('throws on "f"-suffixed meetKey', async () => {
      await expect(client.getJoinLog('tac-xxxxf')).rejects.toThrow(/MOCK_FAIL/);
    });
  });
});
