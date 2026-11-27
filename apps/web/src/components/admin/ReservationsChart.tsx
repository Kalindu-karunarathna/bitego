"use client";

import type { AdminAnalyticsDto } from "@bitego/shared";
import { useState } from "react";

// Stacked column chart: reservations per day, split into "picked up" and "not picked up" (cancelled, expired or still waiting).
// Colours are two categorical slots of the dataviz reference palette (validated in light and dark).
// Every value is also in the table view, and in the tooltip on hover or keyboard focus.

type Day = AdminAnalyticsDto["daily"][number];

export const VIZ_CSS = `
.viz-root{color-scheme:light;--surface-1:#fcfcfb;--text-primary:#0b0b0b;--text-secondary:#52514e;--text-muted:#898781;--grid:#e1e0d9;--border:rgba(11,11,11,.10);--series-1:#2a78d6;--series-2:#eb6834}
@media (prefers-color-scheme: dark){:root:where(:not([data-theme="light"])) .viz-root{color-scheme:dark;--surface-1:#1a1a19;--text-primary:#f0efec;--text-secondary:#c3c2b7;--text-muted:#898781;--grid:#2c2c2a;--border:rgba(255,255,255,.10);--series-1:#3987e5;--series-2:#d95926}}
:root[data-theme="dark"] .viz-root{color-scheme:dark;--surface-1:#1a1a19;--text-primary:#f0efec;--text-secondary:#c3c2b7;--text-muted:#898781;--grid:#2c2c2a;--border:rgba(255,255,255,.10);--series-1:#3987e5;--series-2:#d95926}
`;

const W = 720;
const H = 260;
const M = { l: 36, r: 8, t: 8, b: 28 };
const BAR_MAX = 24; // bars never fill their slot
const GAP = 2; // surface-coloured gap between the two stacked segments

function niceStep(raw: number) {
  for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) if (s >= raw) return s;
  return Math.ceil(raw / 1000) * 1000;
}

// Rectangle with only the top corners rounded (4px data end, square at the baseline).
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}L${x},${y + rr}Q${x},${y} ${x + rr},${y}L${x + w - rr},${y}Q${x + w},${y} ${x + w},${y + rr}L${x + w},${y + h}Z`;
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function ReservationsChart({ daily }: { daily: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const n = daily.length;
  const maxVal = Math.max(0, ...daily.map((d) => d.reserved));
  const step = niceStep(Math.max(1, maxVal) / 4);
  const yMax = step * 4;
  const plotW = W - M.l - M.r;
  const plotH = H - M.t - M.b;
  const base = M.t + plotH;
  const slot = plotW / n;
  const barW = Math.min(BAR_MAX, slot * 0.7);
  const labelEvery = Math.ceil(n / 7);
  const h = (v: number) => (v <= 0 ? 0 : Math.max(2, (v / yMax) * plotH));

  const hovered = hover === null ? null : daily[hover];

  return (
    <figure className="viz-root rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
      <style>{VIZ_CSS}</style>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <figcaption>
          <p className="font-semibold">Reservations per day</p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Split by whether the food was picked up
          </p>
        </figcaption>
        <button
          onClick={() => setTable((t) => !t)}
          className="rounded-md border px-3 py-1.5 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          {table ? "Show chart" : "Table view"}
        </button>
      </div>

      <div className="mb-2 flex gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
        <span className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden="true">
            <rect width="12" height="12" rx="2" fill="var(--series-1)" />
          </svg>
          Picked up
        </span>
        <span className="flex items-center gap-2">
          <svg width="12" height="12" aria-hidden="true">
            <rect width="12" height="12" rx="2" fill="var(--series-2)" />
          </svg>
          Not picked up
        </span>
      </div>

      {table ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead style={{ color: "var(--text-secondary)" }}>
              <tr>
                <th className="p-2 font-medium">Date</th>
                <th className="p-2 font-medium">Reserved</th>
                <th className="p-2 font-medium">Picked up</th>
                <th className="p-2 font-medium">Not picked up</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.date} className="border-t" style={{ borderColor: "var(--grid)" }}>
                  <td className="p-2">{d.date}</td>
                  <td className="p-2">{d.reserved}</td>
                  <td className="p-2">{d.pickedUp}</td>
                  <td className="p-2">{d.reserved - d.pickedUp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label="Reservations per day, stacked by picked up and not picked up">
            {[0, 1, 2, 3, 4].map((i) => {
              const y = base - (i / 4) * plotH;
              return (
                <g key={i}>
                  <line x1={M.l} x2={W - M.r} y1={y} y2={y} stroke="var(--grid)" strokeWidth="1" />
                  <text x={M.l - 6} y={y + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
                    {i * step}
                  </text>
                </g>
              );
            })}
            {daily.map((d, i) => {
              const cx = M.l + i * slot + slot / 2;
              const x = cx - barW / 2;
              const other = d.reserved - d.pickedUp;
              const hp = h(d.pickedUp);
              const ho = h(other);
              return (
                <g key={d.date}>
                  {hover === i ? <rect x={M.l + i * slot} y={M.t} width={slot} height={plotH} fill="var(--text-primary)" opacity="0.06" /> : null}
                  {hp > 0 ? (
                    ho > 0 ? (
                      <rect x={x} y={base - hp} width={barW} height={hp} fill="var(--series-1)" />
                    ) : (
                      <path d={topRounded(x, base - hp, barW, hp, 4)} fill="var(--series-1)" />
                    )
                  ) : null}
                  {ho > 0 ? <path d={topRounded(x, base - hp - ho, barW, Math.max(ho - (hp > 0 ? GAP : 0), 1), 4)} fill="var(--series-2)" /> : null}
                  {i % labelEvery === 0 ? (
                    <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
                      {dayLabel(d.date)}
                    </text>
                  ) : null}
                  <rect
                    x={M.l + i * slot}
                    y={M.t}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    tabIndex={0}
                    aria-label={`${dayLabel(d.date)}: ${d.reserved} reserved, ${d.pickedUp} picked up`}
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    style={{ outline: "none" }}
                  />
                </g>
              );
            })}
            <line x1={M.l} x2={W - M.r} y1={base} y2={base} stroke="var(--grid)" strokeWidth="1" />
          </svg>

          {hovered && hover !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute top-2 z-10 whitespace-nowrap rounded-md border px-3 py-2 text-sm shadow-md"
              style={{
                left: `${((M.l + hover * slot + slot / 2) / W) * 100}%`,
                transform: hover > n / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
                background: "var(--surface-1)",
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              <p className="mb-1">{dayLabel(hovered.date)}</p>
              <p className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3" style={{ background: "var(--series-1)" }} />
                <strong style={{ color: "var(--text-primary)" }}>{hovered.pickedUp}</strong> picked up
              </p>
              <p className="flex items-center gap-2">
                <span className="inline-block h-0.5 w-3" style={{ background: "var(--series-2)" }} />
                <strong style={{ color: "var(--text-primary)" }}>{hovered.reserved - hovered.pickedUp}</strong> not picked up
              </p>
            </div>
          ) : null}
        </div>
      )}
    </figure>
  );
}
