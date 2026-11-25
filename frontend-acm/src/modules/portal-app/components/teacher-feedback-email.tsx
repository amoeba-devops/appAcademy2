import { useAuthStore } from "@/stores/auth.store";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Recipient = { stdId: string; parId: string };
type Result = Recipient & { status: string };
export function TeacherFeedbackEmail({
  evtId,
  version,
  disabled,
}: {
  evtId: string;
  version: string;
  disabled: boolean;
}) {
  const { t } = useTranslation("common");
  const identity = useAuthStore(
    (s) => `${s.portal.user?.entId}:${s.portal.user?.refId}`,
  );
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, Recipient>>({});
  const [requestId, setRequestId] = useState("");
  // REQ-261125-CAL2 — 발송 완료 안내 (모달을 닫은 뒤 버튼 옆에 잠시 표시)
  const [doneNotice, setDoneNotice] = useState(false);
  useEffect(() => {
    if (!doneNotice) return;
    const id = window.setTimeout(() => setDoneNotice(false), 5000);
    return () => window.clearTimeout(id);
  }, [doneNotice]);
  // 이력에 학부모 이름을 보이려고 수신자 목록은 항상 조회한다.
  const q = useQuery({
    queryKey: ["portal-feedback-recipients", identity, evtId],
    queryFn: async () =>
      (
        await apiClient.get<{
          smtpConfigured: boolean;
          hasFeedback: boolean;
          students: {
            stdId: string;
            stdName: string;
            parents: { parId: string; name: string; email: string | null }[];
          }[];
        }>(`/portal/cal/events/${evtId}/review/recipients`)
      ).data,
  });
  const history = useQuery({
    queryKey: ["portal-feedback-history", identity, evtId],
    queryFn: async () =>
      (
        await apiClient.get<
          { createdAt: string; result: { results: Result[] } | null }[]
        >(`/portal/cal/events/${evtId}/review/email-history`)
      ).data,
  });
  const send = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ results: Result[] }>(
          `/portal/cal/events/${evtId}/review/send-email`,
          {
            recipients: Object.values(selected),
            requestId,
            expectedUpdatedAt: version,
          },
        )
      ).data,
    onSettled: () => {
      void history.refetch();
    },
    // REQ-261125-CAL2 — 전원 성공이면 "발송완료되었습니다" 후 모달 닫기. 실패가 있으면 결과·재발송을 위해 유지.
    onSuccess: (data) => {
      if (data.results.some((x) => x.status === "FAILED")) return;
      setDoneNotice(true);
      window.setTimeout(() => setOpen(false), 1200);
    },
  });
  const parentName = (x: Recipient) =>
    q.data?.students
      .find((s) => s.stdId === x.stdId)
      ?.parents.find((p) => p.parId === x.parId)?.name ?? "";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          setSelected({});
          setRequestId(crypto.randomUUID());
          send.reset();
        }}
      >
        {t("reviewMail.open")}
      </Button>
      {disabled && (
        <p className="text-xs text-secondary">{t("reviewMail.saveFirst")}</p>
      )}
      {doneNotice && (
        <p role="status" className="mt-1 text-sm font-medium text-emerald-700">
          {t("reviewMail.doneAll")}
        </p>
      )}
      {/* REQ-261125-CAL2 — 발송 버튼 아래 발송 이력 (발송 시각 = 서버 저장) */}
      {!!history.data?.length && (
        <div className="mt-2 text-xs">
          <p className="mb-1 font-semibold text-secondary">{t("reviewMail.history")}</p>
          <ul className="grid gap-0.5">
            {history.data.map((h, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="tabular-nums text-secondary">{fmt(h.createdAt)}</span>
                <span>
                  {h.result
                    ? h.result.results
                        .map(
                          (x) =>
                            `${parentName(x) || t("reviewMail.parent")} · ${t(`reviewMail.${x.status}`)}`,
                        )
                        .join(", ")
                    : t("reviewMail.uncertain")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reviewMail.open")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{t("reviewMail.savedOnly")}</p>
          {q.isLoading && <p>{t("status.loading")}</p>}
          {q.isError && (
            <Button onClick={() => q.refetch()}>{t("reviewMail.retry")}</Button>
          )}
          {q.data && !q.data.smtpConfigured && (
            <p role="alert">{t("reviewMail.noSmtp")}</p>
          )}
          {q.data?.students.map((s) => (
            <section key={s.stdId}>
              <strong>{s.stdName}</strong>
              {!s.parents.length && <p>{t("reviewMail.noEmail")}</p>}
              {s.parents.map((p) => {
                const key = `${s.stdId}:${p.parId}`;
                return (
                  <label key={key} className="flex gap-2 py-2">
                    <input
                      type="checkbox"
                      disabled={!p.email || send.isPending || send.isSuccess}
                      checked={!!selected[key]}
                      onChange={(e) =>
                        setSelected((old) => {
                          const next = { ...old };
                          if (e.target.checked)
                            next[key] = { stdId: s.stdId, parId: p.parId };
                          else delete next[key];
                          return next;
                        })
                      }
                    />
                    <span>
                      {p.name} · {p.email || t("reviewMail.noEmail")}
                    </span>
                  </label>
                );
              })}
            </section>
          ))}
          {q.data?.students.length === 0 && <p>{t("reviewMail.noEmail")}</p>}
          {send.isError && <p role="alert">{t("reviewMail.failed")}</p>}
          {send.data?.results.map((x) => (
            <p key={`${x.stdId}:${x.parId}`}>
              {
                q.data?.students
                  .find((s) => s.stdId === x.stdId)
                  ?.parents.find((p) => p.parId === x.parId)?.name
              }
              : {t(`reviewMail.${x.status}`)}
            </p>
          ))}
          {send.data?.results.some((x) => x.status === "FAILED") && (
            <Button
              variant="outline"
              onClick={() => {
                setSelected(
                  Object.fromEntries(
                    send
                      .data!.results.filter((x) => x.status === "FAILED")
                      .map((x) => [
                        `${x.stdId}:${x.parId}`,
                        { stdId: x.stdId, parId: x.parId },
                      ]),
                  ),
                );
                setRequestId(crypto.randomUUID());
                send.reset();
              }}
            >
              {t("reviewMail.retryFailed")}
            </Button>
          )}
          {send.isPending && (
            <div role="progressbar" aria-label={t("reviewMail.sending")} className="grid gap-1">
              <div className="h-1.5 w-full overflow-hidden rounded bg-[var(--gray-100)]">
                <div className="h-full w-1/3 animate-[acm-progress_1.1s_ease-in-out_infinite] rounded bg-accent-600" />
              </div>
              <p className="text-xs text-secondary">
                {t("reviewMail.sending")} ({Object.keys(selected).length})
              </p>
            </div>
          )}
          {send.isSuccess &&
            !send.data?.results.some((x) => x.status === "FAILED") && (
              <p role="status" className="text-sm font-medium text-emerald-700">
                {t("reviewMail.doneAll")}
              </p>
            )}
          <Button
            disabled={
              !Object.keys(selected).length ||
              !q.data?.smtpConfigured ||
              !q.data?.hasFeedback ||
              send.isPending ||
              send.isSuccess
            }
            onClick={() => send.mutate()}
          >
            {t("reviewMail.send")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
