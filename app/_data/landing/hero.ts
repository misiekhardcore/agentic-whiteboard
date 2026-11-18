import { routes } from "@/lib/shared/routes";

/** Hero copy: the first screen of `/`. */
export const hero = {
  eyebrow: "Early access",
  title: {
    lead: "An ",
    accent: "Agentic Whiteboard",
    trail: " for whatever you’re building",
  },
  lead: "An infinite canvas where you and your agents sketch, map and refine ideas together — from messy first thought to something you can ship.",
  primaryCta: {
    label: "Start building for free",
    href: routes.signUp,
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
} as const;
