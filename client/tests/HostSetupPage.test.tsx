import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PUZZLE_LIBRARY } from "@wordchain/shared";
import { HostSetupPage } from "../src/pages/HostSetupPage.js";

const emitMock = vi.fn(
  (_event: string, _payload: unknown, callback: (response: { code: string }) => void) =>
    callback({ code: "BLUE-42" })
);
vi.mock("../src/socket.js", () => ({
  getSocket: () => ({ emit: emitMock }),
}));

describe("HostSetupPage", () => {
  beforeEach(() => {
    localStorage.clear();
    emitMock.mockClear();
  });

  it("disables Create Room until at least one puzzle is selected", () => {
    render(<HostSetupPage onOpenCreator={vi.fn()} onRoomCreated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /create room/i })).toBeDisabled();
  });

  it("creates an individual-mode room with the selected puzzles as the playlist", async () => {
    const onRoomCreated = vi.fn();
    render(<HostSetupPage onOpenCreator={vi.fn()} onRoomCreated={onRoomCreated} />);

    await userEvent.click(screen.getByLabelText(new RegExp(`^${PUZZLE_LIBRARY[0].category} — ${PUZZLE_LIBRARY[0].words[0]}`)));
    await userEvent.click(screen.getByRole("button", { name: /create room/i }));

    expect(emitMock).toHaveBeenCalledWith(
      "host:createRoom",
      { mode: "individual", teams: undefined },
      expect.any(Function)
    );
    expect(onRoomCreated).toHaveBeenCalledWith({
      code: "BLUE-42",
      mode: "individual",
      playlist: [PUZZLE_LIBRARY[0]],
    });
  });

  it("shows a team-name input only in team mode and includes teams when creating the room", async () => {
    render(<HostSetupPage onOpenCreator={vi.fn()} onRoomCreated={vi.fn()} />);
    expect(screen.queryByLabelText(/team names/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/team mode/i));
    expect(screen.getByLabelText(/team names/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/team names/i), "Red Team, Blue Team");
    await userEvent.click(screen.getByLabelText(new RegExp(`^${PUZZLE_LIBRARY[0].category} — ${PUZZLE_LIBRARY[0].words[0]}`)));
    await userEvent.click(screen.getByRole("button", { name: /create room/i }));

    expect(emitMock).toHaveBeenCalledWith(
      "host:createRoom",
      {
        mode: "team",
        teams: [
          { id: "team-1", name: "Red Team" },
          { id: "team-2", name: "Blue Team" },
        ],
      },
      expect.any(Function)
    );
  });

  it("calls onOpenCreator when the custom puzzle link is clicked", async () => {
    const onOpenCreator = vi.fn();
    render(<HostSetupPage onOpenCreator={onOpenCreator} onRoomCreated={vi.fn()} />);
    await userEvent.click(screen.getByText(/create a custom puzzle/i));
    expect(onOpenCreator).toHaveBeenCalled();
  });

  it("groups puzzles under Easy/Medium/Hard headers and selects an entire tier at once", async () => {
    const onRoomCreated = vi.fn();
    render(<HostSetupPage onOpenCreator={vi.fn()} onRoomCreated={onRoomCreated} />);

    expect(screen.getByText("Easy")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Hard")).toBeInTheDocument();

    const easyPuzzleCount = PUZZLE_LIBRARY.filter((p) => p.difficulty === "easy").length;
    const selectAllButtons = screen.getAllByRole("button", { name: /select all/i });
    await userEvent.click(selectAllButtons[0]); // Easy section is rendered first

    await userEvent.click(screen.getByRole("button", { name: /create room/i }));
    expect(onRoomCreated.mock.calls[0][0].playlist).toHaveLength(easyPuzzleCount);
  });
});
