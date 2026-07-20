export type LetterCellState = "locked" | "solved" | "hinted" | "typing" | "empty";

export interface LetterCellProps {
  letter?: string;
  state: LetterCellState;
}

const STATE_CLASSES: Record<LetterCellState, string> = {
  locked: "bg-chain-locked text-white",
  solved: "bg-chain-green text-white",
  hinted: "bg-chain-yellow text-chain-locked shadow-[0_3px_0_#e0b800]",
  typing: "bg-white text-chain-purple border-2 border-dashed border-chain-purple",
  empty: "bg-white/40 border-2 border-dashed border-white/70",
};

export function LetterCell({ letter, state }: LetterCellProps) {
  return (
    <div
      data-testid="letter-cell"
      data-state={state}
      className={`w-9 h-9 rounded-lg flex items-center justify-center font-display font-black text-lg uppercase ${STATE_CLASSES[state]}`}
    >
      {letter ?? ""}
    </div>
  );
}
