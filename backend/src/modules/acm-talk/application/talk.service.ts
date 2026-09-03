import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { ACM_DS } from '../../acm-common/datasource';
import { ObjectStoreClient } from '../../acm-csl/infrastructure/external/object-store.client';
import { TalkChannelTypeormEntity } from '../infrastructure/typeorm/talk-channel.typeorm-entity';
import {
  TalkMemberKind,
  TalkMemberTypeormEntity,
} from '../infrastructure/typeorm/talk-member.typeorm-entity';
import { TalkMessageTypeormEntity } from '../infrastructure/typeorm/talk-message.typeorm-entity';
import { TalkSseService } from './talk-sse.service';

/**
 * REQ-260728C — 로비채팅 (운영자↔강사, AMA amoeba-talk 참조).
 *
 * 규칙:
 *   • 대화방 개설/멤버관리/삭제 = 콘솔 운영자(USER)만 — 컨트롤러 @Roles 와 이중.
 *   • 강사(TEACHER)는 초대된 방에서 메시지/파일 송수신·읽음만.
 *   • DIRECT 는 동일 두 멤버 조합이면 기존 방 재사용 (find-or-create).
 *   • unread = 내가 보내지 않은 미삭제 메시지 중 last_read_at 이후 건수.
 */
const MAX_CONTENT = 2000;
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB (REQ-260728B 와 동일 한도)
const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/haansofthwp',
  'application/x-hwp',
  'application/vnd.hancom.hwp',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
];

export interface TalkActor {
  kind: TalkMemberKind;
  refId: string;
}

export interface TalkMemberInput {
  kind: TalkMemberKind;
  refId: string;
}

export interface TalkMemberView {
  kind: TalkMemberKind;
  refId: string;
  name: string;
  role: 'OWNER' | 'MEMBER';
}

export interface TalkChannelView {
  id: string;
  type: 'GROUP' | 'DIRECT';
  name: string;
  members: TalkMemberView[];
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  mine: boolean; // 내가 OWNER 인지
}

export interface TalkMessageView {
  id: string;
  channelId: string;
  type: 'TEXT' | 'FILE';
  content: string;
  filename: string | null;
  sizeBytes: number | null;
  senderKind: TalkMemberKind;
  /** REQ-260903C — SSE 수신측에서 mine 재계산용 발신자 refId. */
  senderRefId: string;
  senderName: string;
  mine: boolean;
  createdAt: string;
}

export interface TalkCandidateView {
  kind: TalkMemberKind;
  refId: string;
  name: string;
}

interface UploadFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

const actorKey = (a: { kind: TalkMemberKind; refId: string }) =>
  `${a.kind}:${a.refId}`;

@Injectable()
export class TalkService {
  constructor(
    @InjectRepository(TalkChannelTypeormEntity, ACM_DS)
    private readonly channelRepo: Repository<TalkChannelTypeormEntity>,
    @InjectRepository(TalkMemberTypeormEntity, ACM_DS)
    private readonly memberRepo: Repository<TalkMemberTypeormEntity>,
    @InjectRepository(TalkMessageTypeormEntity, ACM_DS)
    private readonly messageRepo: Repository<TalkMessageTypeormEntity>,
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly store: ObjectStoreClient,
    private readonly sse: TalkSseService,
  ) {}

  // ── Candidates (참여자 후보 = 운영자 + 강사) ──────────────────────────

  async listCandidates(entId: string): Promise<TalkCandidateView[]> {
    const operators: Array<{ ref_id: string; name: string }> =
      await this.ds.query(
        `SELECT usr_id AS ref_id, usr_name AS name FROM amb_acm_user
          WHERE ent_id = $1 AND usr_status = 'ACTIVE'
            AND usr_role IN ('ADMIN','APP_ADMIN')
          ORDER BY usr_name`,
        [entId],
      );
    const teachers: Array<{ ref_id: string; name: string }> =
      await this.ds.query(
        `SELECT tch_id AS ref_id, tch_name AS name FROM amb_acm_tch_teacher
          WHERE ent_id = $1 AND deleted_at IS NULL ORDER BY tch_name`,
        [entId],
      );
    return [
      ...operators.map((r) => ({
        kind: 'USER' as const,
        refId: r.ref_id,
        name: r.name,
      })),
      ...teachers.map((r) => ({
        kind: 'TEACHER' as const,
        refId: r.ref_id,
        name: r.name,
      })),
    ];
  }

