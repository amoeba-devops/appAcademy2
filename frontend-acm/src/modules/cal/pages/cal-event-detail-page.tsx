import { reviewMissing } from "@/lib/review-completion";
import { IcsSourcePanel } from "../components/ics-source-panel";
import {
  useVideoConfig,
  canEnterVideo,
} from "@/modules/cfg/hooks/use-video-config";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import {
  ChevronLeft,
  ClipboardCopy,
  Download,
  LogIn,
  Mail,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useBodaReconcile } from "@/lib/boda-admin-api";
import { useCalEvent } from "../hooks/use-cal-events";
import { CalRecordingsSection } from "../components/cal-recordings-section";
import { CalEventModal, teacherJoinUrl } from "../components/cal-event-modal";
import { FeedbackEmailDialog } from "../components/feedback-email-dialog";
import { copyHtmlToClipboard } from "../lib/copy-html";
import { formatTime } from "../lib/date-utils";
import { formatDual, useTenantTz } from "@/lib/tz";
import { useMyZones } from "@/modules/me/use-my-zones";

/**
 * PLN-260729-2 — 관리자 수업일정 상세 "페이지" (/admin/cal/:evtId).
 * 일/주/리스트 뷰에서 모달 없이 바로 진입. [수정] 은 기존 편집 모달 재사용.
 */

interface ClassRecordRow {
  kind: string;
  name: string | null;
  joinedAt: string;
  leftAt: string | null;
  totalSeconds: number | null;
}

