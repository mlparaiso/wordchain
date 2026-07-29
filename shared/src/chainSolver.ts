export const WRONG_GUESS_PENALTY_SECONDS = 3;
export const HINT_PENALTY_SECONDS = 5;

export interface ChainState {
  words: string[];
  topSolved: number;
  bottomSolved: number;
  revealedLetters: number[];
  penaltySeconds: number;
}

// Every blank word (everything but the two given clue rows) gets its first letter
// revealed for free at round start, as a toehold — free because it doesn't add to
// penaltySeconds, unlike a player-triggered hint via applyHint.
function isBlankIndex(index: number, wordCount: number): boolean {
  return index >= 1 && index <= wordCount - 2;
}

export function createChainState(words: string[]): ChainState {
  const revealedLetters = words.map((_, index) => (isBlankIndex(index, words.length) ? 1 : 0));
  return {
    words,
    topSolved: 0,
    bottomSolved: words.length - 1,
    revealedLetters,
    penaltySeconds: 0,
  };
}

export function getActiveRowsFromBounds(topSolved: number, bottomSolved: number): number[] {
  const top = topSolved + 1;
  const bottom = bottomSolved - 1;
  if (top > bottom) return [];
  if (top === bottom) return [top];
  return [top, bottom];
}

export function getActiveRows(state: ChainState): number[] {
  return getActiveRowsFromBounds(state.topSolved, state.bottomSolved);
}

export function isComplete(state: ChainState): boolean {
  return state.topSolved + 1 > state.bottomSolved - 1;
}

function assertActive(state: ChainState, rowIndex: number): void {
  if (!getActiveRows(state).includes(rowIndex)) {
    throw new Error(`Row ${rowIndex} is not active`);
  }
}

export function submitGuess(
  state: ChainState,
  rowIndex: number,
  guess: string
): { state: ChainState; correct: boolean } {
  assertActive(state, rowIndex);
  const normalized = guess.trim().toUpperCase();
  const correct = normalized === state.words[rowIndex].toUpperCase();

  if (!correct) {
    return {
      state: { ...state, penaltySeconds: state.penaltySeconds + WRONG_GUESS_PENALTY_SECONDS },
      correct: false,
    };
  }

  const next: ChainState = { ...state };
  if (rowIndex === state.topSolved + 1) next.topSolved = rowIndex;
  if (rowIndex === state.bottomSolved - 1) next.bottomSolved = rowIndex;
  return { state: next, correct: true };
}

export function applyHint(state: ChainState, rowIndex: number): ChainState {
  assertActive(state, rowIndex);
  const wordLength = state.words[rowIndex].length;
  const currentRevealed = state.revealedLetters[rowIndex];
  if (currentRevealed >= wordLength) return state;

  const revealedLetters = [...state.revealedLetters];
  revealedLetters[rowIndex] = currentRevealed + 1;
  return {
    ...state,
    revealedLetters,
    penaltySeconds: state.penaltySeconds + HINT_PENALTY_SECONDS,
  };
}

export interface PublicChainRow {
  index: number;
  length: number;
  isClue: boolean;
  text?: string;
}

export function toPublicRows(words: string[]): PublicChainRow[] {
  return words.map((word, index) => {
    const isClue = index === 0 || index === words.length - 1;
    return isClue
      ? { index, length: word.length, isClue: true, text: word }
      : { index, length: word.length, isClue: false };
  });
}

export interface RoundStartedPayload {
  puzzleId: string;
  category: string;
  timeCapSeconds: number;
  rows: PublicChainRow[];
  startedAt: number;
  isLastRound: boolean;
}

export interface PublicBoardView {
  topSolved: number;
  bottomSolved: number;
  revealedText: Record<number, string>;
  penaltySeconds: number;
}

export function toPublicBoardView(state: ChainState): PublicBoardView {
  const revealedText: Record<number, string> = {};
  state.words.forEach((word, index) => {
    if (index <= state.topSolved || index >= state.bottomSolved) {
      revealedText[index] = word;
      return;
    }
    const revealedCount = state.revealedLetters[index];
    if (revealedCount > 0) {
      revealedText[index] = word.slice(0, revealedCount);
    }
  });
  return {
    topSolved: state.topSolved,
    bottomSolved: state.bottomSolved,
    revealedText,
    penaltySeconds: state.penaltySeconds,
  };
}
