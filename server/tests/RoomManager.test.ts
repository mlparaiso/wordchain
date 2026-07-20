import { describe, it, expect } from "vitest";
import { RoomManager } from "../src/rooms/RoomManager.js";

describe("RoomManager", () => {
  it("creates a room with a generated code and the given host", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1");
    expect(room.hostSocketId).toBe("host-1");
    expect(room.code).toMatch(/^[A-Z]+-\d{2}$/);
  });

  it("retrieves a room by its code", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1");
    expect(manager.getRoom(room.code)).toBe(room);
  });

  it("returns undefined for an unknown code", () => {
    const manager = new RoomManager();
    expect(manager.getRoom("NOPE-00")).toBeUndefined();
  });

  it("removes a room", () => {
    const manager = new RoomManager();
    const room = manager.createRoom("host-1");
    manager.removeRoom(room.code);
    expect(manager.getRoom(room.code)).toBeUndefined();
  });

  it("never generates two rooms with the same code while both exist", () => {
    let callCount = 0;
    const collidingRandom = () => {
      callCount++;
      return callCount <= 2 ? 0 : 0.5;
    };
    const manager = new RoomManager(collidingRandom);
    const roomA = manager.createRoom("host-1");
    const roomB = manager.createRoom("host-2");
    expect(roomA.code).not.toBe(roomB.code);
  });
});
