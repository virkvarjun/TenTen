import type { HTMLAttributes } from "react";
import type { WorkType } from "@/domain/types";
import { cn } from "@/lib/cn";

/** Per-work-type accent colours. Phase 5 replaces these with design tokens. */
export const WORK_TYPE_COLOR: Record<WorkType, string> = {
  deep: "bg-indigo-100 text-indigo-800 border-indigo-200",
  shallow: "bg-sky-100 text-sky-800 border-sky-200",
  admin: "bg-neutral-100 text-neutral-700 border-neutral-200",
  health: "bg-emerald-100 text-emerald-800 border-emerald-200",
  social: "bg-amber-100 text-amber-800 border-amber-200",
};

export function Badge({
  className,
  type,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { type?: WorkType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        type ? WORK_TYPE_COLOR[type] : "border-neutral-200 bg-neutral-100 text-neutral-700",
        className,
      )}
      {...props}
    />
  );
}
