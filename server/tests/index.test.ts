import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { createServer } from "../src/index.js";

describe("server bootstrap", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("accepts a socket.io connection", async () => {
    const { httpServer, io } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const port = address.port;

    const client: Socket = ioClient(`http://localhost:${port}`);
    cleanup = () => {
      client.close();
      io.close();
      httpServer.close();
    };

    await new Promise<void>((resolve, reject) => {
      client.on("connect", () => resolve());
      client.on("connect_error", reject);
    });

    expect(client.connected).toBe(true);
  });
});
