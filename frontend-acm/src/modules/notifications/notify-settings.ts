import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

/** REQ-261102B — 알림 설정(학원·개인). 상황 목록·경로는 서버가 내려준다. */
export type NotifyChannel = "inbox" | "push" | "popup" | "mail" | "alimtalk";
export type NotifyRole = "ADMIN" | "STAFF" | "TEACHER";
export type PersonalChannel = "inbox" | "push" | "popup";
export interface NotifySpec {
  channels: NotifyChannel[];
  roles: NotifyRole[];
  fixed?: NotifyChannel[];
}
export interface TypeSetting {
  inbox: boolean;
  push: boolean;
  popup: boolean;
  mail: boolean;
  alimtalk: boolean;
  roles: NotifyRole[];
}
export interface Quiet {
  on: boolean;
  start: string;
  end: string;
}
export interface TenantNotifyConfig {
  types: Record<string, TypeSetting>;
  push: { enabled: boolean; chatPreview: boolean; quiet: Quiet };
  reminder: { first: number; second: number };
}
export interface TenantNotifyView {
  config: TenantNotifyConfig;
  spec: Record<string, NotifySpec>;
  types: string[];
  ama: {
    connected: boolean;
    enabled: boolean;
    types: string[];
    supported: string[];
  };
}
export interface PushStatus {
  push: boolean;
  devices: { mobile: number; desktop: number; unknown: number };
  last7days: { sent: number; failed: number; skipped: number };
}
export interface PersonalPrefs {
  types: Record<string, Partial<Record<PersonalChannel, boolean>>>;
  quiet: Quiet;
}
export interface PersonalView {
  prefs: PersonalPrefs;
  tenant: {
    types: Record<string, TypeSetting>;
    pushEnabled: boolean;
    quiet: Quiet;
  };
  spec: Record<string, NotifySpec>;
  types: string[];
}
export interface TestPushResult {
  devices: number;
  sent: number;
  failed: number;
}

export const TENANT_URL = "/acm/config/notifications";
export const myUrl = (mode: "admin" | "portal") =>
  mode === "admin"
    ? "/acm/notifications/my-settings"
    : "/portal/notifications/my-settings";
export const myKey = (mode: "admin" | "portal") =>
  ["notification-my-settings", mode] as const;

export function useMyNotifySettings(mode: "admin" | "portal", enabled = true) {
  return useQuery({
    queryKey: myKey(mode),
    queryFn: async () => (await apiClient.get<PersonalView>(myUrl(mode))).data,
    enabled,
    staleTime: 60_000,
  });
}

/** 학원 설정 AND 개인 설정(서버 personalOn 과 같은 규칙). */
export function personalOn(
  view: PersonalView | undefined,
  type: string,
  channel: PersonalChannel,
): boolean {
  if (!view) return true;
  const spec = view.spec[type];
  if (!spec) return true;
  if (spec.fixed?.includes(channel)) return true;
  const t = view.tenant.types[type];
  if (t && !t[channel]) return false;
  if (channel === "push" && !view.tenant.pushEnabled) return false;
  return view.prefs.types[type]?.[channel] !== false;
}

/** 서버에 푸시 키(VAPID)가 없을 때 테스트 발송은 503 PUSH_NOT_CONFIGURED. */
export function pushNotReady(e: unknown): boolean {
  const r = (
    e as {
      response?: { status?: number; data?: { error?: { message?: string } } };
    }
  )?.response;
  return r?.status === 503 || r?.data?.error?.message === "PUSH_NOT_CONFIGURED";
}
