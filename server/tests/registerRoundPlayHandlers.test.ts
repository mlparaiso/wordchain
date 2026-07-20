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

describe("player:submitGuess", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  async function setupActiveRound(mode: "individual" | "team" = "individual") {
    const { httpServer, io, roomManager } = createServer();
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no port");
    const url = `http://localhost:${address.port}`;

    const host: Socket = ioClient(url);
    await new Promise<void>((resolve) => host.on("connect", resolve));
    const createPayload =
      mode === "team" ? { mode, teams: [{ id: "t1", name: "Red Team" }] } : { mode };
    const { code } = await new Promise<{ code: string }>((resolve) => {
      host.emit("host:createRoom", createPayload, resolve);
    });

    const player: Socket = ioClient(url);
    await new Promise<void>((resolve) => player.on("connect", resolve));
    await new Promise<void>((resolve) => player.emit("player:joinRoom", { code, nickname: "Alex" }, () => resolve()));

    let teammate: Socket | undefined;
    if (mode === "team") {
      await new Promise<void>((resolve) => player.emit("player:selectTeam", { teamId: "t1" }, () => resolve()));
      teammate = ioClient(url);
      await new Promise<void>((resolve) => teammate!.on("connect", resolve));
      await new Promise<void>((resolve) =>
        teammate!.emit("player:joinRoom", { code, nickname: "Sam" }, () => resolve())
      );
      await new Promise<void>((resolve) => teammate!.emit("player:selectTeam", { teamId: "t1" }, () => resolve()));
    }

    await new Promise<void>((resolve) => host.emit("host:startRound", { puzzle: PUZZLE }, () => resolve()));

    cleanup = () => {
      host.close();
      player.close();
      teammate?.close();
      io.close();
      httpServer.close();
    };

    return { host, player, teammate, roomManager, code };
  }

  it("accepts a correct guess and broadcasts the updated board", async () => {
    const { player } = await setupActiveRound();

    const updatePromise = new Promise<{ entrantId: string; view: { topSolved: number } }>((resolve) => {
      player.once("board:updated", resolve);
    });
    const response = await new Promise<{ success: boolean; correct: boolean }>((resolve) => {
      player.emit("player:submitGuess", { rowIndex: 1, guess: "dog" }, resolve);
    });

    expect(response).toEqual({ success: true, correct: true });
    expect((await updatePromise).view.topSolved).toBe(1);
  });

  it("penalizes a wrong guess without advancing the pointer", async () => {
    const { player } = await setupActiveRound();

    const updatePromise = new Promise<{ view: { topSolved: number; penaltySeconds: number } }>((resolve) => {
      player.once("board:updated", resolve);
    });
    const response = await new Promise<{ correct: boolean }>((resolve) => {
      player.emit("player:submitGuess", { rowIndex: 1, guess: "CAT" }, resolve);
    });

    expect(response.correct).toBe(false);
    const update = await updatePromise;
    expect(update.view.topSolved).toBe(0);
    expect(update.view.penaltySeconds).toBe(3);
  });

  it("emits player:chainComplete once the last row is solved", async () => {
    const { player } = await setupActiveRound();

    const completePromise = new Promise<{ entrantId: string }>((resolve) => {
      player.once("player:chainComplete", resolve);
    });
    await new Promise<void>((resolve) => player.emit("player:submitGuess", { rowIndex: 1, guess: "DOG" }, () => resolve()));

    expect((await completePromise).entrantId).toBe(player.id);
  });

  it("rejects a guess on a row that is not active", async () => {
    const { player } = await setupActiveRound();
    const response = await new Promise<{ success: boolean }>((resolve) => {
      player.emit("player:submitGuess", { rowIndex: 0, guess: "HOT" }, resolve);
    });
    expect(response.success).toBe(false);
  });

  it("shares one board across teammates", async () => {
    const { player, teammate } = await setupActiveRound("team");

    const teammateUpdatePromise = new Promise<{ view: { topSolved: number } }>((resolve) => {
      teammate!.once("board:updated", resolve);
    });
    await new Promise<void>((resolve) => player.emit("player:submitGuess", { rowIndex: 1, guess: "DOG" }, () => resolve()));

    expect((await teammateUpdatePromise).view.topSolved).toBe(1);
  });

  describe("player:useHint", () => {
    it("reveals the next letter and applies the hint penalty", async () => {
      const { player } = await setupActiveRound();

      const updatePromise = new Promise<{ view: { revealedText: Record<number, string>; penaltySeconds: number } }>(
        (resolve) => player.once("board:updated", resolve)
      );
      const response = await new Promise<{ success: boolean }>((resolve) => {
        player.emit("player:useHint", { rowIndex: 1 }, resolve);
      });

      expect(response.success).toBe(true);
      const update = await updatePromise;
      expect(update.view.revealedText[1]).toBe("D");
      expect(update.view.penaltySeconds).toBe(5);
    });

    it("rejects a hint on a row that is not active", async () => {
      const { player } = await setupActiveRound();
      const response = await new Promise<{ success: boolean }>((resolve) => {
        player.emit("player:useHint", { rowIndex: 0 }, resolve);
      });
      expect(response.success).toBe(false);
    });
  });

  describe("player:typing", () => {
    it("broadcasts to teammates but not back to the sender", async () => {
      const { player, teammate } = await setupActiveRound("team");

      const teammateEventPromise = new Promise<{ entrantId: string; nickname: string; rowIndex: number }>((resolve) => {
        teammate!.once("board:typing", resolve);
      });
      let senderReceivedIt = false;
      player.once("board:typing", () => {
        senderReceivedIt = true;
      });

      player.emit("player:typing", { rowIndex: 1 });

      const event = await teammateEventPromise;
      expect(event).toMatchObject({ entrantId: "t1", nickname: "Alex", rowIndex: 1 });
      expect(senderReceivedIt).toBe(false);
    });
  });
});
