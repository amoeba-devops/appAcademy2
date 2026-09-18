interface SparklineProps {
  data: (number | null)[];
  height?: number;
  color?: string;
}

export function Sparkline({
  data,
  height = 40,
  color = 'currentColor',
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <div style={{ height }} className="text-secondary text-xs flex items-center">—</div>;
  }
  const w = 320;
  const h = height;
  const pad = 2;
  const known = data.filter((v): v is number => v !== null);
  if (!known.length) return <div style={{ height }}>—</div>;
  const min = Math.min(...known);
  const max = Math.max(...known);
  const range = max - min || 1;
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    if (v === null) return null;
    const x = pad + i * step;
    const y = max === min ? h / 2 : pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const linePath = points.map((p, i) => p ? `${i === 0 || points[i - 1] === null ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}` : "").join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      width="100%"
      height={h}
      role="img"
      aria-label="sparkline"
      style={{ display: 'block' }}
    >
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
