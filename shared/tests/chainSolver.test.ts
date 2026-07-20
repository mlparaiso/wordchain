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
  it("reveals one additional letter and adds the hint penalty", () => {
    const state = createChainState(CHAIN);
    const hinted = applyHint(state, 1);
    expect(hinted.revealedLetters[1]).toBe(1);
    expect(hinted.penaltySeconds).toBe(HINT_PENALTY_SECONDS);
  });

  it("does not reveal past the word's length", () => {
    let state = createChainState(["HOT", "DOG", "KICK"]);
    state = applyHint(state, 1); // reveals 1 of 3
    state = applyHint(state, 1); // reveals 2 of 3
    state = applyHint(state, 1); // reveals 3 of 3
    state = applyHint(state, 1); // no-op, already fully revealed
    expect(state.revealedLetters[1]).toBe(3);
    expect(state.penaltySeconds).toBe(HINT_PENALTY_SECONDS * 3);
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
    let state = createChainState(["HOT", "DOG", "TAG", "KICK"]);
    state = submitGuess(state, 1, "DOG").state; // topSolved -> 1
    state = applyHint(state, 2); // reveal 1 letter of TAG

    const view = toPublicBoardView(state);
    expect(view.revealedText[0]).toBe("HOT"); // clue
    expect(view.revealedText[1]).toBe("DOG"); // solved
    expect(view.revealedText[2]).toBe("T"); // hinted prefix only
    expect(view.revealedText[3]).toBe("KICK"); // clue
    expect(view.penaltySeconds).toBe(5);
  });

  it("reveals nothing for an untouched middle row", () => {
    const state = createChainState(["HOT", "DOG", "TAG", "ALONG", "SIDE", "KICK"]);
    const view = toPublicBoardView(state);
    expect(view.revealedText[2]).toBeUndefined();
    expect(view.revealedText[3]).toBeUndefined();
  });
});
