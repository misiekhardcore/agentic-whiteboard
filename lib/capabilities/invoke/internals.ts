import type { ZodError } from "zod";

export /**
 * The one way a capability is called. Every caller goes through this, so the
 * validation, the authorization and the result contract cannot be skipped.
 *
 * Only a broken handler throws (its output does not match the declared schema);
 * everything a caller can cause is returned as a value.
 */
/** The field messages from a rejected input, first issue per field wins. */
function inputFieldErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}
