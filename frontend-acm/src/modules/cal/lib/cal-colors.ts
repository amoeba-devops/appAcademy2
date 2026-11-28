/**
 * REQ-261128-CAL — calendar colors are a single `#rrggbb` picked by the admin.
 * Card background / text / border tones are derived from it. Legacy palette
 * names (and their migrated hex values) keep their exact original tones so
 * existing calendars look the same after the migration (sql/acm/1073).
 */
export type Tone = readonly [background: string, text: string, border: string];

export const LEGACY_PALETTE: Record<string, { hex: string; tone: Tone }> = {
  blue: { hex: '#3b82f6', tone: ['#dbeafe', '#1e40af', '#93c5fd'] },
  purple: { hex: '#a855f7', tone: ['#f3e8ff', '#6b21a8', '#d8b4fe'] },
  amber: { hex: '#f59e0b', tone: ['#fef3c7', '#92400e', '#fcd34d'] },
  green: { hex: '#10b981', tone: ['#d1fae5', '#065f46', '#6ee7b7'] },
  rose: { hex: '#f43f5e', tone: ['#ffe4e6', '#9f1239', '#fda4af'] },
  cyan: { hex: '#06b6d4', tone: ['#cffafe', '#155e75', '#67e8f9'] },
  orange: { hex: '#f97316', tone: ['#ffedd5', '#9a3412', '#fdba74'] },
  gray: { hex: '#6b7280', tone: ['#f3f4f6', '#374151', '#d1d5db'] },
};

/** Quick picks shown under the color picker (same as the old 8 palettes + 4). */
export const PRESET_COLORS = [
  ...Object.values(LEGACY_PALETTE).map((p) => p.hex),
  '#22c55e',
  '#ef4444',
  '#8b5cf6',
  '#eab308',
];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const FALLBACK_COLOR = '#6b7280';

/** Accepts `#rrggbb` or a legacy palette name; returns `#rrggbb` (lowercase). */
export function toHex(color: string | null | undefined): string | null {
  if (!color) return null;
  if (LEGACY_PALETTE[color]) return LEGACY_PALETTE[color].hex;
  return HEX_RE.test(color) ? color.toLowerCase() : null;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexOf([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}
/** Mix `hex` toward `target` by `amount` (0 → hex, 1 → target). */
function mix(hex: string, target: [number, number, number], amount: number) {
  const c = rgb(hex);
  return hexOf(c.map((v, i) => v + (target[i] - v) * amount) as [number, number, number]);
}
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/** Background (light tint) · text (dark shade, ≥ 4.5:1 on the tint) · border. */
export function toneOf(color: string | null | undefined): Tone {
  const hex = toHex(color) ?? FALLBACK_COLOR;
  const legacy = Object.values(LEGACY_PALETTE).find((p) => p.hex === hex);
  if (legacy) return legacy.tone;
  const background = mix(hex, WHITE, 0.85);
  const border = mix(hex, WHITE, 0.45);
  let text = mix(hex, BLACK, 0.45);
  for (let k = 0.55; contrast(text, background) < 4.5 && k <= 0.95; k += 0.1)
    text = mix(hex, BLACK, k);
  return [background, text, border];
}
