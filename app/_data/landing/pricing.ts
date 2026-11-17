/**
 * Pricing section copy.
 *
 * Which plans each tab shows is the billing rule, not copy: `plansForAudience`
 * decides it, so the landing page cannot drift from the dashboard.
 */
export const pricing = {
  id: "pricing",
  eyebrow: "Pricing",
  title: "Plans that grow the way your board does",
  lead: "Start free on your own canvas. Move up when you need more prompts, public share links, or a whole team around the board — every plan includes the same agent, canvas, docs and board.",
  tabs: {
    personal: "Personal",
    team: "Team",
  },
  featuredId: "pro",
  note: "Monthly billing in USD. Change or cancel your plan any time from the billing portal.",
} as const;
