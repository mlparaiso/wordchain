import { useState } from "react";
import { PUZZLE_LIBRARY, type Puzzle } from "@wordchain/shared";
import { loadCustomPuzzles } from "../customPuzzles.js";

export interface SoloDifficultyPageProps {
  onPuzzleChosen: (puzzle: Puzzle) => void;
  onBack: () => void;
}

const DIFFICULTIES: { key: Puzzle["difficulty"]; label: string; blurb: string }[] = [
  { key: "easy", label: "Easy", blurb: "Short chains, everyday words" },
  { key: "medium", label: "Medium", blurb: "Longer chains, a bit trickier" },
  { key: "hard", label: "Hard", blurb: "Long chains, tougher vocabulary" },
];

export function SoloDifficultyPage({ onPuzzleChosen, onBack }: SoloDifficultyPageProps) {
  const [customPuzzles] = useState(() => loadCustomPuzzles());
  const allPuzzles = [...PUZZLE_LIBRARY, ...customPuzzles];

  function pickDifficulty(difficulty: Puzzle["difficulty"]) {
    const pool = allPuzzles.filter((p) => p.difficulty === difficulty);
    const puzzle = pool[Math.floor(Math.random() * pool.length)];
    onPuzzleChosen(puzzle);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="font-display text-3xl text-white font-extrabold">Solo Practice</h1>
      <p className="text-white/80 font-body text-center">
        Pick a difficulty — you'll get a random puzzle from that tier.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => pickDifficulty(d.key)}
            className="bg-white rounded-2xl px-6 py-4 text-left shadow-lg"
          >
            <span className="block font-display font-extrabold text-chain-locked text-lg uppercase tracking-wide">
              {d.label}
            </span>
            <span className="block text-chain-locked/70 text-sm font-body">{d.blurb}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onBack} className="text-white/80 text-sm font-semibold underline">
        Back
      </button>
    </div>
  );
}
