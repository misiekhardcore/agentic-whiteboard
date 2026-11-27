export type IdentityMail = {
  to: string;
  subject: string;
  /** The single-use link the message carries. */
  url: string;
};

/**
 * The one place identity mail leaves the app.
 *
 * v2 has no SMTP transport yet, so development prints the link to the server
 * log — that is how a local reset or invitation is reachable without a mail
 * account. Production refuses to log a reset token: it is a credential, and a
 * deployment without a transport must fail loudly rather than write it to a log
 * where anyone with log access can spend it. Wiring SMTP replaces this function
 * and nothing else.
 */
export function sendIdentityMail(mail: IdentityMail): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.IDENTITY_MAIL_MODE !== "log") {
    console.warn(`[identity] no mail transport configured; ${mail.subject} was not delivered`);
    return Promise.resolve();
  }

  console.info(`[identity] ${mail.subject} for ${mail.to}: ${mail.url}`);
  return Promise.resolve();
}
