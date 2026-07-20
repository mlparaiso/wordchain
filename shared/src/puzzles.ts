import type { Puzzle } from "./types.js";

// Every chain below is manually verified link-by-link against real compound
// words or common phrases (see docs/superpowers/specs for the verification
// notes). Difficulty is driven primarily by length per product direction:
// easy = 7 words (5 blanks), medium = 9 words (7 blanks), hard = 11 words
// (9 blanks). Several medium/hard chains are deliberate extensions of an
// easier chain in the same family (e.g. the "hotdog" chain grows from
// kickstand -> bygone across tiers) so solving one primes intuition for the
// next, without ever showing more than one puzzle at a time.

export const PUZZLE_LIBRARY: Puzzle[] = [
  // --- Easy: 7 words, 5 blanks (~15s/blank + 30s buffer = 105s) ---
  {
    id: "hotdog-kickstand",
    category: "Classics",
    difficulty: "easy",
    words: ["HOT", "DOG", "TAG", "ALONG", "SIDE", "KICK", "STAND"],
    timeCapSeconds: 105,
  },
  {
    id: "newspaper-shopping",
    category: "Everyday",
    difficulty: "easy",
    words: ["NEWS", "PAPER", "BACK", "GROUND", "WORK", "SHOP", "PING"],
    timeCapSeconds: 105,
  },
  {
    id: "sunset-lesson",
    category: "Everyday",
    difficulty: "easy",
    words: ["SUN", "SET", "BACK", "PACK", "AGE", "LESS", "ON"],
    timeCapSeconds: 105,
  },
  {
    id: "football-walkout",
    category: "Sports",
    difficulty: "easy",
    words: ["FOOT", "BALL", "PARK", "WAY", "SIDE", "WALK", "OUT"],
    timeCapSeconds: 105,
  },
  {
    id: "cupcake-lineup",
    category: "Food",
    difficulty: "easy",
    words: ["CUP", "CAKE", "WALK", "WAY", "SIDE", "LINE", "UP"],
    timeCapSeconds: 105,
  },

  // --- Medium: 9 words, 7 blanks (135s) ---
  {
    id: "hotdog-bygone",
    category: "Classics",
    difficulty: "medium",
    words: ["HOT", "DOG", "TAG", "ALONG", "SIDE", "KICK", "STAND", "BY", "GONE"],
    timeCapSeconds: 135,
  },
  {
    id: "downtown-lineup",
    category: "Everyday",
    difficulty: "medium",
    words: ["DOWN", "TOWN", "SHIP", "WRECK", "AGE", "LESS", "ON", "LINE", "UP"],
    timeCapSeconds: 135,
  },
  {
    id: "overtime-stopwatch",
    category: "School",
    difficulty: "medium",
    words: ["OVER", "TIME", "LINE", "UP", "GRADE", "SCHOOL", "BUS", "STOP", "WATCH"],
    timeCapSeconds: 135,
  },
  {
    id: "playground-lesson",
    category: "School",
    difficulty: "medium",
    words: ["PLAY", "GROUND", "WORK", "OUT", "FIELD", "TRIP", "WIRE", "LESS", "ON"],
    timeCapSeconds: 135,
  },

  // --- Hard: 11 words, 9 blanks (165s) ---
  {
    id: "overtime-doghouse",
    category: "School",
    difficulty: "hard",
    words: ["OVER", "TIME", "LINE", "UP", "GRADE", "SCHOOL", "BUS", "STOP", "WATCH", "DOG", "HOUSE"],
    timeCapSeconds: 165,
  },
  {
    id: "downtown-sidewalk",
    category: "Everyday",
    difficulty: "hard",
    words: ["DOWN", "TOWN", "SHIP", "WRECK", "AGE", "LESS", "ON", "LINE", "UP", "SIDE", "WALK"],
    timeCapSeconds: 165,
  },
  {
    id: "playground-lineup",
    category: "School",
    difficulty: "hard",
    words: ["PLAY", "GROUND", "WORK", "OUT", "FIELD", "TRIP", "WIRE", "LESS", "ON", "LINE", "UP"],
    timeCapSeconds: 165,
  },
];
