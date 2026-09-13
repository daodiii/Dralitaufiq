# Prof. Dr. Ali Mohamed Salah — white rebuild, design notes

Date: 2026-09-13. Status: built autonomously from the user's brief; pull-back hero chosen 2026-09-13.
Supersedes the 2026-09-12 "lamp-lit study" spec, which is kept for reference.

## The brief

Scrap the dark site but keep it as a reference. The new page is white, very professional, very
modern, and cinematic: three sections only (hero, books, about), motion everywhere, and it must
represent the scholar's standing. The portrait is soft (a 2048×724 banner), so the hero must not
blow it up. Typeface: the Geist family (Geist Sans for everything, Geist Mono for small labels),
Amiri for Arabic. No template-looking parts.

## Direction: "north light"

A white gallery wall with real objects on it. The colour lives in the book jackets and the one
photograph; the page itself is warm paper, warm ink, and a single madder-red accent used only for
small marks (dots on the journey, the "New release" tag, focus rings, hover fills).

- Paper `oklch(98.6% 0.004 85)`, ink `oklch(19% 0.012 60)`, accent `oklch(46% 0.15 28)`. No pure
  black or white. Hairlines at 12% ink.
- Geist Variable 500 for display with tight tracking (−0.035em to −0.06em); weight contrast
  (500 vs 300) instead of italics for emphasis. Geist Mono at 0.72–0.74rem for captions, counters,
  record labels and the rail.
- Motion: GSAP 3.15 (ScrollTrigger, SplitText) + Lenis. One orchestrated opening per hero, then
  scroll-driven work. Scroll tweens are created only after the intro completes so they never
  fight it. Everything respects `prefers-reduced-motion` and degrades without JS.

## Sections

### Hero, the banner and the pull-back (settled 2026-09-13)

The hero at rest is the client's banner rebuilt for the web: the study full-bleed, and over the
text-free photograph the live layers the banner carried as pixels: the "official page" line (the
extracted PNG as a mask, silver), his name in gilded calligraphy (the PNG as a mask over a gold
gradient with a slow glint), "Sh. Prof. Dr. Ali Mohamed Salah" in Geist, and the Facebook handle.
The photograph is laid out as an explicit cover box with his face placed at 66% of the width
(50% on phones), never letting a gap open; the title block sits on the wall left of the curtain,
or at the bottom over a dark veil on phones. A short timed entrance plays on load (room breathes,
lines arrive).

Scrolling drives the pull-back the user chose: the hero pins for 1.3 viewports while the banner's
lines lift away, the room shrinks around his face and lands exactly on the printed plate, the gold
flies to its place above the name, and the page assembles (name, lede, link, record; the plate
tilts, its shadow deepens, a lamp-coloured glow spills onto the paper). Since 2026-09-14 the
assembled page is a card: warmer paper (`--paper-2`), hairline border, 22px radius, a soft
shadow, inset from the viewport by the gutter, which the banner uncovers as it shrinks into the
plate. The record (Field, Post, Works, Formed in) sits as a 2x2 block under the link, and the text
column and the plate are bottom-aligned and centred in the card. The card is sized by viewport
height too (calligraphy, gaps, lede, record and the plate's width follow `vh`, tighter under
700px tall) so the whole of it is on screen while pinned, on laptop screens included; on phones
the same card holds the stacked order. Both images come from the
user's 4x Upscayl of the banner, downsampled to 2x: `portrait-open.jpg` (4096x1588, text region
reconstructed from the wall, 140px replicated headroom) and `portrait-plate.jpg` cut from it, so
plate (x, y) = banner (x + 2720, y). The nav is light over the banner and turns to ink as the paper
appears. Reduced motion shows the banner as a still with the page below it.

The source generator lives in the session scratchpad (`banner.mjs`); the two rejected hero mockups
(Letterbox and Strip) and the once-per-session gate are gone.

### Books, "the wall" (chosen 2026-09-13 from three mockups)

All eighteen covers hang as one 6 x 3 mosaic that fills the viewport, veiled and monochrome like
an archive. The section pins for about 4.7 viewports; scrolling flies the camera into the wall and
through three stops, one per row and one per language: Arab Culture (the new release), Fiqh
al-Mahjar (Arabic), Dawada Nafta (Somali). At a stop the featured cover blooms to colour at two
thirds of the viewport height, the rest of the wall recedes into paper and the caption (mono
counter, title, subtitle, record line, "Open the book") appears in a pool of light beside it.
Between stops the camera lifts and settles the way a map flies, and a torch of colour follows the
focal point across the wall. At the end the camera pulls out to the whole library in colour with
a numbered label under every cover, so the wall doubles as the index; every tile links to
`/books/<id>`. A numbered rail on the left jumps to stops; the pointer tilts the camera a few
degrees.

