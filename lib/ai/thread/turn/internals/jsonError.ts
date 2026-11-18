export function jsonError(
  error: string,
  status: number,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json({ error, ...extra }, { status });
}
