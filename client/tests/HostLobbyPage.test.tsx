import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Puzzle } from "@wordchain/shared";
import { HostLobbyPage } from "../src/pages/HostLobbyPage.js";

type Handler = (payload: unknown) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  const emit = vi.fn((_event: string, _payload: unknown, callback?: (r: unknown) => void) => callback?.({ success: true }));
  return {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    emit,
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
  };
}

let fakeSocket = createFakeSocket();
vi.mock("../src/socket.js", () => ({ getSocket: () => fakeSocket }));

const PLAYLIST: Puzzle[] = [
  { id: "p1", category: "Classics", difficulty: "easy", words: ["HOT", "DOG", "KICK"], timeCapSeconds: 60 },
];

describe("HostLobbyPage", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
  });

  it("shows the room code", () => {
    render(<HostLobbyPage roomCode="BLUE-42" playlist={PLAYLIST} onStarted={vi.fn()} />);
    expect(screen.getByText("BLUE-42")).toBeInTheDocument();
  });

  it("adds a player to the list when room:playerJoined fires", () => {
    render(<HostLobbyPage roomCode="BLUE-42" playlist={PLAYLIST} onStarted={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("room:playerJoined", { socketId: "p1", nickname: "Alex", teamId: null, connected: true });
    });
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("kicks a player when their kick button is clicked", async () => {
    render(<HostLobbyPage roomCode="BLUE-42" playlist={PLAYLIST} onStarted={vi.fn()} />);
    act(() => {
      fakeSocket.trigger("room:playerJoined", { socketId: "p1", nickname: "Alex", teamId: null, connected: true });
    });
    await userEvent.click(screen.getByRole("button", { name: /kick alex/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("host:kickPlayer", { socketId: "p1" }, expect.any(Function));
  });

  it("starts the first puzzle in the playlist, flags it as the last round when the playlist has one entry, and calls onStarted", async () => {
    const onStarted = vi.fn();
    render(<HostLobbyPage roomCode="BLUE-42" playlist={PLAYLIST} onStarted={onStarted} />);
    await userEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "host:startRound",
      { puzzle: PLAYLIST[0], isLastRound: true },
      expect.any(Function)
    );
    expect(onStarted).toHaveBeenCalledWith(PLAYLIST[0]);
  });
});
