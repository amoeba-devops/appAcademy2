import {
  CLASS_FIELDS,
  emptyClassInfo,
  TeacherClassFields,
} from "./teacher-class-fields";
import type { TeacherClassInfo } from "../types";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TeacherDetail } from "@/modules/tch/types";
import { TeacherMultiCombo } from "@/modules/cal/components/teacher-multi-combo";
import { useCreateStudent, useUpdateStudent } from "../hooks/use-students";
import type {
  ParentInput,
  StudentCreatePrefill,
  StudentDetail,
} from "../types";
import { STD_SITES } from "../types";
import { ParentSubform } from "./parent-subform";

interface StdFormModalProps {
  initialStatus?: "ACTIVE" | "WITHDRAWN";
  open: boolean;
  onClose: () => void;
  initial?: StudentDetail;
  /** create 모드에서 폼을 미리 채우기 위한 값 (edit 모드에는 영향 없음) */
  prefill?: StudentCreatePrefill;
}

type FormValues = {
  stdSite: string;
  stdName: string;
  stdEnglishName: string;
  stdGender: string;
  stdBirthDate: string;
  stdPhone: string;
  stdEmail: string;
  stdResidence: string;
  stdSchool: string;
  stdGrade: string;
  stdMapReading: string;
  stdMapMath: string;
  stdMapLanguage: string;
  stdGoalsNote: string;
  stdSpecialNote: string;
  stdStatus: string;
  stdStartDate: string;
  stdAdmissionDate: string;
  stdWithdrawnDate: string;
  stdWithdrawnReason: string;
  stdParents: ParentInput[];
};

const inputClass =
  "w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary placeholder:italic placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent-500/40";
const labelClass = "block text-xs text-secondary mb-1";

