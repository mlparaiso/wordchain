import { describe, it, expect } from "vitest";
import { generateRoomCode } from "../src/rooms/roomCode.js";

describe("generateRoomCode", () => {
  it("matches the WORD-NN format", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z]+-\d{2}$/);
  });

  it("is deterministic given a fixed random function", () => {
    const fixedRandom = () => 0;
    const code = generateRoomCode(fixedRandom);
    expect(code).toBe(generateRoomCode(fixedRandom));
  });

  it("produces different codes for different random inputs", () => {
    const codeA = generateRoomCode(() => 0);
    const codeB = generateRoomCode(() => 0.99);
    expect(codeA).not.toBe(codeB);
  });
});
