import net from "node:net";

/**
 * A throwaway SMTP server for end-to-end runs: it accepts every message and
 * drops it. Sign-up sends a verification email, and in CI there is no Supabase
 * mail container to catch it.
 */
const port = Number(process.env.SMTP_SINK_PORT ?? 2500);

const server = net.createServer((socket) => {
  socket.write("220 localhost ESMTP sink\r\n");

  let buffer = "";
  let readingData = false;

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");

    let newline = buffer.indexOf("\r\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 2);
      newline = buffer.indexOf("\r\n");

      if (readingData) {
        if (line === ".") {
          readingData = false;
          socket.write("250 2.0.0 Message accepted\r\n");
        }
        continue;
      }

      const verb = line.slice(0, 4).toUpperCase();
      if (verb === "EHLO" || verb === "HELO") {
        socket.write("250-localhost\r\n250-PIPELINING\r\n250 8BITMIME\r\n");
      } else if (verb === "DATA") {
        readingData = true;
        socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
      } else if (verb === "QUIT") {
        socket.write("221 2.0.0 Bye\r\n");
        socket.end();
      } else {
        socket.write("250 2.0.0 OK\r\n");
      }
    }
  });

  socket.on("error", () => undefined);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`SMTP sink listening on 127.0.0.1:${port}`);
});
