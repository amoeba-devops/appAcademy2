import { SetMetadata } from '@nestjs/common';

/**
 * PLN-261022 — activity-log hints. Writes (POST/PUT/PATCH/DELETE) are recorded automatically;
 * GETs are recorded only when marked with `@AuditRead` (personal-data screens) or `@AuditDownload`.
 */
export const AUDIT_META = 'acm:audit';
export interface AuditMeta {
  /** Override the action derived from the HTTP method. */
  action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'DOWNLOAD';
  /** Target type used for the label lookup (default: inferred from the route). */
  target?: string;
  /** Route param holding the target id (default: the last `:param`). */
  param?: string;
  /** Download kind shown in the activity log (e.g. `bill-export`). */
  download?: string;
  /** Do not record this route. */
  skip?: boolean;
}

/** Record a GET that shows personal data (READ). */
export const AuditRead = (target: string) =>
  SetMetadata(AUDIT_META, { action: 'READ', target } satisfies AuditMeta);
/** Record a file download (DOWNLOAD). */
export const AuditDownload = (
  download: string,
  target?: string,
  param?: string,
) =>
  SetMetadata(AUDIT_META, {
    action: 'DOWNLOAD',
    download,
    target,
    param,
  } satisfies AuditMeta);
export const AuditAs = (meta: AuditMeta) => SetMetadata(AUDIT_META, meta);
export const AuditSkip = () =>
  SetMetadata(AUDIT_META, { skip: true } satisfies AuditMeta);
