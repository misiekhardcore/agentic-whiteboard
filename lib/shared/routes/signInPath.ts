import { withRedirect } from "./internals";
import { routes } from "./routes";

export function signInPath(redirectTo?: string): string {
  return withRedirect(routes.signIn, redirectTo);
}
