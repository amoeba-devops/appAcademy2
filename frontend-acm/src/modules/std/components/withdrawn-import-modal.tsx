import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
type Fields = Record<string, string | number | boolean | null>;
interface Row {
  key: string;
  row: number;
  fields: Fields;
  errors: string[];
  blocked: boolean;
  candidates: Array<{
    id: string;
    name: string;
    status: string;
    birthDate?: string | null;
    fields: Record<string, string | null>;
  }>;
}
interface Decision {
  key: string;
  action: "NEW" | "UPDATE";
  studentId?: string;
  reviewed: boolean;
  teacherIds: string[];
}
export function WithdrawnImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("std");
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [selected, setSelected] = useState<Row | null>(null);
  const preview = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("file", file!);
      return (
        await apiClient.post<{
          previewId: string;
          rows: Row[];
          counts: {
            total: number;
            new: number;
            existing: number;
            hold: number;
          };
        }>("/acm/std/withdrawn/preview", form)
      ).data;
    },
    onSuccess: () => {
      setDecisions({});
      setSelected(null);
    },
  });
  const commit = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{
          created: number;
          updated: number;
          unchanged: number;
        }>("/acm/std/withdrawn/commit", {
          previewId: preview.data!.previewId,
          decisions: Object.values(decisions).filter((d) => d.reviewed),
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["std"] }),
  });
  const pending = preview.isPending || commit.isPending;
  const decide = (row: Row, patch: Partial<Decision>) =>
    setDecisions((all) => ({
      ...all,
      [row.key]: {
        ...(all[row.key] ?? {
          key: row.key,
          action: row.candidates.length ? "UPDATE" : "NEW",
          teacherIds: [],
          reviewed: false,
        }),
        ...patch,
      },
    }));
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && !pending && onClose()}
    >
      <DialogContent className="max-w-5xl max-h-[90dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t("withdrawn.importTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm">{t("withdrawn.policy")}</p>
        <input
          type="file"
          accept=".xlsx"
          disabled={pending}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            preview.reset();
            commit.reset();
            setDecisions({});
            setSelected(null);
          }}
        />
        <Button disabled={!file || pending} onClick={() => preview.mutate()}>
          {t("withdrawn.analyze")}
        </Button>
        {preview.data && (
          <>
            <p>{t("withdrawn.counts", { ...preview.data.counts })}</p>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>{t("withdrawn.row")}</th>
                    <th>{t("field.name")}</th>
                    <th>{t("withdrawn.candidate")}</th>
                    <th>{t("withdrawn.review")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.data.rows.map((row) => (
                    <tr key={row.key} className="border-b">
                      <td>{row.row}</td>
                      <td>
                        <button
                          type="button"
                          className="underline"
                          onClick={() => setSelected(row)}
                        >
                          {String(row.fields["이름"])}
                        </button>
                      </td>
                      <td>
                        {row.candidates.length ? (
                          <select
                            aria-label={`${row.fields["이름"]} ${t("withdrawn.candidate")}`}
                            value={
                              decisions[row.key]?.action === "NEW"
                                ? "__new__"
                                : (decisions[row.key]?.studentId ?? "")
                            }
                            disabled={pending || !!commit.data}
                            onChange={(e) =>
                              decide(row, {
                                studentId:
                                  e.target.value === "__new__"
                                    ? undefined
                                    : e.target.value,
                                action:
                                  e.target.value === "__new__"
                                    ? "NEW"
                                    : "UPDATE",
                                reviewed: false,
                              })
                            }
                          >
                            <option value="">{t("withdrawn.select")}</option>
                            <option value="__new__">
                              {t("withdrawn.new")}
                            </option>
                            {row.candidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} / {t(`status.${c.status}`)} /{" "}
                                {c.birthDate ?? t("detail.inputRequired")}
                              </option>
                            ))}
                          </select>
                        ) : (
                          t("withdrawn.new")
                        )}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`${row.fields["이름"]} ${t("withdrawn.review")}`}
                          checked={decisions[row.key]?.reviewed ?? false}
                          disabled={
                            row.blocked ||
                            pending ||
                            !!commit.data ||
                            (row.candidates.length > 0 &&
                              decisions[row.key]?.action !== "NEW" &&
                              !decisions[row.key]?.studentId)
                          }
                          onChange={(e) =>
                            decide(row, { reviewed: e.target.checked })
                          }
                        />
                        {row.errors.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {selected && (
          <section className="rounded border p-3">
            <h3 className="text-[13px] font-bold">
              {String(selected.fields["이름"])} · {t("withdrawn.source")}
            </h3>
            {selected.candidates.map((candidate) => (
              <div key={candidate.id} className="my-3 border rounded p-2">
                <h4 className="font-bold text-sm">
                  {t("withdrawn.current")} · {candidate.name} ·{" "}
                  {t(`status.${candidate.status}`)}
                </h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(candidate.fields).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <dt>{key} :</dt>
                      <dd>
                        {value || t("detail.inputRequired")} →{" "}
                        {selected.fields[key] == null
                          ? t("detail.inputRequired")
                          : String(selected.fields[key])}{" "}
                        (
                        {value
                          ? t("withdrawn.keep")
                          : t("withdrawn.supplement")}
                        )
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(selected.fields).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <dt className="inline text-secondary">{key} : </dt>
                  <dd className="inline whitespace-pre-wrap break-words">
                    {value == null ? t("detail.inputRequired") : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {(preview.error || commit.error) && (
          <p role="alert" className="text-red-600">
            {t("withdrawn.failed")}
          </p>
        )}
        {commit.data && (
          <p role="status">{t("withdrawn.result", commit.data)}</p>
        )}
        <div className="sticky bottom-0 bg-canvas py-3 flex justify-end gap-2">
          <Button variant="outline" disabled={pending} onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            disabled={
              pending ||
              !!commit.data ||
              !Object.values(decisions).some((d) => d.reviewed)
            }
            onClick={() => commit.mutate()}
          >
            {t("withdrawn.apply", {
              count: Object.values(decisions).filter((d) => d.reviewed).length,
            })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
