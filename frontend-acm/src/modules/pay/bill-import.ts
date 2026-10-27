import type { BillInput } from "./types";

// REQ-261027 — Excel bulk bill registration. Columns are read by position so a template
// downloaded in any locale can be uploaded back.
export const BILL_KINDS = ["CLASS", "BOOK", "MATERIAL", "TRANSPORT", "OTHER"];
export const IMPORT_MAX_ROWS = 300;
// A name · B site · C month · D due · E kind · F class · G title · H amount · I discount
// J memo · K enrolled classes (reference) · L student id. Gray = do not edit.
const COLUMNS = 12;
const GRAY_COLUMNS = [1, 2, 11, 12];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRAY = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5E7EB" },
} as const;

export interface ImportClass {
  id: string;
  name: string;
}
export interface ImportStudent {
  id: string;
  name: string;
  site: string | null;
  classes: ImportClass[];
}
export interface ImportData {
  students: ImportStudent[];
  classes: ImportClass[];
}
export interface TemplateLabels {
  sheet: string;
  guideSheet: string;
  /** 12 headers, A..L */
  headers: string[];
  kinds: Record<string, string>;
  guideKinds: string;
  guideClasses: string;
  guideRules: string[];
  unassigned: string;
}
export interface ParsedRow {
  row: number;
  studentName: string;
  /** Cell text as typed, shown for rows that fail to parse. */
  raw: { month: string; title: string; amount: string };
  item?: BillInput;
  reason?: string;
  skipped?: boolean;
}

/** `PAY_*` error code from an API error response, if any. */
export function payErrorCode(e: unknown): string | undefined {
  const msg = (e as { response?: { data?: { error?: { message?: unknown } } } })
    .response?.data?.error?.message;
  return typeof msg === "string" && msg.startsWith("PAY_") ? msg : undefined;
}

async function loadExcel() {
  const module = await import("exceljs");
  return module.default ?? module;
}

