# Prof. Dr. Ali Mohamed Salah — website design spec

Date: 2026-09-12. Status: approved by default (user granted full creative control; session ran autonomously).

## Goal

Replace the template site at alimohamedsalah.com with a cinematic, authoritative author site.
Phase 1 (this spec): landing page with three sections — Hero, Books, About — plus nav and footer.
Later phases (out of scope): Lectures (11 YouTube IDs already harvested), Contact form, per-book pages, Arabic/Somali UI.

## Source material (harvested from the old site, kept in `src/data/`)

- 20 catalogue entries → 18 unique titles: 11 English, 4 Arabic, 3 Somali (two entries were duplicate editions). Covers, descriptions, Amazon / Bookshop / Barnes & Noble links per ISBN. The biography lists 20 published works in total, which is the number the About counter uses.
- The old site is source material, not a template: copy is edited and curated, never pasted wholesale.
- Full biography, education timeline, roles, mission statement, languages.
- New release: *Arab Culture and Its Pioneers in Somalia* (release date 2026-05-05) with four endorsements (Mukhtar, Baadiyow, Doodishe, Awil).
- Hero image: user's `drAli.jpg` banner (2048×724). Portrait side cropped, baked-in text inpainted out, 2× Lanczos upscale (2256×1448). A second, portrait-aspect crop with extended headroom serves phones through a `<picture>` element. Silver Thuluth calligraphy of his name lifted to a transparent PNG for reuse.

## Creative direction: "The lamp-lit study"

The banner already sets the mood: a scholar in a dark, warm, lamp-lit room. The whole site lives in that room.

- **Palette**: espresso blacks (#0e0a07 → #2f2418), parchment text (#efe6d8 / #cfc2ae / #9a8b74), brass accent (#c8a45d, light #e3c98a), lamp glow (#f0b56a) for light effects only, oxblood (#6f1d1b) reserved for one or two moments.
- **Type**: Fraunces (variable, optical sizing) for display; Instrument Sans (variable) for body and small-caps labels; Amiri for Arabic text. The hero's Arabic name uses the original calligraphy PNG, not a font.
- **Texture**: animated film grain overlay (SVG turbulence, ~4% opacity), faint eight-point-star lattice pattern behind the Books and About sections, hairline brass rules.
- **Motion** (GSAP 3.15 + Lenis): one orchestrated hero intro (portrait scale-down from 1.08, lamp glow fade, calligraphy clip-path wipe right-to-left, staggered line-mask reveals, rule draw), then scroll-driven work: portrait parallax and dimming, headline line reveals, pinned horizontal "library" shelf, drawing timeline, counters. Everything respects `prefers-reduced-motion`.

## Sections

### Hero
Full viewport. Portrait anchored right (~60% width), left edge blended into the page background, radial lamp glow breathing slowly on the right. Left column: eyebrow "Scholar · Author · Translator", calligraphy name, "Prof. Dr. Ali Mohamed Salah" in Fraunces, a two-line positioning statement, two CTAs (Explore the books / About him). Bottom rail: journey line "Madinah · Makkah · Kuala Lumpur · Oslo" and a scroll cue. Mobile: portrait on top (60svh), text below with gradient.

### Books ("The Library")
1. **New release spotlight**: large cover with pointer-tracking 3D tilt, title, "translated, edited and annotated by", short description, buy buttons, and the three endorsements cycling as a quote carousel.
2. **The shelf**: one continuous horizontal strip of all 19 books, grouped English → Arabic → Somali with a group label riding along. Desktop: section pins and scroll drives the strip (GSAP ScrollTrigger scrub) with a progress hairline; language chips scroll to the group. Mobile: native horizontal snap scroll, no pinning.
3. **Book object**: CSS 3D book (front cover, spine with vertical title, page edge). Hover: rotateY(-22°) and lift. Click: detail panel slides in from the right (bottom sheet on mobile) with full description, publisher, role (author / translator / editor), and store links. Esc / backdrop closes; focus is trapped and returned.

### About
Two columns. Left: sticky portrait (second photo from the old site) in an offset brass frame. Right: eyebrow, Fraunces headline, lead bio, mission pull-quote, four counters (30+ years, 100+ recorded courses, 19 published works, 5 languages), then a vertical education/career timeline whose line draws on scroll. A slow marquee of his teaching fields (tafsīr, ḥadīth, fiqh, uṣūl, …) separates Books and About.

### Nav and footer
Nav: fixed, transparent over the hero, becomes a translucent dark bar with a thin progress line after scrolling. Footer: name in both scripts, Facebook link, "For talks and events" line, copyright.

## Stack and structure

Astro (static output) + GSAP + Lenis, hand-written CSS with custom properties (no Tailwind), fonts self-hosted through @fontsource. Images through `astro:assets` for covers; hero served as explicit WebP/JPEG at 1× and 2×.

```
src/
  data/books.json, data/profile.json
  assets/covers/*.jpg  assets/hero/*  assets/about/*
  styles/tokens.css, global.css
  layouts/Base.astro
  components/Nav, Hero, NewRelease, Shelf, Book, BookPanel, About, Marquee, Footer, Grain
  scripts/motion.ts (GSAP timelines), scripts/panel.ts, scripts/lenis.ts
  pages/index.astro
.claude/launch.json  (astro dev on 4321, astro preview on 4322)
```

## Testing
Visual verification in the in-app browser at 1440, 1024 and 390 widths; keyboard pass on the panel and nav; reduced-motion pass; Lighthouse-style sanity (no layout shift on hero, images sized). No unit tests for a static marketing page.
