import { createPortal } from "react-dom";
import { AdminSupportSlot } from "@/components/layout/admin-content-layout";
import { TalkParticipantsPanel } from "./talk-participants-panel";
import { useAuthStore } from "@/stores/auth.store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTalkIdentity } from "../hooks/use-talk-identity";
import { RoomActions } from "./room-actions";
import { useSearchParams } from "react-router-dom";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Download,
  Hash,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Search,
  Send,
  Crown,
  Users,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  talkApi,
  type TalkCandidate,
  type TalkChannel,
  type TalkMemberInput,
  type TalkMessage,
  type TalkMode,
} from "../api/talk-api";
import { useTalkEvents } from "../hooks/use-talk-events";
import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * REQ-260728C — 로비채팅 공용 UI (AMA amoeba-talk 레이아웃 참조).
 * Group owners manage members; both operators and teachers can DM room peers.
 */

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const kindBadgeCls = (kind: "USER" | "TEACHER") =>
  `rounded px-1 text-[9px] font-mono ${
    kind === "USER"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-purple-100 text-purple-700"
  }`;

function KindBadge({ kind }: { kind: "USER" | "TEACHER" }) {
  const { t } = useTranslation("common");
  return (
    <span className={kindBadgeCls(kind)}>
      {kind === "USER"
        ? t("talk.kindOperator", "운영자")
        : t("talk.kindTeacher", "강사")}
    </span>
  );
}

