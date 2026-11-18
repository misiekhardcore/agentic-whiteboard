/** Inside-the-workspace section copy. */
export const surfaces = {
  id: "surfaces",
  eyebrow: "Inside the workspace",
  title: "One agent, one workspace, your whole team",
  lead: "Every surface shares one agent and one context. Draw the flow, write the spec, put the work on the board — nothing gets copied between tabs.",
  items: [
    {
      id: "canvas",
      title: "Canvas",
      description:
        "An infinite whiteboard where the agent draws flowcharts, ERDs, architecture diagrams and org charts shape by shape, and edits them in place on your request.",
      bullets: [
        "Prompt a flowchart, ERD, architecture diagram or org chart",
        "Select a shape and ask for a change — edited in place, never redrawn",
        "Labels, spacing and connectors stay intact as the diagram grows",
      ],
    },
    {
      id: "docs",
      title: "Docs",
      description:
        "A block editor where the agent turns a diagram into a written spec, and rewrites or summarizes sections on command.",
      bullets: [
        "Turn the canvas diagram into a structured first draft",
        "Rewrite, shorten or summarize a section without leaving the page",
        "Every block stays editable — the agent writes, you decide",
      ],
    },
    {
      id: "team-board",
      title: "Team board",
      description:
        "A kanban board of every workspace in your org, with live cursors so teammates can jump in together.",
      bullets: [
        "Every workspace in your org, grouped by stage on one board",
        "Live cursors and presence show who is in which workspace",
        "Open a workspace together and keep the same agent context",
      ],
    },
  ],
} as const;

export type LandingFeature = (typeof surfaces)["items"][number];
export type SurfaceId = LandingFeature["id"];