export function StdFormModal({
  open,
  onClose,
  initial,
  prefill,
  initialStatus = "ACTIVE",
}: StdFormModalProps) {
  const { t } = useTranslation("std");
  const isEdit = !!initial;
  const [serverError, setServerError] = useState<string | null>(null);
  // REQ-260903B — 담당강사 복수선택 (첫번째 = 대표, 최대 5명)
  const initialTeachers = (): TeacherDetail[] =>
    (initial?.teachers ?? []).map(
      (x) => ({ id: x.tchId, name: x.name }) as TeacherDetail,
    );
  const [selectedTeachers, setSelectedTeachers] =
    useState<TeacherDetail[]>(initialTeachers);
  useEffect(() => {
    if (open) setSelectedTeachers(initialTeachers());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const [classInfos, setClassInfos] = useState<
    Record<string, TeacherClassInfo>
  >(() =>
    Object.fromEntries(
      (initial?.teacherClassInfos ?? []).map((info) => [info.tchId, info]),
    ),
  );
  const [legacyTeacherId, setLegacyTeacherId] = useState<string>();
  const changeTeachers = (teachers: TeacherDetail[]) => {
    setSelectedTeachers(teachers);
    if (legacyTeacherId && !teachers.some((t) => t.id === legacyTeacherId))
      setLegacyTeacherId(undefined);
  };
  const assignLegacy = (tchId: string) => {
    const info = classInfos[tchId] ?? emptyClassInfo(tchId);
    const merged = { ...info };
    for (const field of CLASS_FIELDS)
      if (!merged[field]?.trim()) merged[field] = initial?.[field] ?? "";
    setClassInfos((prev) => ({ ...prev, [tchId]: merged }));
    setLegacyTeacherId(tchId);
  };

  const {
    register,
    watch,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      stdSite: initial?.site ?? prefill?.stdSite ?? "",
      stdName: initial?.name ?? prefill?.stdName ?? "",
      stdEnglishName: initial?.englishName ?? "",
      stdGender: initial?.gender ?? "",
      stdBirthDate: initial?.birthDate ?? "",
      stdPhone: initial?.phone ?? prefill?.stdPhone ?? "",
      stdEmail: initial?.email ?? "",
      stdResidence: initial?.residence ?? "",
      stdSchool: initial?.school ?? prefill?.stdSchool ?? "",
      stdGrade: initial?.grade ?? prefill?.stdGrade ?? "",
      stdMapReading:
        initial?.mapReading != null ? String(initial.mapReading) : "",
      stdMapMath: initial?.mapMath != null ? String(initial.mapMath) : "",
      stdMapLanguage:
        initial?.mapLanguage != null ? String(initial.mapLanguage) : "",
      stdGoalsNote: initial?.goalsNote ?? "",
      stdSpecialNote: initial?.specialNote ?? "",
      stdStatus: initial?.status ?? initialStatus,
      stdAdmissionDate: initial?.admissionDate ?? "",
      stdWithdrawnDate: initial?.withdrawnDate ?? "",
      stdWithdrawnReason: initial?.withdrawnReason ?? "",
      stdStartDate: initial?.startDate ?? prefill?.stdStartDate ?? "",
      stdParents:
        initial?.parents?.map((p) => ({
          parId: p.id,
          parName: p.name,
          parRelation: p.relation ?? "",
          parPhone: p.phone ?? "",
          parEmail: p.email ?? "",
          spIsPrimary: p.isPrimary,
        })) ??
        prefill?.stdParents ??
        [],
    },
  });

  const createMut = useCreateStudent();
  const updateMut = useUpdateStudent(initial?.id ?? "");
  const isLoading = createMut.isPending || updateMut.isPending;

  const isWithdrawn = watch("stdStatus") === "WITHDRAWN";

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const dto: Record<string, unknown> = {};
    Object.entries(values).forEach(([k, v]) => {
      if (k === "stdParents") return;
      if (v !== "") dto[k] = v;
    });
    if (isEdit) dto.stdSite = values.stdSite || null;
    // REQ-260903B — 담당강사 복수: 전체 목록 동기화(빈 배열 = 전부 해제).
    dto.stdTeacherIds = selectedTeachers.map((tch) => tch.id);
    dto.stdTeacherClassInfos = selectedTeachers.map(
      (tch) => classInfos[tch.id] ?? emptyClassInfo(tch.id),
    );
    if (legacyTeacherId) dto.stdClassInfoLegacyTeacherId = legacyTeacherId;
    if (dto.stdMapReading) dto.stdMapReading = Number(dto.stdMapReading);
    if (dto.stdMapMath) dto.stdMapMath = Number(dto.stdMapMath);
    if (dto.stdMapLanguage) dto.stdMapLanguage = Number(dto.stdMapLanguage);

    // Sanitize parents: drop empty rows + empty optional fields
    const cleanParents = (values.stdParents ?? [])
      .filter((p) => (p.parName ?? "").trim() !== "")
      .map((p) => {
        const o: Record<string, unknown> = { parName: p.parName.trim() };
        if (p.parId) o.parId = p.parId;
        if (p.parRelation) o.parRelation = p.parRelation;
        if (p.parPhone) o.parPhone = p.parPhone;
        if (p.parEmail) o.parEmail = p.parEmail;
        if (p.spIsPrimary) o.spIsPrimary = true;
        return o;
      });
    dto.stdParents = cleanParents;

    try {
      if (isEdit) {
        await updateMut.mutateAsync(dto);
      } else {
        await createMut.mutateAsync(dto);
      }
      reset();
      setSelectedTeachers([]);
      onClose();
    } catch (e) {
      const err = e as {
        response?: {
          data?: {
            error?: { code?: string; message?: string | string[] };
            message?: string;
          };
        };
        message?: string;
      };
      // GlobalExceptionFilter 응답 shape: { error: { code, message } } —
      // 도메인 코드(EMAIL_*)는 message 자리에 오므로 code/message 둘 다 매칭한다.
      const apiErr = err.response?.data?.error;
      const rawMsg = Array.isArray(apiErr?.message)
        ? apiErr.message.join("\n")
        : apiErr?.message;
      const code =
        apiErr?.code === "HTTP_400" || apiErr?.code === "HTTP_409"
          ? rawMsg
          : (apiErr?.code ?? rawMsg);
      // FIX-260922 — 이름 중복(사전 검사 NAME_DUPLICATE 또는 DB 제약 UNIQUE_VIOLATION).
      const isNameDuplicate =
        code === "NAME_DUPLICATE" ||
        (apiErr?.code === "UNIQUE_VIOLATION" &&
          String(rawMsg ?? "").includes("uq_acm_std_ent_name"));
      setServerError(
        isNameDuplicate
          ? t("form.error.nameDuplicate", {
              defaultValue:
                "같은 이름의 학생이 이미 등록되어 있습니다(재원·비활성·퇴원 포함). 기존 학생을 수정하거나 이름을 구분해 주세요.",
            })
          : code === "EMAIL_DUPLICATE"
            ? t("form.error.emailDuplicate", {
                defaultValue: "이미 사용 중인 이메일입니다.",
              })
            : code === "EMAIL_REQUIRED"
              ? t("form.error.emailRequired", {
                  defaultValue: "이메일을 입력해야 저장할 수 있습니다.",
                })
              : (rawMsg ??
                err.response?.data?.message ??
                err.message ??
                t("form.error.save", { defaultValue: "저장에 실패했습니다." })),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("form.titleEdit") : t("form.titleCreate")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <fieldset className="rounded-md border border-[var(--border-subtle)] bg-surface p-4 space-y-3">
            <legend className="text-[13px] font-bold">
              {t("withdrawn.datesTitle")}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={labelClass}>
                {t("withdrawn.admissionDate")}
                <input
                  type="date"
                  {...register("stdAdmissionDate")}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                {t("withdrawn.withdrawnDate")}
                <input
                  type="date"
                  {...register("stdWithdrawnDate")}
                  className={inputClass}
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                {t("withdrawn.reason")}
                <textarea
                  placeholder={t("detail.enterValue")}
                  {...register("stdWithdrawnReason")}
                  className={inputClass}
                  maxLength={1000}
                />
              </label>
            </div>
          </fieldset>
          {/* 기본 인적사항 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] bg-surface p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">
              {t("form.sectionBasic")}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} htmlFor="std-site">
                  {t("site.label")}
                  {!isEdit && !isWithdrawn ? " *" : ""}
                </label>
                <select
                  id="std-site"
                  {...register("stdSite", {
                    required: !isEdit && !isWithdrawn,
                  })}
                  required={!isEdit && !isWithdrawn}
                  className={inputClass}
                >
                  <option value="">{t("site.UNASSIGNED")}</option>
                  {STD_SITES.map((site) => (
                    <option key={site} value={site}>
                      {t(`site.${site}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("field.name")} *</label>
                <input
                  placeholder={t("detail.enterValue")}
                  {...register("stdName", { required: true })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t("field.englishName")}</label>
                <input
                  placeholder={t("detail.enterValue")}
                  {...register("stdEnglishName")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t("field.gender")}</label>
                <select {...register("stdGender")} className={inputClass}>
                  <option value="">—</option>
                  <option value="M">{t("gender.M")}</option>
                  <option value="F">{t("gender.F")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("field.birthDate")}</label>
                <input
                  type="date"
                  {...register("stdBirthDate")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {t("field.phone", "전화번호")}
                </label>
                <input
                  placeholder={t("detail.enterValue")}
                  {...register("stdPhone")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {t("field.email", "이메일")}
                  {!isWithdrawn ? " *" : ""}
                </label>
                <input
                  placeholder={t("detail.enterValue")}
                  type="email"
                  {...register("stdEmail", {
                    required:
                      !isWithdrawn &&
                      (t("form.error.emailRequired", {
                        defaultValue: "이메일을 입력해야 저장할 수 있습니다.",
                      }) as string),
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: t("form.error.emailInvalid", {
                        defaultValue: "올바른 이메일 형식이 아닙니다.",
                      }),
                    },
                  })}
                  className={inputClass}
                />
                {errors.stdEmail && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.stdEmail.message}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>{t("field.residence")}</label>
                <input
                  placeholder={t("detail.enterValue")}
                  {...register("stdResidence")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t("field.school")}</label>
                <input
                  placeholder={t("detail.enterValue")}
                  {...register("stdSchool")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t("field.grade")}</label>
                <input
                  {...register("stdGrade")}
                  className={inputClass}
                  placeholder="G5, G8, 중1…"
                />
              </div>
            </div>
          </fieldset>

          {/* 학부모 정보 */}
          <ParentSubform
            control={
              control as unknown as import("react-hook-form").Control<
                import("react-hook-form").FieldValues
              >
            }
            register={
              register as unknown as import("react-hook-form").UseFormRegister<
                import("react-hook-form").FieldValues
              >
            }
          />

          {/* MAP 점수 — 서버 DTO(@Min 100/@Max 350)와 동일 범위를 폼에서 선검증.
              범위 밖 레거시 값이 있으면 어떤 필드를 고쳐도 저장 전체가 400 나므로
              해당 필드에 구체적 오류를 표시해 운영자가 바로잡을 수 있게 한다. */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] bg-surface p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">
              {t("form.sectionMap")}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["stdMapReading", "stdMapMath", "stdMapLanguage"] as const).map(
                (name, i) => (
                  <div key={name}>
                    <label className={labelClass}>
                      {t(
                        [
                          "field.mapReading",
                          "field.mapMath",
                          "field.mapLanguage",
                        ][i],
                      )}
                    </label>
                    <input
                      placeholder={t("detail.enterValue")}
                      type="number"
                      {...register(name, {
                        validate: (v) =>
                          v === "" ||
                          (Number(v) >= 100 && Number(v) <= 350) ||
                          (t("form.error.mapRange", {
                            defaultValue: "MAP 점수는 100~350 사이여야 합니다.",
                          }) as string),
                      })}
                      className={inputClass}
                    />
                    {errors[name] && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors[name]?.message}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          </fieldset>

          {/* 수업 정보 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] bg-surface p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">
              {t("form.sectionClass")}
            </legend>
            <TeacherMultiCombo
              value={selectedTeachers}
              onChange={changeTeachers}
              max={5}
            />
            <p className="text-xs text-secondary">
              {t("classInfo.unlinkHint")}
            </p>
            {initial?.classInfoLegacyPending && (
              <div className="border rounded p-3 bg-surface">
                <h4 className="text-[13px] font-bold">
                  {t("classInfo.legacyTitle")}
                </h4>
                {CLASS_FIELDS.map((field) => (
                  <p
                    key={field}
                    className="text-sm whitespace-pre-wrap break-words"
                  >
                    {t(`field.${field}`)} :{" "}
                    {initial[field] || (
                      <span className="italic text-secondary">
                        {t("detail.inputRequired")}
                      </span>
                    )}
                  </p>
                ))}
                <p className="text-xs text-secondary">
                  {t("classInfo.assignHint")}
                </p>
              </div>
            )}
            {!selectedTeachers.length && (
              <p className="italic text-secondary">
                {t("classInfo.noTeacher")}
              </p>
            )}
            {selectedTeachers.map((teacher) => (
              <div
                key={teacher.id}
                className="rounded border bg-surface p-4 space-y-3"
              >
                <h4 className="text-[13px] font-bold">
                  {teacher.name} · {t("form.sectionClass")}
                </h4>
                {initial?.classInfoLegacyPending && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => assignLegacy(teacher.id)}
                  >
                    {t(
                      legacyTeacherId === teacher.id
                        ? "classInfo.assigned"
                        : "classInfo.assign",
                    )}
                  </Button>
                )}
                <TeacherClassFields
                  value={classInfos[teacher.id] ?? emptyClassInfo(teacher.id)}
                  onChange={(info) =>
                    setClassInfos((prev) => ({ ...prev, [teacher.id]: info }))
                  }
                />
              </div>
            ))}
          </fieldset>

          {/* 메모/상태 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] bg-surface p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">
              {t("form.sectionMemo")}
            </legend>
            <div>
              <label className={labelClass}>{t("field.goalsNote")}</label>
              <textarea
                placeholder={t("detail.enterValue")}
                {...register("stdGoalsNote")}
                rows={2}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary placeholder:italic placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent-500/40 resize-none"
              />
            </div>
            <div>
              <label className={labelClass}>{t("field.specialNote")}</label>
              <textarea
                placeholder={t("detail.enterValue")}
                {...register("stdSpecialNote")}
                rows={2}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary placeholder:italic placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent-500/40 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t("field.status")}</label>
                <select {...register("stdStatus")} className={inputClass}>
                  <option value="ACTIVE">{t("status.ACTIVE")}</option>
                  <option value="INACTIVE">{t("status.INACTIVE")}</option>
                  <option value="WITHDRAWN">{t("status.WITHDRAWN")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("field.startDate")}</label>
                <input
                  type="date"
                  {...register("stdStartDate")}
                  className={inputClass}
                />
              </div>
            </div>
          </fieldset>

          {serverError && (
            <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t("common:status.saving") : t("common:actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
