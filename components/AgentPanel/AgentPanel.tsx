"use client";

import { Button } from "@konopskidev/ui/components/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@konopskidev/ui/components/resizable";
import { cn } from "@konopskidev/ui/lib/utils";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { type LayoutChangedMeta, usePanelRef } from "react-resizable-panels";

import { Loading } from "@/components/Loading/Loading";

import { AgentPanelThread } from "./AgentPanelThread";
import {
  clampPanelWidth,
  COLLAPSED_PANEL_WIDTH,
  DEFAULT_PANEL_WIDTH,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  PANEL_PREFERENCE_KEY,
  type PanelPreference,
  readPanelPreference,
} from "./panelPreference";

const CONTENT_PANEL_ID = "workspace-content";
const AGENT_PANEL_ID = "agent";

const OPENING_PREFERENCE: PanelPreference = {
  width: DEFAULT_PANEL_WIDTH,
  collapsed: false,
};

/**
 * The agent as the right column of the workspaces section. It is mounted by the
 * section's layout once, so moving between the board and a workspace page keeps
 * the same live thread instead of remounting the composer.
 *
 * The resizable group owns the live width; this component only remembers the
 * width and collapsed state this device chose.
 */
export function AgentPanel({ children }: { children: ReactNode }) {
  const agentPanel = usePanelRef();
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [foldAnimates, setFoldAnimates] = useState(false);
  const preference = useRef<PanelPreference>(OPENING_PREFERENCE);

  // The device's choice is applied after mount: the server has no storage, and
  // a resize needs the group to have measured itself.
  useEffect(() => {
    const panel = agentPanel.current;
    if (!panel) return;

    const stored = readPanelPreference(window.localStorage.getItem(PANEL_PREFERENCE_KEY));
    if (stored) {
      preference.current = stored;
      panel.resize(stored.width);
      if (stored.collapsed) panel.collapse();
    }

    // A visit that opens on a remembered fold is applied before the slide is
    // allowed, so the panel does not shut itself in front of the reader.
    const frame = requestAnimationFrame(() => setFoldAnimates(true));
    return () => cancelAnimationFrame(frame);
  }, [agentPanel]);

  // A drag rewrites the panel's flex every frame; a transition there would make
  // the panel trail the pointer.
  useEffect(() => {
    if (!dragging) return;

    const release = () => setDragging(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [dragging]);

  function remember() {
    try {
      window.localStorage.setItem(PANEL_PREFERENCE_KEY, JSON.stringify(preference.current));
    } catch {
      // Private mode and a full quota leave the panel usable, just not remembered.
    }
  }

  // Only a choice this person made is worth remembering: a layout the viewport
  // forced would overwrite the width they picked on a wider window.
  function rememberResize(meta: LayoutChangedMeta) {
    const panel = agentPanel.current;
    if (!meta.isUserInteraction || !panel || panel.isCollapsed()) return;

    preference.current = {
      width: clampPanelWidth(panel.getSize().inPixels),
      collapsed: false,
    };
    remember();
  }

  function toggleCollapsed() {
    const panel = agentPanel.current;
    if (!panel) return;

    if (panel.isCollapsed()) {
      panel.expand();
      // A restored collapsed panel only knows the rail's width, so the width
      // this device chose is applied again.
      panel.resize(preference.current.width);
      preference.current = { ...preference.current, collapsed: false };
    } else {
      preference.current = {
        width: clampPanelWidth(panel.getSize().inPixels),
        collapsed: true,
      };
      panel.collapse();
    }

    remember();
  }

  return (
    <ResizablePanelGroup
      className={cn("min-h-0 flex-1", foldAnimates && !dragging && "panel-fold")}
      onLayoutChanged={(_, meta) => rememberResize(meta)}
    >
      {/* The page is the other panel, so the handle between them is the only
          thing that decides how much room each one gets. It stands where the
          page used to end in a gap, so the page keeps its own inset from it. */}
      <ResizablePanel id={CONTENT_PANEL_ID} className="min-w-0 p-4">
        {children}
      </ResizablePanel>

      <ResizableHandle
        aria-label="Resize agent panel"
        withHandle
        onPointerDown={() => setDragging(true)}
      />

      <ResizablePanel
        id={AGENT_PANEL_ID}
        panelRef={agentPanel}
        className="min-w-0"
        collapsible
        defaultSize={DEFAULT_PANEL_WIDTH}
        minSize={MIN_PANEL_WIDTH}
        maxSize={MAX_PANEL_WIDTH}
        collapsedSize={COLLAPSED_PANEL_WIDTH}
        onResize={(size) => setCollapsed(size.inPixels <= COLLAPSED_PANEL_WIDTH)}
      >
        <section aria-label="Agent panel" className="flex h-full min-w-0 flex-col border-l">
          {/* The control keeps its place at the right edge through the fold, so
              it travels with the panel instead of jumping to the rail's centre
              while the width is still changing. */}
          <div className="flex items-center justify-end gap-2 py-1 pr-2">
            {collapsed ? (
              <span className="sr-only">Agent</span>
            ) : (
              <h2 className="mr-auto pl-2 text-sm font-semibold">Agent</h2>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={collapsed ? "Expand agent panel" : "Collapse agent panel"}
              onClick={toggleCollapsed}
            >
              {collapsed ? <PanelRightOpen /> : <PanelRightClose />}
            </Button>
          </div>

          {/* Folded away instead of unmounted, so hiding the panel does not
              throw away a reply that is still arriving. */}
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4",
              collapsed && "hidden",
            )}
          >
            <Suspense fallback={<Loading label="Opening the conversation…" />}>
              <AgentPanelThread />
            </Suspense>
          </div>
        </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