  // ── Channels ──────────────────────────────────────────────────────────

  async listMyChannels(
    entId: string,
    actor: TalkActor,
  ): Promise<TalkChannelView[]> {
    const myMemberships = await this.memberRepo.find({
      where: {
        entId,
        kind: actor.kind,
        refId: actor.refId,
        leftAt: IsNull(),
      },
    });
    if (myMemberships.length === 0) return [];
    const channelIds = myMemberships.map((m) => m.channelId);
    const channels = await this.channelRepo.find({
      where: { entId, id: In(channelIds), deletedAt: IsNull() },
    });
    if (channels.length === 0) return [];
    const liveIds = channels.map((c) => c.id);

    const allMembers = await this.memberRepo.find({
      where: { entId, channelId: In(liveIds), leftAt: IsNull() },
    });
    const nameMap = await this.resolveNames(entId, allMembers);

    // 마지막 메시지 + unread 를 채널 단위로 집계 (아메바톡 unread 산정식).
    const lastRows: Array<{
      tlc_id: string;
      last_at: string;
      preview: string;
      msg_type: string;
    }> = await this.ds.query(
      `SELECT DISTINCT ON (tlc_id) tlc_id, created_at AS last_at,
              tms_content AS preview, tms_type AS msg_type
         FROM amb_acm_talk_message
        WHERE ent_id = $1 AND tlc_id = ANY($2::uuid[]) AND deleted_at IS NULL
        ORDER BY tlc_id, created_at DESC`,
      [entId, liveIds],
    );
    const lastByChannel = new Map(lastRows.map((r) => [r.tlc_id, r]));

    const unreadRows: Array<{ tlc_id: string; c: string }> = await this.ds.query(
      `SELECT m.tlc_id, COUNT(*)::text AS c
         FROM amb_acm_talk_message m
         JOIN amb_acm_talk_member me
           ON me.tlc_id = m.tlc_id AND me.ent_id = m.ent_id
          AND me.tlm_kind = $3 AND me.tlm_ref_id = $4 AND me.tlm_left_at IS NULL
        WHERE m.ent_id = $1 AND m.tlc_id = ANY($2::uuid[])
          AND m.deleted_at IS NULL
          AND NOT (m.tms_sender_kind = $3 AND m.tms_sender_ref = $4)
          AND (me.tlm_last_read_at IS NULL OR m.created_at > me.tlm_last_read_at)
        GROUP BY m.tlc_id`,
      [entId, liveIds, actor.kind, actor.refId],
    );
    const unreadByChannel = new Map(unreadRows.map((r) => [r.tlc_id, Number(r.c)]));

    const views = channels.map((c) => {
      const members = allMembers
        .filter((m) => m.channelId === c.id)
        .map((m) => ({
          kind: m.kind,
          refId: m.refId,
          name: nameMap.get(actorKey(m)) ?? '-',
          role: m.role,
        }));
      const last = lastByChannel.get(c.id);
      return {
        id: c.id,
        type: c.type,
        name: c.name,
        members,
        unreadCount: unreadByChannel.get(c.id) ?? 0,
        lastMessageAt: last ? new Date(last.last_at).toISOString() : null,
        lastMessagePreview: last
          ? last.msg_type === 'FILE'
            ? '📎'
            : last.preview.slice(0, 80)
          : null,
        mine: members.some(
          (m) =>
            m.role === 'OWNER' &&
            m.kind === actor.kind &&
            m.refId === actor.refId,
        ),
      };
    });
    // 최근 활동순 (메시지 없는 방은 뒤로).
    return views.sort((a, b) =>
      (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''),
    );
  }

  /** 단체방 개설 — 운영자 전용 (컨트롤러 @Roles 와 이중 게이트). */
  async createChannel(
    entId: string,
    operatorUserId: string,
    name: string,
    members: TalkMemberInput[],
  ): Promise<TalkChannelView> {
    const cleanName = (name ?? '').trim();
    if (!cleanName) throw new BadRequestException('NAME_REQUIRED');
    const cleanMembers = await this.validateMembers(entId, members, {
      kind: 'USER',
      refId: operatorUserId,
    });
    if (cleanMembers.length === 0) {
      throw new BadRequestException('MEMBER_REQUIRED');
    }

    const channel = await this.channelRepo.save(
      this.channelRepo.create({
        entId,
        type: 'GROUP',
        name: cleanName,
        createdBy: operatorUserId,
      }),
    );
    await this.memberRepo.save([
      this.memberRepo.create({
        entId,
        channelId: channel.id,
        kind: 'USER',
        refId: operatorUserId,
        role: 'OWNER',
      }),
      ...cleanMembers.map((m) =>
        this.memberRepo.create({
          entId,
          channelId: channel.id,
          kind: m.kind,
          refId: m.refId,
          role: 'MEMBER' as const,
        }),
      ),
    ]);
    await this.emitChannelUpdate(entId, channel.id);
    return this.getChannelView(entId, channel.id, {
      kind: 'USER',
      refId: operatorUserId,
    });
  }

