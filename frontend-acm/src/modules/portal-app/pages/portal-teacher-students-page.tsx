import { useState, useMemo } from "react";
import {
  Link,
  useParams,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCalCategories } from "@/modules/cal/hooks/use-cal-categories";
import {
  CalendarRange,
  ChevronLeft,
  Link2,
  MessageSquare,
  Search,
} from "lucide-react";
import {
  ClassLinkList,
  ClassLinksEditor,
  type ClassLink,
} from "@/components/common/class-links";
import { formatDual } from "@/lib/tz";
import { useMyZones } from "@/modules/me/use-my-zones";
import { useAuthStore } from "@/stores/auth.store";
import { portalApi, type TeacherStudent } from "../api/portal-api";

/**
 * PLN-260719 Phase C — 강사 포털 "수강생관리".
 *   • /portal/students        → 배정/반 소속 학생 폴더 그리드
 *   • /portal/students/:stdId → 학생 상세 (기본정보 + 수업링크 + 상담 + 수업기록)
 * REQ-261103C — 수업링크: 학생관리에서 배정된 학생에게 내 링크 여러 개 등록.
 * TEACHER 전용 (타 역할은 안내문).
 */
export function PortalTeacherStudentsPage() {
  const { t } = useTranslation("common");
  const { stdId } = useParams<{ stdId: string }>();
  const kind = useAuthStore((s) => s.portal.user?.kind);

  if (kind !== "TEACHER") {
    return (
      <p className="rounded-md border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
        {t("portalApp.students.teacherOnly", "강사 전용 메뉴입니다.")}
      </p>
    );
  }
  return stdId ? <StudentDetail stdId={stdId} /> : <StudentGrid />;
}

