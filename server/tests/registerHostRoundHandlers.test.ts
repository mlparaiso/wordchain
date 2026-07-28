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

  it("immediately pushes each entrant's starting board, including the free middle-letter reveal", async () => {
    const { host, player } = await setupRoomWithHostAndPlayer();

    // PUZZLE's only blank (DOG, row 1) is the chain's middle blank, so it starts with
    // its first letter already revealed (see createChainState) — clients can't compute
    // that themselves since they don't know the answer, so the server must push it
    // rather than leaving the player's own optimistic empty-board guess to stand.
    const playerUpdatePromise = new Promise<{ entrantId: string; view: { revealedText: Record<number, string> } }>(
      (resolve) => player.once("board:updated", resolve)
    );
    const hostUpdatePromise = new Promise<{ entrantId: string; view: { revealedText: Record<number, string> } }>(
      (resolve) => host.once("board:updated", resolve)
    );
    await new Promise<void>((resolve) => host.emit("host:startRound", { puzzle: PUZZLE }, () => resolve()));

    expect((await playerUpdatePromise).view.revealedText[1]).toBe("D");
    expect((await hostUpdatePromise).view.revealedText[1]).toBe("D");
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

  it("rejects starting a round while one is already in progress (e.g. a double-clicked Start button)", async () => {
    const { host } = await setupRoomWithHostAndPlayer();
    await new Promise<void>((resolve) => host.emit("host:startRound", { puzzle: PUZZLE }, () => resolve()));

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      host.emit("host:startRound", { puzzle: PUZZLE }, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/already in progress/i);
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

  it("does not let a manually-ended round's stale auto-timer prematurely end the next round", async () => {
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

    // Start round A with a short time cap, then manually end it early.
    await new Promise<void>((resolve) =>
      host.emit("host:startRound", { puzzle: { ...PUZZLE, id: "round-a", timeCapSeconds: 0.2 } }, () => resolve())
    );
    await new Promise<void>((resolve) => host.emit("host:endRound", {}, () => resolve()));

    // Start round B immediately after, before round A's original timer would have fired.
    await new Promise<void>((resolve) =>
      host.emit("host:startRound", { puzzle: { ...PUZZLE, id: "round-b", timeCapSeconds: 5 } }, () => resolve())
    );

    // Wait past round A's original 0.2s time cap; its stale timer must not touch round B.
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(roomManager.getRoom(code)?.currentRound?.puzzle.id).toBe("round-b");
  }, 2000);

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

describe("session ending", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("removes the room and tells everyone still in it when host:endSession fires", async () => {
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

    const sessionEndedPromise = new Promise<void>((resolve) => {
      player.once("room:sessionEnded", () => resolve());
    });
    const response = await new Promise<{ success: boolean }>((resolve) => {
      host.emit("host:endSession", {}, resolve);
    });

    expect(response.success).toBe(true);
    await sessionEndedPromise;
    expect(roomManager.getRoom(code)).toBeUndefined();
  });

  it("rejects host:endSession from a non-host socket", async () => {
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

    const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      player.emit("host:endSession", {}, resolve);
    });

    expect(response.success).toBe(false);
    expect(response.error).toMatch(/host/i);
  });

  it("removes the host's socket from the old room's broadcast channel, so a stray update can't leak into a new room", async () => {
    const { httpServer, io } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const { code: oldCode } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });

    cleanup = () => {
      host.close();
      io.close();
      httpServer.close();
    };

    await new Promise<void>((resolve) => host.emit("host:endSession", {}, () => resolve()));

    // Host starts a second room on the same socket, as happens when they host again right away.
    const { code: newCode } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", { mode: "individual" }, resolve);
    });
    expect(newCode).not.toBe(oldCode);

    let leaked = false;
    host.once("room:playerUpdated", () => {
      leaked = true;
    });
    // Simulate a stray broadcast to the old room's channel (e.g. a departing player's own
    // disconnect handling) — the host must no longer be a member of it to receive this.
    io.to(oldCode).emit("room:playerUpdated", { socketId: "ghost", nickname: "Ghost", teamId: null, connected: false });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(leaked).toBe(false);
  });
});
