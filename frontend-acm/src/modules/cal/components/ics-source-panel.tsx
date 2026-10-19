import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
interface SourceInfo {
  calendarName: string;
  unbounded: boolean;
  stoppedAt: string | null;
  rules: string[];
  timezone: string | null;
}
export function IcsSourcePanel({
  eventId,
  startAt,
  onStopped,
}: {
  eventId: string;
  startAt: string;
  onStopped?: () => void;
}) {
  const { t } = useTranslation("cal");
  const role = useAuthStore((s) => s.user?.role);
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["cal", "ics", eventId],
    queryFn: async () =>
      (await apiClient.get<SourceInfo | null>(`/acm/cal/events/${eventId}/ics`))
        .data,
  });
  const stop = useMutation({
    mutationFn: () =>
      apiClient.post(`/acm/cal/events/${eventId}/ics/stop`, { from: startAt }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cal"] });
      onStopped?.();
    },
  });
  if (!data) return null;
  return (
    <section className="my-3 rounded-md border bg-slate-50 p-3 text-sm">
      <p>
        <strong>{t("ics.sourceCalendar")}:</strong> {data.calendarName}
      </p>
      <p>
        {t("ics.timezone")}: {data.timezone ?? t("ics.timezoneSource")}
      </p>
      <p>
        {t("ics.repeat")}:{" "}
        {data.stoppedAt
          ? t("ics.stopped")
          : data.unbounded
            ? t("ics.unbounded")
            : data.rules.length
              ? t("ics.keepSourceEnd")
              : t("ics.single")}
      </p>
      {data.rules.map((rule) => (
        <p key={rule} className="break-all text-xs text-secondary">
          {rule.replace("RRULE:", "")}
        </p>
      ))}
      <p className="mt-1 text-xs text-secondary">
        {t("ics.editScopeHint")}
      </p>
      {role === "ADMIN" && data.rules.length > 0 && !data.stoppedAt && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={stop.isPending}
          className="mt-2"
          onClick={async () => {
            if (
              await confirm({
                title: t("ics.stopTitle"),
                description: t("ics.stopDescription"),
                confirmLabel: t("ics.stopConfirm"),
                variant: "destructive",
              })
            )
              stop.mutate();
          }}
        >
          {t("ics.stopTitle")}
        </Button>
      )}
      {stop.isError && (
        <p role="alert" className="text-red-600">
          {t("ics.stopFailed")}
        </p>
      )}
    </section>
  );
}
