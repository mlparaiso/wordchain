import { describe, it, expect, afterEach } from "vitest";
import type { Puzzle } from "@wordchain/shared";
import { submitGuess } from "@wordchain/shared";
import { Room } from "../src/rooms/Room.js";
import { computeRoundResults, endRound } from "../src/rooms/scoreRound.js";
import { createServer } from "../src/index.js";

const PUZZLE: Puzzle = {
  id: "test-puzzle",
  category: "Test",
  difficulty: "easy",
  words: ["HOT", "DOG", "TAG", "KICK"],
  timeCapSeconds: 60,
};

describe("computeRoundResults", () => {
  it("scores a finisher at 1000 points when they are the only finisher", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("p1", "Alex");
    room.startRound(PUZZLE);
    room.currentRound!.startedAt = Date.now() - 10_000;
    room.currentRound!.finishedAt.set("p1", Date.now());

    const results = computeRoundResults(room);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ entrantId: "p1", finished: true, points: 1000 });
  });

  it("gives a non-finisher partial credit based on blanks solved", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("p1", "Alex");
    room.startRound(PUZZLE);
    let state = room.currentRound!.entrantChains.get("p1")!;
    state = submitGuess(state, 1, "DOG").state;
    room.currentRound!.entrantChains.set("p1", state);

    const results = computeRoundResults(room);
    expect(results[0]).toMatchObject({ finished: false, rowsSolved: 1, totalRows: 2, points: 100 });
  });

  it("scores a slower second finisher proportionally against the fastest", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("p1", "Alex");
    room.addPlayer("p2", "Sam");
    room.startRound(PUZZLE);
    const now = Date.now();
    room.currentRound!.startedAt = now - 60_000;
    room.currentRound!.finishedAt.set("p1", now - 30_000);
    room.currentRound!.finishedAt.set("p2", now);

    const results = computeRoundResults(room);
    const p1 = results.find((r) => r.entrantId === "p1")!;
    const p2 = results.find((r) => r.entrantId === "p2")!;
    expect(p1.points).toBe(1000);
    expect(p2.points).toBe(500);
  });
});

describe("endRound", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("still ends the round and notifies clients even if scoring throws unexpectedly", () => {
    const { io } = createServer();
    cleanup = () => io.close();

    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("p1", "Alex");
    // A puzzle with no blanks at all isn't something host:startRound would normally
    // accept (validatePuzzleWords requires at least one), but Room.startRound itself
    // doesn't re-validate — this reproduces an unexpected totalBlanks<=0 the same way
    // any future scoring bug could, to prove endRound survives it (no try/catch existed
    // in this chain before) instead of crashing the entire process via an unhandled
    // exception inside a setTimeout callback.
    room.startRound({ id: "p1", category: "Test", difficulty: "easy", words: ["HOT", "KICK"], timeCapSeconds: 60 });

    expect(() => endRound(io, room)).not.toThrow();
    expect(room.currentRound).toBeNull();
  });
});
