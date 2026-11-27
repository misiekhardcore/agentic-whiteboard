import type {
  ApplyInput,
  ApplyResult,
  ContentOp,
  DocProjection,
  JsonValue,
  RoomOwnerErrorCode,
  RoomOwnerPort,
  RoomRef,
  Snapshot,
} from "@v2/contracts";
import { RoomOwnerError } from "@v2/contracts";
import type { RoomOwnerFixture } from "@v2/contracts/conformance";
import { describeRoomOwnerContract } from "@v2/contracts/conformance";
import { afterAll, beforeAll } from "vitest";
import * as Y from "yjs";

import { createBlockElement, DOC_BLOCKS_FIELD } from "./doc-blocks";
import { createDocService } from "./service";
import type { DocService } from "./service";
import { memoryStores } from "./test-support/memory-stores";

const secret = "doc-secret";
const stores = memoryStores();
let service: DocService;
let base = "";

beforeAll(async () => {
  service = createDocService({
    snapshots: stores.snapshots,
    leaseStore: stores.leaseStore,
    secret,
    instanceId: "conformance",
    debounceMs: 10,
    maxDebounceMs: 20,
    renewMs: 60_000,
    log: () => undefined,
  });
  const port = await service.listen(0);
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await service.destroy();
});

const seedBlock = {
  id: "block-1",
  kind: "paragraph" as const,
  level: null,
  text: "Product brief",
  updatedBy: null,
};

const seedContent: DocProjection = { blocks: [seedBlock] };

function seedState(): Uint8Array {
  const document = new Y.Doc();
  document
    .getXmlFragment(DOC_BLOCKS_FIELD)
    .push([
      createBlockElement(
        { id: seedBlock.id, kind: seedBlock.kind, level: seedBlock.level, text: seedBlock.text },
        null,
      ),
    ]);
  return Y.encodeStateAsUpdate(document);
}

async function errorFor(response: Response): Promise<RoomOwnerError> {
  let code: RoomOwnerErrorCode = "apply-refused";

  try {
    const body = (await response.json()) as { code?: unknown };
    if (
      body.code === "invalid-ops" ||
      body.code === "room-not-found" ||
      body.code === "room-revoked" ||
      body.code === "apply-refused"
    ) {
      code = body.code;
    }
  } catch {
    // The status still reports the refusal.
  }

  return new RoomOwnerError(code, `The document service answered ${response.status}.`);
}

function serviceOwner(): RoomOwnerPort {
  const authorization = `Bearer ${secret}`;

  return {
    async snapshot(reference: RoomRef): Promise<Snapshot> {
      const response = await fetch(`${base}/snapshot/${reference.id}`, {
        headers: { authorization },
      });
      if (!response.ok) throw await errorFor(response);

      const body = (await response.json()) as { revision: number; content: JsonValue };
      return { room: reference, revision: `rev-${body.revision}`, content: body.content };
    },

    async apply(input: ApplyInput): Promise<ApplyResult> {
      const response = await fetch(`${base}/apply/${input.room.id}`, {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify({
          actor: input.actor,
          idempotencyKey: input.idempotencyKey,
          ops: input.ops,
        }),
      });
      if (!response.ok) throw await errorFor(response);

      const body = (await response.json()) as { revision: number; applied: number };
      return { revision: `rev-${body.revision}`, applied: body.applied };
    },

    async save(reference: RoomRef): Promise<{ revision: string }> {
      const response = await fetch(`${base}/save/${reference.id}`, {
        method: "POST",
        headers: { authorization },
      });
      if (!response.ok) throw await errorFor(response);

      const body = (await response.json()) as { revision: number };
      return { revision: `rev-${body.revision}` };
    },

    async revoke(reference: RoomRef): Promise<void> {
      const response = await fetch(`${base}/revoke/${reference.id}`, {
        method: "POST",
        headers: { authorization },
      });
      if (!response.ok) throw await errorFor(response);
    },
  };
}

let fixtureNumber = 0;

describeRoomOwnerContract("the document room owner", () => {
  const room: RoomRef = {
    kind: "doc",
    id: `doc-conformance-${fixtureNumber++}`,
    accountId: "account-1",
  };

  stores.rooms.add(room.id);
  stores.state.set(room.id, seedState());

  const applyOps: ContentOp[] = [
    {
      kind: "append-block",
      payload: {
        block: { id: "block-2", kind: "paragraph", level: null, text: "Reviewed brief" },
      },
    },
  ];
  const invalidOps: ContentOp[] = [
    {
      kind: "append-block",
      payload: {
        block: { id: "block-3", kind: "paragraph", level: null, text: "Must not land" },
      },
    },
    {
      kind: "replace-block",
      payload: {
        blockId: "block-missing",
        block: { id: "block-missing", kind: "paragraph", level: null, text: "No target" },
      },
    },
  ];

  const fixture: RoomOwnerFixture = {
    owner: serviceOwner(),
    room,
    actor: { type: "user", userId: "user-1", accountId: "account-1" },
    seedContent,
    applyOps,
    appliedContent: {
      blocks: [
        seedBlock,
        {
          id: "block-2",
          kind: "paragraph",
          level: null,
          text: "Reviewed brief",
          updatedBy: "user:user-1",
        },
      ],
    },
    invalidOps,
  };

  return fixture;
});
