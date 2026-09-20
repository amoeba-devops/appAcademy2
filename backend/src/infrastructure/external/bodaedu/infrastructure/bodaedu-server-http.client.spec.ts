import { ConfigService } from '@nestjs/config';
import { BodaeduServerHttpClient } from './bodaedu-server-http.client';
import { BodaeduUnavailableException } from '../interfaces/bodaedu-server-api.interface';

/**
 * FIX-260920 — 보다 SERVER API 응답 봉투(`{ success, data }`) 해제.
 *
 * 2026-09-20 실연동 전환 직후 녹화 목록이 항상 [] 로 파싱되던 원인:
 * 벤더는 SPEC_823 §2.1 대로 모든 결과를 `data` 하위에 싣는데 클라이언트가
 * 최상위 `content` 를 읽었다. 아래 fixture 는 프로덕션 실측 페이로드다.
 */
const PROD_RECORDING_LIST = {
  status: 0,
  data: {
    page: 0,
    size: 100,
    total: 2,
    totalPages: 1,
    content: [
      {
        recordIdx: 8253,
        roomIdx: 0,
        meetIdx: 80285,
        recordTitle: '영어',
        startDatetime: '20260831190737',
        endDatetime: '20260831191210',
        fileExist: true,
        detailInfo: '',
      },
      {
        recordIdx: 8251,
        roomIdx: 0,
        meetIdx: 80285,
        recordTitle: '영어',
        startDatetime: '20260831190630',
        endDatetime: '20260831190737',
        fileExist: true,
        detailInfo: '',
      },
    ],
  },
  success: true,
};

const AUTH = { baseUrl: 'https://svr.example', basicAuth: 'QUJD' };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

