import { landing } from "@/app/_data/landing";

/**
 * A narrow band under the hero naming the people the product is for. The small
 * diamonds echo the map-legend marker used in the hero eyebrow.
 */
export function AudienceStrip() {
  const { eyebrow, headline, groups } = landing.audience;

  return (
    <section aria-labelledby="audience-heading" className="border-y bg-secondary/50">
      <div className="container-page flex flex-col gap-5 py-7 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="max-w-sm">
          <h2
            id="audience-heading"
            className="flex items-center gap-2.5 font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase"
          >
            <span aria-hidden="true" className="size-1.5 rotate-45 bg-primary" />
            {eyebrow}
          </h2>
          <p className="mt-2 font-serif text-sm text-pretty text-muted-foreground">{headline}</p>
        </div>

        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
          {groups.map((group) => (
            <li key={group} className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span
                aria-hidden="true"
                className="size-1 rotate-45 border border-primary/50 bg-primary/10"
              />
              {group}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
