import type { LucideIcon } from "lucide-react";
import { Check, Columns3, FileText, Shapes } from "lucide-react";

import { landing, type SurfaceId } from "@/app/_data/landing";
import { cn } from "@/lib/utils";

import { SurfaceMock } from "./surface-mocks";

const SURFACE_ICONS: Record<SurfaceId, LucideIcon> = {
  canvas: Shapes,
  docs: FileText,
  "team-board": Columns3,
};

/**
 * The three surfaces that make up a workspace, each paired with a static mock
 * of what it looks like. Rows alternate sides so the section has a rhythm on
 * wide screens; on mobile the copy always comes first.
 */
export function FeatureShowcase() {
  const { id, eyebrow, title, lead, items } = landing.surfaces;

  return (
    <section id={id} aria-labelledby="surfaces-heading" className="container-page py-20 lg:py-28">
      <header className="max-w-2xl">
        <p className="flex items-center gap-2.5 font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          <span aria-hidden="true" className="size-1.5 rotate-45 bg-primary" />
          {eyebrow}
        </p>
        <h2 id="surfaces-heading" className="mt-4 section-title text-balance">
          {title}
        </h2>
        <p className="mt-4 font-serif text-lead text-pretty text-muted-foreground">{lead}</p>
      </header>

      <div className="mt-16 flex flex-col gap-16 lg:mt-20 lg:gap-24">
        {items.map((item, index) => {
          const Icon = SURFACE_ICONS[item.id];
          const reversed = index % 2 === 1;

          return (
            <article key={item.id} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
              <div className={cn("lg:order-1", reversed && "lg:order-2")}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-sm border bg-card text-primary shadow-xs">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-h3 font-semibold">{item.title}</h3>
                </div>

                <p className="mt-4 font-serif text-lg leading-relaxed text-pretty text-muted-foreground">
                  {item.description}
                </p>

                <ul className="mt-6 flex flex-col gap-3">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2.5 text-sm leading-relaxed">
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/5 text-primary">
                        <Check className="size-2.5" aria-hidden="true" />
                      </span>
                      <span className="text-foreground/90">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={cn("lg:order-2", reversed && "lg:order-1")}>
                <SurfaceMock surface={item.id} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
