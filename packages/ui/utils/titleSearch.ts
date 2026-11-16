import { defaultFilter } from "cmdk";

interface Searchable {
  title: string;
  discGroup?: string;
}

/**
 * Fuzzy-scores `title` against `query` with the command palette's scorer.
 * Returns 0 for no match. A case-insensitive substring of the title always
 * scores above 0.
 */
export function scoreTitle(title: string, query: string): number {
  const score = defaultFilter(title, query);
  if (score > 0) {
    return score;
  }
  return title.toLowerCase().includes(query.toLowerCase()) ? Number.MIN_VALUE : 0;
}

/**
 * Keeps the games whose title fuzzy-matches `query`, best match first.
 *
 * `games` should already be in the selected sort order: equal scores keep
 * their input order. Discs of a multi-disc set share their best disc's score,
 * so a set stays together. An empty query returns `games` unchanged.
 */
export function searchByTitle<T extends Searchable>(games: Array<T>, query: string): Array<T> {
  if (!query) {
    return games;
  }

  const scores = new Map<T, number>();
  const groupScores = new Map<string, number>();
  for (const game of games) {
    const score = scoreTitle(game.title, query);
    if (score <= 0) {
      continue;
    }
    scores.set(game, score);
    if (game.discGroup != null) {
      groupScores.set(game.discGroup, Math.max(groupScores.get(game.discGroup) ?? 0, score));
    }
  }

  const rank = (game: T) =>
    game.discGroup != null ? (groupScores.get(game.discGroup) ?? 0) : (scores.get(game) ?? 0);

  // Array.prototype.sort is stable, so ties keep the selected sort.
  return games.filter((game) => scores.has(game)).sort((a, b) => rank(b) - rank(a));
}
