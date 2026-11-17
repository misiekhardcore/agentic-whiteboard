import type { Plan, PlanId } from "./types";

/**
 * Content follows the agreed price sheet: Free is the same on both tabs, Pro is
 * personal, Team and Enterprise are billed per member.
 */
export const plans = {
  free: {
    id: "free",
    name: "Free",
    summary: "Everything you need to start mapping.",
    priceUsd: 0,
    perSeat: false,
    audience: ["personal", "team"],
    features: [
      "20 agent prompts per month",
      "Up to 3 workspaces",
      "Live collaboration on docs and canvas",
      "Voice input",
    ],
    limits: { agentPromptsPerMonth: 20, workspaces: 3 },
    capabilities: {
      liveCollaboration: true,
      voiceInput: true,
      shareLinks: false,
      pdfExport: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    summary: "For solo builders who ship what they map.",
    priceUsd: 12,
    perSeat: false,
    audience: ["personal"],
    features: [
      "Unlimited workspaces",
      "Public share links",
      "PDF export",
      "500 agent prompts per month",
    ],
    limits: { agentPromptsPerMonth: 500, workspaces: null },
    capabilities: {
      liveCollaboration: true,
      voiceInput: true,
      shareLinks: true,
      pdfExport: true,
    },
  },
  team: {
    id: "team",
    name: "Team",
    summary: "For teams who think on the same canvas.",
    priceUsd: 12,
    perSeat: true,
    audience: ["team"],
    features: [
      "Unlimited seats",
      "Unlimited workspaces",
      "Public share links",
      "PDF export",
      "500 agent prompts per member / month",
    ],
    limits: { agentPromptsPerMonth: 500, workspaces: null },
    capabilities: {
      liveCollaboration: true,
      voiceInput: true,
      shareLinks: true,
      pdfExport: true,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    summary: "For orgs running many workspaces at once.",
    priceUsd: 20,
    perSeat: true,
    audience: ["team"],
    features: [
      "Unlimited seats",
      "2,000 agent prompts per member / month",
      "Unlimited workspaces",
      "Public share links",
      "PDF export",
    ],
    limits: { agentPromptsPerMonth: 2000, workspaces: null },
    capabilities: {
      liveCollaboration: true,
      voiceInput: true,
      shareLinks: true,
      pdfExport: true,
    },
  },
} as const satisfies Record<PlanId, Plan>;
