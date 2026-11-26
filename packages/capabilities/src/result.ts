import type { Refusal, RefusalCode, Success } from "@v2/contracts";

export function success<Output extends object>(payload: Output): Success<Output> {
  return { ok: true, ...payload };
}

export function refusal(
  code: RefusalCode,
  error: string,
  extra: Omit<Refusal, "ok" | "code" | "error"> = {},
): Refusal {
  return { ok: false, code, error, ...extra };
}
