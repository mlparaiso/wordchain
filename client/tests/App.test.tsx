import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.js";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

type Handler = (payload: unknown) => void;

function createFakeSocket() {
  const handlers = new Map<string, Handler>();
  const ioHandlers = new Map<string, Handler>();
  const joinResponses: unknown[] = [];

  const emit = vi.fn((event: string, _payload: unknown, callback?: (r: unknown) => void) => {
    if (event === "player:joinRoom") {
      callback?.(joinResponses.shift() ?? { success: false, error: "no mock response queued" });
      return;
    }
    if (event === "host:createRoom") {
      callback?.({ code: "TEST-99" });
      return;
    }
    callback?.({ success: true });
  });

  return {
    on: (event: string, handler: Handler) => handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    emit,
    io: {
      on: (event: string, handler: Handler) => ioHandlers.set(event, handler),
      off: (event: string) => ioHandlers.delete(event),
    },
    trigger: (event: string, payload: unknown) => handlers.get(event)?.(payload),
    triggerReconnect: () => ioHandlers.get("reconnect")?.(1),
    queueJoinResponse: (response: unknown) => joinResponses.push(response),
  };
}

let fakeSocket = createFakeSocket();
vi.mock("../src/socket.js", () => ({
  getSocket: () => fakeSocket,
  getSessionToken: () => "test-session-token",
}));

async function joinAsPlayer() {
  await userEvent.click(screen.getByRole("button", { name: /join a game/i }));
  await userEvent.type(screen.getByLabelText(/room code/i), "BLUE-42");
  await userEvent.type(screen.getByLabelText(/nickname/i), "Alex");
  await userEvent.click(screen.getByRole("button", { name: /^join$/i }));
}

