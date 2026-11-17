export /**
 * A sign-in (or sign-up) link that comes back to `redirectTo` afterwards. The
 * destination is encoded so a path with its own query string survives, and the
 * auth pages decode it through `URLSearchParams` before handing it to
 * `safeRedirectTo`, which only accepts a same-origin path.
 */
function withRedirect(page: string, redirectTo?: string): string {
  return redirectTo ? `${page}?redirectTo=${encodeURIComponent(redirectTo)}` : page;
}
