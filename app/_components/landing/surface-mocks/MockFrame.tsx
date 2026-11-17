import type { ReactNode } from "react";

export function MockFrame({ file, children }: { file: string; children: ReactNode }) {
  return (
    <div aria-hidden="true" className="relative overflow-hidden card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rotate-45 bg-primary" />
          <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            {file}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-border" />
          <span className="size-1.5 rounded-full bg-border" />
          <span className="size-1.5 rounded-full bg-border" />
        </div>
      </div>
      {children}
    </div>
  );
}