  /** DM find-or-create — 운영자 전용. 동일 두 멤버 DIRECT 방 재사용. */
  async findOrCreateDm(
    entId: string,
    operatorUserId: string,
    target: TalkMemberInput,
  ): Promise<TalkChannelView> {
    const me: TalkActor = { kind: 'USER', refId: operatorUserId };
    if (target.kind === 'USER' && target.refId === operatorUserId) {
      throw new BadRequestException('CANNOT_DM_SELF');
    }
    const [cleanTarget] = await this.validateMembers(entId, [target], me);
    if (!cleanTarget) throw new BadRequestException('INVALID_TARGET');

    // 아메바톡 findOrCreateDm SQL 패턴 — 두 멤버가 동시 재적 중인 DIRECT 방.
    const rows: Array<{ tlc_id: string }> = await this.ds.query(
      `SELECT c.tlc_id
         FROM amb_acm_talk_channel c
         JOIN amb_acm_talk_member a
           ON a.tlc_id = c.tlc_id AND a.ent_id = c.ent_id AND a.tlm_left_at IS NULL
          AND a.tlm_kind = $2 AND a.tlm_ref_id = $3
         JOIN amb_acm_talk_member b
           ON b.tlc_id = c.tlc_id AND b.ent_id = c.ent_id AND b.tlm_left_at IS NULL
          AND b.tlm_kind = $4 AND b.tlm_ref_id = $5
        WHERE c.ent_id = $1 AND c.tlc_type = 'DIRECT' AND c.deleted_at IS NULL
        LIMIT 1`,
      [entId, 'USER', operatorUserId, cleanTarget.kind, cleanTarget.refId],
    );
    if (rows.length > 0) {
      return this.getChannelView(entId, rows[0].tlc_id, me);
    }

    const nameMap = await this.resolveNames(entId, [
      { kind: 'USER', refId: operatorUserId },
      cleanTarget,
    ]);
    const channel = await this.channelRepo.save(
      this.channelRepo.create({
        entId,
        type: 'DIRECT',
        name: `${nameMap.get(actorKey(me)) ?? '-'}, ${
          nameMap.get(actorKey(cleanTarget)) ?? '-'
        }`.slice(0, 100),
        createdBy: operatorUserId,
      }),
    );
    await this.memberRepo.save([
      this.memberRepo.create({
        entId,
        channelId: channel.id,
        kind: 'USER',
        refId: operatorUserId,
        role: 'OWNER',
      }),
      this.memberRepo.create({
        entId,
        channelId: channel.id,
        kind: cleanTarget.kind,
        refId: cleanTarget.refId,
        role: 'MEMBER',
      }),
    ]);
    await this.emitChannelUpdate(entId, channel.id);
    return this.getChannelView(entId, channel.id, me);
  }

  /** GROUP 멤버 교체(OWNER 제외 전체) — OWNER 운영자 전용. */
  async updateMembers(
    entId: string,
    operatorUserId: string,
    channelId: string,
    members: TalkMemberInput[],
  ): Promise<TalkChannelView> {
    const me: TalkActor = { kind: 'USER', refId: operatorUserId };
    const channel = await this.getOwnedChannel(entId, channelId, operatorUserId);
    if (channel.type !== 'GROUP') {
      throw new BadRequestException('DM_MEMBERS_FIXED');
    }
    const cleanMembers = await this.validateMembers(entId, members, me);
    if (cleanMembers.length === 0) {
      throw new BadRequestException('MEMBER_REQUIRED');
    }

    const current = await this.memberRepo.find({
      where: { entId, channelId, leftAt: IsNull() },
    });
    const nextKeys = new Set(cleanMembers.map(actorKey));
    const now = new Date();
    // 제외: OWNER 는 유지, 목록에 없는 MEMBER 는 left 처리.
    for (const m of current) {
      if (m.role === 'OWNER') continue;
      if (!nextKeys.has(actorKey(m))) {
        m.leftAt = now;
        await this.memberRepo.save(m);
      }
    }
    // 추가: 재적 중이 아닌 신규 멤버 삽입.
    const currentKeys = new Set(
      current.filter((m) => !m.leftAt).map((m) => actorKey(m)),
    );
    const toAdd = cleanMembers.filter((m) => !currentKeys.has(actorKey(m)));
    if (toAdd.length > 0) {
      await this.memberRepo.save(
        toAdd.map((m) =>
          this.memberRepo.create({
            entId,
            channelId,
            kind: m.kind,
            refId: m.refId,
            role: 'MEMBER' as const,
          }),
        ),
      );
    }
    await this.emitChannelUpdate(entId, channelId);
    return this.getChannelView(entId, channelId, me);
  }

