import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
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
  const [scheduledAt, setScheduled] = useState("");
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
    <section className="border rounded p-4 my-4 space-y-3">
      <h3 className="font-semibold">{t("life.editor")}</h3>
      <p className="text-xs text-secondary">{t("life.evidenceHint")}</p>
      <div className="grid md:grid-cols-3 gap-3">
        <label>
          {t("life.kind")}
          <select
            className="block w-full border rounded p-2"
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
          {t("life.date")}
          <input
            className="block border rounded p-2"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          {t("life.site")}
          <select
            className="block border rounded p-2"
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
              {t("life.status")}
              <select
                className="block border rounded p-2"
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
              {t("life.course")}
              <input
                className="block border rounded p-2"
                value={courseKey}
                onChange={(e) => setCourse(e.target.value)}
              />
            </label>
            {status === "SCHEDULED" && (
              <>
                <label>
                  {t("life.teacher")}
                  <select
                    className="block border rounded p-2"
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
                <label>
                  {t("life.scheduledAt")}
                  <input
                    className="block border rounded p-2"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduled(e.target.value)}
                  />
                </label>
              </>
            )}
          </>
        )}
        {related && (
          <>
            <label>
              {t("life.relatedKind")}
              <select
                className="block border rounded p-2"
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
              {t("life.name")}
              <input
                className="block border rounded p-2"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setRelated("");
                }}
              />
              <select
                aria-label={t("life.select")}
                className="block border rounded p-2 w-full"
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
            {t("life.stoppedDate")}
            <input
              className="block border rounded p-2"
              type="date"
              value={stoppedDate}
              onChange={(e) => setStopped(e.target.value)}
            />
          </label>
        )}
      </div>
      {kind !== "SCHEDULE" && (
        <label className="block">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
          />{" "}
          {t("life.verified")}
        </label>
      )}
      <button
        type="button"
        className="border rounded px-3 py-2"
        disabled={
          save.isPending ||
          !date ||
          (related && !relatedId) ||
          (kind !== "SCHEDULE" && !verified)
        }
        onClick={() => save.mutate()}
      >
        {t("life.save")}
      </button>
      {(save.isError ||
        cancel.isError ||
        records.isError ||
        people.isError ||
        teachers.isError) && <p role="alert">{t("life.error")}</p>}
      {save.isSuccess && <p role="status">{t("life.saved")}</p>}
      <ul className="text-sm space-y-2">
        {records.data?.map((r) => (
          <li key={r.id}>
            {r.date} · {t(`life.${r.kind}`)}{" "}
            {r.payload.status && t(`life.${r.payload.status}`)}{" "}
            {r.cancelledAt ? (
              t("life.CANCELLED")
            ) : (
              <button
                type="button"
                className="underline ml-3"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate(r.id)}
              >
                {t("life.cancel")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
