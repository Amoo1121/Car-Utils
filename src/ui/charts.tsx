import { useId, useState } from "react";

export type StackSeries<K extends string> = { key: K; label: string; color: string };

/**
 * Stacked monthly bars. Pure SVG + CSS, no chart library.
 */
export function StackedBars<K extends string>({
  data,
  series,
  labelFor,
  format,
  height = 180,
}: {
  data: (Record<K, number> & { label: string })[];
  series: StackSeries<K>[];
  labelFor?: (item: Record<K, number> & { label: string }) => string;
  format: (value: number) => string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const totals = data.map((item) => series.reduce((sum, entry) => sum + (item[entry.key] || 0), 0));
  const max = Math.max(...totals, 1);
  const summary = data.map((item, index) => `${item.label} ${format(totals[index])}`).join("，");
  const lastNonZero = totals.reduce((last, total, index) => (total > 0 ? index : last), -1);
  const focusIndex = active ?? lastNonZero;

  return (
    <figure className="chart stacked-bars">
      <div className="chart-legend">
        {series.map((entry) => (
          <span key={entry.key}>
            <i style={{ background: entry.color }} />
            {entry.label}
          </span>
        ))}
        {focusIndex >= 0 && (
          <strong className="chart-readout">
            {labelFor ? labelFor(data[focusIndex]) : data[focusIndex].label} · {format(totals[focusIndex])}
          </strong>
        )}
      </div>
      <div aria-label={`月度支出：${summary}`} className="bars" role="img" style={{ height }}>
        {data.map((item, index) => (
          <button
            aria-label={`${item.label} ${format(totals[index])}`}
            className={index === focusIndex ? "bar active" : "bar"}
            key={item.label + index}
            type="button"
            onBlur={() => setActive(null)}
            onFocus={() => setActive(index)}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="bar-stack" style={{ height: `${(totals[index] / max) * 100}%` }}>
              {series.map((entry) =>
                item[entry.key] > 0 ? (
                  <span
                    key={entry.key}
                    style={{ background: entry.color, flexGrow: item[entry.key] }}
                    title={`${entry.label} ${format(item[entry.key])}`}
                  />
                ) : null,
              )}
            </span>
            <small>{item.label}</small>
          </button>
        ))}
      </div>
    </figure>
  );
}

export type LinePoint = { label: string; value: number; detail?: string };

export function LineChart({
  points,
  format,
  color = "var(--accent)",
  height = 160,
  referenceValue,
  referenceLabel,
}: {
  points: LinePoint[];
  format: (value: number) => string;
  color?: string;
  height?: number;
  referenceValue?: number;
  referenceLabel?: string;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return <p className="chart-empty">暂无数据</p>;

  const width = 600;
  const padX = 12;
  const padY = 16;
  const values = points.map((point) => point.value);
  const min = Math.min(...values, referenceValue ?? Infinity);
  const max = Math.max(...values, referenceValue ?? -Infinity);
  const span = max - min || Math.max(Math.abs(max) * 0.1, 1);
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;
  const x = (index: number) => (points.length === 1 ? width / 2 : padX + (index / (points.length - 1)) * (width - padX * 2));
  const y = (value: number) => padY + (1 - (value - lo) / (hi - lo)) * (height - padY * 2);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const focus = active ?? points.length - 1;
  const summary = points.map((point) => `${point.label} ${format(point.value)}`).join("，");

  return (
    <figure className="chart line-chart">
      <div className="chart-legend">
        <strong className="chart-readout">
          {points[focus].label} · {format(points[focus].value)}
          {points[focus].detail ? <small> {points[focus].detail}</small> : null}
        </strong>
      </div>
      <svg aria-label={summary} preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {referenceValue != null && (
          <g className="chart-reference">
            <line x1="0" x2={width} y1={y(referenceValue)} y2={y(referenceValue)} />
            {referenceLabel && (
              <text x={width - 4} y={y(referenceValue) - 6}>
                {referenceLabel}
              </text>
            )}
          </g>
        )}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        {points.map((point, index) => (
          <g key={point.label + index}>
            <rect
              className="chart-hit"
              height={height}
              width={Math.max(width / points.length, 8)}
              x={x(index) - Math.max(width / points.length, 8) / 2}
              y="0"
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            />
            <circle
              className={index === focus ? "chart-dot active" : "chart-dot"}
              cx={x(index)}
              cy={y(point.value)}
              fill={color}
              r={index === focus ? 5 : 3}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>
      <div className="chart-axis">
        <span>{points[0].label}</span>
        {points.length > 2 && <span>{points[Math.floor(points.length / 2)].label}</span>}
        <span>{points.at(-1)!.label}</span>
      </div>
    </figure>
  );
}

export function Sparkline({ values, color = "currentColor", width = 96, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${((index / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((value - min) / span) * (height - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg aria-hidden="true" className="sparkline" height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function BarList({
  items,
  format,
}: {
  items: { label: string; value: number; color?: string; detail?: string }[];
  format: (value: number) => string;
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  if (items.length === 0) return <p className="chart-empty">暂无数据</p>;
  return (
    <ul className="bar-list">
      {items.map((item) => (
        <li key={item.label}>
          <div className="bar-list-row">
            <span>{item.label}</span>
            <strong>{format(item.value)}</strong>
          </div>
          <div className="bar-list-track">
            <span style={{ width: `${(item.value / max) * 100}%`, background: item.color ?? "var(--accent)" }} />
          </div>
          {item.detail && <small>{item.detail}</small>}
        </li>
      ))}
    </ul>
  );
}

export function Meter({ value, max, tone = "accent", label }: { value: number; max: number; tone?: "accent" | "warn" | "danger"; label: string }) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return (
    <div aria-label={label} aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.round(ratio * 100)} className={`meter meter-${tone}`} role="meter">
      <span style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
