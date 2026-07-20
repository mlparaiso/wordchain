import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePenaltyFlashes } from "../src/usePenaltyFlashes.js";

describe("usePenaltyFlashes", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with no flashes", () => {
    const { result } = renderHook(() => usePenaltyFlashes(0));
    expect(result.current).toEqual([]);
  });

  it("emits a flash with the delta amount when the penalty increases", () => {
    const { result, rerender } = renderHook(({ penalty }) => usePenaltyFlashes(penalty), {
      initialProps: { penalty: 0 },
    });
    rerender({ penalty: 5 });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].amount).toBe(5);
  });

  it("does not emit a flash when the penalty is unchanged or decreases", () => {
    const { result, rerender } = renderHook(({ penalty }) => usePenaltyFlashes(penalty), {
      initialProps: { penalty: 5 },
    });
    rerender({ penalty: 5 });
    expect(result.current).toEqual([]);
  });

  it("accumulates a separate flash for each successive penalty increase", () => {
    const { result, rerender } = renderHook(({ penalty }) => usePenaltyFlashes(penalty), {
      initialProps: { penalty: 0 },
    });
    rerender({ penalty: 5 });
    rerender({ penalty: 8 });
    expect(result.current.map((f) => f.amount)).toEqual([5, 3]);
  });

  it("removes a flash automatically after it expires", async () => {
    const { result, rerender } = renderHook(({ penalty }) => usePenaltyFlashes(penalty), {
      initialProps: { penalty: 0 },
    });
    rerender({ penalty: 5 });
    expect(result.current).toHaveLength(1);
    await waitFor(() => expect(result.current).toHaveLength(0), { timeout: 2000 });
  });
});
