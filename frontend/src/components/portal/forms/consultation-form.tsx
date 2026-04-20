"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  consultationSchema,
  type ConsultationInput,
} from "@/lib/portal/schemas";
import { tFormError } from "@/i18n/form-error";

const CONSULTATION_TYPES = [
  { id: "ACCREDITED", labelKey: "contact.consultation-types.accredited-label" },
  { id: "UNACCREDITED", labelKey: "contact.consultation-types.unaccredited-label" },
  { id: "FOREIGN_SCHOOL", labelKey: "contact.consultation-types.foreign-school-label" },
  { id: "BOARDING", labelKey: "contact.consultation-types.boarding-label" },
  {
    id: "ALL_IN_ONE",
    labelKey: "contact.consultation-types.all-in-one-label",
    subKey: "contact.consultation-types.all-in-one-sub",
  },
] as const;

export function ConsultationForm() {
  const { t } = useTranslation("portal");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ConsultationInput>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      types: [],
      studentName: "",
      grade: "",
      phone: "",
      privacyAgreed: undefined,
    },
  });

  const [submitState, setSubmitState] = useState<
    { kind: "idle" } | { kind: "ok" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(data: ConsultationInput) {
    setSubmitState({ kind: "idle" });
    try {
      const res = await fetch("/api/portal/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "GENERAL_INQUIRY", payload: data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? t("contact.consultation-form.error-default"));
      }
      reset();
      setSubmitState({ kind: "ok" });
    } catch (e) {
      setSubmitState({
        kind: "error",
        message: e instanceof Error ? e.message : t("contact.consultation-form.error-default"),
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
      <Field
        label={t("contact.consultation-form.types-label")}
        required
        hint={t("contact.consultation-form.types-hint")}
        error={tFormError(errors.types?.message)}
      >
        <div className="flex flex-col gap-3">
          {CONSULTATION_TYPES.map((ct) => (
            <label
              key={ct.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 transition hover:border-gold hover:bg-cream"
            >
              <input
                type="checkbox"
                value={ct.id}
                className="mt-1 h-4 w-4 accent-navy"
                {...register("types")}
              />
              <span className="text-sm text-slate-900">
                {t(ct.labelKey)}
                {"subKey" in ct && ct.subKey && (
                  <span className="block text-xs text-slate-500">{t(ct.subKey)}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("contact.consultation-form.student-name")}
          required
          error={tFormError(errors.studentName?.message)}
        >
          <input
            type="text"
            autoComplete="name"
            className="input"
            {...register("studentName")}
          />
        </Field>
        <Field label={t("contact.consultation-form.grade")} required error={tFormError(errors.grade?.message)}>
          <input
            type="text"
            placeholder={t("contact.consultation-form.grade-placeholder")}
            className="input"
            {...register("grade")}
          />
        </Field>
      </div>

      <Field label={t("contact.consultation-form.phone")} required error={tFormError(errors.phone?.message)}>
        <input
          type="tel"
          autoComplete="tel"
          placeholder={t("contact.consultation-form.phone-placeholder")}
          className="input"
          {...register("phone")}
        />
      </Field>

      <Field
        label={t("contact.consultation-form.privacy-label")}
        required
        error={tFormError(errors.privacyAgreed?.message)}
      >
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 transition hover:border-gold hover:bg-cream">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-navy"
            {...register("privacyAgreed")}
          />
          <span className="text-sm text-slate-900">
            {t("contact.consultation-form.privacy-consent")}{" "}
            <span className="text-red-500">{t("contact.consultation-form.privacy-required")}</span>
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
        {isSubmitting ? t("contact.consultation-form.submitting") : t("contact.consultation-form.submit")}
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
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label className="text-sm font-semibold text-slate-900">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
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
        {t("contact.consultation-form.success-title")}
      </h3>
      <p className="mt-4 text-sm text-slate-700">{t("contact.form-success-note")}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded-lg border border-navy px-5 py-2 text-sm font-semibold text-navy transition hover:bg-navy hover:text-cream"
      >
        {t("contact.consultation-form.reset")}
      </button>
    </div>
  );
}
