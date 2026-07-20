import type { Puzzle } from "@wordchain/shared";

const STORAGE_KEY = "wordchain:customPuzzles";

export function loadCustomPuzzles(): Puzzle[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Puzzle[]) : [];
}

export function saveCustomPuzzle(puzzle: Puzzle): void {
  const existing = loadCustomPuzzles();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, puzzle]));
}
