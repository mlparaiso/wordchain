import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { createServer } from "../src/index.js";

describe("host:createRoom", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function connectClient() {
    const { httpServer, io, roomManager } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;
    const client: Socket = ioClient(url);
    await new Promise<void>((resolve) => client.on("connect", resolve));
    cleanup = () => {
      client.close();
      io.close();
      httpServer.close();
    };
    return { client, roomManager, url };
  }

  it("creates a room and returns a room code", async () => {
    const { client, roomManager } = await connectClient();

    const response = await new Promise<{ code?: string; error?: string }>((resolve) => {
      client.emit("host:createRoom", { mode: "individual" }, resolve);
    });

    expect(response.code).toMatch(/^[A-Z]+-\d{2}$/);
    expect(roomManager.getRoom(response.code!)?.mode).toBe("individual");
  });

  it("stores the provided teams when creating a team-mode room", async () => {
    const { client, roomManager } = await connectClient();
    const teams = [{ id: "t1", name: "Red Team" }];

    const response = await new Promise<{ code?: string }>((resolve) => {
      client.emit("host:createRoom", { mode: "team", teams }, resolve);
    });

    expect(roomManager.getRoom(response.code!)?.teams).toEqual(teams);
  });

  describe("host:kickPlayer", () => {
    it("removes the player and broadcasts room:playerLeft", async () => {
      const { client: host, roomManager } = await connectClient();
      const { code } = await new Promise<{ code: string }>((resolve) => {
        host.emit("host:createRoom", { mode: "individual" }, resolve);
      });

      const room = roomManager.getRoom(code)!;
      room.addPlayer("fake-player-socket", "Troll");

      const leftPromise = new Promise<{ socketId: string }>((resolve) => host.once("room:playerLeft", resolve));
      const response = await new Promise<{ success: boolean }>((resolve) => {
        host.emit("host:kickPlayer", { socketId: "fake-player-socket" }, resolve);
      });

      expect(response.success).toBe(true);
      expect((await leftPromise).socketId).toBe("fake-player-socket");
      expect(room.getPlayers()).toHaveLength(0);
    });

    it("rejects a kick from a non-host socket", async () => {
      const { client: host, url } = await connectClient();
      const { code } = await new Promise<{ code: string }>((resolve) => {
        host.emit("host:createRoom", { mode: "individual" }, resolve);
      });

      const impostor: Socket = ioClient(url);
      await new Promise<void>((resolve) => impostor.on("connect", resolve));
      await new Promise<void>((resolve) => impostor.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

      const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        impostor.emit("host:kickPlayer", { socketId: "someone" }, resolve);
      });

      expect(response.success).toBe(false);
      expect(response.error).toMatch(/host/i);
      impostor.close();
    });
  });
});
