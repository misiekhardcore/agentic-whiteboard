import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * The visual mark: an open canvas frame with the agent's cursor entering it.
 * The artwork lives in `public/brand/mark.svg`, the same file the favicon and
 * manifest icons are rasterised from.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-sm border bg-card p-1.5 shadow-xs",
        className,
      )}
    >
      <Image src="/brand/mark.svg" alt="" width={32} height={32} className="size-full" />
    </span>
  );
}
