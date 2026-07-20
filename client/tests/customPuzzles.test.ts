import { describe, it, expect, beforeEach } from "vitest";
import { loadCustomPuzzles, saveCustomPuzzle } from "../src/customPuzzles.js";

describe("custom puzzle storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty", () => {
    expect(loadCustomPuzzles()).toEqual([]);
  });

  it("persists a saved puzzle and returns it on reload", () => {
    const puzzle = { id: "custom-1", category: "My Puzzle", difficulty: "easy" as const, words: ["HOT", "DOG", "KICK"], timeCapSeconds: 60 };
    saveCustomPuzzle(puzzle);
    expect(loadCustomPuzzles()).toEqual([puzzle]);
  });

  it("appends rather than overwrites when saving multiple puzzles", () => {
    saveCustomPuzzle({ id: "c1", category: "A", difficulty: "easy", words: ["HOT", "DOG", "KICK"], timeCapSeconds: 60 });
    saveCustomPuzzle({ id: "c2", category: "B", difficulty: "easy", words: ["SUN", "FLOWER", "BED"], timeCapSeconds: 60 });
    expect(loadCustomPuzzles()).toHaveLength(2);
  });
});
