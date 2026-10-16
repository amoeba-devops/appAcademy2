import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { changePassword } from "@/modules/auth/api/auth-api";
import { useSaveMyProfile, type MyProfile } from "./use-my-zones";

const BIO_MAX = 1000;

/** REQ-261017 — 콘솔 마이페이지: 비밀번호 변경(현재 비밀번호 확인). */
export function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useTranslation("auth");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!hasPassword)
    return (
      <section className="grid gap-2 rounded-lg border bg-surface p-4 text-sm">
        <h2 className="font-semibold">{t("changePassword.title")}</h2>
        <p className="text-secondary">{t("changePassword.amaOnly")}</p>
      </section>
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next))
      return setMsg({ ok: false, text: t("changePassword.policy") });
    if (next !== confirm) return setMsg({ ok: false, text: t("changePassword.mismatch") });
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg({ ok: true, text: t("changePassword.done") });
    } catch (err) {
      const status = err instanceof AxiosError ? err.response?.status : undefined;
      setMsg({
        ok: false,
        text:
          status === 401
            ? t("changePassword.currentInvalid")
            : status === 400
              ? t("changePassword.policy")
              : t("changePassword.failed"),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-surface p-4 text-sm" noValidate>
      <h2 className="font-semibold">{t("changePassword.title")}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="me-cur-pw">{t("changePassword.current")}</Label>
          <PasswordInput
            id="me-cur-pw"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="me-new-pw">{t("changePassword.new")}</Label>
          <PasswordInput
            id="me-new-pw"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="me-confirm-pw">{t("changePassword.confirm")}</Label>
          <PasswordInput
            id="me-confirm-pw"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-secondary">{t("changePassword.policy")}</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {msg && (
          <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "" : "text-red-600"}>
            {msg.text}
          </span>
        )}
        <Button type="submit" disabled={busy || !current || !next || !confirm}>
          {busy ? t("changePassword.submitting") : t("changePassword.submit")}
        </Button>
      </div>
    </form>
  );
}

/** REQ-261017 — 콘솔 마이페이지: 비상연락망(이름·관계·연락처) + 자기소개. */
export function ExtraProfileSection({ profile }: { profile: MyProfile }) {
  const { t } = useTranslation("common");
  const save = useSaveMyProfile("console");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  useEffect(() => {
    setName(profile.emergencyName ?? "");
    setRelation(profile.emergencyRelation ?? "");
    setPhone(profile.emergencyPhone ?? "");
    setBio(profile.bio ?? "");
  }, [profile]);
  const phoneValid = /^[0-9+()\-\s]*$/.test(phone);
  const dirty =
    name !== (profile.emergencyName ?? "") ||
    relation !== (profile.emergencyRelation ?? "") ||
    phone !== (profile.emergencyPhone ?? "") ||
    bio !== (profile.bio ?? "");
  const edit = (set: (v: string) => void) => (v: string) => {
    save.reset();
    set(v);
  };
  return (
    <section className="grid gap-3 rounded-lg border bg-surface p-4 text-sm">
      <h2 className="font-semibold">{t("myPage.emergency.title")}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="me-em-name">{t("myPage.emergency.name")}</Label>
          <Input id="me-em-name" maxLength={100} value={name} onChange={(e) => edit(setName)(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="me-em-rel">{t("myPage.emergency.relation")}</Label>
          <Input
            id="me-em-rel"
            maxLength={50}
            placeholder={t("myPage.emergency.relationPlaceholder")}
            value={relation}
            onChange={(e) => edit(setRelation)(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="me-em-phone">{t("myPage.emergency.phone")}</Label>
          <Input
            id="me-em-phone"
            type="tel"
            inputMode="tel"
            maxLength={30}
            placeholder="010-0000-0000"
            aria-invalid={!phoneValid}
            value={phone}
            onChange={(e) => edit(setPhone)(e.target.value)}
          />
        </div>
      </div>
      {!phoneValid && (
        <p role="alert" className="text-xs text-red-600">
          {t("myPage.emergency.phoneInvalid")}
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="me-bio">{t("myPage.bio")}</Label>
        <textarea
          id="me-bio"
          rows={5}
          maxLength={BIO_MAX}
          className="w-full rounded-md border bg-canvas px-3 py-2"
          placeholder={t("myPage.bioPlaceholder")}
          value={bio}
          onChange={(e) => edit(setBio)(e.target.value)}
        />
        <p className="text-right text-xs text-secondary">
          {bio.length}/{BIO_MAX}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {save.isSuccess && <span role="status">{t("myPage.saved")}</span>}
        {save.isError && (
          <span role="alert" className="text-red-600">
            {t("myPage.saveError")}
          </span>
        )}
        <Button
          disabled={save.isPending || !dirty || !phoneValid}
          onClick={() =>
            save.mutate({
              emergencyName: name,
              emergencyRelation: relation,
              emergencyPhone: phone,
              bio,
            })
          }
        >
          {save.isPending ? t("myPage.saving") : t("myPage.save")}
        </Button>
      </div>
    </section>
  );
}
