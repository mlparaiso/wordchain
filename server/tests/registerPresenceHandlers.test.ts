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

  it("tears down the room and notifies remaining players when the host disconnects", async () => {
    const { httpServer, io, roomManager } = createServer();
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
      player.close();
      io.close();
      httpServer.close();
    };

    const hostLeftPromise = new Promise<void>((resolve) => player.once("room:hostLeft", () => resolve()));
    host.close();

    await hostLeftPromise;
    expect(roomManager.getRoom(code)).toBeUndefined();
  }, 2000);

  it("clears the round timeout when the host disconnects mid-round, instead of letting it fire against the torn-down room", async () => {
    const { httpServer, io } = createServer();
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
      player.close();
      io.close();
      httpServer.close();
    };

    // A very short time cap so, if the round timeout is NOT cleared, endRound would fire
    // (and broadcast round:results) well within this test's wait window below.
    await new Promise<void>((resolve) =>
      host.emit(
        "host:startRound",
        { puzzle: { id: "p1", category: "Test", difficulty: "easy", words: ["HOT", "DOG", "KICK"], timeCapSeconds: 0.05 } },
        () => resolve()
      )
    );

    let sawResults = false;
    player.on("round:results", () => {
      sawResults = true;
    });
    host.close();
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(sawResults).toBe(false);
  }, 2000);

  it("removes remaining sockets from the room's broadcast channel when the host disconnects", async () => {
    const { httpServer, io } = createServer();
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
      player.close();
      io.close();
      httpServer.close();
    };

    const hostLeftPromise = new Promise<void>((resolve) => player.once("room:hostLeft", () => resolve()));
    host.close();
    await hostLeftPromise;

    let leaked = false;
    player.once("room:playerUpdated", () => {
      leaked = true;
    });
    // Simulate a stray broadcast to the old room's channel (e.g. a departing player's own
    // disconnect handling, or — before this fix — an orphaned round timeout firing).
    io.to(code).emit("room:playerUpdated", { socketId: "ghost", nickname: "Ghost", teamId: null, connected: false });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(leaked).toBe(false);
  }, 2000);
});
