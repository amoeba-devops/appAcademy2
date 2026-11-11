import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { useAuthStore } from "@/stores/auth.store";
import { TimeSelectInput, halfHourSlots } from "@/components/ui/time-select-input";

// REQ-261111 — 수업 예정일시: 날짜 + 시간(30분 목록·직접 입력) 분리. datetime-local 은 브라우저에 따라 시간 입력 불가.
const SCHEDULE_SLOTS = halfHourSlots(6, 23);
interface Person {
  id: string;
  name: string;
  site?: string | null;
  description?: string;
}
interface RecordRow {
  id: string;
  kind: string;
  date: string;
  payload: { status?: string };
  cancelledAt: string | null;
}
export function LifecycleEditor({
  subjectKind,
  subjectId,
}: {
  subjectKind: "STUDENT" | "INQUIRY";
  subjectId: string;
}) {
  const { t } = useTranslation("dsh");
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [kind, setKind] = useState("SCHEDULE");
  const [date, setDate] = useState(
    new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10),
  );
  const [site, setSite] = useState("COMMON");
  const [status, setStatus] = useState("SCHEDULING");
  const [teacherId, setTeacher] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const scheduledAt = schedDate && schedTime ? `${schedDate}T${schedTime}` : "";
  const needsSchedule = kind === "SCHEDULE" && status === "SCHEDULED";
  const [courseKey, setCourse] = useState("");
  const [relatedKind, setRelatedKind] = useState("STUDENT");
  const [q, setQ] = useState("");
  const [relatedId, setRelated] = useState("");
  const [stoppedDate, setStopped] = useState("");
  const [verified, setVerified] = useState(false);
  const allowed = user?.role === "ADMIN" || user?.role === "STAFF";
  const related = kind === "RETURN" || kind === "REFERRAL";
  const records = useQuery({
    queryKey: ["dsh", "lifecycle-records", user?.entId, subjectKind, subjectId],
    queryFn: async () =>
      (
        await apiClient.get<RecordRow[]>(
          `/acm/dsh/lifecycle/records/${subjectKind}/${subjectId}`,
        )
      ).data,
    enabled: allowed,
  });
  const people = useQuery({
    queryKey: ["dsh", "lifecycle-people", user?.entId, relatedKind, q],
    queryFn: async () =>
      (
        await apiClient.get<Person[]>("/acm/dsh/lifecycle/subjects", {
          params: { kind: relatedKind, q },
        })
      ).data,
    enabled: allowed && related && q.trim().length > 0,
  });
  const teachers = useQuery({
    queryKey: ["dsh", "lifecycle-teachers", user?.entId],
    queryFn: async () => {
      const r = (
        await apiClient.get<Person[] | { items: Person[] }>(
          "/acm/tch/teachers",
          { params: { limit: 100 } },
        )
      ).data;
      return Array.isArray(r) ? r : r.items;
    },
    enabled: allowed && kind === "SCHEDULE" && status === "SCHEDULED",
  });
  const refresh = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["dsh"] }),qc.invalidateQueries({queryKey:["csl"]}),qc.invalidateQueries({queryKey:["std"]})]); };
  const save = useMutation({
    mutationFn: async () =>
      apiClient.post("/acm/dsh/lifecycle/records", {
        subjectKind,
        subjectId,
        kind,
        effectiveDate: date,
        site,
        ...(kind === "SCHEDULE"
          ? {
              status,
              courseKey: courseKey || undefined,
              ...(status === "SCHEDULED"
                ? {
                    teacherId,
                    scheduledAt: scheduledAt
                      ? `${scheduledAt}:00+09:00`
                      : undefined,
                  }
                : {}),
            }
          : { verified }),
        ...(related ? { relatedKind, relatedId } : {}),
        ...(kind === "RETURN" ? { stoppedDate } : {}),
      }),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/acm/dsh/lifecycle/records/${id}`),
    onSuccess: refresh,
  });
  if (!allowed) return null;
  return (
    // REQ-261112E — 공용 박스·입력칸 기준 (학생 상세·신규 상담 상세 공통)
    <Section
      title={t("life.editor")}
      description={t("life.evidenceHint")}
      bodyClassName="space-y-3 p-4 sm:p-5"
    >
      <div className="grid gap-3 md:grid-cols-3">
        <label>
          <span className="admin-field-label">{t("life.kind")}</span>
          <select
            className="admin-field w-full"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setRelated("");
              setVerified(false);
              setRelatedKind("STUDENT");
            }}
          >
            {(user?.role === "ADMIN"
              ? [
                  "SCHEDULE",
                  "RETURN",
                  "REFERRAL",
                  "FIRST_PAYMENT",
                  "FIRST_CLASS",
                  "PAYMENT_ENDED",
                ]
              : ["SCHEDULE", "RETURN", "REFERRAL"]
            ).map((k) => (
              <option key={k} value={k}>
                {t(`life.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="admin-field-label">{t("life.date")}</span>
          <input
            className="admin-field w-full"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          <span className="admin-field-label">{t("life.site")}</span>
          <select
            className="admin-field w-full"
            value={site}
            onChange={(e) => setSite(e.target.value)}
          >
            {["COMMON", "TPI", "TRINITY", "SANTACROCE"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {kind === "SCHEDULE" && (
          <>
            <label>
              <span className="admin-field-label">{t("life.status")}</span>
              <select
                className="admin-field w-full"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {["SCHEDULING", "SCHEDULED", "CLOSED", "CANCELLED"].map((s) => (
                  <option key={s} value={s}>
                    {t(`life.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="admin-field-label">{t("life.course")}</span>
              <input
                className="admin-field w-full"
                value={courseKey}
                onChange={(e) => setCourse(e.target.value)}
              />
            </label>
            {status === "SCHEDULED" && (
              <>
                <label>
                  <span className="admin-field-label">{t("life.teacher")}</span>
                  <select
                    className="admin-field w-full"
                    value={teacherId}
                    onChange={(e) => setTeacher(e.target.value)}
                  >
                    <option value="">{t("life.select")}</option>
                    {teachers.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2">
                  <span className="admin-field-label">{t("life.scheduledAt")}</span>
                  <span className="flex flex-wrap items-start gap-2">
                    <input
                      className="admin-field"
                      type="date"
                      aria-label={t("life.scheduledAt")}
                      value={schedDate}
                      onChange={(e) => setSchedDate(e.target.value)}
                    />
                    <TimeSelectInput
                      className="w-[12rem]"
                      value={schedTime}
                      onChange={setSchedTime}
                      slots={SCHEDULE_SLOTS}
                      ariaLabel={t("life.scheduledTime")}
                      controlClassName="bg-surface"
                    />
                  </span>
                  {schedDate && !schedTime && (
                    <span className="block text-xs text-red-600">{t("life.timeRequired")}</span>
                  )}
                </label>
              </>
            )}
          </>
        )}
        {related && (
          <>
            <label>
              <span className="admin-field-label">{t("life.relatedKind")}</span>
              <select
                className="admin-field w-full"
                value={relatedKind}
                onChange={(e) => {
                  setRelatedKind(e.target.value);
                  setRelated("");
                }}
              >
                {["STUDENT", kind === "RETURN" ? "INQUIRY" : "PARENT"].map(
                  (k) => (
                    <option key={k} value={k}>
                      {t(`life.${k}`)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              <span className="admin-field-label">{t("life.name")}</span>
              <input
                className="admin-field w-full"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setRelated("");
                }}
              />
              <select
                aria-label={t("life.select")}
                className="admin-field mt-2 w-full"
                value={relatedId}
                onChange={(e) => setRelated(e.target.value)}
              >
                <option value="">{t("life.select")}</option>
                {people.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.site ?? "—"} · {p.description ?? ""}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {kind === "RETURN" && (
          <label>
            <span className="admin-field-label">{t("life.stoppedDate")}</span>
            <input
              className="admin-field w-full"
              type="date"
              value={stoppedDate}
              onChange={(e) => setStopped(e.target.value)}
            />
          </label>
        )}
      </div>
      {kind !== "SCHEDULE" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
          />{" "}
          {t("life.verified")}
        </label>
      )}
      <Button
        type="button"
        disabled={
          save.isPending ||
          !date ||
          (related && !relatedId) ||
          (needsSchedule && (!teacherId || !scheduledAt)) ||
          (kind !== "SCHEDULE" && !verified)
        }
        onClick={() => save.mutate()}
      >
        {t("life.save")}
      </Button>
      {(save.isError ||
        cancel.isError ||
        records.isError ||
        people.isError ||
        teachers.isError) && (
        <p role="alert" className="text-sm text-red-700">
          {t("life.error")}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="text-sm text-secondary">
          {t("life.saved")}
        </p>
      )}
      <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] text-sm">
        {records.data?.map((r) => (
          <li key={r.id} className="py-2">
            {r.date} · {t(`life.${r.kind}`)}{" "}
            {r.payload.status && t(`life.${r.payload.status}`)}{" "}
            {r.cancelledAt ? (
              t("life.CANCELLED")
            ) : (
              <button
                type="button"
                className="ml-3 min-h-9 text-accent-600 underline sm:min-h-0"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(r.id)}
              >
                {t("life.cancel")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
