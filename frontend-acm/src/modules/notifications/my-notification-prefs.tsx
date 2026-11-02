import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  myKey,
  myUrl,
  useMyNotifySettings,
  type PersonalChannel,
  type PersonalPrefs,
  type PersonalView,
  type TestPushResult,
  pushNotReady,
} from "./notify-settings";

// 팝업은 콘솔 화면에만 있다(포털 강사 제외).
const CHANNELS: PersonalChannel[] = ["inbox", "push", "popup"];
const box = "h-5 w-5 accent-[var(--acm-accent-600)] disabled:opacity-40";

/**
 * REQ-261102B — 내 알림 설정: 학원이 켠 알림 중 원하지 않는 것만 끈다(상황별 알림함·푸시·팝업),
 * 개인 방해 금지 시간, 이 계정 기기로 테스트 알림.
 */
export function MyNotificationPrefs({ mode }: { mode: "admin" | "portal" }) {
  const { t } = useTranslation("common");
  const qc = useQueryClient();
  const view = useMyNotifySettings(mode);
  const [draft, setDraft] = useState<PersonalPrefs | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (view.data) setDraft(structuredClone(view.data.prefs));
  }, [view.data]);
  const save = useMutation({
    mutationFn: async () =>
      (await apiClient.put<PersonalView>(myUrl(mode), draft)).data,
    onSuccess: (d) => {
      qc.setQueryData(myKey(mode), d);
      setMsg({ ok: true, text: t("notifySettings.saved") });
    },
    onError: () => setMsg({ ok: false, text: t("notifySettings.failed") }),
  });
  const test = useMutation({
    mutationFn: async () =>
      (await apiClient.post<TestPushResult>(`${myUrl(mode)}/test-push`)).data,
    onSuccess: (r) =>
      setMsg(
        r.devices
          ? {
              ok: r.failed === 0,
              text: t("notifySettings.test.result", { ...r }),
            }
          : { ok: false, text: t("notifySettings.test.noDevice") },
      ),
    onError: (e) =>
      setMsg({
        ok: false,
        text: t(
          pushNotReady(e)
            ? "notifySettings.test.notConfigured"
            : "notifySettings.test.failed",
        ),
      }),
  });
  const v = view.data;
  if (view.isError)
    return (
      <p role="alert" className="text-sm text-red-600">
        {t("notifySettings.loadFailed")}
      </p>
    );
  if (!v || !draft) return null;
  const set = (type: string, c: PersonalChannel, on: boolean) =>
    setDraft((d) => {
      if (!d) return d;
      const cur = { ...d.types[type] };
      if (on) delete cur[c];
      else cur[c] = false;
      return { ...d, types: { ...d.types, [type]: cur } };
    });
  const q = draft.quiet;
  const dirty = JSON.stringify(draft) !== JSON.stringify(v.prefs);
  return (
    <div className="grid gap-3 border-t border-[var(--border-subtle)] pt-3 text-sm">
      <div>
        <h3 className="font-semibold">{t("notifySettings.my.title")}</h3>
        <p className="text-xs text-secondary">{t("notifySettings.my.hint")}</p>
      </div>
      <ul className="max-h-72 divide-y divide-[var(--border-subtle)] overflow-y-auto rounded border border-[var(--border-subtle)]">
        {v.types.map((type) => {
          const spec = v.spec[type];
          const tenantOff = !v.tenant.types[type]?.inbox;
          return (
            <li key={type} className="grid gap-1 px-3 py-2">
              <span className="font-medium">
                {t(`notifySettings.types.${type}`)}
              </span>
              {tenantOff ? (
                <span className="text-xs text-secondary">
                  {t("notifySettings.my.academyOff")}
                </span>
              ) : (
                <span className="flex flex-wrap gap-x-4">
                  {CHANNELS.filter(
                    (c) =>
                      spec.channels.includes(c) &&
                      (c !== "popup" || mode === "admin"),
                  ).map((c) => {
                    const fixed = spec.fixed?.includes(c);
                    const academy =
                      v.tenant.types[type]?.[c] !== false &&
                      (c !== "push" || v.tenant.pushEnabled);
                    const pushNeedsInbox =
                      c === "push" && draft.types[type]?.inbox === false;
                    return (
                      <label
                        key={c}
                        className="inline-flex min-h-9 items-center gap-1.5"
                      >
                        <input
                          type="checkbox"
                          className={box}
                          disabled={fixed || !academy || pushNeedsInbox}
                          checked={
                            fixed ||
                            (academy &&
                              !pushNeedsInbox &&
                              draft.types[type]?.[c] !== false)
                          }
                          onChange={(e) => set(type, c, e.target.checked)}
                        />
                        {t(`notifySettings.channels.${c}`)}
                        {fixed && (
                          <span className="text-xs text-secondary">
                            ({t("notifySettings.always")})
                          </span>
                        )}
                      </label>
                    );
                  })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            className={box}
            checked={q.on}
            onChange={(e) =>
              setDraft({ ...draft, quiet: { ...q, on: e.target.checked } })
            }
          />
          <span className="font-medium">{t("notifySettings.my.quiet")}</span>
        </label>
        <Input
          type="time"
          aria-label={t("notifySettings.push.quietStart")}
          className="w-32"
          disabled={!q.on}
          value={q.start}
          onChange={(e) =>
            e.target.value &&
            setDraft({ ...draft, quiet: { ...q, start: e.target.value } })
          }
        />
        <span>~</span>
        <Input
          type="time"
          aria-label={t("notifySettings.push.quietEnd")}
          className="w-32"
          disabled={!q.on}
          value={q.end}
          onChange={(e) =>
            e.target.value &&
            setDraft({ ...draft, quiet: { ...q, end: e.target.value } })
          }
        />
      </div>
      {v.tenant.quiet.on && (
        <p className="text-xs text-secondary">
          {t("notifySettings.my.academyQuiet", {
            start: v.tenant.quiet.start,
            end: v.tenant.quiet.end,
          })}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          disabled={test.isPending}
          onClick={() => {
            setMsg(null);
            test.mutate();
          }}
        >
          {t("notifySettings.test.button")}
        </Button>
        <Button
          disabled={!dirty || save.isPending}
          onClick={() => {
            setMsg(null);
            save.mutate();
          }}
        >
          {t("notifySettings.save")}
        </Button>
      </div>
      {msg && (
        <p
          role="status"
          className={msg.ok ? "text-emerald-700" : "text-red-700"}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
