export type GameMode = "individual" | "team";

export interface Puzzle {
  id: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  words: string[];
  timeCapSeconds: number;
}

export interface PlayerInfo {
  socketId: string;
  nickname: string;
  teamId: string | null;
  connected: boolean;
}

export interface TeamInfo {
  id: string;
  name: string;
}

export interface RoundActivityEvent {
  type: "hint" | "correct";
  entrantId: string; // socketId (individual mode) or teamId (team mode)
  nickname: string; // the individual player's name, even in team mode
  rowIndex: number;
  word?: string; // present when type === "correct"
}

export interface RoundResult {
  entrantId: string; // socketId (individual mode) or teamId (team mode)
  displayName: string;
  finished: boolean;
  rowsSolved: number;
  totalRows: number;
  rawTimeSeconds: number | null; // null if not finished
  points: number;
}
