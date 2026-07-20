import { Fragment, useRef, useState } from "react";
import { getActiveRowsFromBounds, type PublicBoardView, type PublicChainRow } from "@wordchain/shared";
import { ChainLink, type ChainLinkState } from "./ChainLink.js";
import { ChainRow, type ChainCellData } from "./ChainRow.js";

export interface ChainBoardProps {
  rows: PublicChainRow[];
  boardView: PublicBoardView;
  onSubmitGuess: (rowIndex: number, guess: string) => void;
  onHint: (rowIndex: number) => void;
  onTyping?: (rowIndex: number, value: string) => void;
  typingIndicator?: { rowIndex: number; nickname: string } | null;
}

export function ChainBoard({
  rows,
  boardView,
  onSubmitGuess,
  onHint,
  onTyping,
  typingIndicator,
}: ChainBoardProps) {
  const [typedByRow, setTypedByRow] = useState<Record<number, string>>({});
  const activeRows = getActiveRowsFromBounds(boardView.topSolved, boardView.bottomSolved);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  function isRowSolved(rowIndex: number): boolean {
    return rowIndex <= boardView.topSolved || rowIndex >= boardView.bottomSolved;
  }

  function linkStateBetween(rowAIndex: number, rowBIndex: number): ChainLinkState {
    if (isRowSolved(rowAIndex) && isRowSolved(rowBIndex)) return "solved";
    if (activeRows.includes(rowAIndex) || activeRows.includes(rowBIndex)) return "active";
    return "inert";
  }

  function handleChange(rowIndex: number, value: string, length: number) {
    const normalized = value.toUpperCase().slice(0, length);
    setTypedByRow((prev) => ({ ...prev, [rowIndex]: normalized }));
    onTyping?.(rowIndex, normalized);
  }

  function handleSubmit(rowIndex: number) {
    const guess = typedByRow[rowIndex] ?? "";
    if (guess.length === 0) return;
    onSubmitGuess(rowIndex, guess);
    setTypedByRow((prev) => ({ ...prev, [rowIndex]: "" }));
  }

  return (
    <div className="flex flex-col items-start">
      {rows.map((row, rowPosition) => {
        const isActive = activeRows.includes(row.index);
        const solvedFully = isRowSolved(row.index);
        const revealed = boardView.revealedText[row.index];
        const typed = typedByRow[row.index] ?? "";

        const cells: ChainCellData[] = Array.from({ length: row.length }, (_, i) => {
          if (row.isClue) return { letter: row.text?.[i], state: "locked" as const };
          if (revealed && i < revealed.length) {
            return { letter: revealed[i], state: solvedFully ? ("solved" as const) : ("hinted" as const) };
          }
          if (isActive && i < typed.length) return { letter: typed[i], state: "typing" as const };
          return { letter: undefined, state: "empty" as const };
        });

        return (
          <Fragment key={row.index}>
            <div
              className={`flex items-center gap-2${isActive ? " cursor-text" : ""}`}
              onClick={isActive ? () => inputRefs.current[row.index]?.focus() : undefined}
            >
              <ChainRow cells={cells} showHintButton={isActive} onHintClick={() => onHint(row.index)} />
              {isActive && (
                <input
                  ref={(el) => {
                    inputRefs.current[row.index] = el;
                  }}
                  aria-label={`Guess for row ${row.index}`}
                  className="sr-only"
                  value={typed}
                  maxLength={row.length}
                  onChange={(e) => handleChange(row.index, e.target.value, row.length)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit(row.index);
                  }}
                />
              )}
              {typingIndicator?.rowIndex === row.index && (
                <span className="text-white/90 text-xs italic">✏️ {typingIndicator.nickname} is typing…</span>
              )}
            </div>
            {rowPosition < rows.length - 1 && (
              <ChainLink state={linkStateBetween(row.index, rows[rowPosition + 1].index)} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
