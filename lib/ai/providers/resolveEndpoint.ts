import { AiConfigurationError } from "./config/AiConfigurationError";
import { readValue } from "./readValue";

/** The three values every OpenAI-compatible endpoint needs, under its own names. */
export type EndpointLabels = {
  baseURL: string;
  apiKey: string;
  model: string;
};

export type EndpointValues = {
  baseURL?: string;
  apiKey?: string;
  model?: string;
};

/**
 * Reads one endpoint from the environment and validates it as a whole. A missing
 * value is reported with every other missing one, because the deployment sets
 * them together and a one-at-a-time error means one restart per typo.
 */
export function resolveEndpoint(
  values: EndpointValues,
  labels: EndpointLabels,
): { baseURL: string; apiKey: string; model: string } {
  const baseURL = readValue(values.baseURL)?.replace(/\/+$/, "");
  const apiKey = readValue(values.apiKey);
  const model = readValue(values.model);

  const missing = [
    [labels.baseURL, baseURL],
    [labels.apiKey, apiKey],
    [labels.model, model],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new AiConfigurationError(
      `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required. Set every value for your OpenAI-compatible endpoint; the app assumes no provider.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(baseURL as string);
  } catch {
    throw new AiConfigurationError(
      `${labels.baseURL} must be an absolute http(s) URL including the version segment, received "${baseURL}".`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AiConfigurationError(
      `${labels.baseURL} must use http or https, received "${parsed.protocol}".`,
    );
  }

  return { baseURL: baseURL as string, apiKey: apiKey as string, model: model as string };
}
