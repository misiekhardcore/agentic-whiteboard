import { describe, expect, it } from "vitest";

import { authErrorMessage } from "./authErrorMessage";

describe("authErrorMessage", () => {
  it("gives a wrong password and an unknown address the same sentence", () => {
    const wrongPassword = authErrorMessage("INVALID_EMAIL_OR_PASSWORD", "fallback");
    const unknownAddress = authErrorMessage("USER_NOT_FOUND", "fallback");

    expect(wrongPassword).toBe("Incorrect email or password.");
    expect(unknownAddress).toBe(wrongPassword);
  });

  it("explains a duplicate sign-up without naming a different account", () => {
    expect(authErrorMessage("USER_ALREADY_EXISTS", "fallback")).toBe(
      "An account with this email already exists.",
    );
    expect(authErrorMessage("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "fallback")).toBe(
      "An account with this email already exists.",
    );
  });

  it("explains a spent or expired token", () => {
    expect(authErrorMessage("INVALID_TOKEN", "fallback")).toBe(
      "That link is invalid or has expired. Request a new one.",
    );
  });

  it("keeps the caller's fallback for an unknown code", () => {
    expect(authErrorMessage("SOMETHING_NEW", "Try again.")).toBe("Try again.");
    expect(authErrorMessage(undefined, "Try again.")).toBe("Try again.");
  });
});
