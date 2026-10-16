import { apiClient } from "@/lib/api-client";
interface PickerView {
  setIncludeFolders(v: boolean): PickerView;
  setSelectFolderEnabled(v: boolean): PickerView;
  setMimeTypes(v: string): PickerView;
  setEnableDrives(v: boolean): PickerView;
  setParent(v: string): PickerView;
  setLabel?(v: string): PickerView;
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
  enableFeature(v: string): Builder;
  setCallback(
    v: (r: { action: string; docs?: { id: string }[] }) => void,
  ): Builder;
  build(): Picker;
}
interface GoogleApi {
  picker: {
    DocsView: new () => PickerView;
    PickerBuilder: new () => Builder;
    Feature: { SUPPORT_DRIVES: string };
  };
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
const PICKER_SELECTOR = ".picker-dialog, .picker-dialog-bg, .picker";
const inPicker = (n: EventTarget | null) =>
  n instanceof Element && !!n.closest(PICKER_SELECTOR);

/**
 * FIX-261016B — ACM(Radix) 모달 위에서 Picker 를 열면 모달이 body 에 pointer-events:none 을
 * 걸고 포커스를 가둬 Picker 를 클릭·입력할 수 없다. Picker 가 열린 동안만
 * ① Picker 요소의 포인터 이벤트를 살리고 ② Picker 로 가는 포커스·바깥 클릭 이벤트가
 * 모달의 포커스 트랩/바깥 클릭 닫기에 전달되지 않도록 window 캡처 단계에서 끊는다.
 */
function guardModalWhilePicking() {
  const style = document.createElement("style");
  style.textContent = `${PICKER_SELECTOR}{pointer-events:auto!important}.picker-dialog-bg{z-index:2147483000!important}.picker-dialog{z-index:2147483001!important}`;
  document.head.appendChild(style);
  const stop = (e: Event) => {
    const related = (e as FocusEvent).relatedTarget ?? null;
    if (inPicker(e.target) || inPicker(related)) e.stopImmediatePropagation();
  };
  const types = ["focusin", "focusout", "pointerdown", "mousedown", "touchstart"];
  for (const t of types) window.addEventListener(t, stop, true);
  return () => {
    for (const t of types) window.removeEventListener(t, stop, true);
    style.remove();
  };
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
    const view = () => {
      const v = new g.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(folder);
      return folder ? v.setMimeTypes("application/vnd.google-apps.folder") : v;
    };
    const release = guardModalWhilePicking();
    const picker = new g.picker.PickerBuilder()
      .setOAuthToken(data.token)
      .setDeveloperKey(data.key)
      .setAppId(data.appId)
      .setOrigin(location.origin)
      // FIX-261016B — 내 드라이브 + 공유 드라이브 두 탭.
      .addView(view().setParent("root"))
      .addView(view().setEnableDrives(true))
      .enableFeature(g.picker.Feature.SUPPORT_DRIVES)
      .setCallback((r) => {
        if (r.action === "picked" || r.action === "cancel") {
          release();
          picker.dispose();
          resolve(r.docs?.[0]?.id ?? null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}
