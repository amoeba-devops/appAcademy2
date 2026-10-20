import { apiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import type { Sheet as FortuneSheet } from "@fortune-sheet/core";
import "@fortune-sheet/react/dist/index.css";
import type { Sheet } from "./sheet-model";
export interface WorkbookDocument {
  version: 2;
  sheets: FortuneSheet[];
}
export function toWorkbook(value: Sheet | WorkbookDocument): WorkbookDocument {
  if ("version" in value && value.version === 2) return value;
  const old = value as Sheet;
  return {
    version: 2,
    sheets: [
      {
        id: "sheet-1",
        name: "Sheet1",
        row: Math.max(50, old.cells.length),
        column: 50,
        celldata: old.cells.flatMap((row, r) =>
          row.flatMap((cell, c) =>
            cell.value
              ? [
                  {
                    r,
                    c,
                    v: {
                      v: cell.value.startsWith("=")
                        ? ""
                        : cell.format === "text"
                          ? cell.value
                          : Number.isFinite(Number(cell.value))
                            ? Number(cell.value)
                            : cell.value,
                      ...(cell.value.startsWith("=") ? { f: cell.value } : {}),
                      bl: cell.bold ? 1 : 0,
                    },
                  },
                ]
              : [],
          ),
        ),
        config: {
          columnlen: Object.fromEntries(
            (old.widths ?? []).map((v, i) => [i, v]),
          ),
          rowlen: Object.fromEntries((old.heights ?? []).map((v, i) => [i, v])),
        },
      },
    ],
  };
}
export function snapshot(sheets: FortuneSheet[]): WorkbookDocument {
  return {
    version: 2,
    sheets: sheets.map(({ data, celldata, ...sheet }) => ({
      ...sheet,
      celldata: data
        ? data.flatMap((row, r) =>
            (row ?? []).flatMap((v, c) => (v ? [{ r, c, v }] : [])),
          )
        : (celldata ?? []),
    })),
  };
}
export function WorkbookEditor({
  value,
  readOnly,
  onChange,
  title,
  snapshotRef,
  project,
}: {
  value: Sheet | WorkbookDocument;
  readOnly: boolean;
  onChange: (v: WorkbookDocument) => void;
  title: string;
  project: string;
  snapshotRef: RefObject<(() => WorkbookDocument) | null>;
}) {
  const { t: tp } = useTranslation("prj");
  const qc = useQueryClient();
  const [generation, setGeneration] = useState(0);
  const [googleCopy, setGoogleCopy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [initial, setInitial] = useState(() => toWorkbook(value)),
    ref = useRef<WorkbookInstance>(null),
    [error, setError] = useState("");
  snapshotRef.current = () => {
    const result = snapshot(ref.current?.getAllSheets() ?? initial.sheets);
    const input = document.getElementById("luckysheet-rich-text-editor");
    const box = document.querySelector<HTMLElement>(".luckysheet-input-box");
    if (
      input &&
      (box?.style.zIndex === "19" || document.activeElement === input) &&
      ref.current
    ) {
      const selection = ref.current.getSelection()?.[0];
      const sheet = result.sheets.find(
        (s) => s.id === ref.current?.getSheet().id,
      );
      if (selection && sheet) {
        const r = selection.row[0],
          c = selection.column[0],
          text = input.innerText.replace(/\u200b/g, "").replace(/\n+$/, "");
        const cells = sheet.celldata ?? [],
          at = cells.findIndex((cell) => cell.r === r && cell.c === c),
          old = at >= 0 ? cells[at].v : {};
        const style = { ...old };
        delete style.f;
        const cell = {
          r,
          c,
          v: {
            ...style,
            ...(text.startsWith("=")
              ? { f: text, v: "" }
              : { v: text, m: text }),
          },
        };
        if (at >= 0) cells[at] = cell;
        else cells.push(cell);
        sheet.celldata = cells;
      }
    }
    return result;
  };
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        {!readOnly && (
          <label className="cursor-pointer rounded border px-3 py-2 text-sm">
            {tp("workbook.importXlsx")}
            <input
              className="sr-only"
              type="file"
              accept=".xlsx"
              disabled={sharing}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (
                  !confirm(tp("workbook.confirmReplace"))
                )
                  return;
                setSharing(true);
                setError("");
                try {
                  const { importWorkbook } = await import("./workbook-import");
                  const result = await importWorkbook(await file.arrayBuffer());
                  setInitial(result);
                  setGeneration((v) => v + 1);
                  onChange(result);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : tp("workbook.importFailed"),
                  );
                } finally {
                  setSharing(false);
                }
              }}
            />
          </label>
        )}
        <span className="text-xs text-secondary">
          {tp("workbook.editHint")}
        </span>
        {!readOnly && (
          <label className="text-sm">
            <input
              type="checkbox"
              checked={googleCopy}
              disabled={sharing}
              onChange={(e) => setGoogleCopy(e.target.checked)}
            />{" "}
            {tp("workbook.googleCopy")}
          </label>
        )}
        <button
          type="button"
          disabled={sharing}
          data-google={googleCopy && !readOnly}
          className="rounded border px-3 py-2 text-sm"
          onClick={async (event) => {
            const upload = event.currentTarget.dataset.google === "true";
            setSharing(true);
            try {
              const module = await import("exceljs");
              const ExcelJS = module.default ?? module;
              const wb = new ExcelJS.Workbook();
              for (const [
                index,
                s,
              ] of snapshotRef.current!().sheets.entries()) {
                const ws = wb.addWorksheet(
                  `${index + 1}-${s.name}`
                    .replace(/[\\/*?:\[\]]/g, "_")
                    .slice(0, 31),
                );
                for (const cell of s.celldata ?? []) {
                  if (!cell.v) continue;
                  const target = ws.getCell(cell.r + 1, cell.c + 1);
                  if (cell.v.f)
                    target.value = {
                      formula: cell.v.f.replace(/^=/, ""),
                      result:
                        typeof cell.v.v === "number" ? cell.v.v : undefined,
                    };
                  else
                    target.value =
                      typeof cell.v.v === "number" ||
                      typeof cell.v.v === "boolean"
                        ? cell.v.v
                        : String(cell.v.v ?? "");
                  target.font = {
                    bold: cell.v.bl === 1,
                    italic: cell.v.it === 1,
                  };
                }
              }
              const bytes = await wb.xlsx.writeBuffer();
              if (upload) {
                const form = new FormData();
                form.append(
                  "file",
                  new Blob([new Uint8Array(bytes)], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  }),
                  `${title || "spreadsheet"}.xlsx`,
                );
                form.append("title", title || "Spreadsheet");
                form.append("kind", "SHEET");
                form.append("operationId", operationId);
                const { data } = await apiClient.post<{ id: string }>(
                  `/acm/prj/projects/${project}/drive/upload`,
                  form,
                  { timeout: 90000 },
                );
                setOperationId(crypto.randomUUID());
                setShareUrl(
                  `https://docs.google.com/spreadsheets/d/${data.id}/edit`,
                );
                await qc.invalidateQueries({ queryKey: ["prj"] });
                return;
              }
              const url = URL.createObjectURL(
                new Blob([new Uint8Array(bytes)], {
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `${title || "spreadsheet"}.xlsx`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch {
              setError(tp("workbook.exportFailed"));
            } finally {
              setSharing(false);
            }
          }}
        >
          {sharing
            ? tp("workbook.processing")
            : googleCopy && !readOnly
              ? tp("workbook.createGoogleSheet")
              : tp("workbook.downloadXlsx")}
        </button>
      </div>
      {shareUrl && (
        <a
          className="text-blue-600 underline"
          href={shareUrl}
          target="_blank"
          rel="noreferrer"
        >
          {tp("workbook.openCreatedSheet")}
        </a>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="h-[70dvh] min-h-96 w-full overflow-hidden rounded border">
        <Workbook
          key={generation}
          ref={ref}
          data={initial.sheets}
          allowEdit={!readOnly}
          showToolbar={!readOnly}
          onChange={(s) => onChange(snapshot(s))}
        />
      </div>
    </div>
  );
}
