import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import { createServer } from "../src/index.js";

describe("player:joinRoom", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function setup(
    createPayload: { mode: "individual" | "team"; teams?: { id: string; name: string }[] } = { mode: "individual" }
  ) {
    const { httpServer, io, roomManager } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", createPayload, resolve);
    });

    cleanup = () => {
      host.close();
      io.close();
      httpServer.close();
    };

    return { url, code, host, roomManager };
  }

  it("adds the player to the room and acknowledges success", async () => {
    const { url, code, roomManager } = await setup();
    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));

    const response = await new Promise<{ success: boolean }>((resolve) => {
      player.emit("player:joinRoom", { code, nickname: "Alex" }, resolve);
    });

    expect(response.success).toBe(true);
    expect(roomManager.getRoom(code)?.getPlayers()).toHaveLength(1);
    player.close();
  });

  it("notifies the host when a player joins", async () => {
    const { url, code, host } = await setup();
    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));

    const joinedEventPromise = new Promise<{ nickname: string }>((resolve) => {
      host.once("room:playerJoined", resolve);
    });
    player.emit("player:joinRoom", { code, nickname: "Alex" }, () => {});

    const event = await joinedEventPromise;
    expect(event.nickname).toBe("Alex");
    player.close();
  });

  it("rejects joining a room that does not exist", async () => {
    const { url } = await setup();
    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player.emit("player:joinRoom", { code: "NOPE-00", nickname: "Alex" }, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/not found/i);
    player.close();
  });

  it("reconnects a disconnected player instead of creating a duplicate", async () => {
    const { url, code, roomManager } = await setup();
    const firstConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => firstConnection.on("connect", resolve));
    await new Promise<void>((resolve) =>
      firstConnection.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve())
    );
    firstConnection.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    roomManager.getRoom(code)!.setConnected(roomManager.getRoom(code)!.getPlayers()[0].socketId, false);

    const secondConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => secondConnection.on("connect", resolve));
    const response = await new Promise<{ success: boolean }>((resolve) => {
      secondConnection.emit("player:joinRoom", { code, nickname: "Alex" }, resolve);
    });

    expect(response.success).toBe(true);
    expect(roomManager.getRoom(code)?.getPlayers()).toHaveLength(1);
    secondConnection.close();
  });

  it("does not merge a same-nickname join into a disconnected player's slot when the session token doesn't match", async () => {
    const { url, code, roomManager } = await setup();
    const firstConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => firstConnection.on("connect", resolve));
    await new Promise<void>((resolve) =>
      firstConnection.emit("player:joinRoom", { code, nickname: "Alex", sessionToken: "alex-token" }, () => resolve())
    );
    firstConnection.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
    roomManager.getRoom(code)!.setConnected(roomManager.getRoom(code)!.getPlayers()[0].socketId, false);

    const impostorConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => impostorConnection.on("connect", resolve));
    const response = await new Promise<{ success: boolean }>((resolve) => {
      impostorConnection.emit(
        "player:joinRoom",
        { code, nickname: "Alex", sessionToken: "someone-elses-token" },
        resolve
      );
    });

    expect(response.success).toBe(true);
    // Treated as a brand new player rather than reclaiming Alex's disconnected slot.
    expect(roomManager.getRoom(code)?.getPlayers()).toHaveLength(2);
    impostorConnection.close();
  });

  it("includes the active round and the player's own board when reconnecting mid-round", async () => {
    const { url, code, roomManager } = await setup();
    const firstConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => firstConnection.on("connect", resolve));
    await new Promise<void>((resolve) =>
      firstConnection.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve())
    );

    const room = roomManager.getRoom(code)!;
    room.startRound(
      { id: "p1", category: "Test", difficulty: "easy", words: ["HOT", "DOG", "KICK"], timeCapSeconds: 60 },
      false
    );
    room.setConnected(firstConnection.id!, false);
    firstConnection.close();

    const secondConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => secondConnection.on("connect", resolve));
    const response = await new Promise<{
      success: boolean;
      activeRound?: { puzzleId: string };
      boardView?: { topSolved: number };
    }>((resolve) => {
      secondConnection.emit("player:joinRoom", { code, nickname: "Alex" }, resolve);
    });

    expect(response.activeRound?.puzzleId).toBe("p1");
    expect(response.boardView?.topSolved).toBe(0);
    secondConnection.close();
  });

  it("returns the player's teamId on reconnect, so the client can restore it", async () => {
    const { url, code, roomManager } = await setup({ mode: "team", teams: [{ id: "t1", name: "Red Team" }] });
    const firstConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => firstConnection.on("connect", resolve));
    await new Promise<void>((resolve) =>
      firstConnection.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve())
    );
    await new Promise<void>((resolve) =>
      firstConnection.emit("player:selectTeam", { teamId: "t1" }, () => resolve())
    );
    roomManager.getRoom(code)!.setConnected(firstConnection.id!, false);
    firstConnection.close();

    const secondConnection: Socket = ioClient(url);
    await new Promise<void>((resolve) => secondConnection.on("connect", resolve));
    const response = await new Promise<{ success: boolean; teamId?: string | null }>((resolve) => {
      secondConnection.emit("player:joinRoom", { code, nickname: "Alex" }, resolve);
    });

    expect(response.teamId).toBe("t1");
    secondConnection.close();
  });

  it("returns teamId: null for a brand new player who hasn't picked a team yet", async () => {
    const { url, code } = await setup({ mode: "team", teams: [{ id: "t1", name: "Red Team" }] });
    const connection: Socket = ioClient(url);
    await new Promise<void>((resolve) => connection.on("connect", resolve));
    const response = await new Promise<{ success: boolean; teamId?: string | null }>((resolve) => {
      connection.emit("player:joinRoom", { code, nickname: "Alex" }, resolve);
    });

    expect(response.teamId).toBeNull();
    connection.close();
  });
});

describe("player:selectTeam", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("assigns the player to a team and broadcasts the update", async () => {
    const { httpServer, io, roomManager } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "team", teams: [{ id: "t1", name: "Red Team" }] }, resolve);
    });

    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    const updatedEventPromise = new Promise<{ teamId: string | null }>((resolve) => {
      player.once("room:playerUpdated", resolve);
    });
    const response = await new Promise<{ success: boolean }>((resolve) => {
      player.emit("player:selectTeam", { teamId: "t1" }, resolve);
    });

    expect(response.success).toBe(true);
    expect((await updatedEventPromise).teamId).toBe("t1");
    expect(roomManager.getRoom(code)?.getPlayers()[0].teamId).toBe("t1");
  });

  it("rejects selecting a team that does not exist", async () => {
    const { httpServer, io } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "team", teams: [{ id: "t1", name: "Red Team" }] }, resolve);
    });

    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player.emit("player:selectTeam", { teamId: "unknown" }, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/does not exist/);
  });
});
