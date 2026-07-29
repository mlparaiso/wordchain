import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinPage } from "../src/pages/JoinPage.js";

vi.mock("../src/socket.js", () => ({
  getSocket: () => ({
    emit: (
      _event: string,
      _payload: unknown,
      callback: (response: { success: boolean; mode?: string; teams?: unknown[] }) => void
    ) => callback({ success: true, mode: "individual", teams: [] }),
  }),
  getSessionToken: () => "test-session-token",
}));

describe("JoinPage", () => {
  it("disables the join button until both fields are filled", async () => {
    render(<JoinPage onJoined={vi.fn()} />);
    const joinButton = screen.getByRole("button", { name: /join/i });
    expect(joinButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/room code/i), "BLUE-42");
    expect(joinButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/nickname/i), "Alex");
    expect(joinButton).toBeEnabled();
  });

  it("calls onJoined with the nickname and room mode after a successful join", async () => {
    const onJoined = vi.fn();
    render(<JoinPage onJoined={onJoined} />);
    await userEvent.type(screen.getByLabelText(/room code/i), "BLUE-42");
    await userEvent.type(screen.getByLabelText(/nickname/i), "Alex");
    await userEvent.click(screen.getByRole("button", { name: /join/i }));
    expect(onJoined).toHaveBeenCalledWith({
      code: "BLUE-42",
      nickname: "Alex",
      mode: "individual",
      teams: [],
      teamId: null,
      activeRound: undefined,
      boardView: undefined,
    });
  });

  it("includes a session token when joining so the server can tell a reconnect apart from a nickname collision", async () => {
    const emit = vi.fn(
      (_event: string, _payload: unknown, callback: (r: { success: boolean; mode: string; teams: unknown[] }) => void) =>
        callback({ success: true, mode: "individual", teams: [] })
    );
    vi.resetModules();
    vi.doMock("../src/socket.js", () => ({
      getSocket: () => ({ emit }),
      getSessionToken: () => "test-session-token",
    }));
    const { JoinPage: TokenJoinPage } = await import("../src/pages/JoinPage.js");
    render(<TokenJoinPage onJoined={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/room code/i), "BLUE-42");
    await userEvent.type(screen.getByLabelText(/nickname/i), "Alex");
    await userEvent.click(screen.getByRole("button", { name: /join/i }));
    expect(emit).toHaveBeenCalledWith(
      "player:joinRoom",
      { code: "BLUE-42", nickname: "Alex", sessionToken: "test-session-token" },
      expect.any(Function)
    );
  });

  it("forwards an active round and board view when reconnecting mid-round", async () => {
    vi.resetModules();
    vi.doMock("../src/socket.js", () => ({
      getSocket: () => ({
        emit: (_event: string, _payload: unknown, callback: (response: any) => void) =>
          callback({
            success: true,
            mode: "individual",
            teams: [],
            activeRound: { puzzleId: "p1", category: "Test", timeCapSeconds: 60, rows: [], startedAt: 0, isLastRound: false },
            boardView: { topSolved: 0, bottomSolved: 2, revealedText: {}, penaltySeconds: 0 },
          }),
      }),
      getSessionToken: () => "test-session-token",
    }));
    const { JoinPage: ReconnectingJoinPage } = await import("../src/pages/JoinPage.js");
    const onJoined = vi.fn();
    render(<ReconnectingJoinPage onJoined={onJoined} />);
    await userEvent.type(screen.getByLabelText(/room code/i), "BLUE-42");
    await userEvent.type(screen.getByLabelText(/nickname/i), "Alex");
    await userEvent.click(screen.getByRole("button", { name: /join/i }));
    expect(onJoined.mock.calls[0][0].activeRound.puzzleId).toBe("p1");
    expect(onJoined.mock.calls[0][0].boardView.topSolved).toBe(0);
  });

  it("shows the server's error message when the join fails", async () => {
    vi.resetModules();
    vi.doMock("../src/socket.js", () => ({
      getSocket: () => ({
        emit: (_event: string, _payload: unknown, callback: (response: { success: boolean; error?: string }) => void) =>
          callback({ success: false, error: "Room not found" }),
      }),
      getSessionToken: () => "test-session-token",
    }));
    const { JoinPage: JoinPageWithFailingSocket } = await import("../src/pages/JoinPage.js");
    render(<JoinPageWithFailingSocket onJoined={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/room code/i), "NOPE-00");
    await userEvent.type(screen.getByLabelText(/nickname/i), "Alex");
    await userEvent.click(screen.getByRole("button", { name: /join/i }));
    expect(await screen.findByText("Room not found")).toBeInTheDocument();
  });
});
