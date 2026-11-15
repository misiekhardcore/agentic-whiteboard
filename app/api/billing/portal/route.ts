import { ensureStripeCustomer } from "@/lib/billing/customers";
import { appUrl, BillingConfigurationError, getStripe } from "@/lib/billing/stripe";
import { auth } from "@/lib/identity/better-auth";
import { canManageTeam } from "@/lib/organizations/membership";
import { getMemberRole, getOrganizationRecord } from "@/lib/organizations/queries";

/**
 * Opens the Stripe billing portal, where a customer updates a card, sees
 * invoices, or cancels. This is the only cancellation path the app offers.
 */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // The personal billing portal needs no body.
  }

  const organizationId = typeof body.organizationId === "string" ? body.organizationId : null;

  try {
    let customerId: string;

    if (organizationId) {
      const role = await getMemberRole(organizationId, session.user.id);

      if (!role) {
        return Response.json(
          { error: "You are not a member of that organization." },
          { status: 403 },
        );
      }
      if (!canManageTeam(role)) {
        return Response.json(
          { error: "Only organization owners and admins can manage billing." },
          { status: 403 },
        );
      }

      const team = await getOrganizationRecord(organizationId);
      if (!team) {
        return Response.json({ error: "That organization no longer exists." }, { status: 404 });
      }

      customerId = await ensureStripeCustomer({
        ownerType: "ORGANIZATION",
        ownerId: organizationId,
        name: team.name,
      });
    } else {
      customerId = await ensureStripeCustomer({
        ownerType: "USER",
        ownerId: session.user.id,
        email: session.user.email,
        name: session.user.name || session.user.email,
      });
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/dashboard/billing`,
    });

    return Response.json({ url: portal.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BillingConfigurationError) {
      console.error("[billing] portal is not configured:", error.message);
      return Response.json({ error: "Payments are not configured yet." }, { status: 503 });
    }

    console.error("[billing] portal session failed:", error);
    return Response.json(
      { error: "Could not open the billing portal. Try again." },
      { status: 500 },
    );
  }
}
