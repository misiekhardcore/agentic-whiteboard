import { createAgentServer } from "./server";

const port = Number(process.env.AGENT_PORT ?? "3002");
const server = createAgentServer();

server.listen(port, "0.0.0.0", () => {
  console.log(`[agent] health listening on http://0.0.0.0:${port}/health`);
});
