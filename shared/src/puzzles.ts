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
  {
    id: "grocery-shift",
    category: "Everyday",
    difficulty: "easy",
    words: ["GROCERY", "STORE", "CREDIT", "CARD", "GAME", "NIGHT", "SHIFT"],
    timeCapSeconds: 105,
  },
  {
    id: "school-reef",
    category: "School",
    difficulty: "easy",
    words: ["SCHOOL", "BUS", "STOP", "SIGN", "LANGUAGE", "BARRIER", "REEF"],
    timeCapSeconds: 105,
  },
  {
    id: "birthday-party",
    category: "Food",
    difficulty: "easy",
    words: ["BIRTHDAY", "CAKE", "POP", "MUSIC", "BOX", "OFFICE", "PARTY"],
    timeCapSeconds: 105,
  },
  {
    id: "football-traffic",
    category: "Sports",
    difficulty: "easy",
    words: ["FOOTBALL", "FIELD", "GOAL", "LINE", "DRIVE", "THROUGH", "TRAFFIC"],
    timeCapSeconds: 105,
  },
  {
    id: "swimming-study",
    category: "Everyday",
    difficulty: "easy",
    words: ["SWIMMING", "POOL", "TABLE", "TENNIS", "COURT", "CASE", "STUDY"],
    timeCapSeconds: 105,
  },
  {
    id: "drawing-pad",
    category: "School",
    difficulty: "easy",
    words: ["DRAWING", "PAPER", "CLIP", "BOARD", "ROOM", "NUMBER", "PAD"],
    timeCapSeconds: 105,
  },
  {
    id: "sun-pipe",
    category: "Everyday",
    difficulty: "easy",
    words: ["SUN", "FLOWER", "POT", "HOLE", "PUNCH", "BAG", "PIPE"],
    timeCapSeconds: 105,
  },
  {
    id: "basket-tender",
    category: "Sports",
    difficulty: "easy",
    words: ["BASKET", "BALL", "PARK", "WAY", "SIDE", "BAR", "TENDER"],
    timeCapSeconds: 105,
  },
  {
    id: "pizza-way",
    category: "Food",
    difficulty: "easy",
    words: ["PIZZA", "BOX", "CAR", "POOL", "SIDE", "WALK", "WAY"],
    timeCapSeconds: 105,
  },
  {
    id: "home-less",
    category: "School",
    difficulty: "easy",
    words: ["HOME", "WORK", "OUT", "FIELD", "TRIP", "WIRE", "LESS"],
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
  {
    id: "peanut-plan",
    category: "Food",
    difficulty: "medium",
    words: ["PEANUT", "BUTTER", "KNIFE", "BLOCK", "PARTY", "LINE", "DANCE", "FLOOR", "PLAN"],
    timeCapSeconds: 135,
  },
  {
    id: "home-mechanism",
    category: "Everyday",
    difficulty: "medium",
    words: ["HOME", "OFFICE", "SUPPLY", "CHAIN", "REACTION", "TIME", "ZONE", "DEFENSE", "MECHANISM"],
    timeCapSeconds: 135,
  },
  {
    id: "national-model",
    category: "Everyday",
    difficulty: "medium",
    words: ["NATIONAL", "PARK", "BENCH", "PRESS", "CONFERENCE", "ROOM", "TEMPERATURE", "SCALE", "MODEL"],
    timeCapSeconds: 135,
  },
  {
    id: "base-lift",
    category: "Sports",
    difficulty: "medium",
    words: ["BASE", "BALL", "PARK", "RANGER", "STATION", "WAGON", "WHEEL", "CHAIR", "LIFT"],
    timeCapSeconds: 135,
  },
  {
    id: "snow-session",
    category: "Everyday",
    difficulty: "medium",
    words: ["SNOW", "BALL", "GAME", "SHOW", "CASE", "STUDY", "GROUP", "THERAPY", "SESSION"],
    timeCapSeconds: 135,
  },
  {
    id: "drum-guard",
    category: "School",
    difficulty: "medium",
    words: ["DRUM", "STICK", "FIGURE", "HEAD", "LINE", "UP", "GRADE", "POINT", "GUARD"],
    timeCapSeconds: 135,
  },
  {
    id: "space-rail",
    category: "Everyday",
    difficulty: "medium",
    words: ["SPACE", "SUIT", "CASE", "STUDY", "HALL", "WAY", "POINT", "GUARD", "RAIL"],
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
  {
    id: "icecream-game",
    category: "Food",
    difficulty: "hard",
    words: ["ICE", "CREAM", "CHEESE", "PLATE", "GLASS", "CEILING", "FAN", "CLUB", "SANDWICH", "BOARD", "GAME"],
    timeCapSeconds: 165,
  },
  {
    id: "after-piece",
    category: "School",
    difficulty: "hard",
    words: ["AFTER", "SCHOOL", "SUPPLY", "CLOSET", "SPACE", "BAR", "CODE", "BREAKER", "BOX", "SET", "PIECE"],
    timeCapSeconds: 165,
  },
  {
    id: "kitchen-field",
    category: "Sports",
    difficulty: "hard",
    words: ["KITCHEN", "SINK", "HOLE", "PUNCH", "LINE", "DRIVE", "WAY", "SIDE", "WALK", "OUT", "FIELD"],
    timeCapSeconds: 165,
  },
  {
    id: "coffee-town",
    category: "Food",
    difficulty: "hard",
    words: ["COFFEE", "TABLE", "SALT", "WATER", "MELON", "PATCH", "WORK", "OUT", "LET", "DOWN", "TOWN"],
    timeCapSeconds: 165,
  },
  {
    id: "soccer-trip",
    category: "Sports",
    difficulty: "hard",
    words: ["SOCCER", "BALL", "GAME", "NIGHT", "STAND", "STILL", "LIFE", "GUARD", "RAIL", "ROAD", "TRIP"],
    timeCapSeconds: 165,
  },
  {
    id: "library-pack",
    category: "School",
    difficulty: "hard",
    words: ["LIBRARY", "BOOK", "WORM", "HOLE", "PUNCH", "CARD", "BOARD", "WALK", "OUT", "BACK", "PACK"],
    timeCapSeconds: 165,
  },
  {
    id: "butter-law",
    category: "Food",
    difficulty: "hard",
    words: ["BUTTER", "FLY", "OVER", "COAT", "TAIL", "GATE", "CRASH", "COURSE", "WORK", "OUT", "LAW"],
    timeCapSeconds: 165,
  },
];
