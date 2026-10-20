import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { Item } from "./types";

/**
 * REQ-261019 — 목록의 [삭제]. 작성자·프로젝트 소유자/담당자·테넌트 마스터에게만 보인다(서버 can_delete).
 * ACM 에서만 삭제(소프트 삭제)하고 Google Drive 원본은 남긴다.
 */
export function DeleteItemButton({
  projectId,
  item,
  className,
  onDeleted,
}: {
  projectId: string;
  item: Item;
  className?: string;
  onDeleted?: () => void | Promise<void>;
}) {
  const { t } = useTranslation("common");
  const confirm = useConfirm();
  const toast = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!item.can_delete) return null;
  const google = !!item.drive_file_id || item.storage_type === "GOOGLE_LINK" || item.storage_type === "DRIVE_FILE";
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={t("itemDelete.button")}
      className={
        className ??
        "inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
      }
      onClick={async () => {
        const ok = await confirm({
          title: t("itemDelete.title", { name: item.pit_title }),
          description: google ? t("itemDelete.googleDesc") : t("itemDelete.localDesc"),
          confirmLabel: t("itemDelete.button"),
          variant: "destructive",
        });
        if (!ok) return;
        setBusy(true);
        try {
          await apiClient.delete(`/acm/prj/projects/${projectId}/items/${item.pit_id}`);
          await qc.invalidateQueries({ queryKey: ["prj"] });
          await onDeleted?.();
          toast.success(t("itemDelete.done"));
        } catch {
          toast.error(t("itemDelete.failed"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Trash2 size={14} />
      {t("itemDelete.button")}
    </button>
  );
}
