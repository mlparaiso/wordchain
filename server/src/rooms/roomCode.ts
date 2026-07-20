const ADJECTIVES = ["BLUE", "RED", "GOLD", "SWIFT", "LUCKY", "BRAVE", "SUNNY", "ROYAL"];

export function generateRoomCode(randomFn: () => number = Math.random): string {
  const adjective = ADJECTIVES[Math.floor(randomFn() * ADJECTIVES.length)];
  const number = Math.floor(randomFn() * 90) + 10; // 10-99
  return `${adjective}-${number}`;
}
