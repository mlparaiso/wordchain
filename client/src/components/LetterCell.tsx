export type LetterCellState = "locked" | "solved" | "hinted" | "typing" | "empty";

export interface LetterCellProps {
  letter?: string;
  state: LetterCellState;
}

const STATE_CLASSES: Record<LetterCellState, string> = {
  locked: "bg-chain-locked text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]",
  solved: "bg-chain-green text-white shadow-[0_3px_0_#2fa350] animate-tile-pop",
  hinted: "bg-chain-yellow text-chain-locked shadow-[0_3px_0_#e0b800]",
  typing:
    "bg-white text-chain-purple border-2 border-dashed border-chain-purple shadow-[0_0_0_3px_rgba(108,92,231,0.25)]",
  empty: "bg-white/40 border-2 border-dashed border-white/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]",
};

export function LetterCell({ letter, state }: LetterCellProps) {
  return (
    <div
      data-testid="letter-cell"
      data-state={state}
      className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center font-display font-black text-base sm:text-lg uppercase shrink-0 ${STATE_CLASSES[state]}`}
    >
      {letter ?? ""}
    </div>
  );
}
