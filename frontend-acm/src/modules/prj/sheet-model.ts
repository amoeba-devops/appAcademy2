export interface Cell {
  value: string;
  bold?: boolean;
  format?: "auto" | "number" | "text";
}
export interface Sheet {
  cells: Cell[][];
  widths?: number[];
  heights?: number[];
}
export const blankSheet = (): Sheet => ({
  cells: Array.from({ length: 12 }, () =>
    Array.from({ length: 8 }, () => ({ value: "" })),
  ),
});
export const columnName = (n: number): string =>
  n < 26
    ? String.fromCharCode(65 + n)
    : columnName(Math.floor(n / 26) - 1) + String.fromCharCode(65 + (n % 26));
function coordinates(ref: string): [number, number] {
  const m = ref.match(/^([A-Z]+)([1-9]\d*)$/);
  if (!m) throw Error("#REF!");
  return [
    Number(m[2]) - 1,
    [...m[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1,
  ];
}
// Bounded recursive-descent parser. No JavaScript evaluation or external functions.
export function cellValue(
  sheet: Sheet,
  r: number,
  c: number,
  stack = new Set<string>(),
  budget = { left: 20000 },
): string | number {
  const key = `${r}:${c}`;
  if (--budget.left < 0 || stack.size > 100) throw Error("#LIMIT!");
  if (stack.has(key)) throw Error("#CYCLE!");
  const cell = sheet.cells[r]?.[c];
  if (!cell) throw Error("#REF!");
  const value = cell.value;
  if (cell.format === "text" || !value.startsWith("="))
    return value.trim() !== "" &&
      Number.isFinite(Number(value)) &&
      cell.format !== "text"
      ? Number(value)
      : value;
  stack.add(key);
  try {
    const src = value.slice(1).toUpperCase();
    const tokens =
      src.match(/\d+(?:\.\d+)?|[A-Z]+[1-9]\d*|[A-Z]+|[()+\-*/,\:]/g) ?? [];
    if (tokens.join("") !== src.replace(/\s/g, "")) throw Error("#VALUE!");
    let at = 0;
    const number = (x: string | number) => {
      if (x === "") return 0;
      const n = Number(x);
      if (!Number.isFinite(n)) throw Error("#VALUE!");
      return n;
    };
    const ref = (s: string) => {
      const [y, x] = coordinates(s);
      return number(cellValue(sheet, y, x, stack, budget));
    };
    const atom = (): number => {
      const t = tokens[at++];
      if (t === "+" || t === "-") return (t === "-" ? -1 : 1) * atom();
      if (t === "(") {
        const n = expr();
        if (tokens[at++] !== ")") throw Error("#VALUE!");
        return n;
      }
      if (t === "SUM" || t === "AVERAGE") {
        if (tokens[at++] !== "(") throw Error("#VALUE!");
        const values: number[] = [];
        do {
          if (/^[A-Z]+\d+$/.test(tokens[at] ?? "") && tokens[at + 1] === ":") {
            const a = coordinates(tokens[at++]);
            at++;
            const b = coordinates(tokens[at++]);
            if (b[0] >= 200 || b[1] >= 50 || a[0] > b[0] || a[1] > b[1])
              throw Error("#REF!");
            for (let y = a[0]; y <= b[0]; y++)
              for (let x = a[1]; x <= b[1]; x++)
                values.push(number(cellValue(sheet, y, x, stack, budget)));
          } else values.push(expr());
          if (tokens[at] !== ",") break;
          at++;
        } while (at < tokens.length);
        if (tokens[at++] !== ")") throw Error("#VALUE!");
        return (
          values.reduce((a, b) => a + b, 0) /
          (t === "AVERAGE" ? values.length : 1)
        );
      }
      if (/^\d/.test(t ?? "")) return Number(t);
      if (/^[A-Z]+\d+$/.test(t ?? "")) return ref(t);
      throw Error("#VALUE!");
    };
    const term = (): number => {
      let n = atom();
      while (tokens[at] === "*" || tokens[at] === "/") {
        const op = tokens[at++],
          v = atom();
        if (op === "/" && v === 0) throw Error("#DIV/0!");
        n = op === "*" ? n * v : n / v;
      }
      return n;
    };
    const expr = (): number => {
      let n = term();
      while (tokens[at] === "+" || tokens[at] === "-") {
        const op = tokens[at++],
          v = term();
        n = op === "+" ? n + v : n - v;
      }
      return n;
    };
    const result = expr();
    if (at !== tokens.length || !Number.isFinite(result))
      throw Error("#VALUE!");
    return result;
  } finally {
    stack.delete(key);
  }
}
export function displayCell(s: Sheet, r: number, c: number) {
  try {
    const v = cellValue(s, r, c);
    return typeof v === "number"
      ? v.toLocaleString("en-US", { maximumFractionDigits: 10 })
      : v;
  } catch (e) {
    return e instanceof Error ? e.message : "#VALUE!";
  }
}
