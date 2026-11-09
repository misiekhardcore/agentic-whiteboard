import { landing } from "@/app/_data/landing";

/**
 * The route through the product in three steps, drawn as waypoints on a dashed
 * path: vertical down the left on phones, horizontal across the row on wide
 * screens, with a small diamond where the route carries on.
 */
export function HowItWorks() {
  const { id, eyebrow, title, lead, steps } = landing.howItWorks;

  return (
    <section
      id={id}
      aria-labelledby="how-it-works-heading"
      className="topo-bg"
    >
      <div className="container-page py-20 lg:py-28">
        <header className="max-w-2xl">
          <p className="flex items-center gap-2.5 font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            <span aria-hidden="true" className="size-1.5 rotate-45 bg-primary" />
            {eyebrow}
          </p>
          <h2 id="how-it-works-heading" className="section-title mt-4 text-balance">
            {title}
          </h2>
          <p className="mt-4 font-serif text-lead text-pretty text-muted-foreground">
            {lead}
          </p>
        </header>

        <ol className="relative mt-12 grid gap-10 md:mt-16 md:grid-cols-3 md:gap-10">
          {/* the route, drawn behind the waypoints */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-5 left-5 hidden h-px bg-[repeating-linear-gradient(to_right,var(--primary)_0_5px,transparent_5px_11px)] opacity-40 md:right-3 md:block"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-[17px] right-1 hidden size-1.5 rotate-45 bg-primary/50 md:block"
          />

          {steps.map((step, index) => (
            <li key={step.id} className="relative flex gap-5 md:block">
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-14 bottom-[-2.5rem] left-5 border-l border-dashed border-primary/40 md:hidden"
                />
              ) : null}

              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/40 bg-background font-mono text-[11px] font-semibold text-primary shadow-xs">
                <span aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="sr-only">Step {index + 1}</span>
              </span>

              <div className="md:mt-6">
                <h3 className="font-display text-h3 font-semibold">{step.title}</h3>
                <p className="mt-2 font-serif text-base leading-relaxed text-pretty text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
