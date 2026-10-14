import { useRef, useState } from "react";
import { type Sheet, blankSheet, columnName, displayCell } from "./sheet-model";
import { Button } from "@/components/ui/button";
export function SheetEditor({
  value,
  onChange,
  readOnly,
}: {
  value: Sheet;
  onChange: (v: Sheet) => void;
  readOnly: boolean;
}) {
  const shiftPointer = useRef(false);
  const [start, setStart] = useState<[number, number]>([0, 0]),
    [end, setEnd] = useState<[number, number]>([0, 0]),
    [editing, setEditing] = useState(""),
    [past, setPast] = useState<Sheet[]>([]),
    [future, setFuture] = useState<Sheet[]>([]);
  const s = value.cells?.length ? value : blankSheet();
  const update = (fn: (n: Sheet) => void) => {
    const next = structuredClone(s);
    fn(next);
    setPast((p) => [...p.slice(-39), s]);
    setFuture([]);
    onChange(next);
  };
  const selected = (r: number, c: number) =>
    r >= Math.min(start[0], end[0]) &&
    r <= Math.max(start[0], end[0]) &&
    c >= Math.min(start[1], end[1]) &&
    c <= Math.max(start[1], end[1]);
  const apply = (fn: (cell: Sheet["cells"][number][number]) => void) =>
    update((n) =>
      n.cells.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (selected(r, c)) fn(cell);
        }),
      ),
    );
  return (
    <div className="min-w-0 space-y-2">
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!past.length}
            onClick={() => {
              const prev = past[past.length - 1];
              setFuture((f) => [s, ...f]);
              setPast((p) => p.slice(0, -1));
              onChange(prev);
            }}
          >
            되돌리기
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!future.length}
            onClick={() => {
              setPast((p) => [...p, s]);
              onChange(future[0]);
              setFuture((f) => f.slice(1));
            }}
          >
            다시 실행
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={s.cells.length >= 200}
            onClick={() =>
              update((n) => {
                n.cells.push(n.cells[0].map(() => ({ value: "" })));
                if (n.heights) n.heights.push(36);
              })
            }
          >
            행 추가
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={s.cells[0].length >= 50}
            onClick={() =>
              update((n) => {
                n.cells.forEach((row) => row.push({ value: "" }));
                if (n.widths) n.widths.push(120);
              })
            }
          >
            열 추가
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={s.cells.length < 2}
            onClick={() => {
              update((n) => {
                n.cells.splice(start[0], 1);
                n.heights?.splice(start[0], 1);
              });
              setStart([0, 0]);
              setEnd([0, 0]);
            }}
          >
            선택 행 삭제
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={s.cells[0].length < 2}
            onClick={() => {
              update((n) => {
                n.cells.forEach((row) => row.splice(start[1], 1));
                n.widths?.splice(start[1], 1);
              });
              setStart([0, 0]);
              setEnd([0, 0]);
            }}
          >
            선택 열 삭제
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              apply((c) => {
                c.bold = !c.bold;
              })
            }
          >
            굵게
          </Button>
          <select
            aria-label="셀 표시 형식"
            className="rounded border p-2"
            value={s.cells[start[0]]?.[start[1]]?.format ?? "auto"}
            onChange={(e) =>
              apply((c) => {
                c.format = e.target.value as "auto" | "number" | "text";
              })
            }
          >
            <option value="auto">자동</option>
            <option value="number">숫자</option>
            <option value="text">문자</option>
          </select>
          <label>
            열 너비{" "}
            <input
              type="number"
              min={60}
              max={500}
              className="w-20 border p-2"
              value={s.widths?.[start[1]] ?? 120}
              onChange={(e) => {
                const width = Number(e.target.value);
                if (width >= 60 && width <= 500)
                  update((n) => {
                    n.widths ??= n.cells[0].map(() => 120);
                    n.widths[start[1]] = width;
                  });
              }}
            />
          </label>
          <label>
            행 높이{" "}
            <input
              type="number"
              min={24}
              max={300}
              className="w-20 border p-2"
              value={s.heights?.[start[0]] ?? 36}
              onChange={(e) => {
                const height = Number(e.target.value);
                if (height >= 24 && height <= 300)
                  update((n) => {
                    n.heights ??= n.cells.map(() => 36);
                    n.heights[start[0]] = height;
                  });
              }}
            />
          </label>
        </div>
      )}
      <p className="text-xs text-secondary">
        Shift+클릭으로 범위 선택 · 복사/붙여넣기 · =SUM(A1:A3), =AVERAGE(A1:A3),
        사칙연산 지원 · 행/열 삭제 시 수식 참조는 자동 이동하지 않습니다.
      </p>
      <div
        className="max-w-full overflow-auto border"
        style={{ maxHeight: 480 }}
        onCopy={(e) => {
          const text = s.cells
            .flatMap((row, r) =>
              r >= Math.min(start[0], end[0]) && r <= Math.max(start[0], end[0])
                ? [
                    row
                      .filter((_, c) => selected(r, c))
                      .map((c) => c.value)
                      .join("\t"),
                  ]
                : [],
            )
            .join("\n");
          e.clipboardData.setData("text/plain", text);
          e.preventDefault();
        }}
      >
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th>#</th>
              {s.cells[0].map((_, c) => (
                <th key={c} className="border p-1">
                  {columnName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.cells.map((row, r) => (
              <tr key={r}>
                <th className="border px-2">{r + 1}</th>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={`border ${selected(r, c) ? "bg-blue-50" : ""}`}
                  >
                    <input
                      aria-label={`${columnName(c)}${r + 1}`}
                      readOnly={readOnly}
                      style={{
                        width: s.widths?.[c] ?? 120,
                        height: s.heights?.[r] ?? 36,
                        fontWeight: cell.bold ? "bold" : "normal",
                      }}
                      className="bg-transparent p-2 outline-blue-500"
                      value={
                        editing === `${r}:${c}`
                          ? cell.value
                          : displayCell(s, r, c)
                      }
                      onPointerDown={(e) => {
                        shiftPointer.current = e.shiftKey;
                      }}
                      onFocus={() => {
                        if (!shiftPointer.current) {
                          setStart([r, c]);
                          setEnd([r, c]);
                        }
                        shiftPointer.current = false;
                        setEditing(`${r}:${c}`);
                      }}
                      onBlur={() => setEditing("")}
                      onClick={(e) => {
                        if (e.shiftKey) setEnd([r, c]);
                        else {
                          setStart([r, c]);
                          setEnd([r, c]);
                        }
                      }}
                      onChange={(e) =>
                        update((n) => {
                          n.cells[r][c].value = e.target.value;
                        })
                      }
                      onPaste={(e) => {
                        if (readOnly) return;
                        const rows = e.clipboardData
                          .getData("text/plain")
                          .replace(/\r/g, "")
                          .replace(/\n$/, "")
                          .split("\n")
                          .map((x) => x.split("\t"));
                        if (
                          rows.length + r > 200 ||
                          Math.max(...rows.map((x) => x.length)) + c > 50
                        ) {
                          e.preventDefault();
                          return;
                        }
                        e.preventDefault();
                        update((n) => {
                          const cols = Math.max(
                            n.cells[0].length,
                            c + Math.max(...rows.map((x) => x.length)),
                          );
                          while (n.cells.length < r + rows.length)
                            n.cells.push(
                              Array.from({ length: cols }, () => ({
                                value: "",
                              })),
                            );
                          n.cells.forEach((row) => {
                            while (row.length < cols) row.push({ value: "" });
                          });
                          rows.forEach((row, y) =>
                            row.forEach((v, x) => {
                              n.cells[r + y][c + x].value = v.slice(0, 2000);
                            }),
                          );
                          if (n.widths)
                            while (n.widths.length < cols) n.widths.push(120);
                          if (n.heights)
                            while (n.heights.length < n.cells.length)
                              n.heights.push(36);
                        });
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
