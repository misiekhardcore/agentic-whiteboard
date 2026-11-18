/**
 * A scripted OpenAI-compatible endpoint for the e2e suite and local demos.
 *
 * The app has one provider path: HTTP chat completions. Tests therefore point
 * `AI_BASE_URL` here instead of shipping a fake model in `lib/`, so what the
 * suite exercises is the same contract production uses.
 *
 *   node scripts/scripted-model/server.mjs
 *
 * Env:
 *   SCRIPTED_MODEL_PORT        port to listen on (default 3311)
 *   SCRIPTED_DELAY_MS          hold the first chunk back (default 0)
 *   SCRIPTED_CHUNK_DELAY_MS    gap between word deltas (default 0)
 */
import { createServer } from "node:http";

import { SCRIPTED_MODEL_ID, chooseReply } from "./policy.mjs";

const port = Number(process.env.SCRIPTED_MODEL_PORT ?? 3311);
const initialDelayMs = positive(process.env.SCRIPTED_DELAY_MS);
const chunkDelayMs = positive(process.env.SCRIPTED_CHUNK_DELAY_MS);

const USAGE = { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 };

function positive(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function sleep(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function usage() {
  return {
    prompt_tokens: USAGE.prompt_tokens,
    completion_tokens: USAGE.completion_tokens,
    total_tokens: USAGE.total_tokens,
  };
}

function completion(reply, model) {
  const message =
    reply.kind === "tool"
      ? {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: `scripted-${reply.name}`,
              type: "function",
              function: { name: reply.name, arguments: JSON.stringify(reply.input) },
            },
          ],
        }
      : { role: "assistant", content: reply.text };

  return {
    id: "chatcmpl-scripted",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: reply.kind === "tool" ? "tool_calls" : "stop",
      },
    ],
    usage: usage(),
  };
}

function streamFrames(reply, model) {
  const base = {
    id: "chatcmpl-scripted",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
  };

  const frames = [];
  const push = (delta, finishReason = null) =>
    frames.push({ ...base, choices: [{ index: 0, delta, finish_reason: finishReason }] });

  if (reply.kind === "tool") {
    const encoded = JSON.stringify(reply.input);
    push({
      role: "assistant",
      tool_calls: [
        {
          index: 0,
          id: `scripted-${reply.name}`,
          type: "function",
          function: { name: reply.name, arguments: "" },
        },
      ],
    });
    push({ tool_calls: [{ index: 0, function: { arguments: encoded } }] });
    push({}, "tool_calls");
  } else {
    push({ role: "assistant", content: "" });
    for (const word of reply.text.match(/\S+\s*/g) ?? []) push({ content: word });
    push({}, "stop");
  }

  frames.push({ ...base, choices: [], usage: usage() });
  return frames;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = createServer((request, response) => {
  void (async () => {
    const url = request.url ?? "";

    if (request.method === "GET" && (url === "/health" || url === "/")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok", model: SCRIPTED_MODEL_ID }));
      return;
    }

    if (request.method === "GET" && url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          object: "list",
          data: [{ id: SCRIPTED_MODEL_ID, object: "model", owned_by: "scripted" }],
        }),
      );
      return;
    }

    if (request.method !== "POST" || !url.startsWith("/v1/chat/completions")) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "not found" } }));
      return;
    }

    const body = await readBody(request);
    const model = typeof body.model === "string" ? body.model : SCRIPTED_MODEL_ID;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const offeredTools = Array.isArray(body.tools)
      ? body.tools
          .map((candidate) => candidate?.function?.name)
          .filter((name) => typeof name === "string")
      : [];

    const reply = chooseReply({ messages, offeredTools });

    if (body.stream !== true) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(completion(reply, model)));
      return;
    }

    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    await sleep(initialDelayMs);
    for (const frame of streamFrames(reply, model)) {
      response.write(`data: ${JSON.stringify(frame)}\n\n`);
      await sleep(chunkDelayMs);
    }
    response.end("data: [DONE]\n\n");
  })().catch((error) => {
    console.error("[scripted-model] request failed", error);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[scripted-model] listening on http://127.0.0.1:${port}/v1`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
