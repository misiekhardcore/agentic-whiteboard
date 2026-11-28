/**
 * The sentences an authentication form may show. A wrong password and an
 * unknown address deliberately share one message, so the form never becomes an
 * account-existence oracle. Unknown codes keep the caller's fallback.
 */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL: "Enter a valid email address.",
  INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
  INVALID_CREDENTIALS: "Incorrect email or password.",
  USER_NOT_FOUND: "Incorrect email or password.",
  USER_ALREADY_EXISTS: "An account with this email already exists.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "An account with this email already exists.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_TOO_LONG: "That password is too long.",
  INVALID_TOKEN: "That link is invalid or has expired. Request a new one.",
};

export function authErrorMessage(code: string | undefined, fallback: string): string {
  if (code === undefined) return fallback;
  return MESSAGES[code] ?? fallback;
}