describe('BodaeduServerHttpClient — response envelope (FIX-260920)', () => {
  let client: BodaeduServerHttpClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    client = new BodaeduServerHttpClient({
      get: (_k: string, d?: unknown) => d,
    } as unknown as ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('listRecordings unwraps data.content (production payload)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(PROD_RECORDING_LIST));

    const out = await client.listRecordings(
      'tac-999cb70cff33462495f21f2218baa471',
      AUTH,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://svr.example/svr/record/log/video?searchType=ROOM&meetKey=tac-999cb70cff33462495f21f2218baa471&size=100',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Basic QUJD' }),
      }),
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      recordIdx: 8253,
      recordTitle: '영어',
      startDatetime: '20260831190737',
      endDatetime: '20260831191210',
      fileExist: true,
      meetIdx: '80285',
    });
    expect(out[1].recordIdx).toBe(8251);
  });

  it('listRecordings still accepts a bare (unwrapped) page object', async () => {
    fetchMock.mockResolvedValue(jsonResponse(PROD_RECORDING_LIST.data));
    const out = await client.listRecordings('tac-x', AUTH);
    expect(out.map((r) => r.recordIdx)).toEqual([8253, 8251]);
  });

  it('listRecordings returns [] when data.content is empty', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: { page: 0, size: 100, total: 0, totalPages: 0, content: [] },
      }),
    );
    expect(await client.listRecordings('tac-none', AUTH)).toEqual([]);
  });

  it('throws BodaeduUnavailableException when the envelope says success=false', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: false,
        errorCode: 'WB-403-201',
        errorName: 'AuthKeyMismatch',
      }),
    );
    await expect(client.listRecordings('tac-x', AUTH)).rejects.toBeInstanceOf(
      BodaeduUnavailableException,
    );
  });

  it('getJoinLog unwraps data.content and normalises KST datetimes', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          page: 0,
          size: 1000,
          total: 1,
          totalPages: 1,
          content: [
            {
              meetIdx: 80285,
              meetKey: 'tac-999cb70cff33462495f21f2218baa471',
              userId: 'u-1',
              userName: '김민',
              joinDatetime: '20260831190700',
              quitDatetime: '20260831205800',
              userTypeCd: 12,
              clientType: 'Windows',
            },
          ],
        },
      }),
    );

    const out = await client.getJoinLog(
      'tac-999cb70cff33462495f21f2218baa471',
      AUTH,
    );

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      userId: 'u-1',
      joinedAt: '2026-08-31T10:07:00.000Z',
      leftAt: '2026-08-31T11:58:00.000Z',
      clientType: 'Windows',
    });
  });

  it('getMeetInfo uses the meet result list and derives ENDED from endDatetime', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          page: 0,
          size: 10,
          total: 1,
          totalPages: 1,
          content: [
            {
              roomCode: '699',
              meetIdx: 80285,
              meetKey: 'tac-999cb70cff33462495f21f2218baa471',
              meetTitle: '영어',
              userCount: 2,
              openDatetime: '20260831185500',
              startDatetime: '20260831190200',
              endDatetime: '20260831205900',
            },
          ],
        },
      }),
    );

    const info = await client.getMeetInfo(
      'tac-999cb70cff33462495f21f2218baa471',
      AUTH,
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://svr.example/svr/meet/log/list?searchType=ROOM&meetKey=tac-999cb70cff33462495f21f2218baa471&size=10',
    );
    expect(info).toMatchObject({
      status: 'ENDED',
      meetIdx: '80285',
      openedAt: '2026-08-31T09:55:00.000Z',
      startedAt: '2026-08-31T10:02:00.000Z',
      endedAt: '2026-08-31T11:59:00.000Z',
      currentUserCount: 2,
    });
  });

  it('getMeetInfo derives STARTED when the meeting has no endDatetime yet', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          content: [
            {
              meetIdx: 1,
              openDatetime: '20260920150000',
              startDatetime: '20260920150200',
            },
          ],
        },
      }),
    );
    const info = await client.getMeetInfo('tac-live', AUTH);
    expect(info?.status).toBe('STARTED');
    expect(info?.endedAt).toBeNull();
  });

  it('getMeetInfo returns null when the room never started (empty list) or 404', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { content: [] } }),
    );
    expect(await client.getMeetInfo('tac-never', AUTH)).toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse(undefined, 404));
    expect(await client.getMeetInfo('tac-404', AUTH)).toBeNull();
  });

  it('treats 400 WB-400-2xx (unknown meetKey) as not found — null info, empty join log', async () => {
    // 프로덕션 실측(2026-09-20): 개설된 적 없는 meetKey 조회 →
    // 400 {"status":400,"errorCode":"WB-400-245","errorName":"WB-400-245","success":true}
    const notFound = () =>
      jsonResponse(
        {
          status: 400,
          errorCode: 'WB-400-245',
          errorName: 'WB-400-245',
          success: true,
        },
        400,
      );
    fetchMock.mockResolvedValueOnce(notFound());
    expect(await client.getMeetInfo('tac-never-opened', AUTH)).toBeNull();

    fetchMock.mockResolvedValueOnce(notFound());
    expect(await client.getJoinLog('tac-never-opened', AUTH)).toEqual([]);

    fetchMock.mockResolvedValueOnce(notFound());
    expect(await client.listRecordings('tac-never-opened', AUTH)).toEqual([]);
  });

  it('still raises BodaeduUnavailableException for other 400s', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { status: 400, errorCode: 'WB-400-155', errorName: 'TokenMissing' },
        400,
      ),
    );
    await expect(client.getMeetInfo('tac-x', AUTH)).rejects.toBeInstanceOf(
      BodaeduUnavailableException,
    );
  });

  it('getMeetInfo picks the latest meeting when the key was reused', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          content: [
            {
              meetIdx: 1,
              openDatetime: '20260901100000',
              endDatetime: '20260901110000',
            },
            {
              meetIdx: 2,
              openDatetime: '20260908100000',
              startDatetime: '20260908100100',
            },
          ],
        },
      }),
    );
    const info = await client.getMeetInfo('tac-reused', AUTH);
    expect(info?.meetIdx).toBe('2');
    expect(info?.status).toBe('STARTED');
  });
});
