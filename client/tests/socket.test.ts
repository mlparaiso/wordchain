import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSocket = { id: "mock-socket" };
const ioMock = vi.fn(() => mockSocket);
vi.mock("socket.io-client", () => ({ io: ioMock }));

describe("getSocket", () => {
  beforeEach(() => {
    vi.resetModules();
    ioMock.mockClear();
  });

  it("creates exactly one socket connection across repeated calls", async () => {
    const { getSocket } = await import("../src/socket.js");
    const first = getSocket();
    const second = getSocket();
    expect(first).toBe(second);
    expect(ioMock).toHaveBeenCalledTimes(1);
  });
});
