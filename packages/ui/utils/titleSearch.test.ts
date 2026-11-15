import { describe, it, expect } from "vitest";
import { scoreTitle, searchByTitle } from "./titleSearch";

const ALTTP = "The Legend of Zelda: A Link to the Past";

/** Already in title order, as the selected "title" sort would leave them. */
const games = [
  { id: "castlevania", title: "Castlevania" },
  { id: "mm2", title: "Mega Man 2" },
  { id: "mmx", title: "Mega Man X" },
  { id: "smb", title: "Super Mario Bros." },
  { id: "loz", title: "The Legend of Zelda" },
  { id: "alttp", title: ALTTP },
  { id: "zelda2", title: "Zelda II: The Adventure of Link" },
];

const ids = (list: Array<{ id: string }>) => list.map((game) => game.id);

describe("scoreTitle", () => {
  it("matches a whole word in the title", () => {
    expect(scoreTitle(ALTTP, "zelda")).toBeGreaterThan(0);
  });

  it.each(["lttp", "loz", "alttp", "tloz", "link past"])("matches the abbreviation %j", (query) => {
    expect(scoreTitle(ALTTP, query)).toBeGreaterThan(0);
  });

  it("matches partial words", () => {
    expect(scoreTitle("Mega Man X", "mega x")).toBeGreaterThan(0);
  });

  it("returns 0 when the query letters are not in the title in order", () => {
    expect(scoreTitle("Mega Man 2", "mega x")).toBe(0);
    expect(scoreTitle(ALTTP, "xyzzy")).toBe(0);
  });

  it("always matches a case-insensitive substring", () => {
    for (const { title } of games) {
      for (let start = 0; start < title.length; start++) {
        for (let end = start + 1; end <= title.length; end++) {
          expect(scoreTitle(title, title.slice(start, end).toUpperCase())).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("searchByTitle", () => {
  it("returns the input unchanged for an empty query, keeping the selected sort", () => {
    const reversed = [...games].reverse();
    expect(searchByTitle(reversed, "")).toBe(reversed);
  });

  it("returns nothing when no title matches", () => {
    expect(searchByTitle(games, "xyzzy")).toEqual([]);
  });

  it("finds a title by abbreviation", () => {
    expect(ids(searchByTitle(games, "lttp"))).toEqual(["alttp"]);
  });

  it("orders results best match first", () => {
    // "Zelda II" starts with the query, so it beats the two titles that
    // contain it mid-string, even though it sorts last by title.
    expect(ids(searchByTitle(games, "zelda"))).toEqual(["zelda2", "loz", "alttp"]);
  });

  it("breaks score ties with the selected sort", () => {
    // "loz" scores both Zelda titles equally, so they keep their input order.
    expect(ids(searchByTitle(games, "loz"))).toEqual(["loz", "alttp"]);
    const reversed = [...games].reverse();
    expect(ids(searchByTitle(reversed, "loz"))).toEqual(["alttp", "loz"]);
  });

  it("keeps the discs of a multi-disc set together", () => {
    const sorted = [
      { id: "disc1", title: "Fantasy Zone (Disc 1)", discGroup: "fantasy-zone" },
      { id: "disc2", title: "Sega Ages Fantasy Zone (Disc 2)", discGroup: "fantasy-zone" },
      { id: "sequel", title: "Fantasy Zone II" },
    ];
    // Disc 2 alone scores below the sequel, which would split the set. It
    // shares disc 1's score instead, and the tie keeps the selected sort.
    expect(scoreTitle(sorted[1].title, "fantasy zone")).toBeLessThan(
      scoreTitle(sorted[2].title, "fantasy zone"),
    );
    expect(ids(searchByTitle(sorted, "fantasy zone"))).toEqual(["disc1", "disc2", "sequel"]);
  });
});
