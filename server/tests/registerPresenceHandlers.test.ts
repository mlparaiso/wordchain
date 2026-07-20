import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { createServer } from "../src/index.js";

describe("presence on disconnect", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("marks a player disconnected (not removed) immediately, then removes them after the grace period", async () => {
    const { httpServer, io } = createServer({ presenceGracePeriodMs: 100 });
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });

    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

    cleanup = () => {
      host.close();
      io.close();
      httpServer.close();
    };

    const updatedPromise = new Promise<{ connected: boolean }>((resolve) => {
      host.once("room:playerUpdated", resolve);
    });
    const leftPromise = new Promise<{ socketId: string }>((resolve) => {
      host.once("room:playerLeft", resolve);
    });

    player.close();

    expect((await updatedPromise).connected).toBe(false);
    await leftPromise;
  }, 2000);
});
