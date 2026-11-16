// A short tour of the library window: hover the cards, favorite a game,
// search, and filter by platform. It leaves the library as it found it.
// Run with: node scripts/record-demo.mjs library-tour /tmp/library-tour.mp4

const firstCard = 'role=button[name^="Play "] >> nth=0';
const secondCard = 'role=button[name^="Play "] >> nth=1';
const thirdCard = 'role=button[name^="Play "] >> nth=2';
// Scoped to the card: the button's name flips between "Favorite" and "Unfavorite".
const secondFavorite = `${secondCard} >> role=button[name=/favorite/i]`;
const search = 'input[placeholder="Search games..."]';

/** Close the account prompt that can open at startup, before recording begins. */
export async function setup(page) {
  const cancel = page.getByRole("alertdialog").getByRole("button", { name: "Cancel" });
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    await page.waitForTimeout(400);
  }
}

export const steps = [
  { caption: "Your games, with cover art" },
  { glide: firstCard },
  { wait: 500 },
  { glide: secondCard, optional: true },
  { wait: 500 },
  { glide: thirdCard, optional: true },
  { wait: 700 },

  { caption: "Favorite a game in one click" },
  { glide: secondCard, optional: true },
  // Toggle twice so the library is unchanged afterwards.
  { click: secondFavorite, optional: true },
  { wait: 700 },
  { click: secondFavorite, optional: true },
  { wait: 400 },

  { caption: "Search as you type" },
  { type: "golf", into: search },
  { wait: 1100 },
  { press: "ControlOrMeta+A" },
  { press: "Backspace" },
  { wait: 700 },

  { caption: "Filter by platform" },
  { click: 'role=button[name^="NES ("]', optional: true },
  { wait: 800 },
  { click: 'role=button[name^="All ("]' },
  { wait: 900 },
];
