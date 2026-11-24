import {
  type CanvasSnapshotLoad,
  canvasSnapshotLoadSchema,
  canvasSnapshotRefusedSchema,
  canvasSnapshotSavedSchema,
  type CanvasSnapshotWrite,
  type CanvasSnapshotWriteResult,
} from "@/lib/canvas/contracts";

export type CanvasAppClient = {
  load(workspaceId: string): Promise<CanvasSnapshotLoad>;
  save(workspaceId: string, input: CanvasSnapshotWrite): Promise<CanvasSnapshotWriteResult>;
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

      return canvasSnapshotLoadSchema.parse(await response.json());
    },

    async save(workspaceId, input) {
      const response = await fetch(url(workspaceId), {
        method: "PUT",
        headers,
        body: JSON.stringify({ revision: input.revision, snapshot: input.snapshot }),
      });

      if (response.status === 409) {
        const refused = canvasSnapshotRefusedSchema.parse(await response.json());

        return { ok: false, currentRevision: refused.currentRevision };
      }

      if (!response.ok) {
        throw new Error(`canvas snapshot write failed with status ${response.status}`);
      }

      return { ok: true, ...canvasSnapshotSavedSchema.parse(await response.json()) };
    },
  };
}
