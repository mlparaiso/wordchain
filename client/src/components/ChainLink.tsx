import { LinkSimple } from "@phosphor-icons/react";

export type ChainLinkState = "inert" | "active" | "solved";

const STATE_CLASSES: Record<ChainLinkState, string> = {
  inert: "text-white/25",
  active: "text-chain-yellow",
  solved: "text-chain-green",
};

export interface ChainLinkProps {
  state: ChainLinkState;
}

export function ChainLink({ state }: ChainLinkProps) {
  return (
    <div className="pl-1 py-0.5" data-testid="chain-link" data-state={state}>
      <LinkSimple size={16} weight="bold" className={`rotate-90 transition-colors duration-300 ${STATE_CLASSES[state]}`} />
    </div>
  );
}