export function CalEventDetailPage() {
  const { evtId } = useParams<{ evtId: string }>();
  const { t, i18n } = useTranslation(["cal", "common"]);
  const navigate = useNavigate();
  const toast = useToast();
  const tz = useTenantTz(); // REQ-260903 — 테넌트 TZ 기준 표시
  const [editOpen, setEditOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const { data: event, isLoading } = useCalEvent(evtId);
  const video = useVideoConfig();
  const isBoda = video.bodaEnabled && event?.meetingProvider === "BODASCHOOL";
  const qc = useQueryClient();
  // REQ-260912B — 웹훅이 늦거나 유실됐을 때 관리자가 즉시 다시 당겨온다.
  const reconcileMut = useBodaReconcile(evtId);

  const { data: record } = useQuery({
    enabled: !!evtId && isBoda,
    queryKey: ["cal", "class-record", evtId],
    queryFn: async () =>
      (
        await apiClient.get<{
          openedAt: string | null;
          startedAt: string | null;
          endedAt: string | null;
          closedAt: string | null;
          participants: ClassRecordRow[];
        } | null>(`/acm/cal/events/${evtId}/class-record`)
      ).data,
  });

  const { data: review } = useQuery({
    enabled: !!evtId,
    queryKey: ["cal", "review", evtId],
    queryFn: async () =>
      (
        await apiClient.get<{
          feedbackHtml: string | null;
          homeworkStatus: "ASSIGNED" | "NONE" | null;
          homeworkHtml: string | null;
        }>(`/acm/cal/events/${evtId}/review`)
      ).data,
  });

  // REQ-261015C — 테넌트 기본 타임존 기준 + 사용자 타임존(다르면) 병기.
  const userTz = useMyZones("console").userTz;
  const fmtFull = (iso: string) =>
    formatDual(iso, { tenantTz: tz, userTz }, i18n.language, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtShort = (iso: string | null) =>
    iso
      ? formatDual(iso, { tenantTz: tz, userTz }, i18n.language, {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const sanitizedFeedback = useMemo(
    () => (review?.feedbackHtml ? DOMPurify.sanitize(review.feedbackHtml) : ""),
    [review?.feedbackHtml],
  );
  const sanitizedHomework = useMemo(
    () => (review?.homeworkHtml ? DOMPurify.sanitize(review.homeworkHtml) : ""),
    [review?.homeworkHtml],
  );

  if (isLoading || !event) {
    return <p className="py-10 text-center text-sm text-secondary">…</p>;
  }

  const classDone =
    reviewMissing(
      review ?? {},
      (event.attachments ?? []).filter((a) => a.kind === "HOMEWORK").length,
    ).length === 0;
  const canEnter = canEnterVideo(event, video.bodaEnabled);

  const downloadAttachment = async (attId: string, filename: string) => {
    const res = await apiClient.get<Blob>(
      `/acm/cal/events/${event.id}/attachments/${attId}/download`,
      { responseType: "blob" },
    );
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-w-0">
      <Link
        to="/admin/cal"
        className="mb-3 inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
      >
        <ChevronLeft size={12} /> {t("detail.backToCal")}
      </Link>

      <article className="rounded-md border border-[var(--border-subtle)] bg-surface p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-primary">
              {event.title}
            </h1>
            {event.meetingProvider === "BODASCHOOL" && !video.bodaEnabled && (
              <p className="mt-2 text-sm text-secondary">
                {t("common:video.unavailable")}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[var(--gray-100)] px-2 py-0.5 text-xs text-secondary">
                {t(`category.${event.category}`, event.category)}
              </span>
              {classDone && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                  ✓ {t("review.doneFull")}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {canEnter && (
              <Button
                size="sm"
                onClick={() =>
                  window.open(
                    event.meetingProvider === "BODASCHOOL"
                      ? teacherJoinUrl(event.meetingUrl as string)
                      : (event.meetingUrl as string),
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <LogIn size={14} className="mr-1" />
                {t("actions.enterLink")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Pencil size={14} className="mr-1" />
              {t("common:actions.edit")}
            </Button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-secondary">
              {t("field.startAt")}
            </dt>
            <dd>{fmtFull(event.startAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-secondary">
              {t("field.endAt")}
            </dt>
            <dd>{fmtFull(event.endAt)}</dd>
          </div>
          {event.ownerName && (
            <div>
              <dt className="text-xs text-secondary">
                {t("field.creator")}
              </dt>
              <dd>{event.ownerName}</dd>
            </div>
          )}
          {event.assigneeName && (
            <div>
              <dt className="text-xs text-secondary">
                {t("field.assignee")}
              </dt>
              <dd>{event.assigneeName}</dd>
            </div>
          )}
          {event.locationText && (
            <div>
              <dt className="text-xs text-secondary">
                {t("field.locationText")}
              </dt>
              <dd>{event.locationText}</dd>
            </div>
          )}
        </dl>

        <IcsSourcePanel
          eventId={event.id}
          startAt={event.startAt}
          onStopped={() => navigate("/admin/cal")}
        />

        {event.description && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-secondary">
              {t("field.description")}
            </div>
            <div className="whitespace-pre-wrap rounded-md bg-[var(--canvas-subtle)] px-3 py-2 text-sm">
              {event.description}
            </div>
          </div>
        )}

        {(event.invitees ?? []).length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-secondary">
              {t("form.sectionAttendees")} ({event.invitees!.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {event.invitees!.map((inv) => (
                <span
                  key={`${inv.kind}:${inv.refId}`}
                  className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs"
                >
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-mono ${
                      inv.kind === "STUDENT"
                        ? "bg-blue-100 text-blue-700"
                        : inv.kind === "TEACHER"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {inv.kind[0]}
                  </span>
                  {inv.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {(event.attachments ?? []).length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-secondary">
              {t("attach.section")}
            </div>
            <ul className="grid gap-1">
              {event.attachments!.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => void downloadAttachment(a.id, a.filename)}
                  >
                    <Download size={12} className="mr-1" />
                    {t("attach.download")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* REQ-260912B — 녹화본 (운영자·강사 전용, 백엔드가 역할 강제) */}
        {evtId && <CalRecordingsSection evtId={evtId} isBoda={isBoda} />}

        {/* 강의실 기록 — 보다 수업이면 기록이 비어 있어도 안내 + 동기화 제공 */}
        {isBoda && (
          <div className="mt-4 rounded-md border border-[var(--border-subtle)] p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-secondary">
                🕐 {t("boda.recordTitle")}
              </span>
              {isBoda && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 px-2 text-xs"
                  disabled={reconcileMut.isPending}
                  onClick={() =>
                    reconcileMut.mutate(undefined, {
                      onSuccess: (r) => {
                        void qc.invalidateQueries({
                          queryKey: ["cal", "class-record", evtId],
                        });
                        toast.success(
                          t("boda.reconcileDone", {
                            inserted: r.inserted,
                          }),
                        );
                      },
                      onError: () =>
                        toast.error(
                          t("boda.reconcileFailed"),
                        ),
                    })
                  }
                >
                  <RefreshCw size={12} className="mr-1" />
                  {t("boda.recordSyncBtn")}
                </Button>
              )}
            </div>
            {!record && (
              <p className="text-xs text-secondary">
                {t("boda.recordEmpty")}
              </p>
            )}
            {record && (
              <>
                {/* REQ-260729-3 — 예약(일정) 시간과 실제(강의실) 시간을 구분 표기.
                모든 시각은 UTC instant 를 사용자 브라우저 타임존으로 렌더한다. */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <span className="col-span-2 sm:col-span-4 text-[11px] font-semibold text-secondary">
                    {t("boda.reservedRow")}
                  </span>
                  <span>
                    <span className="text-xs text-secondary">
                      {t("boda.reservedStart")}
                    </span>{" "}
                    {fmtShort(event.startAt)}
                  </span>
                  <span>
                    <span className="text-xs text-secondary">
                      {t("boda.reservedEnd")}
                    </span>{" "}
                    {fmtShort(event.endAt)}
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-[var(--border-subtle)] pt-1.5 text-sm sm:grid-cols-4">
                  <span className="col-span-2 sm:col-span-4 text-[11px] font-semibold text-secondary">
                    {t("boda.actualRow")}
                  </span>
                  <span>
                    <span className="text-xs text-secondary">
                      {t("boda.openedAt")}
                    </span>{" "}
                    {fmtShort(record.openedAt)}
                  </span>
                  <span>
                    <span className="text-xs text-secondary">
                      {t("boda.startedAt")}
                    </span>{" "}
                    {fmtShort(record.startedAt)}
                  </span>
                  <span>
                    <span className="text-xs text-secondary">
                      {t("boda.endedAt")}
                    </span>{" "}
                    {fmtShort(record.endedAt)}
                  </span>
                  <span>
                    <span className="text-xs text-secondary">
                      {t("boda.closedAt")}
                    </span>{" "}
                    {fmtShort(record.closedAt)}
                  </span>
                </div>
                {record.participants.length > 0 && (
                  <div className="mt-2 border-t border-[var(--border-subtle)] pt-2 text-[11px] font-semibold text-secondary">
                    {t("boda.joinListTitle")}
                  </div>
                )}
                {record.participants.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {record.participants.map((p, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center gap-1.5"
                      >
                        <span
                          className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                            p.kind === "TEACHER"
                              ? "bg-purple-100 text-purple-700"
                              : p.kind === "STUDENT"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {t(`boda.kind.${p.kind}`, p.kind)}
                        </span>
                        <span className="font-medium">{p.name ?? "-"}</span>
                        <span className="text-secondary">
                          {formatTime(p.joinedAt, i18n.language, tz)} →{" "}
                          {p.leftAt
                            ? formatTime(p.leftAt, i18n.language, tz)
                            : t("boda.stillIn")}
                          {p.totalSeconds != null &&
                            ` (${t("boda.minutes", { m: Math.round(p.totalSeconds / 60) })})`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {/* 피드백·과제 (강사 작성, 관리자 확인용) */}
        {review && (review.feedbackHtml || review.homeworkStatus != null) && (
          <div className="mt-4 space-y-2">
            {review.feedbackHtml && (
              <div className="rounded-md border border-[var(--border-subtle)] p-3">
                <div className="mb-1 text-xs font-semibold text-secondary">
                  📝 {t("review.feedbackLabel")}
                </div>
                <div
                  className="doc-prose max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizedFeedback }}
                />
                {/* REQ-260902 — 복사·학부모 메일 발송 */}
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await copyHtmlToClipboard(sanitizedFeedback);
                        toast.success(
                          t("feedbackEmail.copied"),
                        );
                      } catch {
                        toast.error(
                          t("feedbackEmail.copyFailed"),
                        );
                      }
                    }}
                  >
                    <ClipboardCopy size={13} className="mr-1" />
                    {t("feedbackEmail.copyBtn")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setEmailOpen(true)}
                  >
                    <Mail size={13} className="mr-1" />
                    {t("feedbackEmail.sendBtn")}
                  </Button>
                </div>
              </div>
            )}
            {review.homeworkStatus === "NONE" ? (
              <div className="rounded-md border border-[var(--border-subtle)] p-3 text-sm text-secondary">
                📚 {t("review.noHomework")}
              </div>
            ) : review.homeworkStatus === "ASSIGNED" && review.homeworkHtml ? (
              <div className="rounded-md border border-[var(--border-subtle)] p-3">
                <div className="mb-1 text-xs font-semibold text-secondary">
                  📚 {t("review.homeworkLabel")}
                </div>
                <div
                  className="doc-prose max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizedHomework }}
                />
              </div>
            ) : null}
          </div>
        )}
      </article>

      {/* REQ-260729-3 — 하단 뒤로가기 (진입 경로로 history back) */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mt-3 inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
      >
        <ChevronLeft size={12} /> {t("detail.backHistory")}
      </button>

      <CalEventModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          navigate(0); // 편집 후 상세 최신화
        }}
        initial={event}
      />

      <FeedbackEmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        evtId={event.id}
        eventTitle={event.title}
        eventStartAt={event.startAt}
      />
    </div>
  );
}
