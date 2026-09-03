import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Download,
  Hash,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings2,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  talkApi,
  type TalkCandidate,
  type TalkChannel,
  type TalkMemberInput,
  type TalkMessage,
  type TalkMode,
} from '../api/talk-api';
import { useTalkEvents } from '../hooks/use-talk-events';

/**
 * REQ-260728C — 로비채팅 공용 UI (AMA amoeba-talk 레이아웃 참조).
 * mode='admin' → 개설/DM/멤버관리/방삭제 노출, mode='portal' → 참여 전용.
 */

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const kindBadgeCls = (kind: 'USER' | 'TEACHER') =>
  `rounded px-1 text-[9px] font-mono ${
    kind === 'USER'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-purple-100 text-purple-700'
  }`;

function KindBadge({ kind }: { kind: 'USER' | 'TEACHER' }) {
  const { t } = useTranslation('common');
  return (
    <span className={kindBadgeCls(kind)}>
      {kind === 'USER'
        ? t('talk.kindOperator', '운영자')
        : t('talk.kindTeacher', '강사')}
    </span>
  );
}

export function TalkChat({ mode }: { mode: TalkMode }) {
  const { t } = useTranslation('common');
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modal, setModal] = useState<'channel' | 'dm' | 'members' | null>(null);

  const { data: channels = [] } = useQuery({
    queryKey: ['talk-channels', mode],
    queryFn: () => talkApi.channels(mode),
    refetchInterval: 30_000, // SSE 백스톱
    refetchIntervalInBackground: true, // REQ-260903C — 백그라운드 탭 유지
  });

  // REQ-260903C — admin 은 AppShell 의 AdminRealtime 이 전역 구독(캐시 반영 포함)
  // 하므로 portal 모드에서만 로컬 구독한다.
  useTalkEvents(
    mode,
    (e) => {
      void qc.invalidateQueries({ queryKey: ['talk-channels', mode] });
      if (e.channelId) {
        void qc.invalidateQueries({
          queryKey: ['talk-messages', mode, e.channelId],
        });
      }
    },
    mode === 'portal',
  );

  const active = channels.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[420px] overflow-hidden rounded-md border border-[var(--border-subtle)] bg-surface">
      {/* 채널 목록 */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--border-subtle)]">
        {mode === 'admin' && (
          <div className="flex gap-1.5 border-b border-[var(--border-subtle)] p-2">
            <button
              type="button"
              onClick={() => setModal('channel')}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs text-accent-700 hover:bg-[var(--gray-50)]"
            >
              <Plus size={12} /> {t('talk.newChannel', '새 채널')}
            </button>
            <button
              type="button"
              onClick={() => setModal('dm')}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs text-accent-700 hover:bg-[var(--gray-50)]"
            >
              <Plus size={12} /> {t('talk.newDm', '새 DM')}
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-1.5">
          {channels.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-secondary">
              {t('talk.noChannels', '대화방이 없습니다.')}
            </p>
          ) : (
            channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                  c.id === activeId
                    ? 'bg-accent-600 text-white'
                    : 'text-primary hover:bg-[var(--gray-50)]'
                }`}
              >
                {c.type === 'GROUP' ? (
                  <Hash size={14} className="shrink-0 opacity-70" />
                ) : (
                  <User size={14} className="shrink-0 opacity-70" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{c.name}</span>
                  {c.lastMessagePreview && (
                    <span
                      className={`block truncate text-[11px] ${
                        c.id === activeId ? 'text-white/70' : 'text-secondary'
                      }`}
                    >
                      {c.lastMessagePreview}
                    </span>
                  )}
                </span>
                {c.unreadCount > 0 && (
                  <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {c.unreadCount > 99 ? '99+' : c.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* 대화창 */}
      {active ? (
        <ChatPane
          key={active.id}
          mode={mode}
          channel={active}
          onManageMembers={mode === 'admin' ? () => setModal('members') : undefined}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-secondary">
          <MessageCircle size={28} className="opacity-40" />
          <p className="text-sm">{t('talk.selectChannel', '대화방을 선택하세요.')}</p>
        </div>
      )}

      {/* admin 전용 모달 */}
      {mode === 'admin' && modal === 'channel' && (
        <ChannelModal
          onClose={() => setModal(null)}
          onCreated={(c) => {
            setModal(null);
            setActiveId(c.id);
            void qc.invalidateQueries({ queryKey: ['talk-channels', mode] });
          }}
        />
      )}
      {mode === 'admin' && modal === 'dm' && (
        <DmModal
          onClose={() => setModal(null)}
          onCreated={(c) => {
            setModal(null);
            setActiveId(c.id);
            void qc.invalidateQueries({ queryKey: ['talk-channels', mode] });
          }}
        />
      )}
      {mode === 'admin' && modal === 'members' && active && (
        <ChannelModal
          channel={active}
          onClose={() => setModal(null)}
          onCreated={() => {
            setModal(null);
            void qc.invalidateQueries({ queryKey: ['talk-channels', mode] });
          }}
        />
      )}
    </div>
  );
}

// ── 대화창 ──────────────────────────────────────────────────────────────

function ChatPane({
  mode,
  channel,
  onManageMembers,
}: {
  mode: TalkMode;
  channel: TalkChannel;
  onManageMembers?: () => void;
}) {
  const { t, i18n } = useTranslation('common');
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [older, setOlder] = useState<TalkMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['talk-messages', mode, channel.id],
    queryFn: () => talkApi.messages(mode, channel.id),
    refetchInterval: 30_000, // SSE 백스톱
    refetchIntervalInBackground: true, // REQ-260903C — 백그라운드 탭 유지
  });

  // 첫 페이지 로드 시 커서 초기화 (older 는 별도 유지, id 로 dedupe).
  useEffect(() => {
    if (data && nextCursor === null && older.length === 0) {
      setNextCursor(data.nextCursor);
    }
  }, [data, nextCursor, older.length]);

  const messages = useMemo(() => {
    const byId = new Map<string, TalkMessage>();
    for (const m of [...older, ...(data?.messages ?? [])]) byId.set(m.id, m);
    return Array.from(byId.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }, [older, data]);

  // 방 진입·새 메시지 수신 시 읽음 처리 + 하단 스크롤.
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!lastId) return;
    void talkApi.markRead(mode, channel.id).then(() => {
      void qc.invalidateQueries({ queryKey: ['talk-channels', mode] });
    });
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [mode, channel.id, lastId, qc]);

  const loadOlder = useMutation({
    mutationFn: () => talkApi.messages(mode, channel.id, nextCursor!),
    onSuccess: (res) => {
      setOlder((prev) => [...prev, ...res.messages]);
      setNextCursor(res.nextCursor);
    },
  });

  const send = useMutation({
    mutationFn: () => talkApi.send(mode, channel.id, text),
    onSuccess: () => {
      setText('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['talk-messages', mode, channel.id] });
      void qc.invalidateQueries({ queryKey: ['talk-channels', mode] });
    },
    onError: (e) => setError(errMsg(e)),
  });

  const sendFile = useMutation({
    mutationFn: (f: File) => talkApi.sendFile(mode, channel.id, f),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ['talk-messages', mode, channel.id] });
      void qc.invalidateQueries({ queryKey: ['talk-channels', mode] });
    },
    onError: (e) => setError(errMsg(e)),
  });

  const delMsg = useMutation({
    mutationFn: (id: string) => talkApi.deleteMessage(mode, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['talk-messages', mode, channel.id] }),
  });

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));

  const memberNames = channel.members.map((m) => m.name).join(', ');

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2.5">
        {channel.type === 'GROUP' ? <Hash size={15} /> : <User size={15} />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-primary">
            {channel.name}
          </div>
          <div className="truncate text-[11px] text-secondary">
            {t('talk.members', '참여자')} {channel.members.length} · {memberNames}
          </div>
        </div>
        {onManageMembers && channel.type === 'GROUP' && channel.mine && (
          <button
            type="button"
            onClick={onManageMembers}
            className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-xs text-accent-700 hover:bg-[var(--gray-50)]"
          >
            <Settings2 size={12} /> {t('talk.manageMembers', '멤버관리')}
          </button>
        )}
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {nextCursor && (
          <div className="text-center">
            <button
              type="button"
              disabled={loadOlder.isPending}
              onClick={() => loadOlder.mutate()}
              className="rounded-md border border-[var(--border-subtle)] px-3 py-1 text-xs text-secondary hover:bg-[var(--gray-50)] disabled:opacity-50"
            >
              {loadOlder.isPending ? (
                <Loader2 size={12} className="inline animate-spin" />
              ) : (
                t('talk.loadOlder', '이전 메시지 보기')
              )}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-secondary">
            {t('talk.noMessages', '아직 메시지가 없습니다.')}
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[75%] ${m.mine ? 'text-right' : ''}`}>
              {!m.mine && (
                <div className="mb-0.5 flex items-center gap-1 text-[11px] text-secondary">
                  <KindBadge kind={m.senderKind} />
                  <span className="font-medium text-primary">{m.senderName}</span>
                </div>
              )}
              <div
                className={`inline-block rounded-lg px-3 py-1.5 text-sm ${
                  m.mine
                    ? 'bg-accent-600 text-white'
                    : 'bg-[var(--gray-100)] text-primary'
                }`}
              >
                {m.type === 'FILE' ? (
                  <button
                    type="button"
                    onClick={() =>
                      void talkApi.downloadFile(mode, m.id, m.filename ?? 'file')
                    }
                    className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                  >
                    <Download size={13} />
                    <span className="max-w-[240px] truncate">{m.filename}</span>
                    {m.sizeBytes != null && (
                      <span className="opacity-70">({fmtBytes(m.sizeBytes)})</span>
                    )}
                  </button>
                ) : (
                  <span className="whitespace-pre-wrap break-words">
                    {m.content}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-secondary">
                <span className={m.mine ? 'ml-auto' : ''}>
                  {fmtTime(m.createdAt)}
                </span>
                {m.mine && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          t('talk.confirmDeleteMessage', '이 메시지를 삭제할까요?'),
                        )
                      )
                        delMsg.mutate(m.id);
                    }}
                    className="opacity-50 hover:opacity-100"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 컴포저 */}
      <div className="border-t border-[var(--border-subtle)] p-2.5">
        {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={sendFile.isPending}
            onClick={() => fileRef.current?.click()}
            title={t('talk.attachFile', '파일 전송 (≤50MB)')}
            className="rounded-md border border-[var(--border-subtle)] p-2 text-secondary hover:bg-[var(--gray-50)] disabled:opacity-50"
          >
            {sendFile.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Paperclip size={15} />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) sendFile.mutate(f);
              e.target.value = '';
            }}
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && text.trim())
                send.mutate();
            }}
            placeholder={t('talk.inputPlaceholder', '메시지 입력…')}
            className="h-9 flex-1 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm"
          />
          <button
            type="button"
            disabled={!text.trim() || send.isPending}
            onClick={() => send.mutate()}
            className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {send.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── admin 모달: 새 채널 / 멤버관리 (channel 전달 시 수정 모드) ─────────────

function ChannelModal({
  channel,
  onClose,
  onCreated,
}: {
  channel?: TalkChannel;
  onClose: () => void;
  onCreated: (c: TalkChannel) => void;
}) {
  const { t } = useTranslation('common');
  const isEdit = !!channel;
  const [name, setName] = useState(channel?.name ?? '');
  const [selected, setSelected] = useState<Map<string, TalkMemberInput>>(
    () =>
      new Map(
        (channel?.members ?? [])
          .filter((m) => m.role !== 'OWNER')
          .map((m) => [`${m.kind}:${m.refId}`, { kind: m.kind, refId: m.refId }]),
      ),
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      isEdit
        ? talkApi.updateMembers(channel.id, Array.from(selected.values()))
        : talkApi.createChannel(name, Array.from(selected.values())),
    onSuccess: onCreated,
    onError: (e) => setError(errMsg(e)),
  });

  return (
    <TalkModal
      title={isEdit ? t('talk.manageMembers', '멤버관리') : t('talk.newChannel', '새 채널')}
      onClose={onClose}
    >
      {!isEdit && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('talk.channelNamePlaceholder', '방 이름')}
          className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm"
        />
      )}
      <CandidatePicker
        multi
        selectedKeys={new Set(selected.keys())}
        onToggle={(c) => {
          const key = `${c.kind}:${c.refId}`;
          setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(key)) next.delete(key);
            else next.set(key, { kind: c.kind, refId: c.refId });
            return next;
          });
        }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-secondary"
        >
          {t('actions.cancel', '취소')}
        </button>
        <button
          type="button"
          disabled={(!isEdit && !name.trim()) || selected.size === 0 || save.isPending}
          onClick={() => save.mutate()}
          className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {save.isPending && <Loader2 size={13} className="animate-spin" />}
          {isEdit ? t('actions.save', '저장') : t('talk.create', '개설')}
        </button>
      </div>
    </TalkModal>
  );
}

function DmModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: TalkChannel) => void;
}) {
  const { t } = useTranslation('common');
  const [target, setTarget] = useState<TalkMemberInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () => talkApi.createDm(target!),
    onSuccess: onCreated,
    onError: (e) => setError(errMsg(e)),
  });

  return (
    <TalkModal title={t('talk.newDm', '새 DM')} onClose={onClose}>
      <CandidatePicker
        selectedKeys={
          new Set(target ? [`${target.kind}:${target.refId}`] : [])
        }
        onToggle={(c) => setTarget({ kind: c.kind, refId: c.refId })}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[11px] text-secondary">
        {t('talk.dmReuseHint', '같은 상대와의 기존 DM이 있으면 그 방으로 이동합니다.')}
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-secondary"
        >
          {t('actions.cancel', '취소')}
        </button>
        <button
          type="button"
          disabled={!target || start.isPending}
          onClick={() => start.mutate()}
          className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {start.isPending && <Loader2 size={13} className="animate-spin" />}
          {t('talk.startDm', '시작')}
        </button>
      </div>
    </TalkModal>
  );
}

function CandidatePicker({
  multi = false,
  selectedKeys,
  onToggle,
}: {
  multi?: boolean;
  selectedKeys: Set<string>;
  onToggle: (c: TalkCandidate) => void;
}) {
  const { t } = useTranslation('common');
  const [q, setQ] = useState('');
  const { data: candidates = [] } = useQuery({
    queryKey: ['talk-candidates'],
    queryFn: talkApi.candidates,
  });
  const filtered = candidates.filter(
    (c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 rounded border border-[var(--border-subtle)] bg-canvas px-2">
        <Search size={12} className="opacity-60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('talk.searchMember', '이름 검색 (운영자/강사)')}
          className="h-8 w-full bg-transparent text-xs focus:outline-none"
        />
      </div>
      <div className="max-h-48 overflow-y-auto rounded border border-[var(--border-subtle)]">
        {filtered.map((c) => {
          const key = `${c.kind}:${c.refId}`;
          const checked = selectedKeys.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(c)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[var(--gray-50)] ${
                checked ? 'bg-accent-50' : ''
              }`}
            >
              <input
                type={multi ? 'checkbox' : 'radio'}
                checked={checked}
                readOnly
                className="pointer-events-none"
              />
              <KindBadge kind={c.kind} />
              {c.name}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-2 py-2 text-xs text-secondary">
            {t('talk.noResult', '결과가 없습니다.')}
          </p>
        )}
      </div>
    </div>
  );
}

function TalkModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm space-y-3 rounded-lg bg-surface p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-primary">{title}</span>
          <button type="button" onClick={onClose} className="text-secondary">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? '요청에 실패했습니다.'
  );
}
