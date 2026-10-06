import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Crown, MessageCircle, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  talkApi,
  type TalkChannel,
  type TalkMemberInput,
  type TalkMode,
} from "../api/talk-api";
import { useTalkIdentity } from "../hooks/use-talk-identity";

const memberKey = (member: TalkMemberInput) => `${member.kind}:${member.refId}`;
export function TalkParticipantsPanel({
  mode,
  channel,
  self,
  onOpenDm,
}: {
  mode: TalkMode;
  channel: TalkChannel;
  self: TalkMemberInput;
  onOpenDm: (channel: TalkChannel) => void;
}) {
  const { t, i18n } = useTranslation("common");
  const identity = useTalkIdentity(mode);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const owner = mode === "admin" && channel.type === "GROUP" && channel.mine;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TalkMemberInput[]>([]);
  const refresh = async (updated?: TalkChannel) => {
    if (updated)
      qc.setQueryData(["talk-channel", mode, identity, channel.id], updated);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["talk-channel", mode] }),
      qc.invalidateQueries({ queryKey: ["talk-channels", mode] }),
    ]);
  };
  const candidates = useQuery({
    queryKey: ["talk-invite-candidates", mode, identity, channel.id],
    queryFn: talkApi.candidates,
    enabled: owner && inviteOpen,
  });
  const eligible = (candidates.data ?? []).filter(
    (c) =>
      !channel.members.some((m) => memberKey(m) === memberKey(c)) &&
      c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const invite = useMutation({
    mutationFn: () => talkApi.inviteMembers(channel.id, selected),
    onSuccess: async (result) => {
      setInviteOpen(false);
      setSelected([]);
      await refresh(result);
    },
  });
  const remove = useMutation({
    mutationFn: (target: TalkMemberInput) =>
      talkApi.removeMember(channel.id, target),
    onSuccess: refresh,
  });
  const dm = useMutation({
    mutationFn: (target: TalkMemberInput) =>
      talkApi.memberDm(mode, channel.id, target),
    onSuccess: onOpenDm,
  });
  const busy = invite.isPending || remove.isPending || dm.isPending;
  const members = [...channel.members].sort(
    (a, b) =>
      Number(b.role === "OWNER") - Number(a.role === "OWNER") ||
      a.name.localeCompare(b.name, i18n.language),
  );
  return (
    <section
      className="rounded-lg border border-[var(--border-subtle)] bg-surface p-4"
      aria-label={t("talk.participantsTitle")}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">
          {t("talk.participantsTitle")} {members.length}
        </h2>
        {owner && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              invite.reset();
              setSearch("");
              setSelected([]);
              setInviteOpen(true);
            }}
          >
            <UserPlus size={14} className="mr-1" />
            {t("talk.inviteMembers")}
          </Button>
        )}
      </div>
      {(remove.isError || dm.isError) && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {t("talk.memberActionError")}
        </p>
      )}
      <ul className="max-h-[65vh] space-y-2 overflow-y-auto">
        {members.map((m) => {
          const isSelf = memberKey(m) === memberKey(self);
          return (
            <li
              key={memberKey(m)}
              className="rounded border border-[var(--border-subtle)] p-2"
            >
              <div className="flex min-w-0 items-center gap-1 text-sm font-medium">
                {channel.type === "GROUP" && m.role === "OWNER" && (
                  <Crown
                    size={15}
                    className="shrink-0 text-amber-600"
                    aria-label={t("talk.owner")}
                  />
                )}
                <span className="truncate" title={m.name}>
                  {m.name}
                </span>
                {isSelf && (
                  <span className="shrink-0 text-xs text-secondary">
                    ({t("talk.you")})
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-secondary">
                {t(
                  m.kind === "USER" ? "talk.kindOperator" : "talk.kindTeacher",
                )}
              </p>
              {!isSelf && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    aria-label={t("talk.dmMember", { name: m.name })}
                    onClick={() => {
                      remove.reset();
                      dm.mutate({ kind: m.kind, refId: m.refId });
                    }}
                  >
                    <MessageCircle size={12} className="mr-1" />
                    DM
                  </Button>
                  {owner && m.role !== "OWNER" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      aria-label={t("talk.removeMemberName", { name: m.name })}
                      onClick={async () => {
                        dm.reset();
                        const ok = await confirm({
                          title: t("talk.removeMember"),
                          description: t("talk.removeMemberConfirm", {
                            name: m.name,
                          }),
                          confirmLabel: t("talk.removeMember"),
                          variant: "destructive",
                        });
                        if (ok) remove.mutate({ kind: m.kind, refId: m.refId });
                      }}
                    >
                      <UserMinus size={12} className="mr-1" />
                      {t("talk.removeMember")}
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Dialog
        open={owner && inviteOpen}
        onOpenChange={(open) => {
          if (!invite.isPending) setInviteOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("talk.inviteMembers")}</DialogTitle>
          </DialogHeader>
          <input
            aria-label={t("talk.memberSearch")}
            placeholder={t("talk.memberSearch")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border p-2"
          />
          {candidates.isPending ? (
            <p role="status">{t("inbox.loading")}</p>
          ) : candidates.isError ? (
            <p role="alert">
              {t("talk.memberActionError")}{" "}
              <Button variant="outline" onClick={() => candidates.refetch()}>
                {t("inbox.retry")}
              </Button>
            </p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {!eligible.length && (
                <p className="py-4 text-sm text-secondary">
                  {t("talk.noInviteCandidates")}
                </p>
              )}
              {eligible.map((c) => (
                <label
                  key={memberKey(c)}
                  className="flex items-center gap-2 rounded border p-2 text-sm"
                >
                  <input
                    type="checkbox"
                    disabled={invite.isPending}
                    checked={selected.some(
                      (m) => memberKey(m) === memberKey(c),
                    )}
                    onChange={(e) =>
                      setSelected((values) =>
                        e.target.checked
                          ? [...values, { kind: c.kind, refId: c.refId }]
                          : values.filter((m) => memberKey(m) !== memberKey(c)),
                      )
                    }
                  />
                  {c.name} ·{" "}
                  {t(
                    c.kind === "USER"
                      ? "talk.kindOperator"
                      : "talk.kindTeacher",
                  )}
                </label>
              ))}
            </div>
          )}
          {invite.isError && (
            <p role="alert" className="text-sm text-red-600">
              {t("talk.memberActionError")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={invite.isPending}
              onClick={() => setInviteOpen(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              disabled={!selected.length || invite.isPending}
              onClick={() => invite.mutate()}
            >
              {t("talk.inviteSelected", { count: selected.length })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
