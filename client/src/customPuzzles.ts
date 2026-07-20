import type { Puzzle } from "@wordchain/shared";

const STORAGE_KEY = "wordchain:customPuzzles";

export function loadCustomPuzzles(): Puzzle[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Puzzle[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomPuzzle(puzzle: Puzzle): void {
  const existing = loadCustomPuzzles();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, puzzle]));
}
