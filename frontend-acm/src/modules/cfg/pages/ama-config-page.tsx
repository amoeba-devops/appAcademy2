import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Settings, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  AMA_FORWARD_TYPES,
  useAmaConfig,
  useAmaForwardStatus,
  useAmaForwardTest,
  useUpdateAmaConfig,
  type AmaForwardType,
} from "@/modules/cfg/hooks/use-ama-config";

/**
 * /admin/config/ama — AMA 연동 설정 (REQ-260609B, split out in REQ-260621).
 *
 * 어드민이 AMA 커스텀앱 SSO 로그인 허용 조건(entityId + appCode)을 등록한다.
 * 토큰의 법인정보가 저장값과 일치할 때만 로그인이 허용된다.
 */
export function AmaConfigPage() {
  const { t } = useTranslation("common");
  const toast = useToast();
  const confirm = useConfirm();

  const { data, isLoading, isError } = useAmaConfig();
  const update = useUpdateAmaConfig();

  const [amaEntityId, setAmaEntityId] = useState("");
  const [appCode, setAppCode] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [expectedScope, setExpectedScope] = useState("");
  const [customAppSecret, setCustomAppSecret] = useState(""); // write-only
  const [categorySlug, setCategorySlug] = useState("");
  const [categorySecret, setCategorySecret] = useState(""); // write-only
  // REQ-261006 — AMA 알림 전달
  const [forwardEnabled, setForwardEnabled] = useState(false);
  const [forwardTypes, setForwardTypes] = useState<AmaForwardType[]>([
    "CSL_CREATED",
    "CSL_STAGE",
  ]);
  const forwardStatus = useAmaForwardStatus(!!data);
  const forwardTest = useAmaForwardTest();

  useEffect(() => {
    if (data) {
      setAmaEntityId(data.amaEntityId);
      setAppCode(data.appCode);
      setIsActive(data.isActive);
      setExpectedScope(data.expectedScope ?? "");
      setCustomAppSecret(""); // never prefilled
      setCategorySlug(data.categorySlug ?? "");
      setCategorySecret(""); // never prefilled
      setForwardEnabled(data.forwardEnabled ?? false);
      setForwardTypes((data.forwardTypes ?? []) as AmaForwardType[]);
    }
  }, [data]);

  const reset = () => {
    setAmaEntityId(data?.amaEntityId ?? "");
    setAppCode(data?.appCode ?? "");
    setIsActive(data?.isActive ?? true);
    setExpectedScope(data?.expectedScope ?? "");
    setCustomAppSecret("");
    setCategorySlug(data?.categorySlug ?? "");
    setCategorySecret("");
    setForwardEnabled(data?.forwardEnabled ?? false);
    setForwardTypes((data?.forwardTypes ?? []) as AmaForwardType[]);
  };

  const onSave = async () => {
    if (!amaEntityId.trim() || !appCode.trim()) {
      toast.error(t("config.errors.required"));
      return;
    }
    // Deactivating blocks all AMA logins — confirm first.
    if (data?.isActive && !isActive) {
      const ok = await confirm({
        title: t("config.deactivate.title"),
        description: t("config.deactivate.description"),
        variant: "destructive",
        confirmLabel: t("config.deactivate.confirm"),
      });
      if (!ok) return;
    }
    try {
      await update.mutateAsync({
        amaEntityId: amaEntityId.trim(),
        appCode: appCode.trim(),
        isActive,
        expectedScope: expectedScope.trim() || undefined,
        categorySlug: categorySlug.trim() || undefined,
        forwardEnabled,
        forwardTypes,
        // send secrets only when entered (keeps existing otherwise)
        ...(customAppSecret.trim()
          ? { customAppSecret: customAppSecret.trim() }
          : {}),
        ...(categorySecret.trim()
          ? { categorySecret: categorySecret.trim() }
          : {}),
      });
      setCustomAppSecret("");
      setCategorySecret("");
      toast.success(t("config.saved"));
    } catch {
      toast.error(t("config.errors.saveFailed"));
    }
  };

  return (
    <div className="w-full min-w-0">
      <Link
        to="/admin/config"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
      >
        <ArrowLeft size={16} />
        {t("config.backToList")}
      </Link>
      <header className="mb-6 flex items-center gap-2">
        <Settings size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">
          {t("config.title")}
        </h1>
      </header>

      <p className="mb-6 text-sm text-secondary">{t("config.description")}</p>

      {isLoading ? (
        <p className="text-sm text-secondary">{t("config.loading")}</p>
      ) : isError ? (
        <p className="text-sm text-red-600">{t("config.errors.loadFailed")}</p>
      ) : (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-6">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="amaEntityId">
                {t("config.fields.entityId.label")}
              </Label>
              <Input
                id="amaEntityId"
                value={amaEntityId}
                onChange={(e) => setAmaEntityId(e.target.value)}
                placeholder="550e8400-e29b-41d4-a716-446655440000"
                autoComplete="off"
              />
              <p className="text-xs text-secondary">
                {t("config.fields.entityId.hint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appCode">
                {t("config.fields.appCode.label")}
              </Label>
              <Input
                id="appCode"
                value={appCode}
                onChange={(e) => setAppCode(e.target.value)}
                placeholder="tpi-acm"
                autoComplete="off"
              />
              <p className="text-xs text-secondary">
                {t("config.fields.appCode.hint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expectedScope">
                {t("config.fields.scope.label")}
              </Label>
              <Input
                id="expectedScope"
                value={expectedScope}
                onChange={(e) => setExpectedScope(e.target.value)}
                placeholder="custom_app:context"
                autoComplete="off"
              />
              <p className="text-xs text-secondary">
                {t("config.fields.scope.hint")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customAppSecret">
                {t("config.fields.secret.label")}
              </Label>
              <Input
                id="customAppSecret"
                type="password"
                value={customAppSecret}
                onChange={(e) => setCustomAppSecret(e.target.value)}
                placeholder={
                  data?.customAppSecretIsSet
                    ? t("config.fields.secret.placeholderSet")
                    : t("config.fields.secret.placeholderUnset")
                }
                autoComplete="new-password"
              />
              <p className="text-xs text-secondary">
                {t("config.fields.secret.hint")}
              </p>
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-5">
              <h2 className="mb-1 text-sm font-semibold text-primary">
                {t("config.category.title")}
              </h2>
              <p className="mb-4 text-xs text-secondary">
                {t("config.category.description")}
              </p>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="categorySlug">
                    {t("config.fields.categorySlug.label")}
                  </Label>
                  <Input
                    id="categorySlug"
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    placeholder="tpi-academy"
                    autoComplete="off"
                  />
                  <p className="text-xs text-secondary">
                    {t("config.fields.categorySlug.hint")}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="categorySecret">
                    {t("config.fields.categorySecret.label")}
                  </Label>
                  <Input
                    id="categorySecret"
                    type="password"
                    value={categorySecret}
                    onChange={(e) => setCategorySecret(e.target.value)}
                    placeholder={
                      data?.categorySecretIsSet
                        ? t("config.fields.secret.placeholderSet")
                        : t("config.fields.secret.placeholderUnset")
                    }
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-secondary">
                    {t("config.fields.categorySecret.hint")}
                  </p>
                </div>
              </div>
            </div>

            {/* REQ-261006 — AMA 알림 전달 */}
            <div className="border-t border-[var(--border-subtle)] pt-5">
              <h2 className="mb-1 text-sm font-semibold text-primary">
                {t("config.forward.title")}
              </h2>
              <p className="mb-4 text-xs text-secondary">
                {t("config.forward.description")}
              </p>
              <label className="mb-3 flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={forwardEnabled}
                  onChange={(e) => setForwardEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border-subtle)]"
                />
                {t("config.forward.enabled")}
              </label>
              <div className="mb-3 grid gap-1.5 rounded-md border border-[var(--border-subtle)] px-3 py-2">
                <span className="text-xs text-secondary">
                  {t("config.forward.types")}
                </span>
                {AMA_FORWARD_TYPES.map((ty) => (
                  <label key={ty} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      disabled={!forwardEnabled}
                      checked={forwardTypes.includes(ty)}
                      onChange={(e) =>
                        setForwardTypes((cur) =>
                          e.target.checked
                            ? [...cur, ty]
                            : cur.filter((x) => x !== ty),
                        )
                      }
                    />
                    {t(`config.forward.type.${ty}`)}
                  </label>
                ))}
              </div>
              {forwardStatus.data && (
                <div className="grid gap-1 text-xs text-secondary">
                  <span>
                    {t("config.forward.status", {
                      sent: forwardStatus.data.counts.SENT,
                      pending: forwardStatus.data.counts.PENDING,
                      failed: forwardStatus.data.counts.FAILED,
                      skipped: forwardStatus.data.counts.SKIPPED,
                      users: forwardStatus.data.amaLinkedUsers,
                    })}
                  </span>
                  {forwardStatus.data.lastSentAt && (
                    <span>
                      {t("config.forward.lastSent", {
                        at: new Date(
                          forwardStatus.data.lastSentAt,
                        ).toLocaleString(),
                      })}
                    </span>
                  )}
                  {forwardStatus.data.lastError && (
                    <span className="text-red-700">
                      {t("config.forward.lastError")}:{" "}
                      {forwardStatus.data.lastError}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={forwardTest.isPending}
                  onClick={async () => {
                    try {
                      const r = await forwardTest.mutateAsync();
                      toast.success(
                        t("config.forward.testOk", { created: r.created }),
                      );
                    } catch (e) {
                      const msg =
                        (
                          e as {
                            response?: {
                              data?: { error?: { message?: string } };
                            };
                          }
                        )?.response?.data?.error?.message ?? "";
                      toast.error(
                        `${t("config.forward.testFailed")} ${msg}`.trim(),
                      );
                    }
                  }}
                >
                  {forwardTest.isPending
                    ? t("actions.saving")
                    : t("config.forward.testBtn")}
                </Button>
                <p className="mt-1 text-xs text-secondary">
                  {t("config.forward.testHint")}
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-primary">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-subtle)]"
              />
              {t("config.fields.isActive.label")}
            </label>
          </div>

          {data?.updatedAt && (
            <p className="mt-5 text-xs text-secondary">
              {t("config.lastUpdated", {
                at: new Date(data.updatedAt).toLocaleString(),
              })}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={reset}
              disabled={update.isPending}
            >
              {t("actions.cancel")}
            </Button>
            <Button onClick={onSave} disabled={update.isPending}>
              {update.isPending ? t("actions.saving") : t("actions.save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
