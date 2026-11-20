import { Button } from "@konopskidev/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandLockup } from "@/components/Site/Brand";
import { routes } from "@/lib/shared/routes";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-24 text-center">
      <BrandLockup />
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          404
        </p>
        <h1 className="font-display text-h2 font-semibold">This page is off the map</h1>
        <p className="max-w-md font-serif text-sm text-pretty text-muted-foreground">
          The address does not match anything here. Head back to the board and start from what you
          know.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="primary">
          <Link href={routes.home}>Back to the homepage</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={routes.dashboard}>Open the dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
