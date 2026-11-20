import { createServer } from "node:http";

/**
 * A stand-in for the stack's broadcast endpoint during end-to-end runs: it
 * records what the app published and answers 202, so a spec can assert that a
 * capability's declared change keys really left the server, on the channel the
 * browser would have joined.
 *
 * It is not a Realtime server: a spec cannot observe delivery from it, only
 * publication. The delivery path needs the Supabase stack.
 */
const port = Number(process.env.BROADCAST_SINK_PORT ?? 3312);

/** Oldest first, so a spec reads the tail as the most recent change. */
const messages = [];

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200).end("ok");
    return;
  }

  if (request.method === "GET" && request.url === "/messages") {
    response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ messages }));
    return;
  }

  if (request.method === "POST" && request.url === "/realtime/v1/api/broadcast") {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString("utf8");
    });
    request.on("end", () => {
      let batch;
      try {
        batch = JSON.parse(body);
      } catch {
        response.writeHead(400).end("not json");
        return;
      }

      for (const message of batch.messages ?? []) {
        messages.push({
          topic: message.topic,
          keys: message.payload?.keys ?? [],
          private: message.private === true,
        });
      }

      response.writeHead(202, { "content-type": "application/json" }).end("{}");
    });
    return;
  }

  response.writeHead(404).end();
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Broadcast sink listening on 127.0.0.1:${port}`);
});
