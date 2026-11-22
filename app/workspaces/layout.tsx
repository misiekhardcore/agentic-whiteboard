import { cookies } from "next/headers";
import { Suspense } from "react";

import { privateMetadata } from "@/app/metadata/privateMetadata";
import { AgentPanel } from "@/components/AgentPanel/AgentPanel";
import {
  COLLAPSED_PANEL_WIDTH,
  PANEL_LAYOUT_COOKIE,
  parsePanelLayout,
} from "@/components/AgentPanel/panelLayout";
import { DashboardShell } from "@/components/DashboardShell/DashboardShell";
import { Loading } from "@/components/Loading/Loading";

export const metadata = privateMetadata;

export default async function WorkspacesLayout({ children }: LayoutProps<"/workspaces">) {
  // The width is this device's preference, so it is read before the panel
  // renders: a reload opens at the chosen width instead of snapping after
  // hydration.
  const panelLayout = parsePanelLayout((await cookies()).get(PANEL_LAYOUT_COOKIE)?.value);

  return (
    <DashboardShell>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="min-w-0 flex-1">{children}</div>
        {/* Mounted by the section, not by a page: moving between the board and a
            workspace keeps the same live conversation on screen. */}
        <Suspense
          fallback={
            <div
              className="flex shrink-0 justify-center pt-8"
              style={{
                width: panelLayout.collapsed ? COLLAPSED_PANEL_WIDTH : panelLayout.width,
              }}
            >
              <Loading label="Opening the conversation…" />
            </div>
          }
        >
          <AgentPanel initialLayout={panelLayout} />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
