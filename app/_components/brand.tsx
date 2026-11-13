import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The Agentic Whiteboard mark: a survey diamond with a centre point, the same
 * rotated-square motif the landing page uses for its legend markers.
 */
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

/**
 * Mark and wordmark together — the lockup used in the closing call to action
 * and the footer.
 */
export function BrandLockup({
  href,
  className,
  markClassName,
  textClassName,
}: {
  href?: string;
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  const content = (
    <>
      <BrandMark className={markClassName} />
      <span
        className={cn("font-display font-semibold tracking-tight text-foreground", textClassName)}
      >
        Agentic Whiteboard
      </span>
    </>
  );

  const classes = cn("inline-flex items-center gap-2.5", className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}
