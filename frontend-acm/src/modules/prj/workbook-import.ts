import type { Sheet as FortuneSheet } from "@fortune-sheet/core";
import type { WorkbookDocument } from "./workbook-editor";
/** Import supported XLSX values/formulas without executing formulas or fetching links. */
export async function importWorkbook(
  input: ArrayBuffer,
): Promise<WorkbookDocument> {
  if (input.byteLength > 20 * 1024 * 1024)
    throw new Error("20MB 이하 XLSX 파일을 선택하세요.");
  const module = await import("exceljs");
  const { Workbook } = module.default ?? module;
  const workbook = new Workbook();
  await workbook.xlsx.load(input);
  if (!workbook.worksheets.length || workbook.worksheets.length > 20)
    throw new Error("시트는 1~20개까지 가져올 수 있습니다.");
  const sheets: FortuneSheet[] = workbook.worksheets.map((ws, index) => {
    if (ws.rowCount > 10000 || ws.columnCount > 500)
      throw new Error(
        "행 또는 열이 저장 범위를 초과했습니다. Google 링크로 등록하세요.",
      );
    const celldata: NonNullable<FortuneSheet["celldata"]> = [];
    ws.eachRow((row, r) =>
      row.eachCell((cell, c) => {
        const value = cell.value;
        if (
          value === null ||
          value === undefined ||
          (cell.isMerged && cell.master.address !== cell.address)
        )
          return;
        const formula = cell.formula;
        const scalar =
          typeof value === "number" || typeof value === "boolean"
            ? value
            : value instanceof Date
              ? value.toISOString()
              : cell.text;
        celldata.push({
          r: r - 1,
          c: c - 1,
          v: {
            v: formula
              ? typeof cell.result === "number"
                ? cell.result
                : ""
              : scalar,
            ...(formula ? { f: `=${formula}` } : {}),
            bl: cell.font?.bold ? 1 : 0,
            it: cell.font?.italic ? 1 : 0,
          },
        });
      }),
    );
    return {
      id: `import-${index + 1}`,
      name: ws.name,
      row: Math.max(50, ws.rowCount),
      column: Math.max(26, ws.columnCount),
      celldata,
    };
  });
  const result: WorkbookDocument = { version: 2, sheets };
  if (new TextEncoder().encode(JSON.stringify(result)).length > 60000)
    throw new Error(
      "변환한 시트가 저장 한도(60KB)를 초과합니다. Google 링크로 등록하세요.",
    );
  return result;
}
