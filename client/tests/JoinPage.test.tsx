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
      nickname: "Alex",
      mode: "individual",
      teams: [],
      activeRound: undefined,
      boardView: undefined,
    });
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
    }));
    const { JoinPage: JoinPageWithFailingSocket } = await import("../src/pages/JoinPage.js");
    render(<JoinPageWithFailingSocket onJoined={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/room code/i), "NOPE-00");
    await userEvent.type(screen.getByLabelText(/nickname/i), "Alex");
    await userEvent.click(screen.getByRole("button", { name: /join/i }));
    expect(await screen.findByText("Room not found")).toBeInTheDocument();
  });
});
