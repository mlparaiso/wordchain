import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCountUp } from "../src/useCountUp.js";

describe("useCountUp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("eventually reaches the target value", async () => {
    const { result } = renderHook(() => useCountUp(1000, 50));
    await waitFor(() => expect(result.current).toBe(1000));
  });

  it("starts immediately at the target when reduced motion is preferred", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { result } = renderHook(() => useCountUp(500));
    expect(result.current).toBe(500);
  });
});
