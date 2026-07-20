import { describe, it, expect, afterEach } from "vitest";
import { io as ioClient, type Socket } from "socket.io-client";
import type { Puzzle } from "@wordchain/shared";
import { createServer } from "../src/index.js";

const PUZZLE: Puzzle = {
  id: "test-puzzle",
  category: "Test",
  difficulty: "easy",
  words: ["HOT", "DOG", "KICK"],
  timeCapSeconds: 60,
};

describe("host:startRound", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function setupRoomWithHostAndPlayer() {
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
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    return { url, code, host, player, roomManager };
  }

  it("starts the round and broadcasts public rows without solutions", async () => {
    const { code, host, player, roomManager } = await setupRoomWithHostAndPlayer();

    const roundStartedPromise = new Promise<{ rows: unknown[]; puzzleId: string }>((resolve) => {
      player.once("round:started", resolve);
    });
    const response = await new Promise<{ success: boolean }>((resolve) => {
      host.emit("host:startRound", { puzzle: PUZZLE }, resolve);
    });

    expect(response.success).toBe(true);
    const payload = await roundStartedPromise;
    expect(payload.puzzleId).toBe("test-puzzle");
    expect(JSON.stringify(payload)).not.toContain("\"DOG\"");
    expect(roomManager.getRoom(code)?.currentRound?.puzzle.id).toBe("test-puzzle");
  });

  it("rejects host:startRound from a non-host socket", async () => {
    const { player } = await setupRoomWithHostAndPlayer();

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player.emit("host:startRound", { puzzle: PUZZLE }, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/host/i);
  });

  it("rejects a structurally invalid puzzle", async () => {
    const { host } = await setupRoomWithHostAndPlayer();
    const invalidPuzzle: Puzzle = { ...PUZZLE, words: ["HOT"] };

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit("host:startRound", { puzzle: invalidPuzzle }, resolve);
    });

    expect(response.success).toBe(false);
  });
});

describe("round ending", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("ends the round on host:endRound and broadcasts results", async () => {
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
    await new Promise<void>((resolve) => host.emit("host:startRound", { puzzle: PUZZLE }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    const resultsPromise = new Promise<{ results: unknown[] }>((resolve) => {
      player.once("round:results", resolve);
    });
    const response = await new Promise<{ success: boolean }>((resolve) => {
      host.emit("host:endRound", {}, resolve);
    });

    expect(response.success).toBe(true);
    expect((await resultsPromise).results).toHaveLength(1);
  });

  it("automatically ends the round when the time cap elapses", async () => {
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
      host.close();
      player.close();
      io.close();
      httpServer.close();
    };

    const resultsPromise = new Promise<{ results: unknown[] }>((resolve) => {
      player.once("round:results", resolve);
    });
    await new Promise<void>((resolve) =>
      host.emit("host:startRound", { puzzle: { ...PUZZLE, timeCapSeconds: 0.2 } }, () => resolve())
    );

    const results = await resultsPromise;
    expect(results.results).toHaveLength(1);
  }, 2000);
});
