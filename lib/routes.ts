/**
 * Every in-app URL, built in one place.
 *
 * Pages, links, redirects, revalidation and the agent's tools all name a
 * destination through this module, so a route that moves is one edit rather
 * than a search for string fragments. Paths are relative: the app is the only
 * origin it can vouch for, and an absolute URL built from a request header is
 * exactly the kind of thing a proxy can lie about.
 */

export const routes = {
  home: "/",

  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",

  dashboard: "/dashboard",
  dashboardArchive: "/dashboard/archive",
  dashboardShared: "/dashboard/shared",
  dashboardOrganization: "/dashboard/organization",
  dashboardBilling: "/dashboard/billing",
  dashboardSettings: "/dashboard/settings",
  dashboardAiHelper: "/dashboard/ai-helper",

  workspaces: "/workspaces",
  /** The workspace a person opens: `/workspace/:id`. */
  workspace: (id: string) => `/workspace/${encodeURIComponent(id)}`,
  /** An organization invitation: `/invite/:id`. */
  invite: (id: string) => `/invite/${encodeURIComponent(id)}`,

  agentPromptsApi: "/api/agent/prompts",
} as const;

/**
 * A sign-in (or sign-up) link that comes back to `redirectTo` afterwards. The
 * destination is encoded so a path with its own query string survives, and the
 * auth pages decode it through `URLSearchParams` before handing it to
 * `safeRedirectTo`, which only accepts a same-origin path.
 */
function withRedirect(page: string, redirectTo?: string): string {
  return redirectTo
    ? `${page}?redirectTo=${encodeURIComponent(redirectTo)}`
    : page;
}

export function signInPath(redirectTo?: string): string {
  return withRedirect(routes.signIn, redirectTo);
}

export function signUpPath(redirectTo?: string): string {
  return withRedirect(routes.signUp, redirectTo);
}
