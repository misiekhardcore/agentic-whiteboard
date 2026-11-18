import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-sm border bg-card text-primary shadow-xs",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-full" fill="none">
        <path
          d="M12 3.5 20.5 12 12 20.5 3.5 12Z"
          strokeWidth="1.25"
          className="fill-primary/5 stroke-primary"
        />
        <circle cx="12" cy="12" r="1.6" className="fill-primary" />
        <path d="M12 1v2M12 21v2M1 12h2M21 12h2" strokeWidth="1.25" className="stroke-primary/50" />
      </svg>
    </span>
  );
}
