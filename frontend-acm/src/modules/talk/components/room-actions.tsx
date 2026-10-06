import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MoreHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { talkApi, type TalkChannel, type TalkMode } from "../api/talk-api";

export function RoomActions({
  mode,
  channel,
  onDismiss,
}: {
  mode: TalkMode;
  channel: TalkChannel;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const trigger = useRef<HTMLButtonElement>(null);
  const [action, setAction] = useState<"menu" | "rename" | "leave" | null>(
    null,
  );
  const [name, setName] = useState(channel.name);
  const [successor, setSuccessor] = useState("");
  const needsSuccessor =
    channel.type === "GROUP" && channel.mine && channel.members.length > 1;
  const successors = channel.members.filter(
    (m) => m.kind === "USER" && m.role !== "OWNER",
  );
  const change = useMutation({
    mutationFn: async (operation: "rename" | "archive" | "leave") => {
      if (operation === "rename") await talkApi.rename(channel.id, name.trim());
      else if (operation === "archive")
        await talkApi.archive(mode, channel.id, !channel.archived);
      else await talkApi.leave(mode, channel.id, successor || undefined);
      return operation;
    },
    onSuccess: async (operation) => {
      setAction(null);
      if (operation !== "rename") {
        qc.removeQueries({ queryKey: ["talk-messages", mode, channel.id] });
        qc.removeQueries({
          queryKey: ["talk-message-target", mode, channel.id],
        });
        onDismiss();
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["talk-channels", mode] }),
        qc.invalidateQueries({ queryKey: ["talk-channel", mode] }),
        qc.invalidateQueries({ queryKey: ["notification-inbox"] }),
      ]);
    },
  });
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={t("talk.roomActions")}
        aria-haspopup="dialog"
        className="rounded border p-1.5 hover:bg-gray-100"
        onClick={() => {
          change.reset();
          setName(channel.name);
          setSuccessor("");
          setAction("menu");
        }}
      >
        <MoreHorizontal size={18} />
      </button>
      <Dialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !change.isPending) setAction(null);
        }}
      >
        <DialogContent
          className="max-w-md"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(
                action === "rename"
                  ? "talk.renameRoom"
                  : action === "leave"
                    ? "talk.leaveRoom"
                    : "talk.roomActions",
              )}
            </DialogTitle>
          </DialogHeader>
          {change.isError && (
            <p role="alert" className="text-sm text-red-600">
              {t("talk.roomActionError")}
            </p>
          )}
          {action === "menu" && (
            <div className="flex flex-col gap-2">
              {mode === "admin" && channel.mine && channel.type === "GROUP" && (
                <Button variant="outline" onClick={() => setAction("rename")}>
                  {t("talk.renameRoom")}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={change.isPending}
                onClick={() => change.mutate("archive")}
              >
                {t(channel.archived ? "talk.restoreRoom" : "talk.archiveRoom")}
              </Button>
              <p className="text-xs text-secondary">{t("talk.archiveHelp")}</p>
              <Button variant="outline" onClick={() => setAction("leave")}>
                {t("talk.leaveRoom")}
              </Button>
            </div>
          )}
          {action === "rename" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim() && !change.isPending) change.mutate("rename");
              }}
            >
              <label className="block text-sm">
                {t("talk.roomName")}
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                  className="mt-1 w-full rounded border p-2"
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={change.isPending}
                  onClick={() => setAction(null)}
                >
                  {t("talk.cancelAction")}
                </Button>
                <Button disabled={!name.trim() || change.isPending}>
                  {t("talk.saveAction")}
                </Button>
              </div>
            </form>
          )}
          {action === "leave" && (
            <div className="space-y-3">
              <p className="text-sm">{t("talk.leaveHelp")}</p>
              {needsSuccessor &&
                (successors.length ? (
                  <label className="block text-sm">
                    {t("talk.successor")}
                    <select
                      value={successor}
                      onChange={(e) => setSuccessor(e.target.value)}
                      className="mt-1 w-full rounded border p-2"
                    >
                      <option value="">{t("talk.selectSuccessor")}</option>
                      {successors.map((m) => (
                        <option key={m.refId} value={m.refId}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p role="alert" className="text-sm text-amber-700">
                    {t("talk.inviteSuccessor")}
                  </p>
                ))}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={change.isPending}
                  onClick={() => setAction(null)}
                >
                  {t("talk.cancelAction")}
                </Button>
                <Button
                  disabled={change.isPending || (needsSuccessor && !successor)}
                  onClick={() => change.mutate("leave")}
                >
                  {t(
                    needsSuccessor ? "talk.transferAndLeave" : "talk.leaveRoom",
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
