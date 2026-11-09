import { Button } from "@konopskidev/ui/components/button";
import Link from "next/link";

import { BrandLockup } from "@/app/_components/brand";
import { landing } from "@/app/_data/landing";

/**
 * The last stop on the page: the logo over the topographic contours, then a
 * single clear invitation. Same two calls to action as the hero.
 */
export function ClosingCta() {
  const { id, title, lead, primaryCta, secondaryCta } = landing.closing;

  return (
    <section id={id} aria-labelledby="closing-heading" className="topo-bg border-t">
      <div className="container-page flex flex-col items-center gap-6 py-24 text-center lg:py-32">
        <BrandLockup markClassName="size-12" textClassName="text-lg" />

        <h2
          id="closing-heading"
          className="font-display text-display mt-2 max-w-3xl font-bold text-balance"
        >
          {title.lead}
          <span className="text-primary">{title.accent}</span>
          {title.trail}
        </h2>

        <p className="max-w-xl font-serif text-lead text-pretty text-muted-foreground">
          {lead}
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="primary" size="lg">
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
