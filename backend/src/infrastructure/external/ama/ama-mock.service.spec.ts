import { AmaMockService } from './ama-mock.service';

describe('AmaMockService', () => {
  let service: AmaMockService;

  beforeEach(() => {
    service = new AmaMockService();
  });

  describe('getClient', () => {
    it('returns the fixture client by id', async () => {
      const c = await service.getClient('CL-2026-0001');
      expect(c).not.toBeNull();
      expect(c!.amaClientId).toBe('CL-2026-0001');
      expect(c!.status).toBe('ACTIVE');
    });

    it('returns null for unknown id', async () => {
      const c = await service.getClient('CL-DOES-NOT-EXIST');
      expect(c).toBeNull();
    });

    it('returns INACTIVE fixture for retired client', async () => {
      const c = await service.getClient('CL-2025-9999');
      expect(c!.status).toBe('INACTIVE');
    });
  });

  describe('searchClients', () => {
    it('matches by name (case-insensitive)', async () => {
      const r = await service.searchClients('홍길동');
      expect(r.data.length).toBe(1);
      expect(r.data[0].amaClientId).toBe('CL-2026-0001');
    });

    it('matches by amaClientId substring', async () => {
      const r = await service.searchClients('2026');
      expect(r.data.length).toBe(4);
      expect(r.meta.total).toBe(4);
    });

    it('returns all fixtures when query is empty', async () => {
      const r = await service.searchClients('');
      expect(r.data.length).toBe(5);
    });

    it('paginates results', async () => {
      const r = await service.searchClients('', 1, 2);
      expect(r.data.length).toBe(2);
      expect(r.meta).toEqual({ page: 1, limit: 2, total: 5 });
    });

    it('returns empty data on miss', async () => {
      const r = await service.searchClients('zzz-no-match');
      expect(r.data).toEqual([]);
      expect(r.meta.total).toBe(0);
    });
  });
});
