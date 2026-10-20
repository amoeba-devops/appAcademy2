import { StudentDeleteButton } from '../components/student-deletion';
import { StatusHistoryPanel } from "../components/status-history-panel";
import { LifecycleEditor } from "@/modules/dsh/components/lifecycle-editor";
import { OperatingPeriodEditor } from "@/modules/dsh/components/operating-period-editor";
import { CLASS_FIELDS } from "../components/teacher-class-fields";
import { WithdrawnRecordPanel } from "../components/withdrawn-record-panel";
import { useAuthStore } from "@/stores/auth.store";
import { useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Pencil, UserX, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Section as UiSection } from "@/components/ui/section";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useStudent } from "../hooks/use-students";
import {
  useUnlinkParentFromStudent,
  useSetPrimaryParent,
} from "../hooks/use-parents";
import { StdStatusBadge } from "../components/std-status-badge";
import { StdFormModal } from "../components/std-form-modal";
import { ParentPickOrCreateDialog } from "../components/parent-pick-or-create-dialog";
import { PortalAccountPanel } from "@/modules/portal-admin/components/portal-account-panel";

export function displayStudentValue(
  value: string | number | boolean | null | undefined,
  missing: string,
): React.ReactNode {
  if (value == null || (typeof value === "string" && !value.trim()))
    return <span className="italic text-secondary">{missing}</span>;
  return typeof value === "boolean" ? String(value) : value;
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  const { t } = useTranslation("std");
  return (
    <div className="py-1.5 flex flex-wrap items-baseline gap-x-1">
      <dt className="text-xs text-secondary">{label} :</dt>
      <dd className="text-sm text-primary whitespace-pre-wrap break-words min-w-0">
        {displayStudentValue(value, t("detail.inputRequired"))}
      </dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <UiSection title={title}>
      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-3">{children}</dl>
    </UiSection>
  );
}

