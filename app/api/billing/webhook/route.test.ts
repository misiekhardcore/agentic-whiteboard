import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  applySubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  returning: vi.fn(),
  deleteWhere: vi.fn(),
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: mocks.constructEvent },
    subscriptions: { retrieve: vi.fn() },
  }),
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  applyStripeSubscription: mocks.applySubscription,
  markSubscriptionCanceled: mocks.cancelSubscription,
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({ returning: mocks.returning }),
      }),
    }),
    delete: () => ({ where: mocks.deleteWhere }),
  },
}));

vi.mock("@/lib/db/schema", () => ({ stripeEvents: { id: "id" } }));

import { POST } from "./route";

function webhookRequest(signature = "t=1,v1=abc"): Request {
  return new Request("http://localhost:3000/api/billing/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": signature,
      "content-type": "application/json",
    },
    body: JSON.stringify({ id: "evt_1" }),
  });
}

beforeEach(() => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test");

  mocks.returning.mockResolvedValue([{ id: "evt_1" }]);
  mocks.applySubscription.mockResolvedValue(undefined);
  mocks.cancelSubscription.mockResolvedValue(undefined);
  mocks.deleteWhere.mockResolvedValue(undefined);
  mocks.constructEvent.mockReturnValue({
    id: "evt_1",
    type: "customer.subscription.created",
    data: { object: { id: "sub_1" } },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("Stripe webhook", () => {
  it("reports a configuration error before checking the signature", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    const response = await POST(webhookRequest());

    expect(response.status).toBe(503);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it("rejects a request with no signature", async () => {
    const request = new Request("http://localhost:3000/api/billing/webhook", {
      method: "POST",
      body: "{}",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it("rejects a signature Stripe cannot verify", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const response = await POST(webhookRequest("t=1,v1=bad"));

    expect(response.status).toBe(400);
    expect(mocks.applySubscription).not.toHaveBeenCalled();
  });

  it("applies a subscription event one time", async () => {
    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(mocks.applySubscription).toHaveBeenCalledWith({
      id: "sub_1",
    });
  });

  it("acknowledges a replay without applying it again", async () => {
    mocks.returning.mockResolvedValue([]);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ duplicate: true });
    expect(mocks.applySubscription).not.toHaveBeenCalled();
  });

  it("records a canceled subscription", async () => {
    mocks.constructEvent.mockReturnValue({
      id: "evt_2",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1" } },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(mocks.cancelSubscription).toHaveBeenCalledWith({ id: "sub_1" });
  });

  it("lets Stripe retry when the handler fails", async () => {
    mocks.applySubscription.mockRejectedValue(new Error("database is down"));

    const response = await POST(webhookRequest());

    expect(response.status).toBe(500);
    expect(mocks.deleteWhere).toHaveBeenCalled();
  });
});
