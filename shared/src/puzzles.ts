import type { Puzzle } from "./types.js";

// Every chain is a sequence of standalone words where each adjacent pair
// forms a real, common compound word or two-word phrase (e.g. COFFEE +
// TABLE = "coffee table", TABLE + SALT = "table salt") — the same format
// used by published word-chain games like ChainWhich and Game On Family's
// Word Chain. Several easy chains below are drawn directly from those
// published puzzles; medium/hard chains extend a verified chain with
// additional manually-checked links. Difficulty is driven primarily by
// length: easy = 7 words (5 blanks), medium = 9 words (7 blanks), hard = 11
// words (9 blanks).

export const PUZZLE_LIBRARY: Puzzle[] = [
  // --- Easy: 7 words, 5 blanks (105s) ---
  {
    id: "surround-park",
    category: "Everyday",
    difficulty: "easy",
    words: ["SURROUND", "SOUND", "WAVE", "POOL", "CUE", "BALL", "PARK"],
    timeCapSeconds: 105,
  },
  {
    id: "speaker-ticket",
    category: "Sports",
    difficulty: "easy",
    words: ["SPEAKER", "STAND", "STILL", "WATER", "SKI", "LIFT", "TICKET"],
    timeCapSeconds: 105,
  },
  {
    id: "canyon-bowl",
    category: "Everyday",
    difficulty: "easy",
    words: ["CANYON", "WALL", "SHELF", "LIFE", "GUARD", "DOG", "BOWL"],
    timeCapSeconds: 105,
  },
  {
    id: "response-play",
    category: "Sports",
    difficulty: "easy",
    words: ["RESPONSE", "TIME", "TABLE", "TOP", "HAT", "TRICK", "PLAY"],
    timeCapSeconds: 105,
  },
  {
    id: "thunder-point",
    category: "School",
    difficulty: "easy",
    words: ["THUNDER", "STORM", "CLOUD", "COVER", "LETTER", "GRADE", "POINT"],
    timeCapSeconds: 105,
  },

  // --- Medium: 9 words, 7 blanks (135s) ---
  {
    id: "glove-clip",
    category: "School",
    difficulty: "medium",
    words: ["GLOVE", "BOX", "SPRING", "BREAK", "IN", "LINE", "GRAPH", "PAPER", "CLIP"],
    timeCapSeconds: 135,
  },
  {
    id: "orange-up",
    category: "Food",
    difficulty: "medium",
    words: ["ORANGE", "JUICE", "BAR", "SOAP", "DISH", "TOWEL", "OFF", "LINE", "UP"],
    timeCapSeconds: 135,
  },
  {
    id: "tooth-screen",
    category: "Everyday",
    difficulty: "medium",
    words: ["TOOTH", "BRUSH", "WORK", "SHOP", "FLOOR", "RUG", "PAD", "LOCK", "SCREEN"],
    timeCapSeconds: 135,
  },
  {
    id: "mini-court",
    category: "Sports",
    difficulty: "medium",
    words: ["MINI", "GOLF", "BAG", "CHECK", "POINT", "BREAK", "FAST", "FOOD", "COURT"],
    timeCapSeconds: 135,
  },

  // --- Hard: 11 words, 9 blanks (165s) ---
  {
    id: "tour-bar",
    category: "Everyday",
    difficulty: "hard",
    words: ["TOUR", "GUIDE", "DOG", "HOUSE", "BOAT", "RACE", "TRACK", "RECORD", "PLAYER", "PIANO", "BAR"],
    timeCapSeconds: 165,
  },
  {
    id: "train-week",
    category: "Everyday",
    difficulty: "hard",
    words: ["TRAIN", "STATION", "HOUSE", "PARTY", "ANIMAL", "SHELTER", "DOG", "TAG", "TEAM", "SPIRIT", "WEEK"],
    timeCapSeconds: 165,
  },
  {
    id: "computer-credit",
    category: "School",
    difficulty: "hard",
    words: ["COMPUTER", "SCIENCE", "FAIR", "TRADE", "SCHOOL", "ZONE", "DEFENSE", "ATTORNEY", "GENERAL", "STORE", "CREDIT"],
    timeCapSeconds: 165,
  },
];
