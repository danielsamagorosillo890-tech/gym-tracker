import { useEffect, useRef, useState } from 'react';
import { fmtNum } from '../logic/units';

export interface ChartSeries {
  id: string;
  label: string;
  /** CSS custom property name, e.g. "--series-1". */
  colorVar: string;
  dashed?: boolean;
  points: { x: number; y: number | null }[];
}

const dayFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const longFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 100) / 100);
  return ticks;
}

/**
 * Single-axis time line chart (all series share the y unit). Tap/drag shows a
 * crosshair and a tooltip with every series' value at that date.
 */
export function LineChart({ series, unit, height = 220 }: { series: ChartSeries[]; unit: string; height?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const ys = series.flatMap((s) => s.points.map((p) => p.y)).filter((y): y is number => y !== null);
  if (xs.length === 0 || ys.length === 0) return null;

  const m = { top: 26, right: 38, bottom: 28, left: 44 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const x0 = xs[0];
  const x1 = xs[xs.length - 1];
  const sx = (x: number) => (x1 === x0 ? w / 2 : ((x - x0) / (x1 - x0)) * w);
  const sy = (y: number) => h - ((y - y0) / (y1 - y0 || 1)) * h;
  const showMarkers = xs.length <= 24;
  const xTicks = xs.length <= 2 ? xs : [x0, xs[Math.floor(xs.length / 2)], x1];

  const pick = (clientX: number) => {
    const rect = wrap.current!.getBoundingClientRect();
    const px = clientX - rect.left - m.left;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(sx(xs[i]) - px) < Math.abs(sx(xs[best]) - px)) best = i;
    setActive(best);
  };

  const activeX = active !== null ? xs[active] : null;
  const tipLeft = activeX !== null ? Math.min(Math.max(m.left + sx(activeX) - 95, 0), width - 190) : 0;

  return (
    <div className="chart" ref={wrap}>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.id} className="legend-item">
              <svg width="22" height="10" aria-hidden="true">
                <line x1="1" y1="5" x2="21" y2="5" stroke={`var(${s.colorVar})`} strokeWidth="2.5" strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinecap="round" />
              </svg>
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Gráfica en ${unit}. Toca para ver valores.`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => e.buttons && pick(e.clientX)}
        style={{ touchAction: 'pan-y' }}
      >
        <g transform={`translate(${m.left},${m.top})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={w} y1={sy(t)} y2={sy(t)} className="grid" />
              <text x={-8} y={sy(t)} dy="0.32em" textAnchor="end" className="axis">
                {fmtNum(t)}
              </text>
            </g>
          ))}
          <text x={-8} y={-14} textAnchor="end" className="axis unit">
            {unit}
          </text>
          {xTicks.map((x, i) => (
            <text
              key={x}
              x={sx(x)}
              y={h + 18}
              textAnchor={xTicks.length === 1 ? 'middle' : i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              className="axis"
            >
              {dayFmt.format(x)}
            </text>
          ))}
          {activeX !== null && <line x1={sx(activeX)} x2={sx(activeX)} y1={0} y2={h} className="crosshair" />}
          {series.map((s) => {
            const pts = s.points.filter((p) => p.y !== null) as { x: number; y: number }[];
            const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
            const last = pts[pts.length - 1];
            return (
              <g key={s.id} style={{ color: `var(${s.colorVar})` }}>
                <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray={s.dashed ? '6 5' : undefined} strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p) =>
                  showMarkers || p.x === activeX ? (
                    <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={p.x === activeX ? 5.5 : 4} fill="currentColor" className="marker" />
                  ) : null,
                )}
                {last && activeX === null && (
                  <text x={sx(last.x) + 7} y={sy(last.y)} dy="0.32em" textAnchor="start" className="end-label">
                    {fmtNum(last.y)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {activeX !== null && (
        <div className="tooltip" style={{ left: tipLeft }}>
          <strong>{longFmt.format(activeX)}</strong>
          {series.map((s) => {
            const p = s.points.find((q) => q.x === activeX);
            return (
              <span key={s.id}>
                <i style={{ background: `var(${s.colorVar})` }} />
                {s.label}: {p?.y != null ? `${fmtNum(p.y)} ${unit}` : '—'}
              </span>
            );
          })}
          <button className="tooltip-close" onClick={() => setActive(null)} aria-label="Cerrar detalle">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
