"use client";

import { Button } from "@konopskidev/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

export function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Button asChild variant="ghost" className="justify-start px-1.5 py-2" onClick={onNavigate}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
