/**
 * Every in-app URL, built in one place. Paths are relative: the app is the only
 * origin it can vouch for, and an absolute URL built from a request header is
 * exactly what a proxy can lie about.
 */
export const routes = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  workspace: (id: string) => `/w/${encodeURIComponent(id)}`,
  invite: (id: string) => `/invite/${encodeURIComponent(id)}`,
} as const;

function withRedirect(page: string, redirectTo?: string): string {
  return redirectTo ? `${page}?redirectTo=${encodeURIComponent(redirectTo)}` : page;
}

export function signInPath(redirectTo?: string): string {
  return withRedirect(routes.signIn, redirectTo);
}

export function signUpPath(redirectTo?: string): string {
  return withRedirect(routes.signUp, redirectTo);
}
