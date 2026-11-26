export type AgentHealth = { status: "up"; service: string } | { status: "down"; detail: string };

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

type Options = {
  url?: string;
  fetchImpl?: FetchLike;
};

const DEFAULT_AGENT_URL = "http://127.0.0.1:3002";

/**
 * The footer's status. A down agent is information, not an error page: the rest
 * of the workspace still works without it.
 */
export async function readAgentHealth(options: Options = {}): Promise<AgentHealth> {
  const url = options.url ?? process.env.AGENT_URL ?? DEFAULT_AGENT_URL;
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${url}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1000),
    });

    if (!response.ok) {
      return { status: "down", detail: `HTTP ${response.status}` };
    }

    const body: unknown = await response.json();
    const service =
      typeof body === "object" &&
      body !== null &&
      "service" in body &&
      typeof body.service === "string"
        ? body.service
        : "agent";

    return { status: "up", service };
  } catch {
    return { status: "down", detail: "unreachable" };
  }
}
