"use client";

/**
 * Dependency-free SVG charts for the Admin Dashboard: multi-series line,
 * grouped bars and a donut. All sized by viewBox so they scale to their
 * cards without a charting library.
 */
import { useId } from "react";

export interface Series {
  name: string;
  color: string;
  values: number[];
}

/* ── line chart ─────────────────────────────────────────────────── */
export function LineChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const W = 720;
  const H = height;
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const stepX = (W - padL - padR) / Math.max(labels.length - 1, 1);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const x = (i: number) => padL + i * stepX;
  const ticks = [0, max / 2, max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray="3 4" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
            {Math.round(t)}
          </text>
        </g>
      ))}
      {labels.map((l, i) =>
        i % 5 === 0 ? (
          <text key={l + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {l.replace(" Oct", "")}
          </text>
        ) : null,
      )}
      {series.map((s) => {
        const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`).join(" ");
        const area = `${d} L${x(s.values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
        return (
          <g key={s.name}>
            <path d={area} fill={s.color} opacity={0.06} />
            <path d={d} fill="none" stroke={s.color} strokeWidth={2.25} strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
}

/* ── grouped bar chart ──────────────────────────────────────────── */
export function BarChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const W = 720;
  const H = height;
  const padL = 44;
  const padR = 8;
  const padT = 12;
  const padB = 26;
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const groupW = (W - padL - padR) / labels.length;
  const barW = Math.max(3, (groupW * 0.62) / series.length);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, max / 2, max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray="3 4" />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
            {t >= 1000 ? `${Math.round(t / 1000)}K` : Math.round(t)}
          </text>
        </g>
      ))}
      {labels.map((l, i) => {
        const gx = padL + i * groupW;
        return (
          <g key={l + i}>
            {series.map((s, si) => (
              <rect
                key={s.name}
                x={gx + groupW * 0.19 + si * barW}
                y={y(s.values[i])}
                width={barW - 1.5}
                height={Math.max(1, y(0) - y(s.values[i]))}
                rx={2}
                fill={s.color}
              />
            ))}
            {i % 5 === 0 && (
              <text x={gx + groupW / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {l.replace(" Oct", "")}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── donut ──────────────────────────────────────────────────────── */
export function Donut({
  slices,
  centerValue,
  centerLabel,
  size = 176,
}: {
  slices: Array<{ name: string; pct: number; color: string }>;
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const R = 70;
  const C = 2 * Math.PI * R;
  // cumulative offsets computed functionally — nothing is mutated in render
  const arcs = slices.map((s, i) => {
    const len = (s.pct / 100) * C;
    const before = slices
      .slice(0, i)
      .reduce((sum, p) => sum + (p.pct / 100) * C, 0);
    return { ...s, len, dashOffset: -before };
  });

  return (
    <svg viewBox="0 0 180 180" width={size} height={size} role="img">
      <g transform="rotate(-90 90 90)">
        {arcs.map((s) => (
          <circle
            key={s.name + uid}
            cx="90"
            cy="90"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="22"
            strokeDasharray={`${s.len} ${C - s.len}`}
            strokeDashoffset={s.dashOffset}
          />
        ))}
      </g>
      <text x="90" y="86" textAnchor="middle" fontSize="22" fontWeight="800" fill="#0b1f3a">
        {centerValue}
      </text>
      <text x="90" y="106" textAnchor="middle" fontSize="10" fill="#64748b">
        {centerLabel}
      </text>
    </svg>
  );
}

/* ── legend ─────────────────────────────────────────────────────── */
export function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
