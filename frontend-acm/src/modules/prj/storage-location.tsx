import { useTranslation } from "react-i18next";
import { Database, ExternalLink, FolderOpen } from "lucide-react";

/** REQ-261018C — 파일이 실제로 저장되는 곳(Google Drive 경로 또는 ACM 저장소)을 보여준다. */
export function StorageLocation({
  storage,
  rootName,
  folderName,
  folderId,
}: {
  storage: "DRIVE" | "ACM";
  rootName?: string | null;
  folderName?: string | null;
  folderId?: string | null;
}) {
  const { t } = useTranslation("common");
  if (storage === "ACM")
    return (
      <span className="inline-flex items-center gap-1 text-secondary">
        <Database className="h-3.5 w-3.5 shrink-0" />
        {t("storagePath.acm")}
      </span>
    );
  const path = [t("storagePath.drive"), rootName, folderName].filter(Boolean).join(" › ");
  const body = (
    <>
      <FolderOpen className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{path}</span>
      {folderId && <ExternalLink className="h-3 w-3 shrink-0" />}
    </>
  );
  return folderId ? (
    <a
      href={`https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:underline"
      title={t("storagePath.openInDrive")}
    >
      {body}
    </a>
  ) : (
    <span className="inline-flex max-w-full items-center gap-1">{body}</span>
  );
}
