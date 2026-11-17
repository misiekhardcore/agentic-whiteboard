import { withRedirect } from "./internals";
import { routes } from "./routes";

export function signUpPath(redirectTo?: string): string {
  return withRedirect(routes.signUp, redirectTo);
}