function StudentGrid() {
  const { t, i18n } = useTranslation("common");
  const [params, setParams] = useSearchParams();
  const includeWithdrawn = params.get("all") === "1";
  const search = params.get("q") ?? "";
  const change = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const user = useAuthStore((s) => s.portal.user);
  const query = useQuery({
    queryKey: [
      "portal-teacher-students",
      user?.entId,
      user?.refId,
      includeWithdrawn,
    ],
    queryFn: () => portalApi.teacherStudents(includeWithdrawn),
  });
  const students = useMemo(
    () =>
      (query.data ?? [])
        .filter((s) =>
          [s.name, s.englishName, s.school].some((v) =>
            v?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
          ),
        )
        .sort((a, b) => a.name.localeCompare(b.name, i18n.language)),
    [query.data, search, i18n.language],
  );
  return (
    <div>
      <h1 className="portal-title">{t("portalApp.nav.students")}</h1>
      <div className="portal-tabs" aria-label={t("portalUi.studentScope")}>
        <button
          type="button"
          aria-pressed={!includeWithdrawn}
          onClick={() => change("all", "")}
        >
          {t("portalUi.assigned")}
        </button>
        <button
          type="button"
          aria-pressed={includeWithdrawn}
          onClick={() => change("all", "1")}
        >
          {t("portalUi.includeWithdrawn")}
        </button>
      </div>
      <p className="portal-hint">{t("portalUi.assignedScope")}</p>
      <div className="portal-toolbar">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <Search size={18} aria-hidden />
          <input
            className="w-full"
            type="search"
            aria-label={t("portalUi.studentSearch")}
            placeholder={t("portalUi.studentSearch")}
            value={search}
            onChange={(e) => change("q", e.target.value)}
          />
        </label>
        {query.data && !query.isError && (
          <span className="portal-hint" role="status">
            {t("portalUi.resultCount", { count: students.length })}
          </span>
        )}
      </div>
      {query.isError ? (
        <div className="portal-empty" role="alert">
          {t("portalUi.loadError")}{" "}
          <button type="button" onClick={() => void query.refetch()}>
            {t("portalApp.cal.retry")}
          </button>
        </div>
      ) : query.isLoading ? (
        <p role="status" className="portal-empty">
          {t("myPage.loading")}
        </p>
      ) : students.length === 0 ? (
        <p className="portal-empty">
          {search ? t("portalUi.noMatches") : t("portalApp.students.empty")}
        </p>
      ) : (
        <div className="portal-students">
          {students.map((student: TeacherStudent) => (
            <Link
              key={student.id}
              to={
                "/portal/students/" +
                student.id +
                (params.size ? "?" + params.toString() : "")
              }
              className="portal-panel portal-student"
            >
              <div className="portal-student-head">
                <span className="portal-avatar" aria-hidden>
                  {student.name.slice(0, 1)}
                </span>
                <div className="portal-student-info">
                  <strong>{student.name}</strong>
                  {student.englishName && (
                    <span className="text-xs text-secondary">
                      {student.englishName}
                    </span>
                  )}
                </div>
                <span className="portal-status">
                  {t("portalUi.status." + student.status, student.status)}
                </span>
              </div>
              <p className="mt-3 break-words text-sm text-secondary">
                {[student.school, student.grade, student.subject]
                  .filter(Boolean)
                  .join(" · ") || t("portalUi.notEntered")}
              </p>
              {!!student.sources?.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {student.sources.map((src) => (
                    <span key={src} className="portal-status">
                      {t("portalApp.students.source." + src)}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDateOnly(value: string | null, locale: string, empty: string) {
  if (!value) return empty;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return empty;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  )
    return empty;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function StudentDetail({ stdId }: { stdId: string }) {
  const { t, i18n } = useTranslation(["common", "csl", "cal"]);
  const categories = useCalCategories("portal");
  const user = useAuthStore((state) => state.portal.user);
  const location = useLocation();
  const zones = useMyZones("portal");
  const {
    data: s,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["portal-teacher-student", stdId, user?.entId, user?.refId],
    queryFn: () => portalApi.teacherStudent(stdId),
  });

  if (isError)
    return (
      <div role="alert" className="portal-empty">
        {t("portalUi.loadError")}{" "}
        <button onClick={() => void refetch()}>
          {t("portalApp.cal.retry")}
        </button>
      </div>
    );
  if (isLoading || !s) {
    return <p className="py-6 text-center text-sm text-secondary">…</p>;
  }

  const fmtDT = (iso: string) =>
    formatDual(iso, zones, i18n.language, {
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="portal-student-detail">
      <Link
        to={"/portal/students" + location.search}
        className="mb-3 inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
      >
        <ChevronLeft size={12} />{" "}
        {t("portalApp.students.back", "수강생 목록으로")}
      </Link>

      <article className="rounded-md border border-[var(--border-subtle)] p-5">
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-primary">
          {s.name}
          {s.englishName && (
            <span className="ml-2 text-sm font-normal text-secondary">
              ({s.englishName})
            </span>
          )}
        </h1>
        {s.status && (
          <span className="portal-status mt-2">
            {t("portalUi.status." + s.status, s.status)}
          </span>
        )}

        {/* 기본 정보 */}
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
          <InfoRow label={t("portalApp.students.school", "학교/학년")}>
            {[s.school, s.grade].filter(Boolean).join(" · ") ||
              t("portalUi.notEntered")}
          </InfoRow>
          <InfoRow label={t("portalApp.students.subject", "과목")}>
            {s.subject ?? t("portalUi.notEntered")}
          </InfoRow>
          <InfoRow label={t("portalApp.students.email", "이메일")}>
            {s.email ?? t("portalUi.notEntered")}
          </InfoRow>
          <InfoRow label={t("portalApp.students.phone", "연락처")}>
            {s.phone ?? t("portalUi.notEntered")}
          </InfoRow>
          <InfoRow label={t("portalApp.students.startDate", "수강 시작")}>
            {formatDateOnly(
              s.startDate,
              i18n.language,
              t("portalUi.notEntered"),
            )}
          </InfoRow>
          {s.sourceInquiry && (
            <InfoRow label={t("portalApp.students.inquiry", "연결 상담")}>
              #{s.sourceInquiry.seqNo} ·{" "}
              {t(
                `csl:stage.${s.sourceInquiry.currentStage}`,
                s.sourceInquiry.currentStage,
              )}
            </InfoRow>
          )}
        </dl>

        {s.goalsNote && (
          <div className="mt-3 space-y-1 rounded-md bg-[var(--gray-50)] px-3 py-2 text-sm">
            {s.goalsNote && (
              <div>
                <span className="text-xs text-secondary">
                  {t("portalApp.students.goalsNote", "학습 목표")}:
                </span>{" "}
                {s.goalsNote}
              </div>
            )}
          </div>
        )}

        <MyLinks stdId={stdId} links={s.links} editable={s.linksEditable} />

        {/* 상담 기록 */}
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
            <MessageSquare size={14} />
            {t("portalApp.students.remarks", "상담 기록")}
          </h2>
          {s.remarks.length === 0 ? (
            <p className="text-xs text-secondary">
              {t("portalApp.students.noRemarks", "상담 기록이 없습니다.")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {s.remarks.map((r, idx) => (
                <li
                  key={idx}
                  className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                >
                  <div className="whitespace-pre-wrap text-primary">
                    {r.body}
                  </div>
                  <div className="mt-0.5 text-xs text-secondary">
                    {new Date(r.createdAt).toLocaleDateString(i18n.language)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 수업 기록 */}
        <section className="mt-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
            <CalendarRange size={14} />
            {t("portalApp.students.classes", "수업 기록 (최근 10건)")}
          </h2>
          {s.recentEvents.length === 0 ? (
            <p className="text-xs text-secondary">
              {t("portalApp.students.noClasses", "수업 기록이 없습니다.")}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)]">
              {s.recentEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="w-40 shrink-0 text-xs text-secondary">
                    {fmtDT(e.startAt)}
                  </span>
                  <Link
                    to={`/portal/calendar/${e.id}`}
                    state={{ from: location.pathname + location.search }}
                    className="min-w-0 flex-1 truncate text-accent-700 hover:underline"
                  >
                    {e.title}
                  </Link>
                  <span className="shrink-0 rounded bg-[var(--gray-100)] px-1.5 py-0.5 text-xs text-secondary">
                    {categories.label(e.category)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </div>
  );
}

function MyLinks({
  stdId,
  links,
  editable,
}: {
  stdId: string;
  links: ClassLink[];
  editable: boolean;
}) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ClassLink[] | null>(null);
  const save = useMutation({
    mutationFn: (next: ClassLink[]) => portalApi.saveTeacherLinks(stdId, next),
    onSuccess: () => {
      setDraft(null);
      void qc.invalidateQueries({
        queryKey: ["portal-teacher-student", stdId],
      });
    },
  });
  // 400 은 code=HTTP_400, message=CLASS_LINK_INVALID 로 온다.
  const apiErr = (
    save.error as {
      response?: { data?: { error?: { code?: string; message?: unknown } } };
    } | null
  )?.response?.data?.error;
  const errCode =
    apiErr?.message === "CLASS_LINK_INVALID" ? apiErr.message : apiErr?.code;
  return (
    <section className="mt-5">
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
        <Link2 size={14} />
        {t("portalApp.students.links")}
        {editable && draft === null && (
          <button
            type="button"
            className="ml-auto min-h-9 rounded-md border px-3 text-xs font-normal text-accent-700 hover:bg-[var(--gray-50)]"
            onClick={() => setDraft(links.map((l) => ({ ...l })))}
          >
            {links.length
              ? t("portalApp.students.linksEdit")
              : t("classLinks.add")}
          </button>
        )}
      </h2>
      {draft !== null ? (
        <div className="space-y-2">
          <ClassLinksEditor value={draft} onChange={setDraft} />
          {save.isError && (
            <p role="alert" className="text-xs text-red-600">
              {errCode === "CLASS_LINK_INVALID"
                ? t("classLinks.invalid")
                : t("portalApp.students.linksSaveFailed")}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={save.isPending}
              className="min-h-9 rounded-md bg-accent-600 px-4 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
              onClick={() => save.mutate(draft.filter((l) => l.url.trim()))}
            >
              {t("actions.save")}
            </button>
            <button
              type="button"
              className="min-h-9 rounded-md border px-4 text-sm text-secondary"
              onClick={() => {
                setDraft(null);
                save.reset();
              }}
            >
              {t("actions.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <ClassLinkList links={links} />
      )}
      {!editable && (
        <p className="mt-1 text-xs text-secondary">
          {t("portalApp.students.linksNotAssigned")}
        </p>
      )}
    </section>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="text-primary">{children}</dd>
    </div>
  );
}