export function StdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const { t } = useTranslation("std");
  const confirm = useConfirm();
  const role = useAuthStore((s) => s.user?.role);
  const [showEdit, setShowEdit] = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);

  const { data: student, isLoading } = useStudent(id);
  const unlinkMut = useUnlinkParentFromStudent(id ?? "");
  const setPrimaryMut = useSetPrimaryParent(id ?? "");

  if (isLoading) {
    return (
      <p className="text-secondary py-12 text-center">
        {t("common:status.loading")}
      </p>
    );
  }

  if (!student) {
    return (
      <p className="text-secondary py-12 text-center">{t("detail.notFound")}</p>
    );
  }

  const handleDeactivate = () => {
    document.getElementById("student-status-history")?.focus();
    document
      .getElementById("student-status-history")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="w-full min-w-0 space-y-4 bg-canvas">
      {/* Header — UI-261019 P4 */}
      <PageHeader
        back={{
          to:
            returnTo &&
            /^\/admin\/std(?:\/(?:tpi|trinity|santa-croce|withdrawn))?(?:\?[^#]*)?$/.test(
              returnTo,
            )
              ? returnTo
              : student.status === "WITHDRAWN"
                ? "/admin/std/withdrawn"
                : student.site
                  ? `/admin/std/${{ TPI: "tpi", TRINITY: "trinity", SANTACROCE: "santa-croce" }[student.site]}`
                  : "/admin/std",
          label: t("common:nav.std"),
        }}
        title={
          <>
            {student.name}
            {student.englishName && (
              <span className="ml-2 text-lg font-normal text-secondary">
                ({student.englishName})
              </span>
            )}
          </>
        }
        meta={
          <>
            <StdStatusBadge status={student.status} />
            {student.sourceInquiry && (
              <Link
                to={`/admin/csl/${student.sourceInquiry.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-xs text-accent-700 hover:bg-accent-100"
              >
                {t("detail.sourceInquiry", "신규상담 연결")} #
                {student.sourceInquiry.seqNo}
                {" · "}
                {t(
                  `csl:stage.${student.sourceInquiry.currentStage}`,
                  student.sourceInquiry.currentStage,
                )}
              </Link>
            )}
          </>
        }
        actions={
          <>
            <StudentDeleteButton id={student.id} />
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              <Pencil size={14} className="mr-1" />
              {t("actions.edit")}
            </Button>
            {student.status === "ACTIVE" && (
              <Button variant="outline" size="sm" onClick={handleDeactivate}>
                <UserX size={14} className="mr-1" />
                {t("actions.deactivate")}
              </Button>
            )}
          </>
        }
      />

      {/* 기본 인적사항 */}
      <Section title={t("form.sectionBasic")}>
        <InfoRow label={t("field.name")} value={student.name} />
        <InfoRow label={t("field.englishName")} value={student.englishName} />
        <InfoRow
          label={t("field.gender")}
          value={
            student.gender === "M"
              ? t("gender.M")
              : student.gender === "F"
                ? t("gender.F")
                : undefined
          }
        />
        <InfoRow label={t("field.birthDate")} value={student.birthDate} />
        <InfoRow label={t("field.phone")} value={student.phone} />
        <InfoRow label={t("field.residence")} value={student.residence} />
        <InfoRow
          label={t("site.label")}
          value={t(`site.${student.site ?? "UNASSIGNED"}`)}
        />
        <InfoRow label={t("field.school")} value={student.school} />
        <InfoRow label={t("field.grade")} value={student.grade} />
        <InfoRow label={t("field.startDate")} value={student.startDate} />
        {student.status === "WITHDRAWN" && (
          <InfoRow label={t("field.endDate")} value={student.endDate} />
        )}
        <InfoRow
          label={t("withdrawn.admissionDate")}
          value={student.admissionDate}
        />
        {student.status === "WITHDRAWN" && (
          <>
            <InfoRow
              label={t("withdrawn.withdrawnDate")}
              value={student.withdrawnDate}
            />
            <InfoRow
              label={t("withdrawn.reason")}
              value={student.withdrawnReason}
            />
          </>
        )}
      </Section>

      {(role === "ADMIN" || role === "APP_ADMIN") && (
        <WithdrawnRecordPanel studentId={student.id} />
      )}

      {/* MAP 점수 */}
      <Section title={t("form.sectionMap")}>
        <InfoRow label={t("field.mapReading")} value={student.mapReading} />
        <InfoRow label={t("field.mapMath")} value={student.mapMath} />
        <InfoRow label={t("field.mapLanguage")} value={student.mapLanguage} />
        <div className="col-span-1 sm:col-span-3 py-1.5">
          <dt className="text-xs text-secondary">{t("field.mapNote")} :</dt>
          <dd className="text-sm text-primary whitespace-pre-wrap">
            {displayStudentValue(student.mapNote, t("detail.inputRequired"))}
          </dd>
        </div>
      </Section>

      {/* One independent profile per assigned teacher. */}
      <div className="space-y-4">
        <h2 className="text-[13px] font-bold">
          {t("form.sectionClass")} ({student.teachers?.length ?? 0})
        </h2>
        {!student.teachers?.length && (
          <Section title={t("form.sectionClass")}>
            <InfoRow label={t("field.teacher")} value={student.teacher} />
            <p className="col-span-full italic text-secondary">
              {t("classInfo.noTeacher")}
            </p>
          </Section>
        )}
        {student.teachers?.map((teacher) => {
          const info = student.teacherClassInfos?.find(
            (x) => x.tchId === teacher.tchId,
          );
          return (
            <Section
              key={teacher.tchId}
              title={`${teacher.name} · ${t("form.sectionClass")}`}
            >
              <InfoRow label={t("field.teacher")} value={teacher.name} />
              {CLASS_FIELDS.map((field) => (
                <InfoRow
                  key={field}
                  label={t(`field.${field}`)}
                  value={info?.[field]}
                />
              ))}
            </Section>
          );
        })}
        {student.classInfoLegacyPending && (
          <Section title={t("classInfo.legacyTitle")}>
            {CLASS_FIELDS.map((field) => (
              <InfoRow
                key={field}
                label={t(`field.${field}`)}
                value={student[field]}
              />
            ))}
            <div className="col-span-full">
              <Button variant="outline" onClick={() => setShowEdit(true)}>
                {t("classInfo.assign")}
              </Button>
            </div>
          </Section>
        )}
      </div>

      {/* 메모 */}
      <Section title={t("form.sectionMemo")}>
        <div className="col-span-1 sm:col-span-3 py-1.5">
          <dt className="text-xs text-secondary">{t("field.goalsNote")} :</dt>
          <dd className="text-sm text-primary whitespace-pre-wrap">
            {displayStudentValue(student.goalsNote, t("detail.inputRequired"))}
          </dd>
        </div>
        <div className="col-span-1 sm:col-span-3 py-1.5">
          <dt className="text-xs text-secondary">{t("field.specialNote")} :</dt>
          <dd className="text-sm text-primary whitespace-pre-wrap">
            {displayStudentValue(
              student.specialNote,
              t("detail.inputRequired"),
            )}
          </dd>
        </div>
        <InfoRow
          label={t("field.satisfactionNote")}
          value={student.satisfactionNote}
        />
        <InfoRow
          label={t("field.lastCounselDate")}
          value={student.lastCounselDate}
        />
      </Section>

      {/* 포털 계정 (PLN-260706) */}
      <UiSection title={t("common:portalAccount.title")}>
        <PortalAccountPanel
          kind="STUDENT"
          refId={id!}
          issueDisabled={!student.email}
          issueDisabledNote={t("common:portalAccount.emailRequired", {
            defaultValue:
              "학생 이메일을 등록해야 포털계정을 발급할 수 있습니다.",
          })}
        />
      </UiSection>

      {/* 학부모 */}
      <UiSection
        title={t("form.sectionParents", "학부모 정보")}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowParentPicker(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("form.addParent", "학부모 추가")}
          </Button>
        }
      >
        {(!student.parents || student.parents.length === 0) && (
          <p className="py-3 text-xs text-secondary">
            {t(
              "form.parentsEmpty",
              "등록된 학부모가 없습니다. + 버튼으로 추가하세요.",
            )}
          </p>
        )}
        <div className="divide-y divide-[var(--border-subtle)]">
          {student.parents?.map((p) => (
            <div
              key={p.linkId}
              className="flex flex-wrap items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-primary">
                  {p.name}
                  {p.relation && (
                    <span className="ml-2 text-xs text-secondary">
                      ({p.relation})
                    </span>
                  )}
                  {p.isPrimary && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent">
                      <Star className="h-3 w-3" />
                      {t("field.parentPrimary", "대표학부모")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-secondary">
                  {displayStudentValue(p.phone, t("detail.inputRequired"))} ·{" "}
                  {displayStudentValue(p.email, t("detail.inputRequired"))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!p.isPrimary && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={setPrimaryMut.isPending}
                    onClick={() => setPrimaryMut.mutate(p.id)}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    {t("actions.setPrimary", "대표 지정")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unlinkMut.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: t(
                        "actions.confirmUnlink",
                        "이 학부모 연결을 해제하시겠습니까?",
                      ),
                      variant: "destructive",
                    });
                    if (ok) unlinkMut.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {t("actions.unlink", "해제")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </UiSection>

      <p className="text-xs text-secondary">
        {t("detail.updatedAt")}: {new Date(student.updatedAt).toLocaleString()}
      </p>

      {id && <StatusHistoryPanel id={id} status={student.status} />}
      {id && <LifecycleEditor subjectKind="STUDENT" subjectId={id} />}
      {id && <OperatingPeriodEditor kind="STUDENT" subjectId={id} />}
      <StdFormModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        initial={student}
      />
      {id && (
        <ParentPickOrCreateDialog
          open={showParentPicker}
          onClose={() => setShowParentPicker(false)}
          stdId={id}
        />
      )}
    </div>
  );
}
