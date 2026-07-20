import { describe, it, expect } from "vitest";
import { validatePuzzleWords } from "../src/puzzleValidation.js";

describe("validatePuzzleWords", () => {
  it("passes a valid chain with no errors", () => {
    expect(validatePuzzleWords(["HOT", "DOG", "TAG", "ALONG", "SIDE", "KICK"])).toEqual([]);
  });

  it("passes the minimal valid chain of 3 words", () => {
    expect(validatePuzzleWords(["HOT", "DOG", "KICK"])).toEqual([]);
  });

  it("flags a chain shorter than 3 words", () => {
    const errors = validatePuzzleWords(["HOT", "DOG"]);
    expect(errors.some((e) => /at least 3 words/.test(e.message))).toBe(true);
  });

  it("flags an empty word", () => {
    const errors = validatePuzzleWords(["HOT", "", "KICK"]);
    expect(errors.some((e) => /position 2/.test(e.message))).toBe(true);
  });

  it("flags a word with non-letter characters", () => {
    const errors = validatePuzzleWords(["HOT", "DOG2", "KICK"]);
    expect(errors.some((e) => /only letters/.test(e.message))).toBe(true);
  });

  it("flags duplicate consecutive words", () => {
    const errors = validatePuzzleWords(["HOT", "DOG", "DOG", "KICK"]);
    expect(errors.some((e) => /identical/.test(e.message))).toBe(true);
  });

  it("returns multiple errors when multiple problems exist", () => {
    const errors = validatePuzzleWords(["HOT", "", "DOG2"]);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
