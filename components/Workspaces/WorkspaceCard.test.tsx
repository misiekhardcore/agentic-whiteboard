// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A card is rendered from data its surface already read, so the test hands it
 * rows and reads the result: no database, no session, and no query per card.
 * `next/link` is the framework boundary the card cannot run inside a test, so it
 * becomes the anchor it renders in the browser.
 */
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { routes } from "@/lib/shared/routes";

import { WorkspaceCard, type WorkspaceCardWorkspace } from "./WorkspaceCard";

// Two hours and a minute back, so the elapsed label cannot round to one hour.
const twoHoursAgo = () => new Date(Date.now() - (2 * 60 + 1) * 60_000);

const activeWorkspace: WorkspaceCardWorkspace = {
  archived: false,
  id: "ws_roadmap",
  name: "Roadmap",
  description: "Where the quarter goes",
  status: "IN_PROGRESS",
  creator: { name: "Dana Reed", image: null },
  lastActivity: twoHoursAgo(),
};

const archivedWorkspace: WorkspaceCardWorkspace = {
  archived: true,
  id: "ws_old_plan",
  name: "Old plan",
  description: "Last quarter's map",
  status: "DONE",
  creator: null,
  archivedAt: new Date("2026-11-20T09:00:00Z"),
};

/** Radix opens its menu on pointer down, which jsdom does not implement fully. */
function openMenu(workspace: WorkspaceCardWorkspace) {
  fireEvent.pointerDown(screen.getByRole("button", { name: `Actions for ${workspace.name}` }));
}

afterEach(() => {
  cleanup();
});

describe("an active workspace's card", () => {
  it("links the workspace and states its description, last activity, creator and stage", () => {
    render(<ul>{<WorkspaceCard workspace={activeWorkspace} />}</ul>);

    expect(screen.getByRole("link", { name: /Roadmap/ }).getAttribute("href")).toBe(
      routes.workspace("ws_roadmap"),
    );
    expect(screen.getByText("Where the quarter goes")).toBeDefined();
    expect(screen.getByText("Last activity 2 hours ago")).toBeDefined();
    expect(screen.getByText("Dana Reed")).toBeDefined();
    // No image, so the avatar falls back to the creator's initial.
    expect(screen.getByText("D")).toBeDefined();
    expect(screen.getByText("In progress")).toBeDefined();
  });

  it("offers editing and archiving, never restoring or deleting", async () => {
    render(<ul>{<WorkspaceCard workspace={activeWorkspace} />}</ul>);

    openMenu(activeWorkspace);

    expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Archive" })).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: "Restore" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });

  it("leaves the stage out when its surface already names it", () => {
    render(<ul>{<WorkspaceCard workspace={activeWorkspace} showStage={false} />}</ul>);

    expect(screen.queryByText("In progress")).toBeNull();
    expect(screen.getByText("Roadmap")).toBeDefined();
    expect(screen.getByText("Last activity 2 hours ago")).toBeDefined();
  });
});

describe("an archived workspace's card", () => {
  it("states when it was archived and survives a creator that no longer exists", () => {
    render(<ul>{<WorkspaceCard workspace={archivedWorkspace} />}</ul>);

    expect(screen.getByRole("link", { name: /Old plan/ }).getAttribute("href")).toBe(
      routes.workspace("ws_old_plan"),
    );
    expect(screen.getByText("Archived Nov 20, 2026")).toBeDefined();
    expect(screen.queryByText("Last activity", { exact: false })).toBeNull();
    // Archiving is not a stage: the archived card still states the one it keeps.
    expect(screen.getByText("Done")).toBeDefined();
  });

  it("offers restoring and deleting, never editing or archiving", async () => {
    render(<ul>{<WorkspaceCard workspace={archivedWorkspace} />}</ul>);

    openMenu(archivedWorkspace);

    expect(await screen.findByRole("menuitem", { name: "Restore" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeDefined();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Archive" })).toBeNull();
  });
});
