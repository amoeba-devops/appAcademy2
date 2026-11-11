import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/ui/page-header";
import { StdForm } from "../components/std-form";
import { useStudent } from "../hooks/use-students";
import type { StudentCreatePrefill } from "../types";

interface NavState {
  returnTo?: string;
  studentCreatePrefill?: StudentCreatePrefill;
  initialStatus?: "ACTIVE" | "WITHDRAWN";
}

/**
 * REQ-261103B — 학생 등록(`/admin/std/new`)·수정(`/admin/std/:id/edit`) 전체 페이지.
 * 등록 진입값(사이트·퇴원생 여부)은 목록에서 navigation state 로 넘긴다.
 */
export function StdEditPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("std");
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as NavState;
  const { data: student, isLoading } = useStudent(id);

  const back = id
    ? `/admin/std/${id}`
    : state.returnTo?.startsWith("/admin/std")
      ? state.returnTo
      : "/admin/std";
  const leave = (to: string) =>
    navigate(to, { state: id ? { returnTo: state.returnTo } : undefined });

  if (id && isLoading)
    return (
      <p className="text-secondary py-12 text-center">
        {t("common:status.loading")}
      </p>
    );
  if (id && !student)
    return (
      <p className="text-secondary py-12 text-center">{t("detail.notFound")}</p>
    );

  return (
    <div className="admin-form-width space-y-4">
      <PageHeader
        back={{
          to: back,
          label: student ? student.name : t("common:nav.std"),
        }}
        title={student ? t("form.titleEdit") : t("form.titleCreate")}
      />
      <StdForm
        key={student?.id ?? "new"}
        initial={student}
        prefill={state.studentCreatePrefill}
        initialStatus={state.initialStatus}
        onCancel={() => leave(back)}
        onSaved={(saved) =>
          navigate(`/admin/std/${saved.id}`, {
            replace: true,
            state: { returnTo: state.returnTo },
          })
        }
      />
    </div>
  );
}
