import { Button } from "@konopskidev/ui/components/button";
import { Check } from "lucide-react";
import Link from "next/link";

import { landing } from "@/app/_data/landing";

/**
 * Three placeholder tiers. Prices are deliberately unfinished, so the cards are
 * shaped to hold a real price later without rearranging the layout.
 */
export function Pricing() {
  const { id, eyebrow, title, lead, note, plans } = landing.pricing;

  return (
    <section id={id} aria-labelledby="pricing-heading" className="border-t">
      <div className="container-page py-20 lg:py-28">
        <header className="max-w-2xl">
          <p className="flex items-center gap-2.5 font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            <span aria-hidden="true" className="size-1.5 rotate-45 bg-primary" />
            {eyebrow}
          </p>
          <h2 id="pricing-heading" className="section-title mt-4 text-balance">
            {title}
          </h2>
          <p className="mt-4 font-serif text-lead text-pretty text-muted-foreground">
            {lead}
          </p>
        </header>

        <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="card flex flex-col p-6 shadow-xs"
            >
              <h3 className="font-display text-h3 font-semibold">{plan.name}</h3>
              <p className="mt-2 font-serif text-sm text-pretty text-muted-foreground">
                {plan.summary}
              </p>

              <p className="mt-6 flex items-baseline gap-1.5 border-t pt-6">
                <span className="font-display text-h2 font-semibold text-foreground">
                  {plan.price}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {plan.period}
                </span>
              </p>

              <ul className="mt-6 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm leading-relaxed"
                  >
                    <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/5 text-primary">
                      <Check className="size-2.5" aria-hidden="true" />
                    </span>
                    <span className="text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant="outline"
                className="mt-8 w-full"
              >
                <Link href={plan.cta.href}>{plan.cta.label}</Link>
              </Button>
            </article>
          ))}
        </div>

        <p className="mt-8 flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          <span aria-hidden="true" className="size-1 rotate-45 bg-primary/60" />
          {note}
        </p>
      </div>
    </section>
  );
}
