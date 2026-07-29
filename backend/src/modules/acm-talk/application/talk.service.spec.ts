import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TalkService } from './talk.service';

/** REQ-260728C — 로비채팅: 개설 권한·멤버십 접근제어·DM 재사용·전송 규칙. */
describe('TalkService', () => {
  function build(
    opts: {
      channel?: any;
      member?: any;
      members?: any[];
      message?: any;
      messages?: any[];
      dsRows?: (sql: string) => any[];
    } = {},
  ) {
    const channelRepo = {
      find: jest.fn().mockResolvedValue(opts.channel ? [opts.channel] : []),
      findOne: jest.fn().mockResolvedValue(opts.channel ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({
        id: 'chn-1',
        createdAt: new Date(),
        ...x,
      })),
    };
    const memberRepo = {
      find: jest.fn().mockResolvedValue(opts.members ?? []),
      findOne: jest.fn().mockResolvedValue(opts.member ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => x),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(opts.messages ?? []),
    };
    const messageRepo = {
      findOne: jest.fn().mockResolvedValue(opts.message ?? null),
      create: jest.fn((x: any) => x),
      save: jest.fn(async (x: any) => ({
        id: 'msg-1',
        createdAt: new Date(),
        ...x,
      })),
      createQueryBuilder: jest.fn(() => qb),
    };
    const ds = {
      query: jest.fn(async (sql: string) =>
        opts.dsRows ? opts.dsRows(sql) : [],
      ),
    };
    const store = {
      putObject: jest.fn().mockResolvedValue(undefined),
      getObjectStream: jest
        .fn()
        .mockResolvedValue({ stream: 'S', mime: 'application/pdf' }),
    };
    const sse = { emit: jest.fn(), subscribe: jest.fn() };
    const svc = new TalkService(
      channelRepo as any,
      memberRepo as any,
      messageRepo as any,
      ds as any,
      store as any,
      sse as any,
    );
    return { svc, channelRepo, memberRepo, messageRepo, ds, store, sse, qb };
  }

  const OP = 'op-1';
  const teacherRows = (sql: string) =>
    sql.includes('amb_acm_tch_teacher') ? [{ id: 't1', name: '김강사' }] : [];

  const groupChannel = (): any => ({
    id: 'chn-1',
    entId: 'e1',
    type: 'GROUP',
    name: '수학팀',
    createdBy: OP,
    createdAt: new Date(),
    deletedAt: null,
  });

  const activeMember = (over: Partial<any> = {}): any => ({
    id: 'mem-1',
    entId: 'e1',
    channelId: 'chn-1',
    kind: 'USER',
    refId: OP,
    role: 'OWNER',
    lastReadAt: null,
    leftAt: null,
    ...over,
  });

  const file = (
    over: Partial<{ size: number; mimetype: string }> = {},
  ): any => ({
    originalname: Buffer.from('자료.pdf', 'utf8').toString('latin1'),
    mimetype: over.mimetype ?? 'application/pdf',
    buffer: Buffer.from('x'),
    size: over.size ?? 1,
  });

  it('createChannel requires a name and at least one member', async () => {
    const { svc } = build();
    await expect(svc.createChannel('e1', OP, ' ', [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      svc.createChannel('e1', OP, '수학팀', []),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createChannel rejects a nonexistent member', async () => {
    const { svc } = build({ dsRows: () => [] });
    await expect(
      svc.createChannel('e1', OP, '수학팀', [
        { kind: 'TEACHER', refId: 'ghost' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createChannel saves the operator as OWNER + members', async () => {
    const { svc, memberRepo } = build({
      channel: groupChannel(),
      members: [activeMember(), activeMember({ kind: 'TEACHER', refId: 't1', role: 'MEMBER' })],
      dsRows: teacherRows,
    });
    await svc.createChannel('e1', OP, '수학팀', [
      { kind: 'TEACHER', refId: 't1' },
    ]);
    const saved = (memberRepo.save as jest.Mock).mock.calls[0][0];
    expect(saved).toEqual([
      expect.objectContaining({ kind: 'USER', refId: OP, role: 'OWNER' }),
      expect.objectContaining({ kind: 'TEACHER', refId: 't1', role: 'MEMBER' }),
    ]);
  });

  it('findOrCreateDm reuses an existing DIRECT channel', async () => {
    const dm: any = { ...groupChannel(), type: 'DIRECT', name: 'A, B' };
    const { svc, channelRepo } = build({
      channel: dm,
      members: [
        activeMember(),
        activeMember({ kind: 'TEACHER', refId: 't1', role: 'MEMBER' }),
      ],
      dsRows: (sql) =>
        sql.includes("tlc_type = 'DIRECT'")
          ? [{ tlc_id: 'chn-1' }]
          : teacherRows(sql),
    });
    const view = await svc.findOrCreateDm('e1', OP, {
      kind: 'TEACHER',
      refId: 't1',
    });
    expect(view.id).toBe('chn-1');
    expect(channelRepo.save).not.toHaveBeenCalled(); // 새 방 생성 없음
  });

  it('findOrCreateDm rejects self-DM', async () => {
    const { svc } = build();
    await expect(
      svc.findOrCreateDm('e1', OP, { kind: 'USER', refId: OP }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sendMessage forbids a non-member', async () => {
    const { svc } = build({ channel: groupChannel(), member: null });
    await expect(
      svc.sendMessage('e1', { kind: 'TEACHER', refId: 'tX' }, 'chn-1', 'hi'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sendMessage validates content and emits SSE + updates read pointer', async () => {
    const { svc, sse, memberRepo } = build({
      channel: groupChannel(),
      member: activeMember(),
      members: [activeMember()],
      dsRows: (sql) =>
        sql.includes('amb_acm_user') ? [{ id: OP, name: '박운영' }] : [],
    });
    await expect(
      svc.sendMessage('e1', { kind: 'USER', refId: OP }, 'chn-1', '  '),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.sendMessage('e1', { kind: 'USER', refId: OP }, 'chn-1', 'x'.repeat(2001)),
    ).rejects.toBeInstanceOf(BadRequestException);

    const view = await svc.sendMessage(
      'e1',
      { kind: 'USER', refId: OP },
      'chn-1',
      '안녕하세요',
    );
    expect(view).toMatchObject({ content: '안녕하세요', mine: true });
    expect(memberRepo.update).toHaveBeenCalled(); // 발신자 read 포인터
    expect(sse.emit).toHaveBeenCalledWith(
      'e1',
      ['USER:op-1'],
      expect.objectContaining({ type: 'message:new', channelId: 'chn-1' }),
    );
  });

  it('sendFile rejects a disallowed mime and oversize', async () => {
    const { svc } = build({ channel: groupChannel(), member: activeMember() });
    await expect(
      svc.sendFile(
        'e1',
        { kind: 'USER', refId: OP },
        'chn-1',
        file({ mimetype: 'application/x-msdownload' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.sendFile(
        'e1',
        { kind: 'USER', refId: OP },
        'chn-1',
        file({ size: 51 * 1024 * 1024 }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sendFile stores the object and saves a FILE message', async () => {
    const { svc, store, messageRepo } = build({
      channel: groupChannel(),
      member: activeMember(),
      members: [activeMember()],
      dsRows: (sql) =>
        sql.includes('amb_acm_user') ? [{ id: OP, name: '박운영' }] : [],
    });
    const view = await svc.sendFile(
      'e1',
      { kind: 'USER', refId: OP },
      'chn-1',
      file(),
    );
    expect(store.putObject).toHaveBeenCalled();
    expect(messageRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FILE', filename: '자료.pdf' }),
    );
    expect(view).toMatchObject({ type: 'FILE', filename: '자료.pdf' });
  });

  it('downloadFile requires channel membership', async () => {
    const { svc, memberRepo } = build({
      channel: groupChannel(),
      message: {
        id: 'msg-1',
        entId: 'e1',
        channelId: 'chn-1',
        type: 'FILE',
        s3Key: 'k',
        filename: 'f.pdf',
        mime: 'application/pdf',
        senderKind: 'USER',
        senderRef: OP,
        deletedAt: null,
      },
    });
    memberRepo.findOne.mockResolvedValue(null);
    await expect(
      svc.downloadFile('e1', { kind: 'TEACHER', refId: 'tX' }, 'msg-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deleteMessage is sender-only', async () => {
    const { svc } = build({
      message: {
        id: 'msg-1',
        entId: 'e1',
        channelId: 'chn-1',
        senderKind: 'USER',
        senderRef: OP,
        deletedAt: null,
      },
    });
    await expect(
      svc.deleteMessage('e1', { kind: 'TEACHER', refId: 't1' }, 'msg-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('markRead forbids a non-member', async () => {
    const { svc } = build({ member: null });
    await expect(
      svc.markRead('e1', { kind: 'TEACHER', refId: 'tX' }, 'chn-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listMessages paginates with a cursor (limit+1 → nextCursor)', async () => {
    const msgs = Array.from({ length: 3 }, (_, i) => ({
      id: `m${i}`,
      entId: 'e1',
      channelId: 'chn-1',
      type: 'TEXT',
      content: `msg ${i}`,
      senderKind: 'USER',
      senderRef: OP,
      createdAt: new Date(Date.now() - i * 1000),
      deletedAt: null,
    }));
    const { svc } = build({
      channel: groupChannel(),
      member: activeMember(),
      messages: msgs,
      dsRows: (sql) =>
        sql.includes('amb_acm_user') ? [{ id: OP, name: '박운영' }] : [],
    });
    const out = await svc.listMessages(
      'e1',
      { kind: 'USER', refId: OP },
      'chn-1',
      undefined,
      2,
    );
    expect(out.messages).toHaveLength(2);
    expect(out.nextCursor).toBe('m1');
  });

  it('updateMembers rejects DM member changes and non-owners', async () => {
    const dm: any = { ...groupChannel(), type: 'DIRECT' };
    const { svc, memberRepo } = build({ channel: dm, member: activeMember() });
    await expect(
      svc.updateMembers('e1', OP, 'chn-1', [{ kind: 'TEACHER', refId: 't1' }]),
    ).rejects.toBeInstanceOf(BadRequestException);

    const { svc: svc2, memberRepo: mr2 } = build({
      channel: groupChannel(),
      member: null, // not OWNER
    });
    void memberRepo;
    void mr2;
    await expect(
      svc2.updateMembers('e1', 'other-op', 'chn-1', [
        { kind: 'TEACHER', refId: 't1' },
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deleteChannel is owner-only and 404s on a missing channel', async () => {
    const { svc } = build({ channel: null });
    await expect(svc.deleteChannel('e1', OP, 'ghost')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
