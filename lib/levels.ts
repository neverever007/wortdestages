export type Level = {
  key: string;
  name: string;
  minXp: number;
};

// Punkte-System: 1 Punkt/Tag öffnen + 1 Punkt/Wort benutzt
// Nach 30 Tagen täglichem Öffnen: ~30 Punkte → sollte Rang 2 erreichen
export const LEVELS: Level[] = [
  { key: 'wortneuling',  name: 'Wortneuling',  minXp: 0  },
  { key: 'wortsucher',   name: 'Wortsucher',   minXp: 20 },
  { key: 'wortkenner',   name: 'Wortkenner',   minXp: 60 },
  { key: 'wortmeister',  name: 'Wortmeister',  minXp: 150 },
  { key: 'wortlegende',  name: 'Wortlegende',  minXp: 300 },
];

export function getLevelForXp(xp: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.minXp) current = level;
  }
  return current;
}

export function getNextLevel(xp: number): Level | null {
  const current = getLevelForXp(xp);
  const idx = LEVELS.findIndex((l) => l.key === current.key);
  return LEVELS[idx + 1] ?? null;
}

export function getLevelProgress(xp: number): {
  current: Level; next: Level | null; progressFraction: number; xpToNext: number | null;
} {
  const current = getLevelForXp(xp);
  const next = getNextLevel(xp);
  if (!next) return { current, next: null, progressFraction: 1, xpToNext: null };
  const span = next.minXp - current.minXp;
  const progress = xp - current.minXp;
  return { current, next, progressFraction: Math.min(1, progress / span), xpToNext: next.minXp - xp };
}

export function didLevelUp(xpBefore: number, xpAfter: number): boolean {
  return getLevelForXp(xpBefore).key !== getLevelForXp(xpAfter).key;
}
