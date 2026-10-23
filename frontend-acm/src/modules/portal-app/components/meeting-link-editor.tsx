import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { portalApi } from "../api/portal-api";

/**
 * REQ-261023 — the assigned teacher enters or changes the Google Meet link.
 * Mail only when ticked; "this and later" also updates future auto-extended classes.
 */
export function MeetingLinkEditor({ evtId }: { evtId: string }) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ["portal-meeting-link", evtId], queryFn: () => portalApi.meetingLinkInfo(evtId) });
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [scope, setScope] = useState<"ONE" | "FOLLOWING">("ONE");
  const [notify, setNotify] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const save = useMutation({
    mutationFn: () => portalApi.updateMeetingLink(evtId, { meetingUrl: url.trim() || null, scope, notify }),
    onSuccess: (r) => {
      setOpen(false);
      setMessage({
        ok: true,
        text: r.notify ? t("portalApp.cal.link.savedMail", { sent: r.notify.sent }) : t("portalApp.cal.link.saved"),
      });
      void qc.invalidateQueries({ queryKey: ["portal-meeting-link", evtId] });
      void qc.invalidateQueries({ queryKey: ["portal-cal-event", evtId] });
      void qc.invalidateQueries({ queryKey: ["portal-cal-events"] });
    },
    onError: (err) => {
      const body = err instanceof AxiosError ? (err.response?.data as { error?: { code?: string; message?: string } } | undefined) : undefined;
      const status = err instanceof AxiosError ? err.response?.status : undefined;
      const code = body?.error?.code ?? body?.error?.message;
      setMessage({
        ok: false,
        text:
          status === 400
            ? t("portalApp.cal.link.errInvalid")
            : code === "BODA_LINK_MANAGED"
              ? t("portalApp.cal.link.errBoda")
              : code === "VIDEO_PROVIDER_MISMATCH"
                ? t("portalApp.cal.link.errProvider")
                : status === 403
                  ? t("portalApp.cal.link.errForbidden")
                  : t("portalApp.cal.link.errFailed"),
      });
    },
  });

  const d = info.data;
  if (!d) return null;
  if (d.provider === "BODASCHOOL")
    return <p className="mt-4 text-sm text-secondary">{t("portalApp.cal.link.boda")}</p>;

  return (
    <section className="mt-5 rounded-md border border-[var(--border-subtle)] p-3" aria-label={t("portalApp.cal.link.title")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t("portalApp.cal.link.title")}</span>
        {d.meetingUrl ? (
          <a href={d.meetingUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-sm text-accent-700 hover:underline">
            {d.meetingUrl}
          </a>
        ) : (
          <span className="text-sm text-secondary">{t("portalApp.cal.link.none")}</span>
        )}
        {d.canEdit && !open && (
          <button
            type="button"
            className="ml-auto min-h-9 rounded-md border border-[var(--border-subtle)] px-3 text-sm hover:bg-[var(--gray-50)]"
            onClick={() => {
              setUrl(d.meetingUrl ?? "");
              setScope("ONE");
              setNotify(false);
              setMessage(null);
              setOpen(true);
            }}
          >
            {d.meetingUrl ? t("portalApp.cal.link.edit") : t("portalApp.cal.link.add")}
          </button>
        )}
      </div>

      {open && (
        <form
          className="mt-3 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="grid gap-1 text-sm">
            {t("portalApp.cal.link.label")}
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              className="h-10 rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-base"
            />
            <span className="text-xs text-secondary">{t("portalApp.cal.link.hint")}</span>
          </label>
          {d.recurring && d.followingCount > 1 && (
            <fieldset className="grid gap-1 text-sm">
              <legend className="mb-1">{t("portalApp.cal.link.scope")}</legend>
              <label className="inline-flex min-h-9 items-center gap-2">
                <input type="radio" name="link-scope" checked={scope === "ONE"} onChange={() => setScope("ONE")} />
                {t("portalApp.cal.link.scopeOne")}
              </label>
              <label className="inline-flex min-h-9 items-center gap-2">
                <input type="radio" name="link-scope" checked={scope === "FOLLOWING"} onChange={() => setScope("FOLLOWING")} />
                {t("portalApp.cal.link.scopeFollowing", { count: d.followingCount })}
              </label>
            </fieldset>
          )}
          <label className="inline-flex min-h-9 items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            <span>
              {t("portalApp.cal.link.notify")}
              <span className="block text-xs text-secondary">{t("portalApp.cal.link.notifyHint")}</span>
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="min-h-9 rounded-md border border-[var(--border-subtle)] px-3 text-sm" onClick={() => setOpen(false)}>
              {t("portalApp.cal.link.cancel")}
            </button>
            <button type="submit" disabled={save.isPending} className="min-h-9 rounded-md bg-accent-600 px-4 text-sm text-white hover:bg-accent-700 disabled:opacity-60">
              {t("portalApp.cal.link.save")}
            </button>
          </div>
        </form>
      )}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-2 text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
