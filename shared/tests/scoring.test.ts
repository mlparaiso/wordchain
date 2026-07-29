import { describe, it, expect } from "vitest";
import {
  computeFinisherPoints,
  computeNonFinisherPoints,
  FINISHER_MAX_POINTS,
  FINISHER_MIN_POINTS,
} from "../src/scoring.js";

describe("computeFinisherPoints", () => {
  it("gives the fastest player exactly 1000 points", () => {
    expect(computeFinisherPoints(30, 30)).toBe(1000);
  });

  it("scales down proportionally for a slower time", () => {
    expect(computeFinisherPoints(60, 30)).toBe(500);
  });

  it("clamps to a floor of 300 for a very slow finish", () => {
    expect(computeFinisherPoints(1000, 10)).toBe(300);
  });

  it("never exceeds 1000 even if somehow faster than the recorded fastest", () => {
    expect(computeFinisherPoints(10, 30)).toBe(1000);
  });

  it("awards max points for an instant (zero or negative time) finish, instead of throwing", () => {
    // Reachable in practice: a chain whose only/last blank is very short can be
    // auto-submitted within milliseconds of round start (see createChainState's free
    // starting-hint reveal + ChainBoard's auto-submit-on-full-reveal), pushing
    // rawTimeSeconds to ~0. This must never throw — an uncaught exception here would
    // crash the whole server (see endRound), not just fail this one player's score.
    expect(computeFinisherPoints(0, 30)).toBe(FINISHER_MAX_POINTS);
    expect(computeFinisherPoints(-1, 30)).toBe(FINISHER_MAX_POINTS);
  });

  it("still scores normally when the recorded fastest time is degenerate but this player's own time is not", () => {
    expect(computeFinisherPoints(30, 0)).toBe(FINISHER_MIN_POINTS);
  });
});

describe("computeNonFinisherPoints", () => {
  it("awards proportional partial credit", () => {
    expect(computeNonFinisherPoints(2, 4)).toBe(100);
  });

  it("returns 0 for no progress", () => {
    expect(computeNonFinisherPoints(0, 4)).toBe(0);
  });

  it("stays below the finisher floor even at full progress", () => {
    expect(computeNonFinisherPoints(4, 4)).toBeLessThan(300);
  });

  it("throws for non-positive totalRows", () => {
    expect(() => computeNonFinisherPoints(1, 0)).toThrow();
  });
});
