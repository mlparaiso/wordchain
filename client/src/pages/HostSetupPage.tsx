import { useState } from "react";
import { PUZZLE_LIBRARY, type GameMode, type Puzzle, type TeamInfo } from "@wordchain/shared";
import { getSocket } from "../socket.js";
import { loadCustomPuzzles } from "../customPuzzles.js";

const DIFFICULTY_ORDER: Puzzle["difficulty"][] = ["easy", "medium", "hard"];
const DIFFICULTY_LABELS: Record<Puzzle["difficulty"], string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export interface HostSetupPageProps {
  onOpenCreator: () => void;
  onRoomCreated: (data: { code: string; mode: GameMode; playlist: Puzzle[] }) => void;
}

export function HostSetupPage({ onOpenCreator, onRoomCreated }: HostSetupPageProps) {
  const [mode, setMode] = useState<GameMode>("individual");
  const [teamNamesInput, setTeamNamesInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customPuzzles] = useState(() => loadCustomPuzzles());
  const allPuzzles = [...PUZZLE_LIBRARY, ...customPuzzles];

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllInDifficulty(puzzlesInTier: Puzzle[]) {
    const allSelected = puzzlesInTier.every((p) => selectedIds.has(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const puzzle of puzzlesInTier) {
        if (allSelected) next.delete(puzzle.id);
        else next.add(puzzle.id);
      }
      return next;
    });
  }

  function buildTeams(): TeamInfo[] | undefined {
    if (mode !== "team") return undefined;
    return teamNamesInput
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map((name, index) => ({ id: `team-${index + 1}`, name }));
  }

  function handleCreateRoom() {
    const teams = buildTeams();
    getSocket().emit("host:createRoom", { mode, teams }, (response: { code: string }) => {
      const playlist = allPuzzles.filter((p) => selectedIds.has(p.id));
      onRoomCreated({ code: response.code, mode, playlist });
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-8 flex flex-col items-center gap-6">
      <h1 className="font-display text-3xl text-white font-extrabold">Set up your game</h1>

      <div className="bg-white rounded-2xl p-6 w-full max-w-lg flex flex-col gap-4">
        <fieldset className="flex gap-4">
          <label className="flex items-center gap-2 font-semibold text-chain-locked">
            <input
              type="radio"
              name="mode"
              checked={mode === "individual"}
              onChange={() => setMode("individual")}
            />
            Individual mode
          </label>
          <label className="flex items-center gap-2 font-semibold text-chain-locked">
            <input type="radio" name="mode" checked={mode === "team"} onChange={() => setMode("team")} />
            Team mode
          </label>
        </fieldset>

        {mode === "team" && (
          <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
            Team names (comma separated)
            <input
              className="border-2 border-chain-purple/30 rounded-lg px-3 py-2"
              value={teamNamesInput}
              onChange={(e) => setTeamNamesInput(e.target.value)}
              placeholder="Red Team, Blue Team"
            />
          </label>
        )}

        <button
          type="button"
          onClick={onOpenCreator}
          className="text-chain-purple text-sm font-semibold underline self-start"
        >
          + Create a custom puzzle
        </button>

        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-chain-locked">Puzzles for this game</span>
          <div className="flex flex-col gap-4 max-h-72 overflow-y-auto pr-1">
            {DIFFICULTY_ORDER.map((difficulty) => {
              const puzzlesInTier = allPuzzles.filter((p) => p.difficulty === difficulty);
              if (puzzlesInTier.length === 0) return null;
              const allSelected = puzzlesInTier.every((p) => selectedIds.has(p.id));

              return (
                <div key={difficulty} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-chain-purple">
                      {DIFFICULTY_LABELS[difficulty]}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleAllInDifficulty(puzzlesInTier)}
                      className="text-xs font-semibold text-chain-purple underline"
                    >
                      {allSelected ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  {puzzlesInTier.map((puzzle) => (
                    <label key={puzzle.id} className="flex items-center gap-2 text-chain-locked">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(puzzle.id)}
                        onChange={() => toggleSelected(puzzle.id)}
                      />
                      {puzzle.category} — {puzzle.words[0]}...{puzzle.words[puzzle.words.length - 1]}
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          disabled={selectedIds.size === 0}
          onClick={handleCreateRoom}
          className="bg-chain-yellow disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_0_#e0b800] rounded-full py-3 font-display font-extrabold text-chain-locked"
        >
          Create Room
        </button>
      </div>
    </div>
  );
}
