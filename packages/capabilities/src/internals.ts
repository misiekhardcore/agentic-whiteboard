type Issue = {
  path?: readonly unknown[];
  message?: unknown;
};

function issuesOf(error: unknown): Issue[] {
  if (typeof error !== "object" || error === null || !("issues" in error)) return [];
  const issues = error.issues;
  if (!Array.isArray(issues)) return [];
  return issues.filter((issue): issue is Issue => typeof issue === "object" && issue !== null);
}

/** The first message per field, keyed by the input field the form shows. */
export function inputFieldErrors(error: unknown): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issuesOf(error)) {
    const key = issue.path?.find((part): part is string => typeof part === "string");
    const message = typeof issue.message === "string" ? issue.message : "Invalid value";
    if (key !== undefined && !(key in fieldErrors)) {
      fieldErrors[key] = message;
    }
  }

  return fieldErrors;
}
