import { useAuthStore } from "@/stores/auth.store";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { BodaConfigSection } from "@/modules/cfg/components/boda-config-section";
import {
  useVideoConfig,
  videoErrorCode,
  type VideoConfig,
  type VideoProvider,
} from "../hooks/use-video-config";
export function BodaConfigPage() {
  const { t } = useTranslation("common");
  const query = useVideoConfig();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === "ADMIN";
  const qc = useQueryClient();
  const [provider, setProvider] = useState<VideoProvider>("BODASCHOOL");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (query.data && !dirty) setProvider(query.data.provider);
  }, [query.data, dirty]);
  const save = useMutation({
    mutationFn: async () =>
      (
        await apiClient.put<VideoConfig>("/admin/cal/video/config", {
          provider,
        })
      ).data,
    onSuccess: async (saved) => {
      qc.setQueriesData(
        {
          predicate: (q) =>
            q.queryKey[0] === "video-config" && q.queryKey[2] === user?.entId,
        },
        saved,
      );
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["video-config"] });
    },
  });
  return (
    <div className="w-full min-w-0 space-y-4">
      <Link
        to="/admin/config"
        className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
      >
        <ArrowLeft size={16} />
        {t("config.backToList")}
      </Link>
      <h1 className="text-xl font-semibold">{t("video.title")}</h1>
      {query.isLoading && <p role="status">{t("video.loading")}</p>}
      {query.isError && (
        <p role="alert">
          {t("video.loadError")}{" "}
          <Button onClick={() => void query.refetch()}>
            {t("video.retry")}
          </Button>
        </p>
      )}
      {query.data && !query.isError && (
        <form
          className="space-y-4 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <fieldset disabled={save.isPending || !canEdit} className="space-y-3">
            <legend className="font-medium">{t("video.provider")}</legend>
            {(["GOOGLE_MEET", "BODASCHOOL"] as const).map((value) => (
              <label
                key={value}
                className="mr-5 inline-flex items-center gap-2"
              >
                <input
                  type="radio"
                  name="videoProvider"
                  value={value}
                  checked={provider === value}
                  onChange={() => {
                    setProvider(value);
                    setDirty(true);
                    save.reset();
                  }}
                />
                {t(`video.${value}`)}
              </label>
            ))}
            <p className="text-sm text-secondary">
              {t(
                provider === "GOOGLE_MEET"
                  ? "video.googleHint"
                  : "video.bodaHint",
              )}
            </p>
            <Button type="submit" disabled={save.isPending || !dirty}>
              {t("video.save")}
            </Button>
          </fieldset>
          {save.isSuccess && !dirty && <p role="status">{t("video.saved")}</p>}
          {save.isError && (
            <p role="alert">
              {t(
                videoErrorCode(save.error) === "VIDEO_ACTIVE_ROOM"
                  ? "video.activeRoom"
                  : "video.saveError",
              )}
            </p>
          )}
        </form>
      )}
      {canEdit && provider === "BODASCHOOL" && query.bodaEnabled && (
        <BodaConfigSection />
      )}
      {provider === "BODASCHOOL" && query.data && !query.bodaEnabled && (
        <p>{t("video.saveFirst")}</p>
      )}
    </div>
  );
}