  /** 방 삭제(soft) — OWNER 운영자 전용. */
  async deleteChannel(
    entId: string,
    operatorUserId: string,
    channelId: string,
  ): Promise<void> {
    const channel = await this.getOwnedChannel(entId, channelId, operatorUserId);
    // 삭제 이벤트는 삭제 전 멤버에게 전파.
    await this.emitChannelUpdate(entId, channelId);
    channel.deletedAt = new Date();
    await this.channelRepo.save(channel);
  }

  // ── Messages ──────────────────────────────────────────────────────────

  async listMessages(
    entId: string,
    actor: TalkActor,
    channelId: string,
    cursor?: string,
    limit = 50,
  ): Promise<{ messages: TalkMessageView[]; nextCursor: string | null }> {
    await this.assertMember(entId, channelId, actor);
    const take = Math.min(Math.max(limit, 1), 100);

    let cursorDate: Date | null = null;
    if (cursor) {
      const cursorMsg = await this.messageRepo.findOne({
        where: { id: cursor, entId, channelId },
      });
      if (cursorMsg) cursorDate = cursorMsg.createdAt;
    }

    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.entId = :entId AND m.channelId = :channelId', {
        entId,
        channelId,
      })
      .andWhere('m.deletedAt IS NULL')
      .orderBy('m.createdAt', 'DESC')
      .take(take + 1);
    if (cursorDate) {
      qb.andWhere('m.createdAt < :cursorDate', { cursorDate });
    }
    const rows = await qb.getMany();

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const nameMap = await this.resolveNames(
      entId,
      page.map((m) => ({ kind: m.senderKind, refId: m.senderRef })),
    );
    return {
      messages: page.map((m) => this.toMessageView(m, actor, nameMap)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async sendMessage(
    entId: string,
    actor: TalkActor,
    channelId: string,
    content: string,
  ): Promise<TalkMessageView> {
    await this.assertMember(entId, channelId, actor);
    const trimmed = (content ?? '').trim();
    if (!trimmed) throw new BadRequestException('EMPTY_MESSAGE');
    if (trimmed.length > MAX_CONTENT) {
      throw new BadRequestException('MESSAGE_TOO_LONG');
    }
    const saved = await this.messageRepo.save(
      this.messageRepo.create({
        entId,
        channelId,
        senderKind: actor.kind,
        senderRef: actor.refId,
        type: 'TEXT',
        content: trimmed,
      }),
    );
    await this.afterSend(entId, channelId, actor, saved);
    const nameMap = await this.resolveNames(entId, [actor]);
    return this.toMessageView(saved, actor, nameMap);
  }

  /** 파일 메시지 — 메시지당 1파일, ≤50MB, mime 허용목록. */
  async sendFile(
    entId: string,
    actor: TalkActor,
    channelId: string,
    file: UploadFile | undefined,
  ): Promise<TalkMessageView> {
    await this.assertMember(entId, channelId, actor);
    if (!file?.buffer?.length) throw new BadRequestException('EMPTY_FILE');
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('FILE_TOO_LARGE');
    }
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('MIME_NOT_ALLOWED');
    }

    // multer decodes originalname as latin1; re-encode to UTF-8.
    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safe = filename.replace(/[^\w.-]+/g, '_').slice(-120);
    const key = `talk/${entId}/${randomUUID()}-${safe}`;
    await this.store.putObject({ key, body: file.buffer, mime: file.mimetype });

    const saved = await this.messageRepo.save(
      this.messageRepo.create({
        entId,
        channelId,
        senderKind: actor.kind,
        senderRef: actor.refId,
        type: 'FILE',
        content: '',
        filename,
        mime: file.mimetype,
        sizeBytes: String(file.size),
        s3Key: key,
      }),
    );
    await this.afterSend(entId, channelId, actor, saved);
    const nameMap = await this.resolveNames(entId, [actor]);
    return this.toMessageView(saved, actor, nameMap);
  }

  async downloadFile(
    entId: string,
    actor: TalkActor,
    messageId: string,
  ): Promise<{ stream: Readable; mime: string; filename: string }> {
    const msg = await this.messageRepo.findOne({
      where: { id: messageId, entId, deletedAt: IsNull() },
    });
    if (!msg || msg.type !== 'FILE' || !msg.s3Key || !msg.filename) {
      throw new NotFoundException('FILE_NOT_FOUND');
    }
    await this.assertMember(entId, msg.channelId, actor);
    const obj = await this.store.getObjectStream(msg.s3Key);
    return {
      stream: obj.stream,
      mime: msg.mime ?? 'application/octet-stream',
      filename: msg.filename,
    };
  }

  async markRead(
    entId: string,
    actor: TalkActor,
    channelId: string,
  ): Promise<void> {
    const member = await this.memberRepo.findOne({
      where: {
        entId,
        channelId,
        kind: actor.kind,
        refId: actor.refId,
        leftAt: IsNull(),
      },
    });
    if (!member) throw new ForbiddenException('NOT_A_MEMBER');
    member.lastReadAt = new Date();
    await this.memberRepo.save(member);
  }

  /** 본인 메시지만 soft delete. */
  async deleteMessage(
    entId: string,
    actor: TalkActor,
    messageId: string,
  ): Promise<void> {
    const msg = await this.messageRepo.findOne({
      where: { id: messageId, entId, deletedAt: IsNull() },
    });
    if (!msg) throw new NotFoundException('MESSAGE_NOT_FOUND');
    if (msg.senderKind !== actor.kind || msg.senderRef !== actor.refId) {
      throw new ForbiddenException('NOT_SENDER');
    }
    msg.deletedAt = new Date();
    await this.messageRepo.save(msg);
    const keys = await this.memberKeys(entId, msg.channelId);
    this.sse.emit(entId, keys, {
      type: 'message:delete',
      channelId: msg.channelId,
      data: { messageId },
    });
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private async afterSend(
    entId: string,
    channelId: string,
    actor: TalkActor,
    saved: TalkMessageTypeormEntity,
  ): Promise<void> {
    // 발신자 읽음 포인터 갱신 (아메바톡과 동일).
    await this.memberRepo.update(
      { entId, channelId, kind: actor.kind, refId: actor.refId },
      { lastReadAt: new Date() },
    );
    const keys = await this.memberKeys(entId, channelId);
    const nameMap = await this.resolveNames(entId, [actor]);
    this.sse.emit(entId, keys, {
      type: 'message:new',
      channelId,
      data: this.toMessageView(saved, { kind: 'USER', refId: '' }, nameMap),
    });
  }

  private toMessageView(
    m: TalkMessageTypeormEntity,
    viewer: TalkActor,
    nameMap: Map<string, string>,
  ): TalkMessageView {
    return {
      id: m.id,
      channelId: m.channelId,
      type: m.type,
      content: m.content,
      filename: m.filename ?? null,
      sizeBytes: m.sizeBytes != null ? Number(m.sizeBytes) : null,
      senderKind: m.senderKind,
      senderRefId: m.senderRef,
      senderName:
        nameMap.get(actorKey({ kind: m.senderKind, refId: m.senderRef })) ?? '-',
      mine: m.senderKind === viewer.kind && m.senderRef === viewer.refId,
      createdAt: m.createdAt.toISOString(),
    };
  }

  private async memberKeys(entId: string, channelId: string): Promise<string[]> {
    const members = await this.memberRepo.find({
      where: { entId, channelId, leftAt: IsNull() },
    });
    return members.map((m) => actorKey(m));
  }

  private async emitChannelUpdate(
    entId: string,
    channelId: string,
  ): Promise<void> {
    const keys = await this.memberKeys(entId, channelId);
    this.sse.emit(entId, keys, { type: 'channel:update', channelId });
  }

  private async getChannelView(
    entId: string,
    channelId: string,
    actor: TalkActor,
  ): Promise<TalkChannelView> {
    const views = await this.listMyChannels(entId, actor);
    const view = views.find((v) => v.id === channelId);
    if (!view) throw new NotFoundException('CHANNEL_NOT_FOUND');
    return view;
  }

  private async getOwnedChannel(
    entId: string,
    channelId: string,
    operatorUserId: string,
  ): Promise<TalkChannelTypeormEntity> {
    const channel = await this.channelRepo.findOne({
      where: { id: channelId, entId, deletedAt: IsNull() },
    });
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    const owner = await this.memberRepo.findOne({
      where: {
        entId,
        channelId,
        kind: 'USER',
        refId: operatorUserId,
        role: 'OWNER',
        leftAt: IsNull(),
      },
    });
    if (!owner) throw new ForbiddenException('NOT_OWNER');
    return channel;
  }

  private async assertMember(
    entId: string,
    channelId: string,
    actor: TalkActor,
  ): Promise<void> {
    const channel = await this.channelRepo.findOne({
      where: { id: channelId, entId, deletedAt: IsNull() },
    });
    if (!channel) throw new NotFoundException('CHANNEL_NOT_FOUND');
    const member = await this.memberRepo.findOne({
      where: {
        entId,
        channelId,
        kind: actor.kind,
        refId: actor.refId,
        leftAt: IsNull(),
      },
    });
    if (!member) throw new ForbiddenException('NOT_A_MEMBER');
  }

  /** 멤버 입력 검증 — 본인 제외·중복 제거·실존(운영자/강사) 확인. */
  private async validateMembers(
    entId: string,
    members: TalkMemberInput[],
    self: TalkActor,
  ): Promise<TalkMemberInput[]> {
    const seen = new Set<string>();
    const out: TalkMemberInput[] = [];
    for (const m of members ?? []) {
      if (!m?.refId || (m.kind !== 'USER' && m.kind !== 'TEACHER')) continue;
      if (m.kind === self.kind && m.refId === self.refId) continue;
      const key = actorKey(m);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: m.kind, refId: m.refId });
    }
    const userIds = out.filter((m) => m.kind === 'USER').map((m) => m.refId);
    const teacherIds = out
      .filter((m) => m.kind === 'TEACHER')
      .map((m) => m.refId);
    if (userIds.length > 0) {
      const rows: Array<{ id: string }> = await this.ds.query(
        `SELECT usr_id AS id FROM amb_acm_user
          WHERE ent_id = $1 AND usr_id = ANY($2::uuid[])
            AND usr_status = 'ACTIVE' AND usr_role IN ('ADMIN','APP_ADMIN')`,
        [entId, userIds],
      );
      if (rows.length !== userIds.length) {
        throw new BadRequestException('INVALID_MEMBER');
      }
    }
    if (teacherIds.length > 0) {
      const rows: Array<{ id: string }> = await this.ds.query(
        `SELECT tch_id AS id FROM amb_acm_tch_teacher
          WHERE ent_id = $1 AND tch_id = ANY($2::uuid[]) AND deleted_at IS NULL`,
        [entId, teacherIds],
      );
      if (rows.length !== teacherIds.length) {
        throw new BadRequestException('INVALID_MEMBER');
      }
    }
    return out;
  }

  private async resolveNames(
    entId: string,
    refs: Array<{ kind: TalkMemberKind; refId: string }>,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const userIds = Array.from(
      new Set(refs.filter((r) => r.kind === 'USER').map((r) => r.refId)),
    );
    const teacherIds = Array.from(
      new Set(refs.filter((r) => r.kind === 'TEACHER').map((r) => r.refId)),
    );
    if (userIds.length > 0) {
      const rows: Array<{ id: string; name: string }> = await this.ds.query(
        `SELECT usr_id AS id, usr_name AS name FROM amb_acm_user
          WHERE ent_id = $1 AND usr_id = ANY($2::uuid[])`,
        [entId, userIds],
      );
      for (const r of rows) map.set(`USER:${r.id}`, r.name);
    }
    if (teacherIds.length > 0) {
      const rows: Array<{ id: string; name: string }> = await this.ds.query(
        `SELECT tch_id AS id, tch_name AS name FROM amb_acm_tch_teacher
          WHERE ent_id = $1 AND tch_id = ANY($2::uuid[])`,
        [entId, teacherIds],
      );
      for (const r of rows) map.set(`TEACHER:${r.id}`, r.name);
    }
    return map;
  }
}
