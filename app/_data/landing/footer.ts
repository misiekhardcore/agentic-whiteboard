import { routes } from "@/lib/shared/routes";

/** Footer copy. */
export const footer = {
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
        { label: "Start for free", href: routes.signUp },
        { label: "Sign in", href: routes.signIn },
        { label: "Dashboard", href: routes.dashboard },
      ],
    },
  ],
  note: "Early access",
  legal: "© 2026 WorkspAIce",
} as const;