export async function buildBillTemplate(
  data: ImportData,
  opts: { month: string; due: string; title: string; labels: TemplateLabels },
): Promise<ArrayBuffer> {
  const { Workbook } = await loadExcel();
  const { labels } = opts;
  const book = new Workbook();
  const sheet = book.addWorksheet(labels.sheet, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const guide = book.addWorksheet(labels.guideSheet);
  sheet.columns = [14, 10, 16, 18, 10, 16, 18, 12, 10, 20, 28, 38].map(
    (width) => ({ width }),
  );
  // Text format keeps typed months/dates as text instead of Excel dates.
  [3, 4].forEach((c) => (sheet.getColumn(c).numFmt = "@"));
  sheet.addRow(labels.headers).font = { bold: true };
  for (const s of data.students)
    sheet.addRow([
      s.name,
      s.site || labels.unassigned,
      opts.month,
      opts.due,
      labels.kinds.CLASS,
      s.classes.length === 1 ? s.classes[0].name : "",
      opts.title,
      null,
      0,
      "",
      s.classes.map((c) => c.name).join(", "),
      s.id,
    ]);
  sheet.eachRow((row) =>
    GRAY_COLUMNS.forEach((c) => (row.getCell(c).fill = GRAY)),
  );

  guide.columns = [{ width: 14 }, { width: 40 }];
  guide.addRow([labels.guideKinds]).font = { bold: true };
  for (const k of BILL_KINDS) guide.addRow([k, labels.kinds[k]]);
  guide.addRow([]);
  guide.addRow([labels.guideClasses]).font = { bold: true };
  const classStart = guide.rowCount + 1;
  for (const c of data.classes) guide.addRow(["", c.name]);
  const classEnd = guide.rowCount;
  guide.addRow([]);
  for (const line of labels.guideRules) guide.addRow([line]);

  const last = Math.max(data.students.length + 1, 2) + 200;
  const kindList = `"${BILL_KINDS.map((k) => labels.kinds[k]).join(",")}"`;
  const classRange = `'${labels.guideSheet}'!$B$${classStart}:$B$${classEnd}`;
  for (let r = 2; r <= last; r++) {
    sheet.getCell(r, 5).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [kindList],
    };
    if (data.classes.length)
      sheet.getCell(r, 6).dataValidation = {
        type: "list",
        allowBlank: true,
        showErrorMessage: false,
        formulae: [classRange],
      };
  }
  return book.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    const o = v as {
      richText?: { text: string }[];
      result?: unknown;
      text?: string;
    };
    if (o.richText) return o.richText.map((x) => x.text).join("");
    if ("result" in o) return text(o.result);
    if (typeof o.text === "string") return o.text;
  }
  return String(v as string | number | boolean).trim();
}
const pad = (n: number) => String(n).padStart(2, "0");
/** Excel serial or Date → [y, m, d] (dates in xlsx carry no time zone). */
function dateParts(v: unknown): [number, number, number] | null {
  if (v instanceof Date && !Number.isNaN(v.getTime()))
    return [v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()];
  if (typeof v === "number" && v > 0 && v < 2958466) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  }
  return null;
}
function parseMonth(v: unknown): string | null {
  const p = dateParts(v);
  const s = p ? `${p[0]}-${pad(p[1])}` : text(v).replace(/[./]/g, "-");
  const m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (!m || +m[2] < 1 || +m[2] > 12) return null;
  return `${m[1]}-${pad(+m[2])}`;
}
function parseDate(v: unknown): string | null {
  const p = dateParts(v);
  const s = p
    ? `${p[0]}-${p[1]}-${p[2]}`
    : text(v).replace(/[./]/g, "-").replace(/-$/, "");
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}
function parseMoney(v: unknown): number | null {
  const s =
    typeof v === "number" ? String(v) : text(v).replace(/[,\s원₫¥]/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n <= 50000000 ? n : null;
}

/**
 * Parse an uploaded workbook. `kindLabels` holds every locale's label per kind so a
 * template in any language parses. Throws `PAY_IMPORT_INVALID_FILE` / `PAY_IMPORT_TOO_MANY`.
 */
export async function parseBillWorkbook(
  input: ArrayBuffer,
  data: ImportData,
  kindLabels: Record<string, string[]>,
): Promise<ParsedRow[]> {
  const { Workbook } = await loadExcel();
  const book = new Workbook();
  try {
    await book.xlsx.load(input);
  } catch {
    throw new Error("PAY_IMPORT_INVALID_FILE");
  }
  const sheet = book.worksheets[0];
  if (!sheet) throw new Error("PAY_IMPORT_INVALID_FILE");
  const students = new Map(data.students.map((s) => [s.id.toLowerCase(), s]));
  const kinds = new Map<string, string>();
  for (const k of BILL_KINDS) {
    kinds.set(k.toLowerCase(), k);
    for (const label of kindLabels[k] ?? []) kinds.set(label.toLowerCase(), k);
  }
  const rows: ParsedRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const raw = Array.from(
      { length: COLUMNS },
      (_, i) => row.getCell(i + 1).value,
    );
    // The enrolled-classes reference column alone does not make a row.
    if (raw.every((v, i) => i === 10 || text(v) === "")) continue;
    if (rows.length >= IMPORT_MAX_ROWS) throw new Error("PAY_IMPORT_TOO_MANY");
    const [name, , month, due, kind, cls, title, amount, discount, memo, , id] =
      raw;
    const studentId = text(id);
    const student = students.get(studentId.toLowerCase());
    const out: ParsedRow = {
      row: r,
      studentName: student?.name || text(name),
      raw: {
        month: parseMonth(month) ?? text(month),
        title: text(title),
        amount: text(amount),
      },
    };
    rows.push(out);
    if (text(amount) === "") {
      out.skipped = true;
      continue;
    }
    const className = text(cls);
    const pool = student?.classes.filter((c) => c.name === className);
    const any = data.classes.filter((c) => c.name === className);
    const classId = !className
      ? undefined
      : pool?.length === 1
        ? pool[0].id
        : any.length === 1
          ? any[0].id
          : null;
    const item = {
      studentId,
      classId,
      month: parseMonth(month),
      due: parseDate(due),
      kind: kinds.get(text(kind).toLowerCase()),
      title: text(title),
      amount: parseMoney(amount),
      discount: text(discount) === "" ? 0 : parseMoney(discount),
      memo: text(memo),
    };
    out.reason = !UUID.test(studentId)
      ? "IMPORT_STUDENT"
      : !item.month
        ? "IMPORT_MONTH"
        : !item.due
          ? "IMPORT_DUE"
          : !item.kind
            ? "IMPORT_KIND"
            : item.classId === null
              ? "IMPORT_CLASS"
              : !item.title || item.title.length > 200
                ? "IMPORT_TITLE"
                : item.amount === null ||
                    item.discount === null ||
                    item.discount > item.amount
                  ? "IMPORT_AMOUNT"
                  : item.memo.length > 2000
                    ? "IMPORT_MEMO"
                    : undefined;
    if (!out.reason) out.item = item as BillInput;
  }
  return rows;
}
