import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { SchoolFormDialog } from "../components/school-form-dialog";
import { SchoolChildModal } from "./school-list-page";
import type { School } from "../types/school";

export function SchoolDetailPage() {
  const { id } = useParams();
  const { hash } = useLocation();
  const { t } = useTranslation("sch");
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [tab, setTab] = useState<"bands" | "schedules" | null>(null);
  const {
    data: school,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["school", id],
    queryFn: async () =>
      (await apiClient.get<School>(`/acm/sch/schools/${id}`)).data,
  });
  useEffect(() => {
    if (school && hash)
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ block: "start" });
  }, [school, hash]);
  const box =
    "rounded-lg border border-[var(--border-subtle)] bg-surface p-4 space-y-3";
  const row = (label: string, value?: string | null) => (
    <div>
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="min-h-5 text-sm whitespace-pre-wrap break-words">
        {value}
      </dd>
    </div>
  );
  if (isLoading) return <div className={box}>{t("loading")}</div>;
  if (error || !school)
    return (
      <div role="alert" className={box}>
        {t("catalog.loadError")}{" "}
        <button onClick={() => void refetch()}>{t("catalog.retry")}</button>
      </div>
    );
  const remove = async () => {
    if (
      !(await confirm({
        title: t("actions.delete"),
        description: school.name,
        variant: "destructive",
      }))
    )
      return;
    try {
      await apiClient.delete(`/acm/sch/schools/${id}`);
      navigate("/admin/sch");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("catalog.saveError"));
    }
  };
  return (
    <div className="space-y-4">
      <Link to="/admin/sch" className="text-sm text-accent-700">
        ← {t("title")}
      </Link>
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-2xl font-semibold break-words">{school.name}</h1>
        <div className="flex gap-3">
          <button onClick={() => setEdit(true)}>{t("actions.edit")}</button>
          <button className="text-red-600" onClick={() => void remove()}>
            {t("actions.delete")}
          </button>
        </div>
      </div>
      <section className={box}>
        <h2 className="text-[13px] font-bold">{t("catalog.basic")}</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {row(t("columns.name"), school.name)}
          {row(t("columns.curriculum"), school.curriculumDescription)}
          {row(t("columns.region"), school.region)}
          {row(
            t("columns.authorized"),
            t(
              school.isAuthorized === null
                ? "authorized.unknown"
                : school.isAuthorized
                  ? "authorized.yes"
                  : "authorized.no",
            ),
          )}
          {row(t("columns.eligibility"), school.eligibility)}
          {row(t("columns.notes"), school.notes)}
        </dl>
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="text-[13px] font-bold">
            {t("catalog.admissions")} ({school.admissions?.length ?? 0})
          </h2>
          <button
            className="text-sm text-accent-700"
            onClick={() => setEdit(true)}
          >
            + {t("catalog.addAdmission")}
          </button>
        </div>
        <p className="text-xs text-secondary">{t("catalog.scheduleNotice")}</p>
        {!school.admissions?.length && (
          <div className={box}>{t("catalog.noAdmissions")}</div>
        )}
        {school.admissions?.map((a, i) => (
          <section
            id={`admission-${a.id}`}
            key={a.id ?? i}
            className={box + " scroll-mt-20"}
          >
            <h3 className="text-[13px] font-bold">
              {a.targetLabel || t("catalog.admissionNumber", { number: i + 1 })}
            </h3>
            <dl className="space-y-3">
              {row(t("columns.target"), a.targetLabel)}
              {row(t("columns.exam"), a.examContent)}
              {row(t("columns.schedule"), a.scheduleText)}
            </dl>
          </section>
        ))}
      </section>
      <div className="flex flex-wrap gap-3 text-sm">
        <button className="underline" onClick={() => setTab("bands")}>
          {t("catalog.legacyBands")}
        </button>
        <button className="underline" onClick={() => setTab("schedules")}>
          {t("catalog.legacySchedules")}
        </button>
      </div>
      <p className="text-xs text-secondary">{t("catalog.legacyNotice")}</p>
      <SchoolFormDialog
        open={edit}
        initial={school}
        onClose={() => setEdit(false)}
        onSaved={() => void refetch()}
      />
      {tab && (
        <SchoolChildModal
          school={school}
          tab={tab}
          onClose={() => setTab(null)}
          onChanged={() => void refetch()}
        />
      )}
    </div>
  );
}
