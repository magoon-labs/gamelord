/** Select value meaning "don't filter by genre". */
export const ALL_GENRES = "all";

/** Distinct genres present in `games`, sorted alphabetically. Games without a genre are skipped. */
export function getGenres(games: ReadonlyArray<{ genre?: string }>): Array<string> {
  const genreSet = new Set<string>();
  for (const game of games) {
    if (game.genre) {
      genreSet.add(game.genre);
    }
  }
  return Array.from(genreSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Narrows `games` to the selected genre. `ALL_GENRES` returns `games` unchanged,
 * so games without a genre only appear when no genre is selected.
 */
export function filterByGenre<T extends { genre?: string }>(
  games: Array<T>,
  selectedGenre: string,
): Array<T> {
  if (selectedGenre === ALL_GENRES) {
    return games;
  }
  return games.filter((game) => game.genre === selectedGenre);
}
