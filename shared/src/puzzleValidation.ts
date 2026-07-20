export interface PuzzleValidationError {
  message: string;
}

const LETTERS_ONLY = /^[A-Za-z]+$/;

export function validatePuzzleWords(words: string[]): PuzzleValidationError[] {
  const errors: PuzzleValidationError[] = [];

  if (words.length < 3) {
    errors.push({ message: "A puzzle needs at least 3 words (2 clues + at least 1 blank)." });
  }

  words.forEach((word, index) => {
    const trimmed = word.trim();
    if (trimmed.length === 0) {
      errors.push({ message: `Word at position ${index + 1} is empty.` });
    } else if (!LETTERS_ONLY.test(trimmed)) {
      errors.push({ message: `Word at position ${index + 1} ("${word}") must contain only letters.` });
    }
  });

  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].trim().toUpperCase() === words[i + 1].trim().toUpperCase()) {
      errors.push({ message: `Words at position ${i + 1} and ${i + 2} are identical ("${words[i]}").` });
    }
  }

  return errors;
}