describe("App player reconnect", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
  });

  it("automatically rejoins the room and resumes mid-round after the socket reconnects", async () => {
    fakeSocket.queueJoinResponse({ success: true, mode: "individual", teams: [] });
    render(<App />);
    await joinAsPlayer();
    expect(await screen.findByText(/you're in/i)).toBeInTheDocument();

    fakeSocket.queueJoinResponse({
      success: true,
      mode: "individual",
      teams: [],
      activeRound: {
        puzzleId: "p1",
        category: "Reconnect Test",
        timeCapSeconds: 60,
        rows: [{ index: 0, length: 3, isClue: true, text: "HOT" }],
        startedAt: 0,
        isLastRound: false,
      },
      boardView: { topSolved: 0, bottomSolved: 0, revealedText: { 0: "HOT" }, penaltySeconds: 0 },
    });

    act(() => {
      fakeSocket.triggerReconnect();
    });

    expect(await screen.findByText("Reconnect Test")).toBeInTheDocument();
    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "player:joinRoom",
      { code: "BLUE-42", nickname: "Alex", sessionToken: "test-session-token" },
      expect.any(Function)
    );
  });

  it("returns a reconnecting player to the lobby instead of leaving them stuck when the round ended while they were offline", async () => {
    fakeSocket.queueJoinResponse({ success: true, mode: "individual", teams: [], teamId: null });
    render(<App />);
    await joinAsPlayer();
    expect(await screen.findByText(/you're in/i)).toBeInTheDocument();

    act(() => {
      fakeSocket.trigger("round:started", {
        puzzleId: "p1",
        category: "Reconnect Test",
        timeCapSeconds: 60,
        rows: [{ index: 0, length: 3, isClue: true, text: "HOT" }],
        startedAt: 0,
        isLastRound: false,
      });
    });
    expect(await screen.findByText("Reconnect Test")).toBeInTheDocument();

    // The round ended while this player was disconnected, so the rejoin ack has no
    // activeRound at all — without a fallback, they'd be stuck on the dead round screen.
    fakeSocket.queueJoinResponse({ success: true, mode: "individual", teams: [], teamId: null });
    act(() => {
      fakeSocket.triggerReconnect();
    });

    expect(await screen.findByText(/you're in/i)).toBeInTheDocument();
  });

  it("returns a reconnecting player to the landing screen when the room no longer exists", async () => {
    fakeSocket.queueJoinResponse({ success: true, mode: "individual", teams: [], teamId: null });
    render(<App />);
    await joinAsPlayer();
    expect(await screen.findByText(/you're in/i)).toBeInTheDocument();

    fakeSocket.queueJoinResponse({ success: false, error: "Room not found" });
    act(() => {
      fakeSocket.triggerReconnect();
    });

    expect(await screen.findByText(/host a game/i)).toBeInTheDocument();
  });

  it("restores the reconnecting player's team so their team's board updates apply to them", async () => {
    fakeSocket.queueJoinResponse({ success: true, mode: "team", teams: [{ id: "t1", name: "Red Team" }], teamId: "t1" });
    render(<App />);
    await joinAsPlayer();

    fakeSocket.queueJoinResponse({
      success: true,
      mode: "team",
      teams: [{ id: "t1", name: "Red Team" }],
      teamId: "t1",
      activeRound: {
        puzzleId: "p1",
        category: "Reconnect Test",
        timeCapSeconds: 60,
        rows: [
          { index: 0, length: 3, isClue: true, text: "HOT" },
          { index: 1, length: 3, isClue: false },
          { index: 2, length: 4, isClue: true, text: "KICK" },
        ],
        startedAt: 0,
        isLastRound: false,
      },
      boardView: { topSolved: 0, bottomSolved: 2, revealedText: { 0: "HOT", 2: "KICK" }, penaltySeconds: 0 },
    });
    act(() => {
      fakeSocket.triggerReconnect();
    });
    expect(await screen.findByText("Reconnect Test")).toBeInTheDocument();

    // If myTeamId wasn't restored from the reconnect ack, this board:updated for "t1"
    // would be filtered out as belonging to someone else.
    act(() => {
      fakeSocket.trigger("board:updated", {
        entrantId: "t1",
        view: { topSolved: 1, bottomSolved: 2, revealedText: { 0: "HOT", 1: "DOG", 2: "KICK" }, penaltySeconds: 0 },
      });
    });

    const cells = await screen.findAllByTestId("letter-cell");
    expect(cells.slice(3, 6).map((c) => c.textContent).join("")).toBe("DOG");
  });

  it("sends players back to the landing screen when the host disconnects", async () => {
    fakeSocket.queueJoinResponse({ success: true, mode: "individual", teams: [] });
    render(<App />);
    await joinAsPlayer();
    expect(await screen.findByText(/you're in/i)).toBeInTheDocument();

    act(() => {
      fakeSocket.trigger("room:hostLeft", {});
    });

    expect(await screen.findByText(/host a game/i)).toBeInTheDocument();
  });

  it("sends players back to the landing screen when the host ends the session", async () => {
    fakeSocket.queueJoinResponse({ success: true, mode: "individual", teams: [] });
    render(<App />);
    await joinAsPlayer();
    expect(await screen.findByText(/you're in/i)).toBeInTheDocument();

    act(() => {
      fakeSocket.trigger("room:sessionEnded", {});
    });

    expect(await screen.findByText(/host a game/i)).toBeInTheDocument();
  });
});

describe("App host session end", () => {
  beforeEach(() => {
    fakeSocket = createFakeSocket();
  });

  it("tells the server to end the session when the host finishes the last round", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: /host a game/i }));
    await userEvent.click(screen.getAllByRole("checkbox")[0]);
    await userEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(await screen.findByText("TEST-99")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(await screen.findByRole("button", { name: /end round/i })).toBeInTheDocument();

    act(() => {
      fakeSocket.trigger("round:results", { results: [], totals: {} });
    });

    const endSessionButton = await screen.findByRole("button", { name: /end session/i });
    await userEvent.click(endSessionButton);

    expect(fakeSocket.emit).toHaveBeenCalledWith("host:endSession", {}, expect.any(Function));
    expect(await screen.findByText(/host a game/i)).toBeInTheDocument();
  });
});
