import { routes } from "@/lib/shared/routes";

/** Closing call to action copy. */
export const closing = {
  id: "start",
  title: {
    lead: "Bring the ",
    accent: "next idea",
    trail: " to the canvas",
  },
  lead: "Describe it, watch it take shape, and keep going until it’s something you can hand to the team.",
  primaryCta: { label: "Start building for free", href: routes.signUp },
  secondaryCta: { label: "See how it works", href: "#how-it-works" },
} as const;
