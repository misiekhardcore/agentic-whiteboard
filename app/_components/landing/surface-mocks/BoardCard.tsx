import { cn } from "@/lib/utils";

export function BoardCard({
  title,
  tag,
  highlighted = false,
}: {
  title: string;
  tag: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border bg-card px-2 py-1.5 shadow-xs",
        highlighted && "border-primary/50",
      )}
    >
      <p className="text-[10.5px] leading-snug font-medium text-foreground">{title}</p>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="rounded-xs bg-secondary px-1 py-px font-mono text-[8px] tracking-[0.08em] text-muted-foreground uppercase">
          {tag}
        </span>
        <span className="flex items-center">
          <span className="size-2.5 rounded-full border border-card bg-chart-5" />
          <span className="-ml-1 size-2.5 rounded-full border border-card bg-chart-4" />
        </span>
      </div>
    </div>
  );
}
