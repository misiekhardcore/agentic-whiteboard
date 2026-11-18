import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function BoardColumn({
  label,
  count,
  marker,
  className,
  children,
}: {
  label: string;
  count: number;
  marker: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-sm border bg-background/70 p-1.5", className)}>
      <div className="flex items-center justify-between gap-1 px-0.5 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", marker)} />
          <span className="text-[9.5px] font-bold tracking-wide text-foreground uppercase">
            {label}
          </span>
        </div>
        <span className="font-mono text-[9px] text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}
