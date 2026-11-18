import type { CapabilityFailure } from "./types";

export function failure(
  error: string,
  extra: Omit<CapabilityFailure, "ok" | "error"> = {},
): CapabilityFailure {
  return { ok: false, error, ...extra };
}
