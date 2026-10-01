import { useCallback, useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/lib/api-client";
import { useSseStream } from "@/lib/use-sse-stream";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { InboxItem, InboxPage } from "./types-inbox";

const base = "/acm/notifications/inbox";
function useInboxKey() {
  const user = useAuthStore((s) => s.user);
  return ["notification-inbox", user?.entId, user?.id] as const;
}
export function NotificationBell() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const key = useInboxKey();
  const qc = useQueryClient();
  useEffect(()=>()=>{qc.removeQueries({queryKey:['notification-inbox',user?.entId,user?.id]});},[qc,user?.entId,user?.id]);
  const enabled = !!user;
  const count = useQuery({
    queryKey: [...key, "count"],
    queryFn: async () =>
      (
        await apiClient.get<{ unreadCount: number; asOf: string }>(
          base + "/count",
        )
      ).data,
    enabled,
    refetchInterval: 15000,
  });
  const refresh = useCallback(() => {
    void qc.invalidateQueries({
      queryKey: ["notification-inbox", user?.entId, user?.id],
    });
  }, [qc, user?.entId, user?.id]);
  useSseStream("/api" + base + "/events", token, refresh, enabled);
  if (!enabled) return null;
  const n = count.data?.unreadCount ?? 0;
  return (
    <>
      <button
        type="button"
        className="relative rounded-md p-2 hover:bg-gray-100 focus-visible:ring-2"
        aria-label={t("inbox.bell", { count: n })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Bell size={20} aria-hidden />
        {n > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white"
          >
            {n > 99 ? "99+" : n}
          </span>
        )}
        {count.isError && (
          <span
            className="absolute right-0 top-0 text-xs text-red-600"
            title={t("inbox.error")}
          >
            !
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="left-auto right-4 top-16 w-[calc(100vw-2rem)] max-w-lg translate-x-0 translate-y-0">
          <DialogHeader>
            <DialogTitle>{t("inbox.title")}</DialogTitle>
          </DialogHeader>
          <InboxList compact onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
function Summary({ item }: { item: InboxItem }) {
  const { t } = useTranslation("common");
  const p = item.payload;
  return (
    <>
      <span className="block font-medium">
        {t("inbox.events." + item.type)}
      </span>
      <span className="block truncate text-sm text-secondary">
        {p.title || p.senderName || (p.seqNo ? `#${p.seqNo}` : "")}
        {p.fromStage && p.toStage
          ? ` · ${t("csl:stage." + p.fromStage, { defaultValue: p.fromStage })} → ${t("csl:stage." + p.toStage, { defaultValue: p.toStage })}`
          : ""}
        {p.count ? ` · ${t("inbox.occurrences", { count: p.count })}` : ""}
      </span>
    </>
  );
}
export function InboxList({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const { t, i18n } = useTranslation("common");
  const key = useInboxKey();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(false);
  const query = useInfiniteQuery({
    queryKey: [...key, "list", unread],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (
        await apiClient.get<InboxPage>(base, {
          params: { cursor: pageParam, unread },
        })
      ).data,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    refetchInterval: 15000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const open = useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.patch<{ href: string }>(`${base}/${id}/read`)).data,
    onSuccess: async (res) => {
      await refresh();
      onNavigate?.();
      navigate(res.href);
    },
    onError: () => {
      void refresh();
    },
  });
  const all = useMutation({
    mutationFn: async () =>
      apiClient.post(base + "/read-all", { asOf: query.data!.pages[0].asOf }),
    onSuccess: refresh,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            variant={unread ? "outline" : "default"}
            size="sm"
            onClick={() => setUnread(false)}
          >
            {t("inbox.all")}
          </Button>
          <Button
            variant={unread ? "default" : "outline"}
            size="sm"
            onClick={() => setUnread(true)}
          >
            {t("inbox.unread")}
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={
            !query.data || all.isPending || !query.data.pages[0].unreadCount
          }
          onClick={() => all.mutate()}
        >
          {t("inbox.readAll")}
        </Button>
      </div>
      {(open.isError || all.isError) && (
        <p role="alert" className="text-sm text-red-600">
          {t(open.isError ? "inbox.unavailable" : "inbox.error")}
        </p>
      )}
      {query.isError ? (
        <div role="alert">
          {t("inbox.error")}{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            {t("inbox.retry")}
          </Button>
        </div>
      ) : query.isPending ? (
        <p role="status">{t("inbox.loading")}</p>
      ) : (
        <>
          {!items.length && (
            <p className="py-8 text-center text-secondary">
              {t("inbox.empty")}
            </p>
          )}
          <ul
            className={
              compact ? "max-h-[55vh] space-y-1 overflow-y-auto" : "space-y-1"
            }
          >
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={open.isPending}
                  onClick={() => open.mutate(item.id)}
                  className={`flex w-full gap-3 rounded-md border p-3 text-left hover:bg-gray-50 ${!item.readAt ? "bg-blue-50" : "bg-surface"}`}
                >
                  <span
                    className="w-3 shrink-0 text-blue-600"
                    aria-label={
                      !item.readAt ? t("inbox.unread") : t("inbox.read")
                    }
                  >
                    {!item.readAt ? "●" : "○"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Summary item={item} />
                    <time
                      dateTime={item.createdAt}
                      className="text-xs text-secondary"
                    >
                      {new Date(item.createdAt).toLocaleString(i18n.language)}
                    </time>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {query.hasNextPage && !compact && (
            <Button
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
            >
              {t("inbox.more")}
            </Button>
          )}
        </>
      )}
      {compact && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            onNavigate?.();
            navigate("/admin/notification-inbox");
          }}
        >
          {t("inbox.viewAll")}
        </Button>
      )}
    </div>
  );
}
export function NotificationInboxPage() {
  const { t } = useTranslation("common");
  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{t("inbox.title")}</h1>
      <InboxList />
    </section>
  );
}
