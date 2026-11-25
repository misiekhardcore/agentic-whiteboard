import { createServer } from "node:http";

/**
 * A stand-in for the stack's storage service during end-to-end runs: it keeps
 * objects in memory and speaks the three calls the media adapter makes, so a
 * spec proves upload, read and delete through the app without a stack in the
 * job. It is not Storage: nothing is durable and no policy is enforced.
 */
const port = Number(process.env.MEDIA_STORAGE_PORT ?? 3313);

/** Every stored object, keyed the way the adapter addresses it. */
const objects = new Map();

const OBJECT_PATH = /^\/storage\/v1\/object\/([^/]+)\/([^/]+)$/;

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200).end("ok");
    return;
  }

  const match = OBJECT_PATH.exec(request.url ?? "");
  if (!match?.[1] || !match[2]) {
    response.writeHead(404).end();
    return;
  }

  const key = `${match[1]}/${match[2]}`;

  if (request.method === "POST") {
    const body = await readBody(request);
    objects.set(key, {
      body,
      contentType: request.headers["content-type"] ?? "application/octet-stream",
    });
    response.writeHead(200, { "content-type": "application/json" }).end("{}");
    return;
  }

  if (request.method === "GET") {
    const object = objects.get(key);
    if (!object) {
      response.writeHead(404).end("not found");
      return;
    }

    response.writeHead(200, { "content-type": object.contentType }).end(object.body);
    return;
  }

  if (request.method === "DELETE") {
    objects.delete(key);
    response.writeHead(200, { "content-type": "application/json" }).end("{}");
    return;
  }

  response.writeHead(405).end();
});

server.listen(port, "127.0.0.1", () => {
  console.info(`[media-bucket] listening on :${port}`);
});
