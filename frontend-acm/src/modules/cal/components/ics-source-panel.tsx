import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
        <strong>원본 캘린더:</strong> {data.calendarName}
      </p>
      <p>시간대: {data.timezone ?? "원본 일정 기준"}</p>
      <p>
        반복:{" "}
        {data.stoppedAt
          ? "종료됨"
          : data.unbounded
            ? "종료일 없음 · 원본 규칙 유지"
            : data.rules.length
              ? "원본 종료 조건 유지"
              : "단일 일정"}
      </p>
      {data.rules.map((rule) => (
        <p key={rule} className="break-all text-xs text-secondary">
          {rule.replace("RRULE:", "")}
        </p>
      ))}
      <p className="mt-1 text-xs text-secondary">
        일정 수정·삭제는 이번 회차에만 적용됩니다.
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
                title: "이번 회차부터 반복 종료",
                description:
                  "선택한 일정의 시작 시각부터 이후 회차를 삭제하고 자동 생성을 중단합니다. 이전 회차는 유지됩니다.",
                confirmLabel: "반복 종료",
                variant: "destructive",
              })
            )
              stop.mutate();
          }}
        >
          이번 회차부터 반복 종료
        </Button>
      )}
      {stop.isError && (
        <p role="alert" className="text-red-600">
          반복 종료에 실패했습니다. 다시 시도해 주세요.
        </p>
      )}
    </section>
  );
}
