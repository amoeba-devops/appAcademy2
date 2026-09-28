import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
export type VideoProvider = "GOOGLE_MEET" | "BODASCHOOL";
export interface VideoConfig {
  provider: VideoProvider;
  bodaEnabled: boolean;
}
export function useVideoConfig(portal = false) {
  const user = useAuthStore((s) => (portal ? s.portal.user : s.user));
  const query = useQuery({
    queryKey: [
      "video-config",
      portal ? "portal" : "admin",
      user?.entId,
      user?.id,
    ],
    enabled: !!user,
    queryFn: async () =>
      (
        await apiClient.get<VideoConfig>(
          portal
            ? "/portal/cal/video-capabilities"
            : "/acm/cal/video-capabilities",
        )
      ).data,
    staleTime: 0,
    refetchInterval: 30_000,
  });
  return {
    ...query,
    bodaEnabled: !query.isError && query.data?.bodaEnabled === true,
  };
}
export function isGoogleMeetUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      url.hostname === "meet.google.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
export function canEnterVideo(
  event: { meetingProvider?: string | null; meetingUrl?: string | null },
  bodaEnabled: boolean,
) {
  if (!event.meetingUrl) return false;
  if (event.meetingProvider === "BODASCHOOL") return bodaEnabled;
  if (event.meetingProvider === "GOOGLE_MEET")
    return isGoogleMeetUrl(event.meetingUrl);
  return (
    event.meetingProvider === "OTHER" && /^https?:\/\//i.test(event.meetingUrl)
  );
}
export function videoErrorCode(error: unknown): string | undefined {
  const data = (
    error as {
      response?: {
        data?: {
          message?: string;
          code?: string;
          error?: { message?: string; code?: string };
        };
      };
    }
  )?.response?.data;
  return (
    data?.error?.message ?? data?.message ?? data?.error?.code ?? data?.code
  );
}
