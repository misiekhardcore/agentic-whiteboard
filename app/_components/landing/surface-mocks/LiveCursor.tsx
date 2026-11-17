import { cn } from "@/lib/utils";

export function LiveCursor({
  name,
  tone,
  className,
}: {
  name: string;
  tone: "amber" | "violet";
  className?: string;
}) {
  return (
    <div className={cn("pointer-events-none absolute z-10", className)}>
      <svg
        viewBox="0 0 24 24"
        className={cn(
          "size-3.5 -rotate-6 drop-shadow-sm",
          tone === "amber" ? "fill-chart-3" : "fill-chart-4",
        )}
        role="presentation"
      >
        <path d="M4.5 2.5 20 11.5l-7.3 1.2-3.4 6.6z" />
      </svg>
      <span
        className={cn(
          "-mt-0.5 ml-3 inline-block rounded-sm px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm",
          tone === "amber" ? "bg-chart-3" : "bg-chart-4",
        )}
      >
        {name}
      </span>
    </div>
  );
}
