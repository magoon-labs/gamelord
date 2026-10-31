import { describe, it, expect } from "vitest";
import { ALL_GENRES, filterByGenre, getGenres } from "./genreFilter";

const games = [
  { id: "1", genre: "Platform" },
  { id: "2", genre: "Action" },
  { id: "3" },
  { id: "4", genre: "RPG" },
  { id: "5", genre: "Action" },
  { id: "6", genre: "" },
];

describe("getGenres", () => {
  it("returns distinct genres sorted alphabetically", () => {
    expect(getGenres(games)).toEqual(["Action", "Platform", "RPG"]);
  });

  it("skips games without a genre", () => {
    expect(getGenres([{ id: "1" }, { id: "2", genre: "" }])).toEqual([]);
  });

  it("returns an empty list for an empty library", () => {
    expect(getGenres([])).toEqual([]);
  });
});

describe("filterByGenre", () => {
  it("returns every game, including ones without a genre, for ALL_GENRES", () => {
    expect(filterByGenre(games, ALL_GENRES)).toBe(games);
  });

  it("keeps only games with the selected genre", () => {
    expect(filterByGenre(games, "Action").map((game) => game.id)).toEqual(["2", "5"]);
  });

  it("excludes games without a genre when a genre is selected", () => {
    expect(filterByGenre(games, "Platform").map((game) => game.id)).toEqual(["1"]);
  });

  it("returns nothing for a genre no game has", () => {
    expect(filterByGenre(games, "Puzzle")).toEqual([]);
  });
});
