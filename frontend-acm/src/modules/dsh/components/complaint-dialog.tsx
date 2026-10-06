import type { Complaint } from "../types/complaint";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ComplaintSite = "COMMON" | "TPI" | "TRINITY" | "SANTACROCE";
const SITES: ComplaintSite[] = ["COMMON", "TPI", "TRINITY", "SANTACROCE"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearMonth: string;
  complaint?: Complaint;
  onSaved?: (statisticsPending: boolean) => void;
  /** PLN-260914B — preselect a site (from the site tab). */
  initialSite?: Exclude<ComplaintSite, "COMMON">;
}

interface FormInput {
  date: string;
  site: ComplaintSite;
  channel: "PHONE" | "EMAIL" | "CHAT" | "IN_PERSON" | "OTHER";
  severity: "LOW" | "MEDIUM" | "HIGH";
  subject?: string;
  description?: string;
  linkedQnaId?: string;
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function ComplaintDialog({
  open,
  onOpenChange,
  yearMonth,
  initialSite,
  complaint,
  onSaved,
}: Props) {
  const { t } = useTranslation("dsh");
  const qc = useQueryClient();
  const [qnaSearch, setQnaSearch] = useState("");
  const [savedWarning, setSavedWarning] = useState(false);
  const qna = useQuery({
    queryKey: ["dsh", "complaint-qna", qnaSearch],
    enabled: open,
    queryFn: async () =>
      (
        await apiClient.get<Array<{ id: string; subject: string }>>(
          "/acm/dsh/complaints/qna-options",
          { params: { search: qnaSearch } },
        )
      ).data,
  });

  const defaults = (): FormInput => ({
    date: complaint?.date ?? todayIso(),
    site: complaint?.site ?? initialSite ?? "COMMON",
    channel: complaint?.channel ?? "PHONE",
    severity: complaint?.severity ?? "MEDIUM",
    subject: complaint?.subject ?? "",
    description: complaint?.description ?? "",
    linkedQnaId: complaint?.linkedQnaId ?? "",
  });
  const { register, handleSubmit, reset } = useForm<FormInput>({
    defaultValues: defaults(),
  });

  useEffect(() => {
    if (open) {
      reset(defaults());
      setSavedWarning(false);
      setQnaSearch("");
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSite, complaint]);

  const mutation = useMutation({
    mutationFn: async (data: FormInput) => {
      const body = {
        date: data.date,
        channel: data.channel,
        severity: data.severity,
        subject: data.subject?.trim() || null,
        description: data.description?.trim() || null,
        linkedQnaId: data.linkedQnaId || null,
        site: data.site === "COMMON" ? null : data.site,
        ...(complaint ? { expectedUpdatedAt: complaint.updatedAt } : {}),
      };
      const response = complaint
        ? await apiClient.put(`/acm/dsh/complaints/${complaint.id}`, body)
        : await apiClient.post("/acm/dsh/complaints", body);
      return response.data as { statisticsPending?: boolean };
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["dsh", "complaints"] });
    },
    onSuccess: (result) => {
      onSaved?.(!!result.statisticsPending);
      if (result.statisticsPending) setSavedWarning(true);
      qc.invalidateQueries({ queryKey: ["dsh"] });
      qc.invalidateQueries({ queryKey: ["dsh", "grid", yearMonth] });
      qc.invalidateQueries({ queryKey: ["dsh", "complaints"] });
      reset(defaults());
      if (!result.statisticsPending) onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (mutation.isPending) return;
        if (!o) reset(defaults());
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t(complaint ? "complaint.manage.edit" : "complaint.title")}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="space-y-3"
        >
          <div>
            <Label>{t("complaint.date")}</Label>
            <Input
              aria-label={t("complaint.date")}
              type="date"
              required
              {...register("date", { required: true })}
            />
          </div>
          <div>
            <Label>{t("complaint.site")}</Label>
            <select
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm"
              aria-label={t("complaint.site")}
              {...register("site")}
            >
              {SITES.map((s) => (
                <option key={s} value={s}>
                  {t(`site.tabs.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("complaint.channel")}</Label>
            <select
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm"
              aria-label={t("complaint.channel")}
              {...register("channel")}
            >
              {(["PHONE", "EMAIL", "CHAT", "IN_PERSON", "OTHER"] as const).map(
                (c) => (
                  <option key={c} value={c}>
                    {t(`complaint.channels.${c}`)}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <Label>{t("complaint.severity")}</Label>
            <select
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm"
              aria-label={t("complaint.severity")}
              {...register("severity")}
            >
              {(["LOW", "MEDIUM", "HIGH"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`complaint.severities.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("complaint.subject")}</Label>
            <Input
              aria-label={t("complaint.subject")}
              maxLength={200}
              {...register("subject")}
            />
          </div>
          <div>
            <Label>{t("complaint.description")}</Label>
            <textarea
              aria-label={t("complaint.description")}
              className="w-full rounded-md border bg-surface p-3 text-sm"
              rows={5}
              maxLength={5000}
              {...register("description")}
            />
          </div>
          <div>
            <Label>{t("complaint.linkedQnaId")}</Label>
            <Input
              aria-label={t("complaint.manage.qnaSearch")}
              placeholder={t("complaint.manage.qnaSearch")}
              value={qnaSearch}
              onChange={(e) => setQnaSearch(e.target.value)}
            />
            <select
              aria-label={t("complaint.linkedQnaId")}
              className="mt-2 w-full rounded-md border bg-surface p-2 text-sm"
              {...register("linkedQnaId")}
            >
              <option value="">{t("complaint.manage.noLink")}</option>
              {complaint?.linkedQnaId &&
                !qna.data?.some((q) => q.id === complaint.linkedQnaId) && (
                  <option value={complaint.linkedQnaId}>
                    {t("complaint.manage.currentLink")}
                  </option>
                )}
              {qna.data?.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.subject}
                </option>
              ))}
            </select>
            {qna.isError && (
              <p role="alert">{t("complaint.manage.loadError")}</p>
            )}
          </div>
          {mutation.isError && (
            <p role="alert" className="text-sm text-red-600">
              {t(
                isAxiosError(mutation.error) &&
                  mutation.error.response?.status === 409
                  ? "complaint.manage.conflict"
                  : "complaint.manage.saveError",
              )}
            </p>
          )}
          {savedWarning && (
            <p role="status" className="text-sm text-amber-700">
              {t("complaint.manage.statisticsPending")}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending || savedWarning}>
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
