import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { apiClient } from "@/lib/api-client";
import { forgetDevicePush } from "@/modules/notifications/push-settings";

export function usePortalLogout() {
  const navigate = useNavigate();
  const clearPortal = useAuthStore((s) => s.clearPortal);
  return () => {
    forgetDevicePush("portal");
    const token = useAuthStore.getState().portal.token;
    if (token)
      void apiClient
        .post("/portal/auth/logout", null, {
          headers: { Authorization: "Bearer " + token },
        })
        .catch(() => undefined);
    clearPortal();
    navigate("/portal/login", { replace: true });
  };
}
