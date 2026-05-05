interface SparklineProps {
  data: number[];
  height?: number;
  color?: string;
  fillOpacity?: number;
}

export function Sparkline({
  data,
  height = 32,
  color = 'currentColor',
  fillOpacity = 0.12,
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <div style={{ height }} className="text-secondary text-xs flex items-center">—</div>;
  }
  const w = 100;
  const h = height;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const points = data.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], i) => (i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`)).join(' ');
  const fillPath =
    points.length > 1
      ? `${linePath} L${points[points.length - 1][0].toFixed(2)},${(h - pad).toFixed(2)} L${points[0][0].toFixed(2)},${(h - pad).toFixed(2)} Z`
      : '';

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
      {fillPath && <path d={fillPath} fill={color} opacity={fillOpacity} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
