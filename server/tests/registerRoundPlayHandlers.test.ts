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
      mode === "team"
        ? { mode, teams: [{ id: "t1", name: "Red Team" }, { id: "t2", name: "Blue Team" }] }
        : { mode };
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

    // An unrelated entrant sharing the same room/round — on a rival team (team mode) or
    // simply another individual (individual mode) — used to prove round-play events don't
    // leak to entrants who aren't the acting entrant's own team/self.
    const rival: Socket = ioClient(url);
    await new Promise<void>((resolve) => rival.on("connect", resolve));
    await new Promise<void>((resolve) => rival.emit("player:joinRoom", { code, nickname: "Riley" }, () => resolve()));
    if (mode === "team") {
      await new Promise<void>((resolve) => rival.emit("player:selectTeam", { teamId: "t2" }, () => resolve()));
    }

    // host:startRound immediately pushes each entrant chain's starting board:updated
    // (see registerHostRoundHandlers.ts) — drain those here so a test's own
    // `.once("board:updated", ...)` for a later guess/hint doesn't race with, and
    // accidentally consume, this initial push instead.
    function drainInitialBoardUpdates(socket: Socket, count: number): Promise<void> {
      if (count <= 0) return Promise.resolve();
      return new Promise((resolve) => {
        let remaining = count;
        function handler() {
          remaining -= 1;
          if (remaining <= 0) {
            socket.off("board:updated", handler);
            resolve();
          }
        }
        socket.on("board:updated", handler);
      });
    }

    // Two distinct entrants exist either way: player (+ teammate, sharing one team
    // entrant) and rival — so the host always drains exactly two initial pushes.
    await Promise.all([
      new Promise<void>((resolve) => host.emit("host:startRound", { puzzle: PUZZLE }, () => resolve())),
      drainInitialBoardUpdates(player, 1),
      teammate ? drainInitialBoardUpdates(teammate, 1) : Promise.resolve(),
      drainInitialBoardUpdates(rival, 1),
      drainInitialBoardUpdates(host, 2),
    ]);

    cleanup = () => {
      host.close();
      player.close();
      teammate?.close();
      rival.close();
      io.close();
      httpServer.close();
    };

    return { host, player, teammate, rival, roomManager, code };
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

  it("broadcasts a round:activity event with the player's nickname on a correct guess", async () => {
    const { player } = await setupActiveRound();

    const activityPromise = new Promise<{ type: string; nickname: string; word?: string }>((resolve) => {
      player.once("round:activity", resolve);
    });
    await new Promise<void>((resolve) => player.emit("player:submitGuess", { rowIndex: 1, guess: "dog" }, () => resolve()));

    expect(await activityPromise).toMatchObject({ type: "correct", nickname: "Alex", rowIndex: 1, word: "DOG" });
  });

  it("uses the individual player's nickname (not the team name) in team mode", async () => {
    const { player } = await setupActiveRound("team");

    const activityPromise = new Promise<{ nickname: string; entrantId: string }>((resolve) => {
      player.once("round:activity", resolve);
    });
    await new Promise<void>((resolve) => player.emit("player:submitGuess", { rowIndex: 1, guess: "DOG" }, () => resolve()));

    const event = await activityPromise;
    expect(event.nickname).toBe("Alex");
    expect(event.entrantId).toBe("t1");
  });

  it("does not broadcast round:activity for a wrong guess", async () => {
    const { player } = await setupActiveRound();

    let sawActivity = false;
    player.on("round:activity", () => {
      sawActivity = true;
    });
    await new Promise<void>((resolve) => player.emit("player:submitGuess", { rowIndex: 1, guess: "CAT" }, () => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(sawActivity).toBe(false);
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

  it("does not leak round:activity to an individual player outside the acting player's team", async () => {
    const { player, rival } = await setupActiveRound("team");

    let rivalSawActivity = false;
    rival.on("round:activity", () => {
      rivalSawActivity = true;
    });
    await new Promise<void>((resolve) => player.emit("player:submitGuess", { rowIndex: 1, guess: "DOG" }, () => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(rivalSawActivity).toBe(false);
  });

  it("does not leak round:activity to another individual player in individual mode", async () => {
    const { player, rival } = await setupActiveRound("individual");

    let rivalSawActivity = false;
    rival.on("round:activity", () => {
      rivalSawActivity = true;
    });
    await new Promise<void>((resolve) => player.emit("player:submitGuess", { rowIndex: 1, guess: "DOG" }, () => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(rivalSawActivity).toBe(false);
  });

  it("does not leak board:updated (revealed letters) to entrants outside the acting entrant's team", async () => {
    const { player, rival } = await setupActiveRound("team");

    let rivalSawUpdate = false;
    rival.on("board:updated", () => {
      rivalSawUpdate = true;
    });
    await new Promise<void>((resolve) => player.emit("player:useHint", { rowIndex: 1 }, () => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(rivalSawUpdate).toBe(false);
  });

  it("still delivers round:activity and board:updated to the host regardless of team", async () => {
    const { host, player } = await setupActiveRound("team");

    const hostActivityPromise = new Promise<{ nickname: string }>((resolve) => host.once("round:activity", resolve));
    const hostUpdatePromise = new Promise<{ entrantId: string }>((resolve) => host.once("board:updated", resolve));
    await new Promise<void>((resolve) => player.emit("player:submitGuess", { rowIndex: 1, guess: "DOG" }, () => resolve()));

    expect((await hostActivityPromise).nickname).toBe("Alex");
    expect((await hostUpdatePromise).entrantId).toBe("t1");
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
      // DOG's first letter is already revealed for free as the chain's only blank
      // (the starting hint), so this hint reveals the second letter.
      expect(update.view.revealedText[1]).toBe("DO");
      expect(update.view.penaltySeconds).toBe(5);
    });

    it("broadcasts a round:activity event with the player's nickname", async () => {
      const { player } = await setupActiveRound();

      const activityPromise = new Promise<{ type: string; nickname: string; rowIndex: number }>((resolve) =>
        player.once("round:activity", resolve)
      );
      await new Promise<void>((resolve) => player.emit("player:useHint", { rowIndex: 1 }, () => resolve()));

      expect(await activityPromise).toMatchObject({ type: "hint", nickname: "Alex", rowIndex: 1 });
    });

    it("does not broadcast round:activity or board:updated for a hint that reveals nothing new", async () => {
      const { player } = await setupActiveRound();

      // DOG starts with "D" free; two more hints fully reveal it ("DO" -> "DOG").
      await new Promise<void>((resolve) => player.emit("player:useHint", { rowIndex: 1 }, () => resolve()));
      await new Promise<void>((resolve) => player.emit("player:useHint", { rowIndex: 1 }, () => resolve()));

      let sawActivity = false;
      player.on("round:activity", () => {
        sawActivity = true;
      });
      let sawUpdate = false;
      player.on("board:updated", () => {
        sawUpdate = true;
      });

      const response = await new Promise<{ success: boolean }>((resolve) => {
        player.emit("player:useHint", { rowIndex: 1 }, resolve);
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(response.success).toBe(true);
      expect(sawActivity).toBe(false);
      expect(sawUpdate).toBe(false);
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
