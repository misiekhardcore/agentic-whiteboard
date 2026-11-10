/**
 * Landing page copy.
 *
 * Every sentence rendered on `/` lives here, so the page component stays a
 * layout and the words can be edited without touching markup.
 */

export const landing = {
  hero: {
    eyebrow: "Early access",
    title: {
      lead: "An ",
      accent: "Agentic Whiteboard",
      trail: " for whatever you’re building",
    },
    lead:
      "An infinite canvas where you and your agents sketch, map and refine ideas together — from messy first thought to something you can ship.",
    primaryCta: {
      label: "Start building for free",
      href: "/sign-up",
    },
    secondaryCta: {
      label: "See how it works",
      href: "#how-it-works",
    },
    video: {
      poster: "/videos/hero-poster.jpg",
      sources: [
        { src: "/videos/hero.webm", type: "video/webm" },
        { src: "/videos/hero.mp4", type: "video/mp4" },
      ],
    },
  },

  audience: {
    eyebrow: "Who it’s for",
    headline: "Built for the people who turn a sketch into shipped work.",
    groups: [
      "Product teams",
      "Founders",
      "Solo builders",
      "Agencies",
      "Consultants",
    ],
  },

  howItWorks: {
    id: "how-it-works",
    eyebrow: "How it works",
    title: "Three waypoints from a blank canvas to a shared picture",
    lead:
      "You bring the idea in words. The agent draws it, and you shape it together — on the same canvas, in the same conversation.",
    steps: [
      {
        id: "describe",
        title: "Describe it",
        description:
          "Start with a sentence, not a shape library. Say what you’re mapping — a checkout flow, a schema, a system boundary — and the agent asks the one or two questions it needs answered.",
      },
      {
        id: "draw",
        title: "Watch the agent draw",
        description:
          "Shapes, labels and connectors land on the canvas as it works. Follow the reasoning while it sketches, and correct a wrong turn before it spreads.",
      },
      {
        id: "iterate",
        title: "Keep iterating together",
        description:
          "Select any shape and ask for the change: rename it, split it, add a branch. Edits happen in place, the layout holds together, and the same context follows you into docs and the board.",
      },
    ],
  },

  surfaces: {
    id: "surfaces",
    eyebrow: "Inside the workspace",
    title: "One agent, one workspace, your whole team",
    lead:
      "Every surface shares one agent and one context. Draw the flow, write the spec, put the work on the board — nothing gets copied between tabs.",
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
  },

  pricing: {
    id: "pricing",
    eyebrow: "Pricing",
    title: "Plans that grow the way your board does",
    lead:
      "Start free on your own canvas. Move up when you need more prompts, public share links, or a whole team around the board — every plan includes the same agent, canvas, docs and board.",
    tabs: {
      personal: "Personal",
      team: "Team",
    },
    // Plan content lives in lib/billing/plans.ts; this only says which cards
    // each tab shows.
    planIds: {
      personal: ["free", "pro"],
      team: ["free", "team", "enterprise"],
    },
    featuredId: "pro",
    note: "Monthly billing in USD. Change or cancel your plan any time from the billing portal.",
  },

  closing: {
    id: "start",
    title: {
      lead: "Bring the ",
      accent: "next idea",
      trail: " to the canvas",
    },
    lead:
      "Describe it, watch it take shape, and keep going until it’s something you can hand to the team.",
    primaryCta: { label: "Start building for free", href: "/sign-up" },
    secondaryCta: { label: "See how it works", href: "#how-it-works" },
  },

  footer: {
    tagline:
      "An infinite canvas where you and your agents map ideas together, from the first sketch to the shipped plan.",
    columns: [
      {
        title: "Product",
        links: [
          { label: "How it works", href: "#how-it-works" },
          { label: "The workspace", href: "#surfaces" },
          { label: "Pricing", href: "#pricing" },
        ],
      },
      {
        title: "Account",
        links: [
          { label: "Start for free", href: "/sign-up" },
          { label: "Sign in", href: "/sign-in" },
          { label: "Dashboard", href: "/dashboard" },
        ],
      },
    ],
    note: "Early access",
    legal: "© 2026 Agentic Whiteboard",
  },
} as const;

export type LandingFeature = (typeof landing)["surfaces"]["items"][number];
export type SurfaceId = LandingFeature["id"];
