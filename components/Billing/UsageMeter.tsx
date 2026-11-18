import { Progress } from "@konopskidev/ui/components/progress";
import type { ReactNode } from "react";

import type { LimitUsage } from "@/lib/billing/usage";
import { cn } from "@/lib/utils";

/**
 * A labelled usage bar. `limit: null` is an unlimited plan, which reports the
 * count without a bar: an always-full track would read as "used up", and a
 * bar with no denominator says nothing. The count still shows, so the meter
 * never looks empty on a plan whose other limits are finite.
 *
 * The tones live on the root as arbitrary variants because the design system's
 * Progress pins its indicator to `bg-primary`; overriding it here keeps the
 * shared component untouched.
 */
export function UsageMeter({
  label,
  used,
  limit,
  title,
  prefix,
  className,
}: {
  label: string;
  used: number;
  limit: LimitUsage["limit"];
  title?: string;
  /**
   * Content shown before the label, e.g. the plan name in the header, where the
   * meter is also the way into billing details.
   */
  prefix?: ReactNode;
  className?: string;
}) {
  const unlimited = limit === null;
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const atLimit = !unlimited && used >= limit;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)} title={title}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
          {prefix}
          <span className="truncate">{label}</span>
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-xs tabular-nums",
            atLimit ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {unlimited
            ? `${used.toLocaleString("en-US")} used`
            : `${used.toLocaleString("en-US")} / ${limit.toLocaleString("en-US")}`}
        </span>
      </div>

      {!unlimited && (
        <Progress
          value={percent}
          aria-label={`${label} usage`}
          aria-valuetext={unlimited ? "Unlimited" : `${used} of ${limit} used`}
          className={cn(
            "h-1.5",
            atLimit
              ? "**:data-[slot=progress-indicator]:bg-destructive"
              : percent >= 80
                ? "**:data-[slot=progress-indicator]:bg-amber-500"
                : undefined,
          )}
        />
      )}
    </div>
  );
}
