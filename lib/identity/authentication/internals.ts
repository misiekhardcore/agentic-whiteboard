export /**
 * Sign-in, sign-up, reset and the person's own profile.
 *
 * These run before (or outside) any capability: there is no actor to
 * authorize, so they are plain application functions and the actions above them
 * stay thin. What is policy still lives here once: the error code → sentence
 * mapping, the reset link, and the profile's field rules.
 */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
  USER_ALREADY_EXISTS: "An account with this email already exists.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "An account with this email already exists.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is too long.",
  INVALID_TOKEN: "That link is invalid or has expired. Request a new one.",
};

export function appUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export const OAUTH_PROVIDERS = ["github", "google"] as const;
