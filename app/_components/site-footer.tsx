import Link from "next/link";

import { BrandLockup } from "@/app/_components/brand";
import { landing } from "@/app/_data/landing";

/**
 * The end of the landing page: logo and one-line promise on the left, the two
 * short link columns on the right, and a thin legal strip underneath.
 */
export function SiteFooter() {
  const { tagline, columns, note, legal } = landing.footer;

  return (
    <footer className="border-t">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.75fr_1fr_1fr]">
        <div className="max-w-sm">
          <BrandLockup href="/" textClassName="text-base" />
          <p className="mt-4 font-serif text-sm text-pretty text-muted-foreground">
            {tagline}
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              {column.title}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground/80 transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{legal}</p>
          <p className="flex items-center gap-2 font-mono tracking-[0.14em] uppercase">
            <span aria-hidden="true" className="size-1 rotate-45 bg-primary/60" />
            {note}
          </p>
        </div>
      </div>
    </footer>
  );
}
