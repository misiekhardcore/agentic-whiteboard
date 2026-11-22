import type { ReactNode } from "react";

import { privateMetadata } from "@/app/metadata/privateMetadata";
import { DashboardShell } from "@/components/DashboardShell/DashboardShell";

/**
 * The signed-in sections share one shell and one indexing policy: the dashboard
 * and the workspaces board are separate URL spaces but the same frame, so the
 * sidebar, the scroll column and `noindex` are declared once here rather than by
 * each section's layout.
 */
export const metadata = privateMetadata;

export default function SignedInLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
