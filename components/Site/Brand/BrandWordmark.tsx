import { BRAND_NAME } from "@/lib/shared/brand";
import { cn } from "@/lib/utils";

/**
 * "AI" carries the brand gradient while the surrounding letters stay ink. The
 * visible halves are hidden from assistive technology; the screen-reader label
 * is the word as one token.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-semibold tracking-tight text-foreground", className)}>
      <span className="sr-only">{BRAND_NAME}</span>
      <span aria-hidden="true">Worksp</span>
      <span aria-hidden="true" className="brand-gradient">
        AI
      </span>
      <span aria-hidden="true">ce</span>
    </span>
  );
}
