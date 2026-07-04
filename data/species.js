// Placeholder art: emoji + a color halo instead of sprite assets.
// Swap `emoji` for a real sprite path later without touching game logic.
export const SPECIES = [
  { id: "gecko", name: "게코", emoji: "🦎", color: "#8BC34A", size: 46, isDangerous: false, basePoints: 80 },
  { id: "chameleon", name: "카멜레온", emoji: "🦎", color: "#4CAF50", size: 54, isDangerous: false, basePoints: 100 },
  { id: "skink", name: "스킨크", emoji: "🦎", color: "#FF9800", size: 44, isDangerous: false, basePoints: 90 },
  { id: "iguana", name: "이구아나", emoji: "🦎", color: "#009688", size: 66, isDangerous: false, basePoints: 130 },
  { id: "monitor", name: "왕도마뱀", emoji: "🐊", color: "#795548", size: 96, isDangerous: true, basePoints: 0 },
  { id: "komodo", name: "코모도왕도마뱀", emoji: "🦖", color: "#5D4037", size: 118, isDangerous: true, basePoints: 0 },
];

export function pickSpawnSpecies(dangerousChance) {
  const isDangerous = Math.random() < dangerousChance;
  const pool = SPECIES.filter((s) => s.isDangerous === isDangerous);
  return pool[Math.floor(Math.random() * pool.length)];
}
