"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
const PAD_X = 24;
const CURVE_TOP = 30;
const CURVE_BOTTOM = 186;
const LANE_TOP = 206;
const LANE_BOTTOM = 252;
const AXIS_Y = 286;

/** Energy → color temperature: amber trough → teal mid → indigo peak. */
const TROUGH: RGB = [242, 166, 90];
const MID: RGB = [18, 181, 168];
const PEAK: RGB = [61, 90, 254];
type RGB = [number, number, number];

const BLOCK_FILL: Record<WorkType, string> = {
  deep: "#3d5afe",
  shallow: "#4d8bd4",
  admin: "#8b93a1",
  health: "#12b5a8",
  social: "#f2a65a",
};

function energyColor(e: number): string {
  const t = Math.min(1, Math.max(0, e));
  const [a, b, f] = t < 0.5 ? [TROUGH, MID, t / 0.5] : [MID, PEAK, (t - 0.5) / 0.5];
  const mix = (i: number) => {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    return Math.round(av + (bv - av) * f);
  };
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
}

/**
 * The signature: a real, data-driven energy curve rendered as a spectrograph.
 * The stroke's hue encodes energy temperature along the day; the day's blocks
 * settle onto a fine instrument baseline; a live current-hour readout breathes.
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
  const areaId = useId();
  const reduce = useReducedMotion();
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
  const markerHour = clamp(currentHour, startHour, endHour);
  const markerX = xFor(markerHour);
  const markerEnergy = hourlyScores[Math.floor(markerHour)] ?? 0;

  // Spectrum stops: one per hour, colored by that hour's energy.
  const stops = points.map((_, i) => {
    const h = startHour + i;
    return { offset: i / span, color: energyColor(hourlyScores[h] ?? 0) };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label="Your energy across the day, with scheduled blocks laid beneath it"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          {stops.map((s, i) => (
            <stop key={i} offset={`${s.offset * 100}%`} stopColor={s.color} />
          ))}
        </linearGradient>
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d5afe" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#3d5afe" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* instrument guide lines */}
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <line
          key={level}
          x1={PAD_X}
          x2={W - PAD_X}
          y1={yFor(level)}
          y2={yFor(level)}
          stroke="#e6eaef"
          strokeWidth={1}
        />
      ))}

      {/* hour ticks on the baseline */}
      {Array.from({ length: span + 1 }).map((_, i) => {
        const h = startHour + i;
        const major = h % 2 === 0;
        return (
          <line
            key={h}
            x1={xFor(h)}
            x2={xFor(h)}
            y1={CURVE_BOTTOM}
            y2={CURVE_BOTTOM + (major ? 6 : 3)}
            stroke="#c3cad4"
            strokeWidth={1}
          />
        );
      })}

      {/* energy area + spectrum curve (one gesture — the stroke draws in) */}
      <path d={areaPath} fill={`url(#${areaId})`} />
      <motion.path
        d={linePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: "easeInOut" }}
      />

      {/* blocks settle onto the baseline */}
      {blocks.map((block, i) => {
        const x = xFor(Math.max(startHour, block.startHour));
        const x2 = xFor(Math.min(endHour, block.endHour));
        const width = Math.max(2, x2 - x);
        return (
          <motion.g
            key={block.id}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.1 + i * 0.07, ease: "easeOut" }}
          >
            <rect
              x={x}
              y={LANE_TOP}
              width={width}
              height={LANE_BOTTOM - LANE_TOP}
              rx={5}
              fill={BLOCK_FILL[block.type]}
              fillOpacity={block.source === "fixed" ? 0.22 : 0.92}
              stroke={BLOCK_FILL[block.type]}
              strokeOpacity={block.source === "fixed" ? 0.5 : 0}
              strokeDasharray={block.source === "fixed" ? "3 3" : undefined}
            >
              <title>{`${block.label} · ${workTypeLabel(block.type)} · ${formatHour(
                block.startHour,
              )}–${formatHour(block.endHour)}`}</title>
            </rect>
            {width > 56 && (
              <text
                x={x + 7}
                y={LANE_TOP + 27}
                fontSize={11}
                className="font-mono"
                fill={block.source === "fixed" ? "#5b6472" : "#ffffff"}
                fontWeight={600}
              >
                {truncate(block.label, Math.floor(width / 7))}
              </text>
            )}
          </motion.g>
        );
      })}

      {/* current-hour readout — breathes with real time */}
      {inRange && (
        <motion.g
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.9 }}
        >
          <line
            x1={markerX}
            x2={markerX}
            y1={CURVE_TOP - 8}
            y2={LANE_BOTTOM + 8}
            stroke="#14161b"
            strokeWidth={1.25}
            strokeOpacity={0.5}
          />
          <motion.circle
            cx={markerX}
            cy={yFor(markerEnergy)}
            r={5}
            fill="#14161b"
            animate={reduce ? undefined : { scale: [1, 1.25, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: `${markerX}px ${yFor(markerEnergy)}px` }}
          />
          <text
            x={markerX + 8}
            y={CURVE_TOP + 2}
            fontSize={11}
            className="font-mono"
            fontWeight={700}
            fill="#14161b"
          >
            now · {Math.round(markerEnergy * 100)}%
          </text>
        </motion.g>
      )}

      {/* hour axis */}
      {hourTicks(startHour, endHour).map((h) => (
        <text
          key={h}
          x={xFor(h)}
          y={AXIS_Y}
          fontSize={11}
          className="font-mono"
          fill="#8b93a1"
          textAnchor="middle"
        >
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

/** Catmull-Rom → cubic Bézier smoothing for an instrument-grade curve. */
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