export function TalkChat({ mode }: { mode: TalkMode }) {
  const identity = useTalkIdentity(mode);
  const support = useContext(AdminSupportSlot);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const session = useAuthStore((s) =>
    mode === "admin" ? s.user : s.portal.user,
  );
  const self = session
    ? "refId" in session
      ? { kind: "TEACHER" as const, refId: session.refId }
      : { kind: "USER" as const, refId: session.id }
    : null;
  const [scope, setScope] = useState<"active" | "archived">("active");
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const linkedChannel = params.get("channelId");
  const linkedMessage = params.get("messageId");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modal, setModal] = useState<"channel" | "dm" | null>(null);

  const { data: channels = [] } = useQuery({
    queryKey: ["talk-channels", mode, identity, scope],
    queryFn: () => talkApi.channels(mode, scope),
    refetchInterval: 30_000, // SSE 백스톱
    refetchIntervalInBackground: true, // REQ-260903C — 백그라운드 탭 유지
  });

  // REQ-260903C — admin 은 AppShell 의 AdminRealtime 이 전역 구독(캐시 반영 포함)
  // 하므로 portal 모드에서만 로컬 구독한다.
  useTalkEvents(
    mode,
    (e) => {
      void qc.invalidateQueries({ queryKey: ["talk-channel", mode] });
      if (e.type === "channel:update") {
        void qc.invalidateQueries({ queryKey: ["notification-inbox"] });
        if (e.channelId)
          qc.removeQueries({
            queryKey: ["talk-message-target", mode, e.channelId],
          });
      }
      void qc.invalidateQueries({ queryKey: ["talk-channels", mode] });
      if (e.channelId) {
        void qc.invalidateQueries({
          queryKey: ["talk-messages", mode, e.channelId],
        });
      }
    },
    mode === "portal",
  );

  useEffect(() => {
    if (linkedChannel) setActiveId(linkedChannel);
  }, [linkedChannel]);
  const detail = useQuery({
    queryKey: ["talk-channel", mode, identity, activeId],
    queryFn: () => talkApi.channel(mode, activeId!),
    enabled: !!activeId,
    retry: false,
    refetchInterval: 30000,
  });
  const active = detail.isError
    ? null
    : (detail.data ?? channels.find((c) => c.id === activeId) ?? null);
  const clearActive = () => {
    setActiveId(null);
    setParams({});
  };
  const previousIdentity = useRef(identity);
  useEffect(() => {
    if (previousIdentity.current !== identity) {
      setActiveId(null);
      setParams({});
      previousIdentity.current = identity;
    }
  }, [identity, setParams]);

  const onOpenDm = (channel: TalkChannel) => {
    setScope("active");
    setParams({});
    setActiveId(channel.id);
    setParticipantsOpen(false);
    qc.setQueryData(["talk-channel", mode, identity, channel.id], channel);
    void qc.invalidateQueries({ queryKey: ["talk-channels", mode] });
  };
  const participants =
    active && self ? (
      <TalkParticipantsPanel
        key={identity + active.id}
        mode={mode}
        channel={active}
        self={self}
        onOpenDm={onOpenDm}
      />
    ) : (
      <p className="rounded-lg border bg-surface p-4 text-sm text-secondary">
        {t("talk.selectChannel")}
      </p>
    );

  return (
    <>
      {mode === "admin" &&
        support?.target &&
        createPortal(participants, support.target)}
      {mode === "portal" && (
        <Dialog open={participantsOpen} onOpenChange={setParticipantsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("talk.participantsTitle")}</DialogTitle>
            </DialogHeader>
            {participants}
          </DialogContent>
        </Dialog>
      )}
      <div
        className={`${mode === "admin" ? "admin-chat-layout " : ""}flex h-[calc(100vh-190px)] min-h-[420px] overflow-hidden rounded-md border border-[var(--border-subtle)] bg-surface`}
      >
        {/* 채널 목록 */}
        <aside
          className={`${activeId ? "hidden md:flex" : "flex"} w-full md:w-60 shrink-0 flex-col border-r border-[var(--border-subtle)]`}
        >
          {mode === "admin" && (
            <div className="flex gap-1.5 border-b border-[var(--border-subtle)] p-2">
              <button
                type="button"
                onClick={() => setModal("channel")}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs text-accent-700 hover:bg-[var(--gray-50)]"
              >
                <Plus size={12} /> {t("talk.newChannel", "새 채널")}
              </button>
              <button
                type="button"
                onClick={() => setModal("dm")}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1.5 text-xs text-accent-700 hover:bg-[var(--gray-50)]"
              >
                <Plus size={12} /> {t("talk.newDm", "새 DM")}
              </button>
            </div>
          )}
          <div className="flex gap-2 border-b p-2">
            {(["active", "archived"] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={scope === value}
                className={`rounded px-2 py-1 text-sm ${scope === value ? "bg-blue-100 text-blue-800" : ""}`}
                onClick={() => {
                  setScope(value);
                  clearActive();
                }}
              >
                {t(value === "active" ? "talk.rooms" : "talk.archivedRooms")}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {channels.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-secondary">
                {t("talk.noChannels", "대화방이 없습니다.")}
              </p>
            ) : (
              channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveId(c.id);
                    setParams({});
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                    c.id === activeId
                      ? "bg-accent-600 text-white"
                      : "text-primary hover:bg-[var(--gray-50)]"
                  }`}
                >
                  {c.type === "GROUP" ? (
                    <Hash size={14} className="shrink-0 opacity-70" />
                  ) : (
                    <User size={14} className="shrink-0 opacity-70" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{c.name}</span>
                    {c.type === "GROUP" &&
                      c.members.find((m) => m.role === "OWNER") && (
                        <span
                          className="flex items-center gap-1 truncate text-[11px]"
                          title={t("talk.ownerName", {
                            name: c.members.find((m) => m.role === "OWNER")!
                              .name,
                          })}
                        >
                          <Crown size={12} aria-label={t("talk.owner")} />
                          {c.members.find((m) => m.role === "OWNER")!.name}
                          {c.mine ? ` (${t("talk.you")})` : ""}
                        </span>
                      )}
                    {c.lastMessagePreview && (
                      <span
                        className={`block truncate text-[11px] ${
                          c.id === activeId ? "text-white/70" : "text-secondary"
                        }`}
                      >
                        {c.lastMessagePreview}
                      </span>
                    )}
                  </span>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {c.unreadCount > 99 ? "99+" : c.unreadCount}
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
            key={identity + active.id}
            mode={mode}
            channel={active}
            onDismiss={clearActive}
            targetMessageId={linkedChannel === active.id ? linkedMessage : null}
            onShowParticipants={() =>
              mode === "admin" ? support?.show() : setParticipantsOpen(true)
            }
          />
        ) : (
          <div
            className={`${activeId ? "flex" : "hidden md:flex"} flex-1 flex-col items-center justify-center gap-2 text-secondary`}
          >
            {activeId && (
              <button type="button" onClick={clearActive}>
                {t("talk.backToRooms")}
              </button>
            )}
            <MessageCircle size={28} className="opacity-40" />
            <p className="text-sm">
              {detail.isError
                ? t("inbox.unavailable")
                : t("talk.selectChannel", "대화방을 선택하세요.")}
            </p>
          </div>
        )}

        {/* admin 전용 모달 */}
        {mode === "admin" && modal === "channel" && (
          <ChannelModal
            onClose={() => setModal(null)}
            onCreated={(c) => {
              setModal(null);
              setActiveId(c.id);
              void qc.invalidateQueries({ queryKey: ["talk-channels", mode] });
              void qc.invalidateQueries({ queryKey: ["talk-channel", mode] });
            }}
          />
        )}
        {mode === "admin" && modal === "dm" && (
          <DmModal
            onClose={() => setModal(null)}
            onCreated={(c) => {
              setModal(null);
              setActiveId(c.id);
              void qc.invalidateQueries({ queryKey: ["talk-channels", mode] });
              void qc.invalidateQueries({ queryKey: ["talk-channel", mode] });
            }}
          />
        )}
      </div>
    </>
  );
}

// ── 대화창 ──────────────────────────────────────────────────────────────

function ChatPane({
  mode,
  channel,
  onShowParticipants,
  onDismiss,
  targetMessageId,
}: {
  mode: TalkMode;
  channel: TalkChannel;
  onShowParticipants: () => void;
  onDismiss: () => void;
  targetMessageId?: string | null;
}) {
  const identity = useTalkIdentity(mode);
  const { t, i18n } = useTranslation("common");
  const confirm = useConfirm();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<
    (TalkMemberInput & { name: string })[]
  >([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const target = useQuery({
    queryKey: [
      "talk-message-target",
      mode,
      channel.id,
      identity,
      targetMessageId,
    ],
    queryFn: () => talkApi.message(mode, channel.id, targetMessageId!),
    enabled: !!targetMessageId,
    retry: false,
  });
  const mentionQuery = text.match(/(?:^|\s)@([^@\n]*)$/)?.[1];
  const candidates =
    mentionDismissed || mentionQuery === undefined
      ? []
      : channel.members
          .filter((m) =>
            m.name.toLowerCase().includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 20);
  const selectMention = (m: (typeof channel.members)[number]) => {
    setText((v) => v.replace(/@[^@\n]*$/, `@${m.name} `));
    setMentions((v) =>
      v.some((x) => x.kind === m.kind && x.refId === m.refId)
        ? v
        : [...v, { kind: m.kind, refId: m.refId, name: m.name }],
    );
    setMentionIndex(0);
    inputRef.current?.focus();
  };
  useEffect(() => {
    if (target.data) targetRef.current?.scrollIntoView({ block: "center" });
  }, [target.data]);
  const [older, setOlder] = useState<TalkMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["talk-messages", mode, channel.id, identity],
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
    void talkApi
      .markRead(mode, channel.id)
      .then(() => {
        void qc.invalidateQueries({ queryKey: ["talk-channels", mode] });
      })
      .catch(() => undefined);
    if (!targetMessageId) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [mode, channel.id, lastId, qc, targetMessageId]);

  const loadOlder = useMutation({
    mutationFn: () => talkApi.messages(mode, channel.id, nextCursor!),
    onSuccess: (res) => {
      setOlder((prev) => [...prev, ...res.messages]);
      setNextCursor(res.nextCursor);
    },
  });

  const send = useMutation({
    mutationFn: () =>
      talkApi.send(
        mode,
        channel.id,
        text,
        mentions
          .filter((m) => text.includes("@" + m.name))
          .map(({ kind, refId }) => ({ kind, refId })),
      ),
    onSuccess: () => {
      setText("");
      setMentions([]);
      setError(null);
      void qc.invalidateQueries({
        queryKey: ["talk-messages", mode, channel.id],
      });
      void qc.invalidateQueries({ queryKey: ["talk-channels", mode] });
    },
    onError: (e) => setError(errMsg(e)),
  });

  const sendFile = useMutation({
    mutationFn: (f: File) => talkApi.sendFile(mode, channel.id, f),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({
        queryKey: ["talk-messages", mode, channel.id],
      });
      void qc.invalidateQueries({ queryKey: ["talk-channels", mode] });
    },
    onError: (e) => setError(errMsg(e)),
  });

  const delMsg = useMutation({
    mutationFn: (id: string) => talkApi.deleteMessage(mode, id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["talk-messages", mode, channel.id] }),
  });

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  const memberNames = channel.members.map((m) => m.name).join(", ");

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2.5">
        <button type="button" onClick={onDismiss} className="md:hidden text-xs">
          {t("talk.backToRooms")}
        </button>
        {channel.type === "GROUP" ? <Hash size={15} /> : <User size={15} />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-primary">
            {channel.name}
          </div>
          <div className="truncate text-[11px] text-secondary">
            {t("talk.members", "참여자")} {channel.members.length} ·{" "}
            {memberNames}
          </div>
        </div>
        <button
          type="button"
          onClick={onShowParticipants}
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
        >
          <Users size={14} />
          {t("talk.participantsTitle")} {channel.members.length}
        </button>
        <RoomActions mode={mode} channel={channel} onDismiss={onDismiss} />
      </div>

      {targetMessageId && (
        <div ref={targetRef} className="border-b bg-amber-50 p-3" tabIndex={-1}>
          <strong>{t("inbox.mentionedMessage")}</strong>
          {target.isPending ? (
            <p>{t("inbox.loading")}</p>
          ) : target.isError ? (
            <p role="alert">{t("inbox.unavailable")}</p>
          ) : (
            <p className="whitespace-pre-wrap break-words">
              {target.data?.senderName}: {target.data?.content}
            </p>
          )}
        </div>
      )}
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
                t("talk.loadOlder", "이전 메시지 보기")
              )}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-secondary">
            {t("talk.noMessages", "아직 메시지가 없습니다.")}
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[75%] ${m.mine ? "text-right" : ""}`}>
              {!m.mine && (
                <div className="mb-0.5 flex items-center gap-1 text-[11px] text-secondary">
                  <KindBadge kind={m.senderKind} />
                  <span className="font-medium text-primary">
                    {m.senderName}
                  </span>
                </div>
              )}
              <div
                className={`inline-block rounded-lg px-3 py-1.5 text-sm ${
                  m.mine
                    ? "bg-accent-600 text-white"
                    : "bg-[var(--gray-100)] text-primary"
                }`}
              >
                {m.type === "FILE" ? (
                  <button
                    type="button"
                    onClick={() =>
                      void talkApi.downloadFile(
                        mode,
                        m.id,
                        m.filename ?? "file",
                      )
                    }
                    className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                  >
                    <Download size={13} />
                    <span className="max-w-[240px] truncate">{m.filename}</span>
                    {m.sizeBytes != null && (
                      <span className="opacity-70">
                        ({fmtBytes(m.sizeBytes)})
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="whitespace-pre-wrap break-words">
                    {m.content}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-secondary">
                <span className={m.mine ? "ml-auto" : ""}>
                  {fmtTime(m.createdAt)}
                </span>
                {m.mine && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: t(
                          "talk.confirmDeleteMessage",
                          "이 메시지를 삭제할까요?",
                        ),
                        variant: "destructive",
                      });
                      if (ok) delMsg.mutate(m.id);
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

      {!channel.canSend && (
        <p role="status" className="border-t p-3 text-sm text-secondary">
          {t("talk.participantLeft")}
        </p>
      )}
      {/* 컴포저 */}
      <div className="border-t border-[var(--border-subtle)] p-2.5">
        {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
        {candidates.length > 0 && (
          <div
            role="listbox"
            aria-label={t("inbox.mention")}
            className="max-h-40 overflow-y-auto rounded border bg-surface"
          >
            {candidates.map((m, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === mentionIndex}
                id={`mention-${index}`}
                key={m.kind + ":" + m.refId}
                className={`block w-full px-3 py-2 text-left text-sm ${index === mentionIndex ? "bg-blue-50" : ""}`}
                onClick={() => selectMention(m)}
              >
                {m.name} ·{" "}
                {t(
                  m.kind === "USER" ? "talk.kindOperator" : "talk.kindTeacher",
                )}
              </button>
            ))}
          </div>
        )}
        {mentions.filter((m) => text.includes("@" + m.name)).length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1">
            {mentions
              .filter((m) => text.includes("@" + m.name))
              .map((m) => (
                <button
                  type="button"
                  key={m.kind + ":" + m.refId}
                  className="rounded bg-blue-50 px-2 text-xs"
                  aria-label={`${t("inbox.removeMention")} ${m.name}`}
                  onClick={() =>
                    setMentions((v) =>
                      v.filter((x) => x.kind !== m.kind || x.refId !== m.refId),
                    )
                  }
                >
                  @{m.name} ·{" "}
                  {t(
                    m.kind === "USER"
                      ? "talk.kindOperator"
                      : "talk.kindTeacher",
                  )}{" "}
                  ×
                </button>
              ))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!channel.canSend || sendFile.isPending}
            onClick={() => fileRef.current?.click()}
            title={t("talk.attachFile", "파일 전송 (≤50MB)")}
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
              e.target.value = "";
            }}
          />
          <input
            ref={inputRef}
            disabled={!channel.canSend}
            aria-label={t("talk.inputPlaceholder")}
            aria-autocomplete="list"
            aria-activedescendant={
              candidates.length ? `mention-${mentionIndex}` : undefined
            }
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setMentionDismissed(false);
              setMentionIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Escape") {
                setMentionDismissed(true);
                return;
              }
              if (
                candidates.length &&
                ["ArrowDown", "ArrowUp", "Enter"].includes(e.key)
              ) {
                e.preventDefault();
                if (e.key === "Enter")
                  selectMention(
                    candidates[Math.min(mentionIndex, candidates.length - 1)],
                  );
                else
                  setMentionIndex(
                    (i) =>
                      (i +
                        (e.key === "ArrowDown" ? 1 : candidates.length - 1)) %
                      candidates.length,
                  );
                return;
              }
              if (e.key === "Enter" && !send.isPending && text.trim())
                send.mutate();
            }}
            placeholder={t("talk.inputPlaceholder", "메시지 입력…")}
            className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm"
          />
          <button
            type="button"
            disabled={!channel.canSend || !text.trim() || send.isPending}
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

// ── admin 모달: 새 채널 ─────────────

function ChannelModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: TalkChannel) => void;
}) {
  const { t } = useTranslation("common");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Map<string, TalkMemberInput>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      talkApi.createChannel(name, Array.from(selected.values())),
    onSuccess: onCreated,
    onError: (e) => setError(errMsg(e)),
  });

  return (
    <TalkModal title={t("talk.newChannel", "새 채널")} onClose={onClose}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("talk.channelNamePlaceholder", "방 이름")}
        className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm"
      />
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
          {t("actions.cancel", "취소")}
        </button>
        <button
          type="button"
          disabled={!name.trim() || selected.size === 0 || save.isPending}
          onClick={() => save.mutate()}
          className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {save.isPending && <Loader2 size={13} className="animate-spin" />}
          {t("talk.create", "개설")}
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
  const { t } = useTranslation("common");
  const [target, setTarget] = useState<TalkMemberInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () => talkApi.createDm(target!),
    onSuccess: onCreated,
    onError: (e) => setError(errMsg(e)),
  });

  return (
    <TalkModal title={t("talk.newDm", "새 DM")} onClose={onClose}>
      <CandidatePicker
        selectedKeys={new Set(target ? [`${target.kind}:${target.refId}`] : [])}
        onToggle={(c) => setTarget({ kind: c.kind, refId: c.refId })}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[11px] text-secondary">
        {t(
          "talk.dmReuseHint",
          "같은 상대와의 기존 DM이 있으면 그 방으로 이동합니다.",
        )}
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-secondary"
        >
          {t("actions.cancel", "취소")}
        </button>
        <button
          type="button"
          disabled={!target || start.isPending}
          onClick={() => start.mutate()}
          className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {start.isPending && <Loader2 size={13} className="animate-spin" />}
          {t("talk.startDm", "시작")}
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
  const { t } = useTranslation("common");
  const [q, setQ] = useState("");
  const { data: candidates = [] } = useQuery({
    queryKey: ["talk-candidates"],
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
          placeholder={t("talk.searchMember", "이름 검색 (운영자/강사)")}
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
                checked ? "bg-accent-50" : ""
              }`}
            >
              <input
                type={multi ? "checkbox" : "radio"}
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
            {t("talk.noResult", "결과가 없습니다.")}
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
      ?.message ?? "요청에 실패했습니다."
  );
}
