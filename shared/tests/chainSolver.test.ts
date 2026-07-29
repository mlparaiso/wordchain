import { describe, it, expect } from "vitest";
import {
  createChainState,
  getActiveRows,
  getActiveRowsFromBounds,
  isComplete,
  submitGuess,
  applyHint,
  toPublicRows,
  toPublicBoardView,
  WRONG_GUESS_PENALTY_SECONDS,
  HINT_PENALTY_SECONDS,
} from "../src/chainSolver.js";

const CHAIN = ["HOT", "DOG", "TAG", "ALONG", "SIDE", "KICK"];

describe("createChainState", () => {
  it("starts with the top and bottom clue rows solved", () => {
    const state = createChainState(CHAIN);
    expect(state.topSolved).toBe(0);
    expect(state.bottomSolved).toBe(5);
    expect(state.penaltySeconds).toBe(0);
  });
});

describe("getActiveRows", () => {
  it("returns the row after the top clue and before the bottom clue", () => {
    const state = createChainState(CHAIN);
    expect(getActiveRows(state)).toEqual([1, 4]);
  });

  it("returns a single row when the pointers converge", () => {
    const state = createChainState(CHAIN);
    expect(isComplete(state)).toBe(false);
  });

  it("returns an empty array once solved", () => {
    let state = createChainState(["HOT", "DOG", "KICK"]);
    const result = submitGuess(state, 1, "dog");
    expect(getActiveRows(result.state)).toEqual([]);
  });
});

describe("getActiveRowsFromBounds", () => {
  it("matches getActiveRows given the same bounds, without needing the solution words", () => {
    expect(getActiveRowsFromBounds(0, 5)).toEqual([1, 4]);
    expect(getActiveRowsFromBounds(2, 4)).toEqual([3]);
    expect(getActiveRowsFromBounds(2, 2)).toEqual([]);
  });
});

describe("submitGuess", () => {
  it("accepts a correct guess case-insensitively and trims whitespace", () => {
    const state = createChainState(CHAIN);
    const result = submitGuess(state, 1, "  dog  ");
    expect(result.correct).toBe(true);
    expect(result.state.topSolved).toBe(1);
  });

  it("advances topSolved when the top-active row is solved", () => {
    const state = createChainState(CHAIN);
    const result = submitGuess(state, 1, "DOG");
    expect(getActiveRows(result.state)).toEqual([2, 4]);
  });

  it("advances bottomSolved when the bottom-active row is solved", () => {
    const state = createChainState(CHAIN);
    const result = submitGuess(state, 4, "SIDE");
    expect(result.state.bottomSolved).toBe(4);
    expect(getActiveRows(result.state)).toEqual([1, 3]);
  });

  it("adds a time penalty on a wrong guess and does not advance pointers", () => {
    const state = createChainState(CHAIN);
    const result = submitGuess(state, 1, "CAT");
    expect(result.correct).toBe(false);
    expect(result.state.topSolved).toBe(0);
    expect(result.state.penaltySeconds).toBe(WRONG_GUESS_PENALTY_SECONDS);
  });

  it("throws if guessing a row that is not currently active", () => {
    const state = createChainState(CHAIN);
    expect(() => submitGuess(state, 3, "ALONG")).toThrow(/not active/);
  });

  it("completes the chain when both pointers converge on the final row", () => {
    let state = createChainState(CHAIN);
    state = submitGuess(state, 1, "DOG").state; // active: [2,4]
    state = submitGuess(state, 4, "SIDE").state; // active: [2,3]
    state = submitGuess(state, 2, "TAG").state; // active: [3] (converged)
    expect(getActiveRows(state)).toEqual([3]);
    expect(isComplete(state)).toBe(false);
    const finalResult = submitGuess(state, 3, "ALONG");
    expect(finalResult.correct).toBe(true);
    expect(isComplete(finalResult.state)).toBe(true);
    expect(getActiveRows(finalResult.state)).toEqual([]);
  });

  it("handles a minimal 3-word chain (single blank) from either direction", () => {
    const state = createChainState(["HOT", "DOG", "KICK"]);
    expect(getActiveRows(state)).toEqual([1]);
    const result = submitGuess(state, 1, "DOG");
    expect(result.correct).toBe(true);
    expect(isComplete(result.state)).toBe(true);
  });
});

