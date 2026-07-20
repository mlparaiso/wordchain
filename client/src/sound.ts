const STORAGE_KEY = "wordchain:soundEnabled";

const TONE_FREQUENCIES: Record<"correct" | "wrong" | "complete", number> = {
  correct: 660,
  wrong: 220,
  complete: 880,
};

export function isSoundEnabled(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function playTone(kind: "correct" | "wrong" | "complete"): void {
  if (!isSoundEnabled()) return;

  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = TONE_FREQUENCIES[kind];
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.15);
}
