import { describe, expect, it } from "vitest";

import { authorizeCanvasServiceRequest } from "./authorizeCanvasServiceRequest";

const secret = "canvas-service-secret";

describe("a canvas service request", () => {
  it("is authorized by its bearer credential", () => {
    expect(authorizeCanvasServiceRequest({ authorization: `Bearer ${secret}`, secret })).toBe(true);
  });

  it("is refused without the credential or with another one", () => {
    expect(authorizeCanvasServiceRequest({ authorization: null, secret })).toBe(false);
    expect(authorizeCanvasServiceRequest({ authorization: secret, secret })).toBe(false);
    expect(authorizeCanvasServiceRequest({ authorization: "Bearer another", secret })).toBe(false);
  });

  it("is refused when the deployment has no secret to compare with", () => {
    expect(authorizeCanvasServiceRequest({ authorization: "Bearer ", secret: "" })).toBe(false);
  });
});
