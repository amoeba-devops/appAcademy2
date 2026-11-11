import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
interface Period {
  id: string | null;
  start: string | null;
  end: string | null;
  site: string | null;
  revision: number;
  cancelled: boolean;
}
export function OperatingPeriodEditor({
  kind,
  subjectId,
  onSaved,
}: {
  kind: "STUDENT" | "TEACHER";
  subjectId: string;
  onSaved?: () => Promise<void>;
}) {
  const { t } = useTranslation("dsh");
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Period | null>(null);
  const [replaceMaster, setReplaceMaster] = useState(false);
  const url = `/acm/dsh/operating-periods/${kind}/${subjectId}`;
  const q = useQuery({
    queryKey: ["dsh", "periods", user?.entId, kind, subjectId],
    queryFn: async () => (await apiClient.get<Period[]>(url)).data,
    enabled: user?.role === "ADMIN",
  });
  const save = useMutation({
    mutationFn: () =>
      apiClient.put(url, { ...edit, id: edit?.id ?? undefined, replaceMaster }),
    onSuccess: async () => {
      setEdit(null);
      if (kind === "STUDENT")
        qc.invalidateQueries({ queryKey: ["std"] });
      if (kind === "TEACHER")
        qc.invalidateQueries({ queryKey: ["tch", "teachers"] });
      qc.invalidateQueries({ queryKey: ["dsh"] });
      await onSaved?.();
    },
  });
  if (user?.role !== "ADMIN") return null;
  return (
    // REQ-261112E — 공용 박스·입력칸 기준 (학생 상세·교사 등록 창 공통)
    <Section
      className="mt-4"
      title={t(kind === "STUDENT" ? "ops.periods" : "ops.employment")}
      description={t("ops.periodHint")}
      bodyClassName="space-y-2 p-4 sm:p-5"
    >
      {q.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t("loadFailed")}
        </p>
      )}
      {q.data?.map((p, i) => (
        <div key={p.id ?? i} className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            {p.site ?? "—"} · {p.start ?? "—"} ~ {p.end ?? "—"}{" "}
            {p.cancelled ? t("ops.cancelled") : ""}
          </span>
          <button
            type="button"
            className="min-h-9 text-accent-600 underline sm:min-h-0"
            onClick={() => {
              save.reset();
              setEdit(p);
              setReplaceMaster(!p.id);
            }}
          >
            {t("ops.edit")}
          </button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          save.reset();
          setReplaceMaster(false);
          setEdit({
            id: null,
            start: "",
            end: null,
            site: null,
            revision: 0,
            cancelled: false,
          });
        }}
      >
        {t("ops.addPeriod")}
      </Button>
      {edit && (
        <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border-subtle)] pt-3">
          {kind === "STUDENT" && (
            <select
              className="admin-field"
              aria-label={t("ops.site")}
              value={edit.site ?? ""}
              onChange={(e) =>
                setEdit({ ...edit, site: e.target.value || null })
              }
            >
              <option value="">{t("ops.unclassified")}</option>
              {["TPI", "TRINITY", "SANTACROCE"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
          <label>
            <span className="admin-field-label">{t("ops.start")}</span>
            <input
              className="admin-field"
              type="date"
              value={edit.start ?? ""}
              onChange={(e) => setEdit({ ...edit, start: e.target.value })}
            />
          </label>
          <label>
            <span className="admin-field-label">{t("ops.end")}</span>
            <input
              className="admin-field"
              type="date"
              value={edit.end ?? ""}
              onChange={(e) =>
                setEdit({ ...edit, end: e.target.value || null })
              }
            />
          </label>
          {edit.id && (
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={edit.cancelled}
                onChange={(e) =>
                  setEdit({ ...edit, cancelled: e.target.checked })
                }
              />
              {t("ops.cancelled")}
            </label>
          )}
          {save.isError && (
            <p role="alert" className="w-full text-sm text-red-700">
              {t("ops.saveFailed")}
            </p>
          )}
          <Button
            type="button"
            disabled={save.isPending || !edit.start}
            onClick={() => save.mutate()}
          >
            {t("ops.save")}
          </Button>
          <Button type="button" variant="outline" onClick={() => setEdit(null)}>
            {t("ops.close")}
          </Button>
        </div>
      )}
    </Section>
  );
}
