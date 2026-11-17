/**
 * Rules for the prompt composer that starts an agent conversation. The module is
 * pure so the keyboard contract and the sendable text are tested directly, and
 * the dashboard component only maps DOM events onto them.
 */
/**
 * Starting points offered under the composer. Three is the product decision:
 * enough to show the range of work, few enough to read at a glance.
 */
export const EXAMPLE_PROMPTS = [
  "Design a blog database and document each table",
  "Map out a user onboarding flow",
  "Plan the architecture for a chat app",
] as const;
