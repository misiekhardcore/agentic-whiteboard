import { Suspense } from "react";

import { landing } from "@/app/_data/landing";
import { getSessionAccount } from "@/lib/account";
import { getPlan, isPaidPlan } from "@/lib/billing/plans";

import { PricingTabs } from "./pricing-tabs";

type LandingSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The plan cards render from the static catalog; who is signed in only changes
 * the CTA, so the session is read in a streamed child instead of making the
 * whole landing page dynamic.
 */
export function Pricing({ searchParams }: { searchParams: LandingSearchParams }) {
  const { id, eyebrow, title, lead, note } = landing.pricing;

  return (
    <section id={id} aria-labelledby="pricing-heading" className="border-t">
      <div className="container-page py-20 lg:py-28">
        <header className="max-w-2xl">
          <p className="flex items-center gap-2.5 font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            <span aria-hidden="true" className="size-1.5 rotate-45 bg-primary" />
            {eyebrow}
          </p>
          <h2 id="pricing-heading" className="mt-4 section-title text-balance">
            {title}
          </h2>
          <p className="mt-4 font-serif text-lead text-pretty text-muted-foreground">{lead}</p>
        </header>

        <Suspense
          fallback={
            <PricingTabs
              signedIn={false}
              teams={[]}
              defaultOrganizationId={null}
              requestedPlanId={null}
            />
          }
        >
          <PricingForSession searchParams={searchParams} />
        </Suspense>

        <p className="mt-8 flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-muted-foreground uppercase">
          <span aria-hidden="true" className="size-1 rotate-45 bg-primary/60" />
          {note}
        </p>
      </div>
    </section>
  );
}

async function PricingForSession({ searchParams }: { searchParams: LandingSearchParams }) {
  const [account, params] = await Promise.all([getSessionAccount(), searchParams]);
  const billing = typeof params.billing === "string" ? params.billing : null;
  const requested = getPlan(billing);
  const requestedPlanId = requested && isPaidPlan(requested) ? requested.id : null;

  if (!account) {
    return (
      <PricingTabs
        signedIn={false}
        teams={[]}
        defaultOrganizationId={null}
        requestedPlanId={null}
      />
    );
  }

  const { teams, activeOrganizationId } = account;

  return (
    <PricingTabs
      signedIn
      teams={teams}
      // Personal account leaves this null, so a team checkout asks which team
      // to bill instead of silently picking the first one.
      defaultOrganizationId={activeOrganizationId}
      requestedPlanId={requestedPlanId}
    />
  );
}
