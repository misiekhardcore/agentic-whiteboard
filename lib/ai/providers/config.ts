/**
 * Every connection value comes from the environment: this app knows nothing
 * about which providers exist, what their URLs are, or which keys they want.
 * Nothing here has a default — an incomplete deployment is a configuration
 * error naming every variable it still needs, so a wrong setup fails at the
 * first request with the fix in the message rather than at the provider.
 *
 * The one exception is `AI_STUB`, which turns the scripted provider on: it is a
 * test switch, so it is optional and off unless a deployment sets it.
 */
export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigurationError";
  }
}

/** What a model handle needs, wherever the endpoint comes from. */
export type ModelConnection = {
  /** Base URL including the version segment, e.g. https://api.groq.com/openai/v1. */
  baseURL: string;
  apiKey: string;
  /** The provider's own model id, e.g. what its /v1/models lists. */
  model: string;
  /** Answer with the scripted provider instead of a request (e2e only). */
  stub: boolean;
};

export type AiConfig = ModelConnection & {
  /** Upper bound for the agentic tool loop. */
  maxSteps: number;
  maxRetries: number;
  /**
   * Signs each tool-approval request. Approval responses travel through the
   * browser, so without this a client could approve its own call. When unset,
   * approval-gated tools are not offered to the model at all.
   */
  toolApprovalSecret?: string;
};

/** The model that names conversations; it may be a different endpoint entirely. */
export type TitleAiConfig = ModelConnection;

export type AiEnvironment = Partial<Record<string, string | undefined>>;

const AGENT_VARIABLES = [
  "AI_BASE_URL",
  "AI_API_KEY",
  "AI_MODEL",
  "AI_MAX_STEPS",
  "AI_MAX_RETRIES",
] as const;

const TITLE_VARIABLES = ["AI_TITLE_BASE_URL", "AI_TITLE_API_KEY", "AI_TITLE_MODEL"] as const;

/**
 * Reads every named variable or refuses the whole configuration, naming all of
 * the missing ones at once. A deployment that has to be told twice is a
 * deployment that reads the error twice.
 */
function readRequired<T extends readonly string[]>(
  env: AiEnvironment,
  names: T,
): Record<T[number], string> {
  const missing = names.filter((name) => !valueOf(env[name]));

  if (missing.length > 0) {
    throw new AiConfigurationError(
      `AI is not configured: set ${missing.join(", ")}. There are no defaults; every model setting comes from the environment.`,
    );
  }

  return Object.fromEntries(names.map((name) => [name, valueOf(env[name])])) as Record<
    T[number],
    string
  >;
}

function valueOf(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readBaseURL(name: string, value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  if (!trimmed) throw new AiConfigurationError(`${name} must be a URL, received "${value}".`);
  return trimmed;
}

function readCount(name: string, value: string, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new AiConfigurationError(
      `${name} must be a whole number greater than or equal to ${minimum}, received "${value}".`,
    );
  }

  return parsed;
}

/**
 * The scripted provider is a test switch, not a setting a deployment has to
 * state: unset means off, and only a value that means nothing is refused.
 */
function readStub(value: string | undefined): boolean {
  if (value === undefined) return false;
  if (value !== "0" && value !== "1") {
    throw new AiConfigurationError(`AI_STUB must be "0" or "1" when set, received "${value}".`);
  }

  return value === "1";
}

export function resolveAiConfig(env: AiEnvironment = process.env): AiConfig {
  const settings = readRequired(env, AGENT_VARIABLES);

  const toolApprovalSecret = valueOf(env.AI_TOOL_APPROVAL_SECRET);
  if (toolApprovalSecret && toolApprovalSecret.length < 32) {
    throw new AiConfigurationError(
      "AI_TOOL_APPROVAL_SECRET must be at least 32 characters so an approval cannot be guessed.",
    );
  }

  return {
    baseURL: readBaseURL("AI_BASE_URL", settings.AI_BASE_URL),
    apiKey: settings.AI_API_KEY,
    model: settings.AI_MODEL,
    stub: readStub(valueOf(env.AI_STUB)),
    maxSteps: readCount("AI_MAX_STEPS", settings.AI_MAX_STEPS, 1),
    maxRetries: readCount("AI_MAX_RETRIES", settings.AI_MAX_RETRIES, 0),
    toolApprovalSecret,
  };
}

/**
 * The host a connection talks to. A stored prompt records this rather than a
 * provider name, because the app has no provider vocabulary to record.
 */
export function modelSource(baseURL: string): string {
  return new URL(baseURL).host;
}

/** Reads the live environment so local edits are visible on the next call. */
export function getAiConfig(): AiConfig {
  return resolveAiConfig(process.env);
}

/**
 * The endpoint that names conversations. It is its own setting rather than a
 * model id on the agent's connection: naming is a six-word answer and is often
 * better served by a different, smaller, non-reasoning model than the agent's.
 */
export function resolveTitleAiConfig(env: AiEnvironment = process.env): TitleAiConfig {
  const settings = readRequired(env, TITLE_VARIABLES);
  const stub = readStub(valueOf(env.AI_STUB));

  return {
    baseURL: readBaseURL("AI_TITLE_BASE_URL", settings.AI_TITLE_BASE_URL),
    apiKey: settings.AI_TITLE_API_KEY,
    model: settings.AI_TITLE_MODEL,
    stub,
  };
}

/** Reads the live environment so local edits are visible on the next call. */
export function getTitleAiConfig(): TitleAiConfig {
  return resolveTitleAiConfig(process.env);
}

/**
 * Whether the deployment has a usable model configuration. Routes can use this
 * to answer "AI is not configured" instead of throwing mid-render.
 */
export function isAiConfigured(): boolean {
  try {
    getAiConfig();
    return true;
  } catch (error) {
    if (error instanceof AiConfigurationError) return false;
    throw error;
  }
}
