import { z } from "zod";

import { type CanvasSnapshot, canvasSnapshotSchema } from "@/lib/canvas/contracts";

const loadResponseSchema = z.object({
  revision: z.number().int().min(0),
  snapshot: canvasSnapshotSchema.nullable(),
});

const writeResponseSchema = z.object({ revision: z.number().int().min(0) });
const refusedResponseSchema = z.object({ currentRevision: z.number().int().min(0) });

export type CanvasAppClient = {
  load(workspaceId: string): Promise<{ revision: number; snapshot: CanvasSnapshot | null }>;
  save(
    workspaceId: string,
    input: { revision: number; snapshot: CanvasSnapshot },
  ): Promise<{ ok: true; revision: number } | { ok: false; currentRevision: number | null }>;
};

/**
 * The service's only way into the database: the app's snapshot route. The
 * revision protocol is spoken here — the service names what it last saw, and
 * the app answers with the revision that won when it names too little.
 */
export function createCanvasAppClient({
  appUrl,
  serviceSecret,
  fetch = globalThis.fetch,
}: {
  appUrl: string;
  serviceSecret: string;
  fetch?: typeof globalThis.fetch;
}): CanvasAppClient {
  const url = (workspaceId: string) =>
    `${appUrl}/api/canvas/${encodeURIComponent(workspaceId)}/snapshot`;

  const headers = {
    authorization: `Bearer ${serviceSecret}`,
    "content-type": "application/json",
  };

  return {
    async load(workspaceId) {
      const response = await fetch(url(workspaceId), { headers, cache: "no-store" });
      if (!response.ok) {
        throw new Error(`canvas snapshot load failed with status ${response.status}`);
      }

      return loadResponseSchema.parse(await response.json());
    },

    async save(workspaceId, input) {
      const response = await fetch(url(workspaceId), {
        method: "PUT",
        headers,
        body: JSON.stringify({ revision: input.revision, snapshot: input.snapshot }),
      });

      if (response.status === 409) {
        const refused = refusedResponseSchema.parse(await response.json());

        return { ok: false, currentRevision: refused.currentRevision };
      }

      if (!response.ok) {
        throw new Error(`canvas snapshot write failed with status ${response.status}`);
      }

      return { ok: true, ...writeResponseSchema.parse(await response.json()) };
    },
  };
}
