import { AiConfigurationError } from "@/lib/ai/providers/config";
import { resolveEndpoint } from "@/lib/ai/providers/resolveEndpoint";

/** The effort values an OpenAI-compatible endpoint may accept. */
export const TITLE_REASONING_EFFORTS = [
  "none",
  "default",
  "minimal",
  "low",
  "medium",
  "high",
] as const;

export type TitleConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  /**
   * Sent only when configured. Titles need plain text, and an endpoint that has
   * no reasoning mode rejects the field, so the deployment opts in.
   */
  reasoningEffort?: string;
};

export type TitleEnvironment = Pick<
  typeof process.env,
  "TITLE_AI_BASE_URL" | "TITLE_AI_API_KEY" | "TITLE_AI_MODEL" | "TITLE_AI_REASONING_EFFORT"
>;

/**
 * Titles run on their own endpoint, chosen in full by the deployment exactly as
 * the agent's is: naming a conversation is cheap work that does not belong on
 * the expensive model, and the code cannot assume which server either uses.
 */
export function resolveTitleConfig(env: TitleEnvironment = process.env): TitleConfig {
  const endpoint = resolveEndpoint(
    {
      baseURL: env.TITLE_AI_BASE_URL,
      apiKey: env.TITLE_AI_API_KEY,
      model: env.TITLE_AI_MODEL,
    },
    {
      baseURL: "TITLE_AI_BASE_URL",
      apiKey: "TITLE_AI_API_KEY",
      model: "TITLE_AI_MODEL",
    },
  );

  const reasoningEffort = env.TITLE_AI_REASONING_EFFORT?.trim();
  if (
    reasoningEffort &&
    !(TITLE_REASONING_EFFORTS as readonly string[]).includes(reasoningEffort)
  ) {
    throw new AiConfigurationError(
      `TITLE_AI_REASONING_EFFORT must be one of ${TITLE_REASONING_EFFORTS.join(", ")}, received "${reasoningEffort}".`,
    );
  }

  return { ...endpoint, reasoningEffort: reasoningEffort || undefined };
}

/** Whether a title endpoint is configured, without turning its absence into an error. */
export function isTitleConfigured(): boolean {
  try {
    resolveTitleConfig();
    return true;
  } catch (error) {
    if (error instanceof AiConfigurationError) return false;
    throw error;
  }
}
