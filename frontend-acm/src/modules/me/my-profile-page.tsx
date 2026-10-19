import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { UserCircle, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatDual } from "@/lib/tz";
import { TZ_OPTIONS, tzLabel } from "@/modules/cfg/pages/general-config-page";
import { useMyProfile, useSaveMyProfile, type ProfileMode } from "./use-my-zones";
import { ExtraProfileSection, PasswordSection } from "./console-profile-sections";

/**
 * REQ-261015C — 마이페이지. 포털(/portal/me: 학생·강사·학부모) / 콘솔(/admin/me).
 * 사용자 타임존을 지정하면 테넌트 기본 타임존 시각 뒤에 괄호로 병기한다.
 */
export function MyProfilePage({ mode }: { mode: ProfileMode }) {
  const { t, i18n } = useTranslation("common");
  const profile = useMyProfile(mode);
  const save = useSaveMyProfile(mode);
  const [tz, setTz] = useState("");
  useEffect(() => {
    if (profile.data) setTz(profile.data.timezone ?? "");
  }, [profile.data]);
  const tenantTz = profile.data?.tenantTimezone ?? "Asia/Seoul";
  const options = useMemo(() => {
    const list = tz && !TZ_OPTIONS.includes(tz) ? [tz, ...TZ_OPTIONS] : TZ_OPTIONS;
    return list.map((z) => ({ value: z, label: tzLabel(z, i18n.language) }));
  }, [tz, i18n.language]);
  const preview = formatDual(
    new Date(),
    { tenantTz, userTz: tz || null },
    i18n.language,
    { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" },
  );
  const p = profile.data;
  return (
    <div className="grid w-full max-w-2xl min-w-0 gap-4">
      {mode === "console" ? (
        <PageHeader
          icon={UserRound}
          title={t("nav.myPage")}
          description={t("pageHeader.myPage.desc")}
        />
      ) : (
        <header className="flex items-center gap-2">
          <UserCircle size={20} className="text-accent-700" />
          <h1 className="text-xl font-semibold text-primary">{t("myPage.title")}</h1>
        </header>
      )}
      {profile.isLoading && <p>{t("myPage.loading")}</p>}
      {profile.isError && <p role="alert">{t("myPage.loadError")}</p>}
      {p && (
        <>
          <dl className="grid gap-x-6 gap-y-2 rounded-lg border bg-surface p-4 text-sm sm:grid-cols-2">
            {p.name && (
              <div>
                <dt className="text-xs text-secondary">{t("myPage.name")}</dt>
                <dd>{p.name}</dd>
              </div>
            )}
            <div className="min-w-0">
              <dt className="text-xs text-secondary">{t("myPage.loginId")}</dt>
              <dd className="truncate">{p.loginId ?? p.email}</dd>
            </div>
            {(p.kind || p.role) && (
              <div>
                <dt className="text-xs text-secondary">{t("myPage.role")}</dt>
                <dd>{p.kind ? t(`portalApp.role.${p.kind}`) : t(`myPage.roles.${p.role}`, p.role ?? "")}</dd>
              </div>
            )}
            {p.createdAt && (
              <div>
                <dt className="text-xs text-secondary">{t("myPage.joinedAt")}</dt>
                <dd>
                  {new Intl.DateTimeFormat(i18n.language, {
                    timeZone: tenantTz,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(new Date(p.createdAt))}
                </dd>
              </div>
            )}
          </dl>
          <section className="grid gap-3 rounded-lg border bg-surface p-4 text-sm">
            <h2 className="font-semibold">{t("myPage.timezone")}</h2>
            <select
              className="h-9 w-full rounded-md border bg-canvas px-3"
              aria-label={t("myPage.timezone")}
              value={tz}
              onChange={(e) => {
                save.reset();
                setTz(e.target.value);
              }}
            >
              <option value="">
                {t("myPage.followTenant", { tz: tzLabel(tenantTz, i18n.language) })}
              </option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-secondary">{t("myPage.timezoneHint")}</p>
            <p className="text-xs">{t("myPage.preview", { now: preview })}</p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {save.isSuccess && <span role="status">{t("myPage.saved")}</span>}
              {save.isError && (
                <span role="alert" className="text-red-600">
                  {t("myPage.saveError")}
                </span>
              )}
              <Button
                disabled={save.isPending || tz === (p.timezone ?? "")}
                onClick={() => save.mutate({ timezone: tz || null })}
              >
                {save.isPending ? t("myPage.saving") : t("myPage.save")}
              </Button>
            </div>
          </section>
          {mode === "console" && (
            <>
              <ExtraProfileSection profile={p} />
              <PasswordSection hasPassword={p.hasPassword !== false} />
            </>
          )}
          {mode === "portal" && (
            <Link className="text-sm text-accent-700 hover:underline" to="/portal/change-password">
              {t("myPage.changePassword")} →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
