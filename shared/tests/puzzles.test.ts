import { describe, it, expect } from "vitest";
import { validatePuzzleWords } from "../src/puzzleValidation.js";
import { PUZZLE_LIBRARY } from "../src/puzzles.js";

describe("PUZZLE_LIBRARY", () => {
  it("contains at least 6 puzzles", () => {
    expect(PUZZLE_LIBRARY.length).toBeGreaterThanOrEqual(6);
  });

  it("has a unique id for every puzzle", () => {
    const ids = PUZZLE_LIBRARY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has structurally valid word chains for every puzzle", () => {
    for (const puzzle of PUZZLE_LIBRARY) {
      expect(validatePuzzleWords(puzzle.words)).toEqual([]);
    }
  });

  it("gives every puzzle a positive time cap", () => {
    for (const puzzle of PUZZLE_LIBRARY) {
      expect(puzzle.timeCapSeconds).toBeGreaterThan(0);
    }
  });
});
