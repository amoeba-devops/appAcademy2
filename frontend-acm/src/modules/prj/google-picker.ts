import { apiClient } from "@/lib/api-client";
interface PickerView {
  setIncludeFolders(v: boolean): PickerView;
  setSelectFolderEnabled(v: boolean): PickerView;
  setMimeTypes(v: string): PickerView;
  setEnableDrives(v: boolean): PickerView;
}
interface Picker {
  setVisible(v: boolean): void;
  dispose(): void;
}
interface Builder {
  setOAuthToken(v: string): Builder;
  setDeveloperKey(v: string): Builder;
  setAppId(v: string): Builder;
  setOrigin(v: string): Builder;
  addView(v: PickerView): Builder;
  setCallback(
    v: (r: { action: string; docs?: { id: string }[] }) => void,
  ): Builder;
  build(): Picker;
}
interface GoogleApi {
  picker: { DocsView: new () => PickerView; PickerBuilder: new () => Builder };
}
declare global {
  interface Window {
    gapi?: {
      load: (
        n: string,
        o: { callback: () => void; onerror: () => void },
      ) => void;
    };
    google?: GoogleApi;
  }
}
let loading: Promise<void> | undefined;
function load() {
  return (loading ??= new Promise<void>((resolve, reject) => {
    const ready = () =>
      window.gapi?.load("picker", {
        callback: resolve,
        onerror: () =>
          reject(new Error("Google 선택기를 불러오지 못했습니다.")),
      });
    if (window.gapi) return ready();
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.onload = ready;
    s.onerror = () => {
      loading = undefined;
      reject(new Error("Google 선택기를 불러오지 못했습니다."));
    };
    document.head.appendChild(s);
  }));
}
export async function pickGoogle(folder = false): Promise<string | null> {
  await load();
  const { data } = await apiClient.post<{
    token: string;
    key: string;
    appId: string;
  }>("/acm/prj/drive/picker");
  return new Promise((resolve, reject) => {
    const g = window.google;
    if (!g) return reject(new Error("Google 선택기를 사용할 수 없습니다."));
    let view = new g.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(folder)
      .setEnableDrives(true);
    if (folder) view = view.setMimeTypes("application/vnd.google-apps.folder");
    const picker = new g.picker.PickerBuilder()
      .setOAuthToken(data.token)
      .setDeveloperKey(data.key)
      .setAppId(data.appId)
      .setOrigin(location.origin)
      .addView(view)
      .setCallback((r) => {
        if (r.action === "picked" || r.action === "cancel") {
          picker.dispose();
          resolve(r.docs?.[0]?.id ?? null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}
