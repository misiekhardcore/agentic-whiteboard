import { describe, expect, it } from "vitest";

import { createAgentServer } from "./server";

async function withServer<T>(run: (url: string) => Promise<T>): Promise<T> {
  const server = createAgentServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("The test server did not bind a TCP port");
  }

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
  }
}

describe("the agent service", () => {
  it("answers its health check", async () => {
    const response = await withServer((url) => fetch(`${url}/health`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok", service: "agent" });
  });

  it("has no other surface", async () => {
    const response = await withServer((url) => fetch(`${url}/`));

    expect(response.status).toBe(404);
  });
});
