import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
export function LifecycleDetails({
  date,
  code,
  site = "ALL",
  close,
}: {
  date: string;
  code: string;
  site?: string;
  close: () => void;
}) {
  const { t } = useTranslation("dsh");
  const user = useAuthStore((s) => s.user);
  const q = useQuery({
    queryKey: ["dsh", "life-details", user?.entId, date, code, site],
    queryFn: async () =>
      (
        await apiClient.get<
          Array<{
            id: string;
            kind: string;
            name: string;
            site: string;
            start: string | null;
          }>
        >("/acm/dsh/lifecycle/details", { params: { date, code, site } })
      ).data,
  });
  return (
    <Dialog open onOpenChange={(open)=>{if(!open)close();}}>
      <DialogContent><DialogTitle>{t("life.details")}</DialogTitle><DialogDescription>{date} · {site}</DialogDescription>
        {q.isError ? (
          <p role="alert">{t("life.error")}</p>
        ) : q.isLoading ? (
          <p>{t("life.loading")}</p>
        ) : (
          <ul>
            {q.data?.map((r) => (
              <li key={`${r.kind}:${r.id}`} className="py-2 border-b">
                <Link
                  className="underline"
                  to={
                    r.kind === "STUDENT"
                      ? `/admin/std/${r.id}`
                      : `/admin/csl/${r.id}`
                  }
                >
                  {r.name}
                </Link>{" "}
                · {r.site ?? "—"} · {r.start ?? "—"}
              </li>
            ))}
            {!q.data?.length && <li>{t("life.empty")}</li>}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
