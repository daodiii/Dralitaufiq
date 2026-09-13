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
tilts, its shadow deepens, a lamp-coloured glow spills onto the paper). Both images come from the
user's 4x Upscayl of the banner, downsampled to 2x: `portrait-open.jpg` (4096x1588, text region
reconstructed from the wall, 140px replicated headroom) and `portrait-plate.jpg` cut from it, so
plate (x, y) = banner (x + 2720, y). The nav is light over the banner and turns to ink as the paper
appears. Reduced motion shows the banner as a still with the page below it.

The source generator lives in the session scratchpad (`banner.mjs`); the two rejected hero mockups
(Letterbox and Strip) and the once-per-session gate are gone.

### Books, "the tracking shot"

Six featured covers (Arab Culture, Jurisprudence in the Western Diaspora, The Abrahamic Paradigm,
Deal Breakers in Marriage, Fiqh al-Mahjar, Dawada Nafta) hang in a white 3D space. The section
pins for about six viewports; scrolling dollies the camera through them with a hold at each book.
Each book is a real object: cover, spine tinted from the jacket's dominant colour, page edge,
floor shadow, idle float. Distance is expressed with a white veil and a blur on the cover image
only (blur on a 3D parent would flatten the faces). The caption (mono counter, title, subtitle,
record line, "Open the book") crossfades at each station; a numbered rail on the right jumps to
stations; the pointer tilts the whole camera. Under 760px or with reduced motion the same markup
flows as a vertical list with inline captions. Book links go to `/books/<id>` (pages not built yet).

### About

Headline, a monochrome plate that blooms to colour on hover, the two-paragraph biography, the
mission as a large light-weight statement (no quotation glyph), then "Formation": the road from
Madinah to Oslo drawn as a path that strokes on scroll, each stop lighting up as the line reaches
it (a vertical list on phones). "Today" is a hairline record of his roles.

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
mid-pull), the tracking shot at stations 1, 5 and 6 and mid-move, About, footer.
No console errors. Note for future sessions: the desktop app's browser pane cannot screenshot pinned/fixed
layers once scrolled, and the Playwright MCP reorders batched calls; a scripted playwright-core
runner against the Playwright headless shell is reliable. `motion.ts` exposes `window.ScrollTrigger`
and `smooth.ts` exposes `window.__lenis` so such scripts can drive the scroll.

## Open items

- Per-book pages and the full library page (`/books`) are linked but not built.
- The `og.jpg` still shows the dark design.
- `@astrojs/check` is not installed, so `npm run check` prompts to install it.
