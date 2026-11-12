"use client";

import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@konopskidev/ui/components/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function SidebarMenuLink({
  children,
  href,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={pathname.startsWith(href)}>
        <Link href={href}>{children}</Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
