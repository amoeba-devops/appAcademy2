import { useAuthStore } from "@/stores/auth.store";
import { useState } from "react";
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
  const q = useQuery({
    queryKey: ["portal-feedback-recipients", identity, evtId],
    enabled: open,
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
    enabled: open,
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
          <details>
            <summary>{t("reviewMail.history")}</summary>
            {history.data?.map((h, i) => (
              <p key={i}>
                {new Date(h.createdAt).toLocaleString()}:{" "}
                {h.result
                  ? h.result.results
                      .map((x) => t(`reviewMail.${x.status}`))
                      .join(", ")
                  : t("reviewMail.uncertain")}
              </p>
            ))}
          </details>
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
