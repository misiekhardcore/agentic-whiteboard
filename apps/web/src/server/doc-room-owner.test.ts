import { RoomOwnerError } from "@v2/contracts";
import type { ContentOp, RoomRef } from "@v2/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { createDocRoomOwner } from "./doc-room-owner";
import type { DocService } from "./doc-service";

const service: DocService = {
  wsUrl: "ws://127.0.0.1:3003",
  httpUrl: "http://127.0.0.1:3003",
  secret: "doc-secret",
};

const room: RoomRef = { kind: "doc", id: "doc-1", accountId: "account-1" };
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(respond: () => Response): { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return Promise.resolve(respond());
  };
  globalThis.fetch = fetchImpl;

  return { calls };
}

const appendOp: ContentOp = {
  kind: "append-block",
  payload: {
    block: { id: "block-2", kind: "paragraph", level: null, text: "From the server" },
  },
};

describe("createDocRoomOwner", () => {
  it("reads a snapshot's content and maps its revision", async () => {
    const { calls } = stubFetch(() =>
      Response.json({
        revision: 4,
        content: {
          blocks: [
            {
              id: "block-1",
              kind: "paragraph",
              level: null,
              text: "Product brief",
              updatedBy: null,
            },
          ],
        },
      }),
    );

    const snapshot = await createDocRoomOwner(service).snapshot(room);

    expect(snapshot.revision).toBe("rev-4");
    expect(snapshot.content).toMatchObject({ blocks: [{ id: "block-1" }] });
    expect(calls[0]?.url).toBe("http://127.0.0.1:3003/snapshot/doc-1");
    expect((calls[0]?.init?.headers as Record<string, string>).authorization).toBe(
      "Bearer doc-secret",
    );
  });

  it("sends the apply batch with the service credential and maps the result", async () => {
    const { calls } = stubFetch(() => Response.json({ revision: 5, applied: 1 }));

    const result = await createDocRoomOwner(service).apply({
      room,
      actor: { type: "user", userId: "user-1", accountId: "account-1" },
      idempotencyKey: "op-1",
      ops: [appendOp],
    });

    expect(result).toEqual({ revision: "rev-5", applied: 1 });
    expect(calls[0]?.url).toBe("http://127.0.0.1:3003/apply/doc-1");
    expect((calls[0]?.init?.headers as Record<string, string>).authorization).toBe(
      "Bearer doc-secret",
    );
    expect(JSON.parse(calls[0]?.init?.body as string)).toMatchObject({
      idempotencyKey: "op-1",
      ops: [appendOp],
    });
  });

  it("saves through the service credential and maps the revision", async () => {
    const { calls } = stubFetch(() => Response.json({ revision: 6 }));

    const saved = await createDocRoomOwner(service).save(room);

    expect(saved).toEqual({ revision: "rev-6" });
    expect(calls[0]?.url).toBe("http://127.0.0.1:3003/save/doc-1");
    expect(calls[0]?.init?.method).toBe("POST");
    expect((calls[0]?.init?.headers as Record<string, string>).authorization).toBe(
      "Bearer doc-secret",
    );
  });

  it("reports an invalid batch as invalid-ops", async () => {
    stubFetch(() => Response.json({ error: "bad batch", code: "invalid-ops" }, { status: 400 }));

    await expect(
      createDocRoomOwner(service).apply({
        room,
        actor: { type: "user", userId: "user-1", accountId: "account-1" },
        idempotencyKey: "op-1",
        ops: [appendOp],
      }),
    ).rejects.toMatchObject({ code: "invalid-ops" } satisfies Partial<RoomOwnerError>);
  });
});
