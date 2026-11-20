import Link from "next/link";

import { cn } from "@/lib/utils";

import { BrandMark } from "./BrandMark";
import { BrandWordmark } from "./BrandWordmark";

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
      <BrandWordmark className={textClassName} />
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
