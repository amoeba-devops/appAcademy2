"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { mapTestSchema, type MapTestInput } from "@/lib/portal/schemas";
import { GRADE_OPTIONS } from "@/lib/portal/site-content";
import { tFormError } from "@/i18n/form-error";

// Legal privacy disclosure — Korean is authoritative; other locales fall back to ko.
// Keys kept in common namespace so it can be updated without touching the form.
const PRIVACY_EXCERPT_KO = `제1조 (개인정보의 처리 목적)
트리니티 아카데미(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리한 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.

제2조 (개인정보의 수집 항목 및 수집 방법)
회사는 MAP Test 응시 신청 및 상담 제공을 위해 필요한 최소한의 개인정보를 수집합니다 (성명·생년월일·연락처·이메일·응시 지역).

제3조 ~ 제13조
개인정보의 보유·이용 기간, 제3자 제공, 처리 위탁, 정보 주체의 권리, 파기 절차, 안전성 확보 조치, 담당 부서, 고지 의무 등은 별도의 개인정보 처리방침 전문에 따릅니다.`;

export function MapTestForm() {
  const { t } = useTranslation(["portal", "common"]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MapTestInput>({
    resolver: zodResolver(mapTestSchema),
  });

  const [submitState, setSubmitState] = useState<
    { kind: "idle" } | { kind: "ok" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(data: MapTestInput) {
    setSubmitState({ kind: "idle" });
    try {
      const res = await fetch("/api/portal/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "MAP_TEST_INQUIRY", payload: data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? t("portal:map-test.form.error-default"));
      }
      reset();
      setSubmitState({ kind: "ok" });
    } catch (e) {
      setSubmitState({
        kind: "error",
        message: e instanceof Error ? e.message : t("portal:map-test.form.error-default"),
      });
    }
  }

  if (submitState.kind === "ok") {
    return <SuccessCard onReset={() => setSubmitState({ kind: "idle" })} />;
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("portal:map-test.form.student-name-ko")} required error={tFormError(errors.studentNameKo?.message)}>
          <input
            type="text"
            placeholder={t("portal:map-test.form.student-name-ko-placeholder")}
            className="input"
            {...register("studentNameKo")}
          />
        </Field>
        <Field label={t("portal:map-test.form.student-name-en")} required error={tFormError(errors.studentNameEn?.message)}>
          <input
            type="text"
            placeholder={t("portal:map-test.form.student-name-en-placeholder")}
            className="input"
            {...register("studentNameEn")}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("portal:map-test.form.birth-date")} required error={tFormError(errors.birthDate?.message)}>
          <input type="date" className="input" {...register("birthDate")} />
        </Field>
        <Field label={t("portal:map-test.form.grade")} required error={tFormError(errors.grade?.message)}>
          <select className="input" defaultValue="" {...register("grade")}>
            <option value="" disabled>
              {t("portal:map-test.form.grade-placeholder")}
            </option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t("portal:map-test.form.gender")} required error={tFormError(errors.gender?.message)}>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              value="M"
              className="h-4 w-4 accent-navy"
              {...register("gender")}
            />
            {t("portal:map-test.form.gender-male")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              value="F"
              className="h-4 w-4 accent-navy"
              {...register("gender")}
            />
            {t("portal:map-test.form.gender-female")}
          </label>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("portal:map-test.form.phone")} required error={tFormError(errors.phone?.message)}>
          <input
            type="tel"
            autoComplete="tel"
            placeholder={t("portal:map-test.form.phone-placeholder")}
            className="input"
            {...register("phone")}
          />
        </Field>
        <Field label={t("portal:map-test.form.parent-email")} required error={tFormError(errors.parentEmail?.message)}>
          <input
            type="email"
            autoComplete="email"
            placeholder={t("portal:map-test.form.parent-email-placeholder")}
            className="input"
            {...register("parentEmail")}
          />
        </Field>
      </div>

      <Field label={t("portal:map-test.form.test-location")} required error={tFormError(errors.testLocation?.message)}>
        <input
          type="text"
          placeholder={t("portal:map-test.form.test-location-placeholder")}
          className="input"
          {...register("testLocation")}
        />
      </Field>

      <Field
        label={t("portal:map-test.form.privacy-title")}
        required
        error={tFormError(errors.privacyAgreed?.message)}
      >
        <div className="max-h-32 overflow-y-auto whitespace-pre-line rounded-lg border border-slate-200 bg-cream p-4 text-xs leading-relaxed text-slate-600">
          {PRIVACY_EXCERPT_KO}
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 transition hover:border-gold hover:bg-cream">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-navy"
            {...register("privacyAgreed")}
          />
          <span className="text-sm text-slate-900">
            {t("portal:map-test.form.privacy-consent")}{" "}
            <span className="text-red-500">{t("portal:map-test.form.privacy-required")}</span>
          </span>
        </label>
      </Field>

      {submitState.kind === "error" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitState.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-navy px-6 py-4 text-base font-semibold tracking-[0.05em] text-cream transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? t("portal:map-test.form.submitting") : t("portal:map-test.form.submit")}
      </button>
      <p className="mt-4 rounded-md border-l-[3px] border-gold bg-cream px-4 py-3 text-xs text-slate-600">
        {t("contact.form-success-note")}
      </p>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <label className="mb-2 block text-sm font-semibold text-slate-900">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function SuccessCard({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation("portal");
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-gold/40 bg-cream p-10 text-center shadow-sm">
      <div className="mb-4 text-4xl" aria-hidden="true">
        ✓
      </div>
      <h3 className="font-display text-2xl font-bold text-navy">
        {t("map-test.form.success-title")}
      </h3>
      <p className="mt-4 text-sm text-slate-700">{t("contact.form-success-note")}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded-lg border border-navy px-5 py-2 text-sm font-semibold text-navy transition hover:bg-navy hover:text-cream"
      >
        {t("map-test.form.reset")}
      </button>
    </div>
  );
}
