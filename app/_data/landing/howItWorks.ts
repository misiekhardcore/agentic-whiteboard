/** How-it-works section copy. */
export const howItWorks = {
  id: "how-it-works",
  eyebrow: "How it works",
  title: "Three waypoints from a blank canvas to a shared picture",
  lead: "You bring the idea in words. The agent draws it, and you shape it together — on the same canvas, in the same conversation.",
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
} as const;