describe("applyHint", () => {
  it("reveals one additional letter (beyond the free starting one) and adds the hint penalty", () => {
    const state = createChainState(CHAIN);
    const hinted = applyHint(state, 1);
    expect(hinted.revealedLetters[1]).toBe(2); // starts at 1 (free), hint brings it to 2
    expect(hinted.penaltySeconds).toBe(HINT_PENALTY_SECONDS);
  });

  it("does not reveal past the word's length", () => {
    // Row 1 (DOG, length 3) already starts at 1 letter revealed for free.
    let state = createChainState(CHAIN);
    state = applyHint(state, 1); // 1 -> 2
    state = applyHint(state, 1); // 2 -> 3 (full)
    state = applyHint(state, 1); // no-op, already fully revealed
    expect(state.revealedLetters[1]).toBe(3);
    expect(state.penaltySeconds).toBe(HINT_PENALTY_SECONDS * 2);
  });

  it("throws if hinting a row that is not currently active", () => {
    const state = createChainState(CHAIN);
    expect(() => applyHint(state, 3)).toThrow(/not active/);
  });
});

describe("toPublicRows", () => {
  it("exposes clue text for the first and last row, and only lengths for blanks", () => {
    const rows = toPublicRows(["HOT", "DOG", "KICK"]);
    expect(rows).toEqual([
      { index: 0, length: 3, isClue: true, text: "HOT" },
      { index: 1, length: 3, isClue: false },
      { index: 2, length: 4, isClue: true, text: "KICK" },
    ]);
  });
});

describe("toPublicBoardView", () => {
  it("reveals full text for solved rows and a hinted prefix for active rows", () => {
    // Row 4 (SIDE) already starts with its first letter free, so one applyHint call
    // reveals its second letter.
    let state = createChainState(CHAIN);
    state = submitGuess(state, 1, "DOG").state; // topSolved -> 1
    state = applyHint(state, 4); // "S" (free) -> "SI"

    const view = toPublicBoardView(state);
    expect(view.revealedText[0]).toBe("HOT"); // clue
    expect(view.revealedText[1]).toBe("DOG"); // solved
    expect(view.revealedText[4]).toBe("SI"); // free first letter + one hint
    expect(view.revealedText[5]).toBe("KICK"); // clue
    expect(view.penaltySeconds).toBe(5);
  });

  it("reveals every untouched blank row's free first letter, and nothing more", () => {
    const state = createChainState(CHAIN);
    const view = toPublicBoardView(state);
    expect(view.revealedText[1]).toBe("D");
    expect(view.revealedText[2]).toBe("T");
    expect(view.revealedText[3]).toBe("A");
    expect(view.revealedText[4]).toBe("S");
  });
});

describe("createChainState starting hint", () => {
  it("reveals the first letter of every blank word, not just the clue rows", () => {
    const state = createChainState(CHAIN); // blanks at indices 1-4
    expect(state.revealedLetters).toEqual([0, 1, 1, 1, 1, 0]);
  });

  it("reveals the first letter of every blank in a longer chain too", () => {
    // 7 words -> blanks at indices 1-5.
    const state = createChainState(["HOT", "DOG", "TAG", "ALONG", "SIDE", "WALK", "KICK"]);
    expect(state.revealedLetters).toEqual([0, 1, 1, 1, 1, 1, 0]);
  });

  it("does not charge a time penalty for the free starting reveal", () => {
    const state = createChainState(CHAIN);
    expect(state.penaltySeconds).toBe(0);
  });

  it("leaves a minimal 3-word chain's only blank with its first letter revealed", () => {
    const state = createChainState(["HOT", "DOG", "KICK"]);
    expect(state.revealedLetters).toEqual([0, 1, 0]);
  });
});
