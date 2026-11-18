/**
 * The AI provider configuration is read from the environment so switching
 * between LM Studio, a hosted OpenAI-compatible endpoint, or a future native
 * provider is a deployment change rather than a code change.
 *
 * This module is pure except for `getAiConfig`, which reads `process.env` at
 * call time so hot reload picks up edits without a server restart.
 */
export const AI_PROVIDER_IDS = ["lmstudio", "openai-compatible", "groq", "stub"] as const;
