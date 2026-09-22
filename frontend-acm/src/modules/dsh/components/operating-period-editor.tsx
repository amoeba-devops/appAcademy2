import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
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
      if (kind === "TEACHER")
        qc.invalidateQueries({ queryKey: ["tch", "teachers"] });
      qc.invalidateQueries({ queryKey: ["dsh"] });
      await onSaved?.();
    },
  });
  if (user?.role !== "ADMIN") return null;
  return (
    <section className="bg-surface border rounded p-3 my-3">
      <strong>
        {t(kind === "STUDENT" ? "ops.periods" : "ops.employment")}
      </strong>
      <p className="text-xs text-secondary">{t("ops.periodHint")}</p>
      {q.isError && <p role="alert">{t("loadFailed")}</p>}
      {q.data?.map((p, i) => (
        <div key={p.id ?? i} className="flex gap-2 text-sm py-1">
          <span>
            {p.site ?? "—"} · {p.start ?? "—"} ~ {p.end ?? "—"}{" "}
            {p.cancelled ? t("ops.cancelled") : ""}
          </span>
          <button
            type="button"
            className="underline"
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
      <button
        type="button"
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
      </button>
      {edit && (
        <div className="flex flex-wrap gap-2 mt-2">
          {kind === "STUDENT" && (
            <select
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
            {t("ops.start")}
            <input
              type="date"
              value={edit.start ?? ""}
              onChange={(e) => setEdit({ ...edit, start: e.target.value })}
            />
          </label>
          <label>
            {t("ops.end")}
            <input
              type="date"
              value={edit.end ?? ""}
              onChange={(e) =>
                setEdit({ ...edit, end: e.target.value || null })
              }
            />
          </label>
          {edit.id && (
            <label>
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
          {save.isError && <p role="alert">{t("ops.saveFailed")}</p>}
          <Button
            type="button"
            disabled={save.isPending || !edit.start}
            onClick={() => save.mutate()}
          >
            {t("ops.save")}
          </Button>
          <button type="button" onClick={() => setEdit(null)}>
            {t("ops.close")}
          </button>
        </div>
      )}
    </section>
  );
}
