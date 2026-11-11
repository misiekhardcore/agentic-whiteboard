import { Progress } from "@konopskidev/ui/components/progress";

import type { LimitUsage } from "@/lib/billing/usage";
import { cn } from "@/lib/utils";

/**
 * A labelled usage bar. `limit: null` is an unlimited plan, which shows the
 * word instead of a bar: an always-full track would read as "used up".
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
  className,
}: {
  label: string;
  used: number;
  limit: LimitUsage["limit"];
  title?: string;
  className?: string;
}) {
  const unlimited = limit === null;
  const percent = unlimited
    ? 0
    : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const atLimit = !unlimited && used >= limit;

  return (
    <div
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      title={title}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono text-[11px] tabular-nums",
            atLimit ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {unlimited
            ? "Unlimited"
            : `${used.toLocaleString("en-US")} / ${limit.toLocaleString("en-US")}`}
        </span>
      </div>

      {unlimited ? null : (
        <Progress
          value={percent}
          aria-label={`${label} usage`}
          aria-valuetext={
            unlimited
              ? "Unlimited"
              : `${used} of ${limit} used`
          }
          className={cn(
            "h-1.5",
            atLimit
              ? "[&_[data-slot=progress-indicator]]:bg-destructive"
              : percent >= 80
                ? "[&_[data-slot=progress-indicator]]:bg-amber-500"
                : undefined,
          )}
        />
      )}
    </div>
  );
}
