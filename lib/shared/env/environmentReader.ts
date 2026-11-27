import { ConfigurationError } from "./ConfigurationError";
import type { Environment, EnvironmentReader } from "./types";

const HTTP_SCHEMES = ["http:", "https:"];
const SOCKET_SCHEMES = ["ws:", "wss:"];
const HTTP_DESCRIPTION = "an http:// or https:// address";
const SOCKET_DESCRIPTION = "a ws:// or wss:// address";
const LOWEST_PORT = 1;
const HIGHEST_PORT = 65_535;

/** A setting's trimmed value, or `null` when it is unset or blank. */
function valueOf(env: Environment, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

function protocolOf(address: string): string | null {
  try {
    return new URL(address).protocol;
  } catch {
    return null;
  }
}

/**
 * An address setting without its trailing slash. A scheme that does not say how
 * the value is reached is refused, naming the setting a deployer must change.
 */
function addressOf(
  env: Environment,
  name: string,
  schemes: string[],
  description: string,
): string | null {
  const value = valueOf(env, name);
  if (!value) return null;

  const address = value.replace(/\/+$/, "");
  if (!schemes.includes(protocolOf(address) ?? "")) {
    throw new ConfigurationError(`${name} must be ${description}, received "${value}".`);
  }

  return address;
}

function portOf(env: Environment, name: string, fallback: number): number {
  const raw = valueOf(env, name);
  if (!raw) return fallback;

  const port = Number(raw);
  if (!Number.isInteger(port) || port < LOWEST_PORT || port > HIGHEST_PORT) {
    throw new ConfigurationError(`${name} must be a port number, received "${raw}".`);
  }

  return port;
}

/**
 * One reader over a deployment's environment, so no context hand-writes trimming,
 * slash stripping or the failure that names an unusable setting. Whether an
 * absent setting degrades to `null` or refuses to start stays the context's call.
 */
export function environmentReader(env: Environment = process.env): EnvironmentReader {
  return {
    value: (name) => valueOf(env, name),
    origin: (name) => addressOf(env, name, HTTP_SCHEMES, HTTP_DESCRIPTION),
    socketOrigin: (name) => addressOf(env, name, SOCKET_SCHEMES, SOCKET_DESCRIPTION),
    port: (name, fallback) => portOf(env, name, fallback),
  };
}