Implementation notes: the grid is laid out at 380 x 570 px tiles and only ever scaled down, so no
raster is upscaled. The camera is stored as the grid point under the focal spot plus a scale, so
travel and zoom are independent; targets are function-based and the trigger uses
`invalidateOnRefresh`. Shared book helpers (featured list, captions, dominant jacket colour via
sharp) live in `src/lib/books.ts`. Under 760px or with reduced motion the same markup flows as a
labelled index grid. Deep links (`/#books`) re-land after each ScrollTrigger refresh for four
seconds because the pinned hero grows its spacer after the browser's own jump.

The two rejected mockups, "the shelf" (eighteen spines on a plank; the featured book slides out
and turns) and "the codex" (an open book whose leaves fold over), are gone with their `/mock`
pages; the tracking shot they replaced is in git history (commit 7de7dd7).

### About, "the parting" (chosen 2026-09-13 from nine mockups)

Headline, then a stage pinned for 2.4 viewports: two paper pages fill the viewport and meet at a
hairline. The left page is "Formation", the 1991-2020 record (year, degree, where) as hairline
rows set against the seam; the right is "Today", his four posts and the "Earlier" line with the
languages. Scrolling parts the pages 14vw each and fades the records to 28%; standing between the
pages is his portrait, in colour and still (26vw, 56svh); then the mission writes itself word by
word across the foot of both pages with a pool of paper behind it. Below the pin, the two-paragraph
biography at the reading measure; the mission and the roles are not repeated there. Under 760px or
with reduced motion the same markup flows stacked, without the pin.

Implementation notes: the parting is three numbers (`gap`, `fade`, `mission`) tweened on a paused
timeline that a scrubbed ScrollTrigger drives; `gap` and `fade` are written to the pin as custom
properties the CSS reads, and `mission` sets each word's opacity and lift. The eight rejected
mockups (atlas, years, orbit, worlds, matn, stamps, between, names) are gone with their `/mock`
pages and `land-dots.json`; the drawn road from Madinah to Oslo that the parting replaced is in git
history (commit a3f2d95).

## Scrolling, beat by beat (2026-09-14)

The page moves one beat per gesture. A wheel or trackpad flick, or Down/Up/PageDown/PageUp/Space/
Home/End, glides to the next beat in 0.8-1.6 s (longer moves take longer) and ignores input until
it lands plus a short tail; a gesture only counts while its delta is not shrinking, which is how
trackpad momentum is told from a fresh flick. Scrollbar drags and touch scroll freely and settle on
the nearest beat when they stop. Nav links, the wall's rail and deep links land where they point.
Under 760px and with reduced motion nothing changes: those layouts are stacked and unpinned.

The beats, read live from the pins and the layout: the banner at rest; the banner pulled back;
the "Eighteen works" headline; the wall wide; the three stops; the index; the About headline,
placed so the "All eighteen works" link shows above it; the pages meeting; the mission written
(one gesture plays the whole parting); the biography with the footer on the last screen. Beats
closer than 40px merge. `src/scripts/steps.ts` holds the controller, `smooth.ts` hands it every
gesture before Lenis through Lenis's `virtualScroll` option, and `beats()` in `motion.ts` lists
the positions.

## Assets

- `src/assets/hero/portrait-open.jpg` (4096×1588) and `portrait-plate.jpg` (1180×1448): built from
  `C:/Users/daodi/Downloads/drAli_upscayl_4x_upscayl-standard-4x.png` (the user's 4× upscale of
  the banner). The baked-in text was replaced by a per-column vertical gradient of the wall,
  smoothed across columns and feathered in; 140px of replicated headroom on top. The plate is cut
  from the finished open image at x = 2720. `portrait.jpg` and `portrait-mobile.jpg` are no longer
  referenced. `calligraphy-line.png` (the "official page" line) is now used as a mask too.
- `src/assets/hero/calligraphy-name.png`: alpha cleaned (values under 96 dropped, rest stretched)
  to remove the faint box the extraction left behind. Used only as a CSS mask over gold gradients:
  a bright gold in the dark room, a burnished gold (`--gold` tokens) on the paper.

## Verification

Built with `astro build`, served with `astro preview` (4322). Screenshots at 1440×900 and 390×844
for the hero (first paint, banner at rest, scroll progress 20/40/55/70/100%, phone at rest and
mid-pull), the wall at rest, at each of the three stops, mid-flight and pulled out, the parting at
0/40/70/100% and the biography below it, the About stacked on the phone and with reduced motion, footer.
Beat stepping: a headless run fires real wheel and key input and checks every landing both ways, a
trackpad-shaped burst and a fast wheel spin each move one beat, and native jumps settle; phones
and reduced motion still scroll freely.
No console errors. Note for future sessions: the desktop app's browser pane cannot screenshot pinned/fixed
layers once scrolled, and the Playwright MCP reorders batched calls; a scripted playwright-core
runner against the Playwright headless shell is reliable. `motion.ts` exposes `window.ScrollTrigger`
and `smooth.ts` exposes `window.__lenis` so such scripts can drive the scroll.

## Open items

- Per-book pages and the full library page (`/books`) are linked but not built.
- The `og.jpg` still shows the dark design.
- `@astrojs/check` is not installed, so `npm run check` prompts to install it.
