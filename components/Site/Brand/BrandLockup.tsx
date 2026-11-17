import Link from "next/link";

import { cn } from "@/lib/utils";

import { BrandMark } from "./BrandMark";

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
