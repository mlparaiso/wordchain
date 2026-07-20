import { describe, it, expect } from "vitest";
import type { Puzzle } from "@wordchain/shared";
import { Room } from "../src/rooms/Room.js";

describe("Room", () => {
  it("starts with no players and individual mode", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    expect(room.code).toBe("BLUE-42");
    expect(room.hostSocketId).toBe("host-socket-1");
    expect(room.mode).toBe("individual");
    expect(room.getPlayers()).toEqual([]);
  });

  it("adds a player with no team by default", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    const player = room.addPlayer("p1", "Alex");
    expect(player).toEqual({ socketId: "p1", nickname: "Alex", teamId: null, connected: true });
    expect(room.getPlayers()).toHaveLength(1);
  });

  it("removes a player", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.addPlayer("p1", "Alex");
    room.removePlayer("p1");
    expect(room.getPlayers()).toEqual([]);
  });

  it("marks a player as disconnected without removing them", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.addPlayer("p1", "Alex");
    room.setConnected("p1", false);
    expect(room.getPlayers()[0].connected).toBe(false);
  });

  it("assigns a player to a defined team", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.addPlayer("p1", "Alex");
    room.assignTeam("p1", "t1");
    expect(room.getPlayers()[0].teamId).toBe("t1");
  });

  it("throws when assigning a player to a team that does not exist", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.addPlayer("p1", "Alex");
    expect(() => room.assignTeam("p1", "unknown-team")).toThrow(/does not exist/);
  });

  it("throws when assigning an unknown player to a team", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    expect(() => room.assignTeam("unknown-player", "t1")).toThrow(/does not exist/);
  });
});

const PUZZLE: Puzzle = {
  id: "test-puzzle",
  category: "Test",
  difficulty: "easy",
  words: ["HOT", "DOG", "KICK"],
  timeCapSeconds: 60,
};

describe("Room round state", () => {
  it("creates one chain state per individual player", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.addPlayer("p1", "Alex");
    room.addPlayer("p2", "Sam");
    room.startRound(PUZZLE);
    expect(room.currentRound?.entrantChains.size).toBe(2);
    expect(room.currentRound?.entrantChains.has("p1")).toBe(true);
  });

  it("creates one shared chain state per team in team mode", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.addPlayer("p1", "Alex");
    room.addPlayer("p2", "Sam");
    room.assignTeam("p1", "t1");
    room.assignTeam("p2", "t1");
    room.startRound(PUZZLE);
    expect(room.currentRound?.entrantChains.size).toBe(1);
    expect(room.currentRound?.entrantChains.has("t1")).toBe(true);
  });

  it("skips team-mode players who have not picked a team yet", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.addPlayer("p1", "Alex");
    room.startRound(PUZZLE);
    expect(room.currentRound?.entrantChains.size).toBe(0);
  });

  it("getEntrantId returns the socketId in individual mode and the teamId in team mode", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.addPlayer("p1", "Alex");
    expect(room.getEntrantId("p1")).toBe("p1");

    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.assignTeam("p1", "t1");
    expect(room.getEntrantId("p1")).toBe("t1");
  });
});

describe("Room.getDisplayName", () => {
  it("returns the player's nickname in individual mode", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.addPlayer("p1", "Alex");
    expect(room.getDisplayName("p1")).toBe("Alex");
  });

  it("returns the team name in team mode", () => {
    const room = new Room("BLUE-42", "host-socket-1");
    room.mode = "team";
    room.teams = [{ id: "t1", name: "Red Team" }];
    room.addPlayer("p1", "Alex");
    room.assignTeam("p1", "t1");
    expect(room.getDisplayName("t1")).toBe("Red Team");
  });
});

describe("Room.reconnectPlayer", () => {
  it("returns null when no disconnected player matches the nickname", () => {
    const room = new Room("BLUE-42", "host-1");
    expect(room.reconnectPlayer("Alex", "new-socket")).toBeNull();
  });

  it("re-associates a disconnected player under the new socket id", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("old-socket", "Alex");
    room.setConnected("old-socket", false);

    const reconnected = room.reconnectPlayer("Alex", "new-socket");
    expect(reconnected).toMatchObject({ socketId: "new-socket", nickname: "Alex", connected: true });
    expect(room.getPlayers()).toHaveLength(1);
  });

  it("migrates an in-progress individual chain state to the new socket id", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("old-socket", "Alex");
    room.startRound({ id: "p", category: "c", difficulty: "easy", words: ["HOT", "DOG", "KICK"], timeCapSeconds: 60 });
    room.setConnected("old-socket", false);

    room.reconnectPlayer("Alex", "new-socket");
    expect(room.currentRound?.entrantChains.has("new-socket")).toBe(true);
    expect(room.currentRound?.entrantChains.has("old-socket")).toBe(false);
  });

  it("does not reconnect a player who is still connected", () => {
    const room = new Room("BLUE-42", "host-1");
    room.addPlayer("old-socket", "Alex");
    expect(room.reconnectPlayer("Alex", "new-socket")).toBeNull();
  });
});
