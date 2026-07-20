import { LetterCell, type LetterCellState } from "./LetterCell.js";

export interface ChainCellData {
  letter?: string;
  state: LetterCellState;
}

export interface ChainRowProps {
  cells: ChainCellData[];
  showHintButton: boolean;
  onHintClick?: () => void;
}

export function ChainRow({ cells, showHintButton, onHintClick }: ChainRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      {cells.map((cell, i) => (
        <LetterCell key={i} letter={cell.letter} state={cell.state} />
      ))}
      {showHintButton && (
        <button
          type="button"
          title="Reveal the next letter of this word · costs 5s added to your time"
          onClick={onHintClick}
          className="ml-2 w-11 h-11 rounded-full bg-white/25 border-2 border-white text-lg flex items-center justify-center cursor-help"
        >
          💡
        </button>
      )}
    </div>
  );
}
