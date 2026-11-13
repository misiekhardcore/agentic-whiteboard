import { auth } from "@/lib/auth";
import { startCheckout } from "@/lib/billing/checkout";
import { BillingConfigurationError, BillingRequestError } from "@/lib/billing/stripe";

/**
 * Starts an embedded checkout for the signed-in user. The browser never sends
 * an owner id it could forge: personal plans always bill the session user, and
 * team plans verify membership through the session headers.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json(
      { error: "Sign in to continue." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    const result = await startCheckout({
      user: session.user,
      planId: body.planId,
      seats: body.seats,
      organizationId: body.organizationId,
      organizationName: body.organizationName,
      headers: request.headers,
    });

    return Response.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof BillingRequestError) {
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof BillingConfigurationError) {
      // A missing key is a deployment problem, not something the customer did.
      console.error("[billing] checkout is not configured:", error.message);
      return Response.json(
        {
          error: "Payments are not configured yet. Add the Stripe keys, then try again.",
        },
        { status: 503 },
      );
    }

    console.error("[billing] checkout failed:", error);
    return Response.json({ error: "Could not start checkout. Try again." }, { status: 500 });
  }
}
