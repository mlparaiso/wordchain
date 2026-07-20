import { describe, it, expect } from "vitest";
import { computeFinisherPoints, computeNonFinisherPoints } from "../src/scoring.js";

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

  it("throws for non-positive times", () => {
    expect(() => computeFinisherPoints(0, 30)).toThrow();
    expect(() => computeFinisherPoints(30, 0)).toThrow();
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
