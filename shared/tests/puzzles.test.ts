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

  it("has a meaningful spread of puzzles across all three difficulties", () => {
    const byDifficulty = {
      easy: PUZZLE_LIBRARY.filter((p) => p.difficulty === "easy").length,
      medium: PUZZLE_LIBRARY.filter((p) => p.difficulty === "medium").length,
      hard: PUZZLE_LIBRARY.filter((p) => p.difficulty === "hard").length,
    };
    expect(byDifficulty.easy).toBeGreaterThanOrEqual(3);
    expect(byDifficulty.medium).toBeGreaterThanOrEqual(3);
    expect(byDifficulty.hard).toBeGreaterThanOrEqual(3);
  });

  it("scales chain length by difficulty: easy=7 words, medium=9, hard=11", () => {
    const MIN_WORDS_BY_DIFFICULTY = { easy: 7, medium: 9, hard: 11 } as const;
    for (const puzzle of PUZZLE_LIBRARY) {
      expect(puzzle.words.length).toBeGreaterThanOrEqual(MIN_WORDS_BY_DIFFICULTY[puzzle.difficulty]);
    }
  });
});
