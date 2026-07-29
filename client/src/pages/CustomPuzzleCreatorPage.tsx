import { useState } from "react";
import { validatePuzzleWords } from "@wordchain/shared";
import { Button } from "../components/Button.js";
import { saveCustomPuzzle } from "../customPuzzles.js";

export interface CustomPuzzleCreatorPageProps {
  onSaved: () => void;
  onCancel: () => void;
}

export function CustomPuzzleCreatorPage({ onSaved, onCancel }: CustomPuzzleCreatorPageProps) {
  const [category, setCategory] = useState("");
  const [wordsInput, setWordsInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const words = wordsInput
      .split(",")
      .map((w) => w.trim().toUpperCase())
      .filter((w) => w.length > 0);

    const errors = validatePuzzleWords(words);
    if (errors.length > 0) {
      setError(errors[0].message);
      return;
    }

    const totalBlanks = Math.max(words.length - 2, 1);
    saveCustomPuzzle({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      category: category.trim() || "Custom",
      difficulty: "medium",
      words,
      timeCapSeconds: totalBlanks * 15 + 30,
    });
    onSaved();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-chain-purple to-chain-pink p-4 sm:p-8 flex flex-col items-center gap-6">
      <h1 className="font-display text-2xl text-white font-extrabold">Create a puzzle</h1>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
          Category
          <input
            className="border-2 border-chain-purple/30 rounded-lg px-3 py-2"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-chain-locked">
          Words (comma separated, first and last are the clues). Each word plus the
          next one should form a real two-word phrase.
          <textarea
            className="border-2 border-chain-purple/30 rounded-lg px-3 py-2"
            value={wordsInput}
            onChange={(e) => setWordsInput(e.target.value)}
            placeholder="COFFEE, TABLE, SALT, SHAKER"
          />
        </label>
        {error && <p className="text-red-600 text-sm font-semibold">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={handleSave} size="sm">
            Save Puzzle
          </Button>
          <button type="button" onClick={onCancel} className="text-chain-locked/60 text-sm font-semibold">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
