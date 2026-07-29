import { LinkSimple } from "@phosphor-icons/react";

export type ChainLinkState = "inert" | "active" | "solved";

const STATE_CLASSES: Record<ChainLinkState, string> = {
  inert: "bg-white/10 text-white/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]",
  active: "bg-chain-yellow/90 text-chain-locked shadow-[0_2px_0_#e0b800]",
  solved: "bg-chain-green text-white shadow-[0_2px_0_#2fa350]",
};

export interface ChainLinkProps {
  state: ChainLinkState;
}

export function ChainLink({ state }: ChainLinkProps) {
  return (
    <div
      data-testid="chain-link"
      data-state={state}
      className={`ml-2.5 my-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${STATE_CLASSES[state]}`}
    >
      <LinkSimple size={14} weight="bold" className="rotate-90" />
    </div>
  );
}
