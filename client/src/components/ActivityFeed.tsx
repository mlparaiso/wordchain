import type { RoundActivityEvent } from "@wordchain/shared";

export interface ActivityEntry extends RoundActivityEvent {
  id: number;
}

export interface ActivityFeedProps {
  entries: ActivityEntry[];
}

function describe(entry: ActivityEntry): string {
  return entry.type === "hint" ? "used a hint" : `solved ${entry.word}`;
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  return (
    <div className="bg-white/90 rounded-2xl p-4 w-full lg:w-64 flex-shrink-0 flex flex-col gap-2 max-h-80 lg:max-h-[70vh] overflow-y-auto">
      <h2 className="font-display font-bold text-chain-locked text-sm uppercase tracking-wide">Activity</h2>
      {entries.length === 0 ? (
        <p className="text-chain-locked/50 text-sm">No actions yet</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <li key={entry.id} className="text-sm text-chain-locked flex items-start gap-1.5">
              <span aria-hidden="true">{entry.type === "hint" ? "💡" : "✅"}</span>
              <span>
                <strong>{entry.nickname}</strong> {describe(entry)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
