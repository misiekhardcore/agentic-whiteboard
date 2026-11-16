"use client";

import { SidebarMenuButton, SidebarMenuItem } from "@konopskidev/ui/components/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SidebarMenuLink({
  children,
  href,
  exact = false,
}: {
  href: string;
  children: ReactNode;
  /** `exact` is for a link whose href also prefixes its siblings, such as the
   * dashboard: every other surface lives under `/dashboard`.
   */
  exact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={exact ? pathname === href : pathname.startsWith(href)}>
        <Link href={href}>{children}</Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
