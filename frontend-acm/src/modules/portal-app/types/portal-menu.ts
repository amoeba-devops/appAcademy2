export type PortalMenuKey =
  "notices" | "calendar" | "students" | "links" | "materials" | "chat" | "me";
export type PortalMenuKind = "TEACHER" | "STUDENT";
export interface PortalMenuNav {
  visible: PortalMenuKey[];
  home: string;
}
export interface PortalMenuItem {
  key: PortalMenuKey;
  roles: Record<PortalMenuKind, boolean>;
  locked: PortalMenuKind[];
  alwaysOn: boolean;
}
export interface PortalMenuUpdate {
  key: PortalMenuKey;
  kind: PortalMenuKind;
  visible: boolean;
}
