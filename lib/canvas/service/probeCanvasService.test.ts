import { describe, expect, it, vi } from "vitest";

import { probeCanvasService } from "./probeCanvasService";

const httpOrigin = "http://localhost:4100";

describe("probing the canvas service", () => {
  it("is up when its health read answers", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));

    await expect(probeCanvasService({ httpOrigin, fetch })).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      `${httpOrigin}/health`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("is down when the service does not answer", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(probeCanvasService({ httpOrigin, fetch })).resolves.toBe(false);
  });

  it("is down when its health read is not ok", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }));

    await expect(probeCanvasService({ httpOrigin, fetch })).resolves.toBe(false);
  });
});
