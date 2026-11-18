import type { CapabilitySuccess } from "./types";

export function success<T>(payload: T): CapabilitySuccess<T> {
  return { ok: true, ...payload };
}
