"use client";

import { useId } from "react";
import type { WorkType } from "@/domain/types";
import { formatHour, workTypeLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface CurveBlock {
  id: string;
  startHour: number;
  endHour: number;
  type: WorkType;
  label: string;
  source: "planned" | "fixed";
}

export interface EnergyCurveProps {
  hourlyScores: number[];
  startHour: number;
  endHour: number;
  currentHour: number;
  blocks: CurveBlock[];
  className?: string;
}

const W = 960;
const H = 320;
const PAD_X = 20;
const CURVE_TOP = 28;
const CURVE_BOTTOM = 188;
const LANE_TOP = 206;
const LANE_BOTTOM = 252;
const AXIS_Y = 286;

/** Fill colours for block rects, derived from the same per-type palette. */
const BLOCK_FILL: Record<WorkType, string> = {
  deep: "#6366f1",
  shallow: "#0ea5e9",
  admin: "#a3a3a3",
  health: "#10b981",
  social: "#f59e0b",
};

/**
 * The signature element: a real, data-driven energy curve with the day's blocks
 * laid beneath it and a live current-hour marker. Built structurally correct in
 * Phase 2; Phase 5 turns it into the instrument it wants to be.
 */
export function EnergyCurve({
  hourlyScores,
  startHour,
  endHour,
  currentHour,
  blocks,
  className,
}: EnergyCurveProps) {
  const gradientId = useId();
  const span = Math.max(1, endHour - startHour);
  const plotW = W - PAD_X * 2;

  const xFor = (hour: number) => PAD_X + ((hour - startHour) / span) * plotW;
  const yFor = (energy: number) => CURVE_BOTTOM - clamp01(energy) * (CURVE_BOTTOM - CURVE_TOP);

  const points: Array<{ x: number; y: number }> = [];
  for (let h = startHour; h <= endHour; h++) {
    points.push({ x: xFor(h), y: yFor(hourlyScores[h] ?? 0) });
  }

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${xFor(endHour)} ${CURVE_BOTTOM} L ${xFor(startHour)} ${CURVE_BOTTOM} Z`;
  const inRange = currentHour >= startHour && currentHour <= endHour;
  const markerX = xFor(clamp(currentHour, startHour, endHour));
  const markerEnergy = hourlyScores[Math.floor(clamp(currentHour, startHour, endHour))] ?? 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Your energy across the day with scheduled blocks beneath it"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* horizontal guide lines */}
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <line
          key={level}
          x1={PAD_X}
          x2={W - PAD_X}
          y1={yFor(level)}
          y2={yFor(level)}
          stroke="#e5e5e5"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
      ))}

      {/* energy area + curve */}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke="#4f46e5"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* blocks lane */}
      {blocks.map((block) => {
        const x = xFor(Math.max(startHour, block.startHour));
        const x2 = xFor(Math.min(endHour, block.endHour));
        const width = Math.max(2, x2 - x);
        return (
          <g key={block.id}>
            <rect
              x={x}
              y={LANE_TOP}
              width={width}
              height={LANE_BOTTOM - LANE_TOP}
              rx={6}
              fill={BLOCK_FILL[block.type]}
              fillOpacity={block.source === "fixed" ? 0.45 : 0.9}
              stroke={block.source === "fixed" ? BLOCK_FILL[block.type] : "none"}
              strokeDasharray={block.source === "fixed" ? "3 3" : undefined}
            >
              <title>{`${block.label} · ${workTypeLabel(block.type)} · ${formatHour(
                block.startHour,
              )}–${formatHour(block.endHour)}`}</title>
            </rect>
            {width > 54 && (
              <text
                x={x + 6}
                y={LANE_TOP + 27}
                fontSize={11}
                fill={block.source === "fixed" ? "#525252" : "#ffffff"}
                fontWeight={600}
              >
                {truncate(block.label, Math.floor(width / 7))}
              </text>
            )}
          </g>
        );
      })}

      {/* current-hour marker */}
      {inRange && (
        <g>
          <line
            x1={markerX}
            x2={markerX}
            y1={CURVE_TOP - 6}
            y2={LANE_BOTTOM + 6}
            stroke="#111827"
            strokeWidth={1.5}
          />
          <circle cx={markerX} cy={yFor(markerEnergy)} r={5} fill="#111827" />
          <text x={markerX + 6} y={CURVE_TOP + 2} fontSize={11} fontWeight={700} fill="#111827">
            now
          </text>
        </g>
      )}

      {/* hour axis */}
      {hourTicks(startHour, endHour).map((h) => (
        <text key={h} x={xFor(h)} y={AXIS_Y} fontSize={11} fill="#737373" textAnchor="middle">
          {formatHour(h)}
        </text>
      ))}
    </svg>
  );
}

function hourTicks(start: number, end: number): number[] {
  const ticks: number[] = [];
  for (let h = start; h <= end; h += 2) ticks.push(h);
  return ticks;
}

/** Catmull-Rom → cubic Bézier smoothing for an instrument-like curve. */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function truncate(text: string, max: number): string {
  if (max <= 1) return "";
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}
function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
