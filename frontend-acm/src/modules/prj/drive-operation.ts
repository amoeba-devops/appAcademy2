import { useAuthStore } from "@/stores/auth.store";
/** Keep operation identity across dialog close/reopen and uncertain responses. */
export async function driveOperation(payload: unknown, file?: File | null) {
  const u = useAuthStore.getState().user;
  const digest = async (b: BufferSource) =>
    Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  const fingerprint = await digest(
    new TextEncoder().encode(
      JSON.stringify([
        u?.entId,
        u?.id,
        payload,
        file ? await digest(await file.arrayBuffer()) : null,
      ]),
    ),
  );
  const key = "acm-shared-drive:" + fingerprint;
  const id = sessionStorage.getItem(key) ?? crypto.randomUUID();
  sessionStorage.setItem(key, id);
  return { id, done: () => sessionStorage.removeItem(key) };
}
