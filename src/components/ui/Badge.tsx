import type { HTMLAttributes } from "react";
import type { WorkType } from "@/domain/types";
import { cn } from "@/lib/cn";

/** Per-work-type accents, drawn from the instrument palette (tinted backgrounds). */
export const WORK_TYPE_COLOR: Record<WorkType, string> = {
  deep: "bg-deep/12 text-deep border-deep/25",
  shallow: "bg-shallow/12 text-shallow border-shallow/25",
  admin: "bg-admin/15 text-ink-soft border-admin/30",
  health: "bg-health/12 text-health border-health/25",
  social: "bg-social/15 text-[#b9712a] border-social/35",
};

export function Badge({
  className,
  type,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { type?: WorkType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium tracking-tight",
        type ? WORK_TYPE_COLOR[type] : "border-line bg-canvas text-ink-soft",
        className,
      )}
      {...props}
    />
  );
}
