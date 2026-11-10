import { Button } from "@konopskidev/ui/components/button";
import Link from "next/link";

import { AudienceStrip } from "./_components/landing/audience-strip";
import { ClosingCta } from "./_components/landing/closing-cta";
import { FeatureShowcase } from "./_components/landing/feature-showcase";
import { HowItWorks } from "./_components/landing/how-it-works";
import { Pricing } from "./_components/landing/pricing";
import { SiteFooter } from "./_components/site-footer";
import { landing } from "./_data/landing";

export default function Home({ searchParams }: PageProps<"/">) {
  const { hero } = landing;

  return (
    <main className="flex flex-1 flex-col overflow-y-auto">
      <section className="topo-bg flex flex-1 items-center">
        <div className="container-page flex w-full flex-col items-center gap-6 py-24 text-center">
          <p className="flex items-center gap-2.5 font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            <span aria-hidden="true" className="size-1.5 rotate-45 bg-primary" />
            {hero.eyebrow}
          </p>

          <h1 className="font-display text-display max-w-4xl font-bold text-balance">
            {hero.title.lead}
            <span className="text-primary">{hero.title.accent}</span>
            {hero.title.trail}
          </h1>

          <p className="font-serif text-lead max-w-2xl text-pretty text-muted-foreground">
            {hero.lead}
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href={hero.primaryCta.href}>{hero.primaryCta.label}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={hero.secondaryCta.href}>
                {hero.secondaryCta.label}
              </Link>
            </Button>
          </div>

          <div className="survey-frame scroll-tilt mt-10 w-full max-w-5xl">
            <div className="card overflow-hidden p-1.5">
              <video
                className="aspect-video w-full rounded-sm bg-muted object-cover"
                poster={hero.video.poster}
                autoPlay
                muted
                loop
                playsInline
              >
                {hero.video.sources.map((source) => (
                  <source key={source.src} src={source.src} type={source.type} />
                ))}
              </video>
            </div>
          </div>
        </div>
      </section>

      <AudienceStrip />
      <HowItWorks />
      <FeatureShowcase />
      <Pricing searchParams={searchParams} />
      <ClosingCta />
      <SiteFooter />
    </main>
  );
}
