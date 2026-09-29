export function parseTuitionInput(text: string): string | null {
  if (text === "") return "";
  if (!/^[0-9,]+$/.test(text)) return null;
  const digits = text.replace(/,/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value) || value > 50_000_000) return null;
  return String(value);
}
export function formatTuition(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
export function tuitionCaret(text: string, digitCount: number): number {
  if (digitCount === 0) return 0;
  let digits = 0;
  for (let i = 0; i < text.length; i++)
    if (/\d/.test(text[i]) && ++digits === digitCount) return i + 1;
  return text.length;
}
