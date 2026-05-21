# Task: proof-and-process-sections

## Goal
Add a swipeable Paid Media Results carousel, a 3-video Client Feedback grid, and a My Process section to the home page — and remove the old Founder section.

## Why
The portfolio now positions Ken as a full funnel builder (ads + systems). The page needs proof of ad results, client feedback videos, and a clear process section to replace the redundant founder portrait section. This completes the conversion story: positioning -> proof -> social proof -> process -> CTA.

---

## Files to create

### `app/components/ProofCarousel.tsx`
- "use client" component
- Props: `items: ProofCard[]` where `ProofCard` is:
  ```ts
  type ProofCard = {
    tag: string        // e.g. "Multi-brand eCommerce PH"
    headline: string   // big number e.g. "$4M+"
    subline: string    // e.g. "Total ad spend managed"
    stats: [string, string][]  // array of [value, label] pairs, max 3
    context: string    // e.g. "429+ campaigns · Multiple ad accounts"
  }
  ```
- Renders a horizontal scroll-snap carousel
- One card fully visible at a time; edge of next card peeks (~40px) to signal swipeability
- Arrow buttons: left/right, hide left arrow on first card, hide right arrow on last card
- Dot indicators below: one dot per card, active dot is filled
- Arrow click scrolls exactly one card width using `scrollBy`
- Use `useRef` on the scroll container and `useState` for active dot tracking
- Listen to `scroll` event on container to update active dot
- No external carousel library — pure CSS scroll snap + JS

**Scroll container CSS classes to use:** `.proof-carousel-track`
**Card CSS class:** `.proof-stat-card`
**Arrow CSS classes:** `.proof-arrow`, `.proof-arrow-left`, `.proof-arrow-right`, `.proof-arrow.hidden`
**Dots CSS class:** `.proof-dots`, `.proof-dot`, `.proof-dot.active`

### `app/components/FeedbackGrid.tsx`
- "use client" component
- Props: `videos: FeedbackVideo[]` where `FeedbackVideo` is:
  ```ts
  type FeedbackVideo = {
    src: string   // full CDN URL
    label: string // e.g. "eCommerce Client"
  }
  ```
- Renders 3 video cards in a CSS grid (3 columns desktop, 1 column mobile via CSS)
- Each card has:
  - A `<video>` element: NO autoplay, muted by default, playsInline, preload="none"
  - A play button overlay (centered, visible when paused, hides when playing)
  - Label text below the video
- Clicking play button: plays that video, pauses all others, hides that card's overlay
- Clicking a playing video: pauses it, shows overlay again
- Use `useRef<HTMLVideoElement[]>` array to track all video refs
- Use `useState<number | null>` to track which video index is playing

**CSS classes:** `.feedback-grid`, `.feedback-card`, `.feedback-video`, `.feedback-play-btn`, `.feedback-label`
**Play button:** render as a simple SVG triangle (no emoji, no icon library):
```tsx
<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
```

---

## Files to modify

### `app/data.ts`
Add these exports at the bottom of the file:

```ts
export type ProofCard = {
  tag: string
  headline: string
  subline: string
  stats: [string, string][]
  context: string
}

export const mediaResults: ProofCard[] = [
  {
    tag: "Multi-account Management",
    headline: "$4M+",
    subline: "Total ad spend managed",
    stats: [["429+", "Campaigns"], ["Multiple", "Ad accounts"], ["Active", "All markets"]],
    context: "Across eCommerce, service, and agricultural brands"
  },
  {
    tag: "International Campaign — USA",
    headline: "10x+ ROAS",
    subline: "Return on ad spend",
    stats: [["2023", "Full year"], ["Cold traffic", "Audience"], ["Website purchases", "Goal"]],
    context: "Kynship USA account — Jan to Dec 2023"
  },
  {
    tag: "Multi-brand PH Operator",
    headline: "176",
    subline: "Campaigns run simultaneously",
    stats: [["3.8x-5.3x", "ROAS range"], ["$8.3K", "Efficient spend"], ["COD + ecom", "Model"]],
    context: "Running parallel campaigns across different product lines"
  },
  {
    tag: "Low Cost Per Result",
    headline: "$0.12",
    subline: "Cost per result",
    stats: [["9.84%", "Avg CTR"], ["Website purchases", "Objective"], ["Jan-Dec 2023", "Period"]],
    context: "Consistent low CPR across test campaigns"
  },
  {
    tag: "eCommerce Purchases",
    headline: "3,264",
    subline: "Website purchases tracked",
    stats: [["$308K", "Retargeting spend"], ["COD market", "Model"], ["PH", "Market"]],
    context: "Results from purchase-objective campaigns"
  },
  {
    tag: "Agricultural Product — Cold Traffic",
    headline: "4x ROAS",
    subline: "Return on cold traffic",
    stats: [["$8.3K", "Total spend"], ["41 campaigns", "Tested"], ["$2.71", "CPM"]],
    context: "Lakatan banana bulb — Philippine cold traffic"
  }
]

export type FeedbackVideo = {
  src: string
  label: string
}

export const feedbackVideos: FeedbackVideo[] = [
  {
    src: "https://statics.pancake.vn/web-media/b9/35/f8/a5/c95de6ed6f80c36a3519345b64051da6672f044c6e8e397a500224a7-w:1280-h:720-l:8081424-t:video/mp4.mp4",
    label: "eCommerce Client"
  },
  {
    src: "https://statics.pancake.vn/web-media/98/c0/0d/28/54500fbf49f6dc3175c07041b862093d429499e45d85cbdf07204e4d-w:1440-h:900-l:36512776-t:video/mp4.mp4",
    label: "Brand Partner"
  },
  {
    src: "https://statics.pancake.vn/web-media/30/e8/03/49/15de71b02b303d39cf92c06037a2ffbb0dbc65b60675ac65180d4c2e-w:1280-h:720-l:73154462-t:video/mp4.mp4",
    label: "Service Business"
  }
]

export const processSteps = [
  {
    number: "01",
    accent: "blue",
    name: "Audit",
    body: "We map the full funnel — ads, landing page, system, and follow-up — and find where the biggest leak is."
  },
  {
    number: "02",
    accent: "mint",
    name: "Plan",
    body: "We pick the right first move. Build the system first, run ads first, or fix both together — based on what your business actually needs."
  },
  {
    number: "03",
    accent: "lime",
    name: "Build",
    body: "I build the system and set up the ads. Everything is designed to work together from day one."
  },
  {
    number: "04",
    accent: "amber",
    name: "Launch and Optimize",
    body: "We go live, track results, and improve based on real data — not guesswork."
  }
]
```

### `app/page.tsx`

1. Add imports at top:
   ```ts
   import ProofCarousel from "./components/ProofCarousel"
   import FeedbackGrid from "./components/FeedbackGrid"
   import { funnelStages, industries, mediaResults, feedbackVideos, processSteps, site, transformations, trustProjects } from "./data"
   ```
   Remove `systems` from the import (it is no longer used on this page).

2. **Remove** the entire old `<section className="section founder-section">` block (the one with `.founder-portrait` video and `.founder-stats`).

3. **Add** the following three sections in this exact order, placed between the `funnel-why-section` and the `ai-section`:

**Section A — Paid Media Results:**
```tsx
<section className="section">
  <SectionLabel>Paid Media Results</SectionLabel>
  <h2>Real campaigns. Real numbers.</h2>
  <p className="lead">
    These are results from actual Meta Ads campaigns — not estimates, not projections.
  </p>
  <ProofCarousel items={mediaResults} />
</section>
```

**Section B — Client Feedback:**
```tsx
<section className="section">
  <SectionLabel>Client Feedback</SectionLabel>
  <h2>Hear it from the people who worked with me.</h2>
  <FeedbackGrid videos={feedbackVideos} />
</section>
```

**Section C — My Process:**
```tsx
<section className="section process-section">
  <SectionLabel>How It Works</SectionLabel>
  <h2>From audit to live system in four steps.</h2>
  <div className="process-steps">
    {processSteps.map((step, i) => (
      <div key={step.number} className={`process-step accent-${step.accent}`}>
        {i < processSteps.length - 1 && <div className="process-connector" />}
        <div className="process-number">{step.number}</div>
        <strong className="process-name">{step.name}</strong>
        <p className="process-body">{step.body}</p>
      </div>
    ))}
  </div>
  <div className="cta-row" style={{ marginTop: "2rem" }}>
    <AuditPopup>Start with a Free Audit</AuditPopup>
  </div>
</section>
```

### `app/globals.css`
Add all new CSS at the end of the file, before the last closing media query block (find the last `@media` block and insert before it, or append after all existing rules).

```css
/* ── Proof carousel ──────────────────────────────────── */
.proof-carousel-wrap {
  position: relative;
  margin-top: 2rem;
}

.proof-carousel-track {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 0.5rem;
}

.proof-carousel-track::-webkit-scrollbar {
  display: none;
}

.proof-stat-card {
  flex: 0 0 calc(100% - 40px);
  scroll-snap-align: start;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  background: rgba(18, 24, 35, 0.72);
  backdrop-filter: blur(14px);
  padding: 1.8rem 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.proof-card-tag {
  font-size: var(--fs-eyebrow);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--blue);
}

.proof-card-hero {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.proof-card-headline {
  font-size: clamp(2.8rem, 6vw, 4.5rem);
  font-weight: 900;
  line-height: 1;
  color: var(--soft);
}

.proof-card-subline {
  font-size: 0.95rem;
  color: var(--muted);
}

.proof-card-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}

.proof-card-stats article {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.04);
}

.proof-card-stats strong {
  font-size: 1rem;
  color: var(--soft);
  line-height: 1.2;
}

.proof-card-stats span {
  font-size: 0.75rem;
  color: var(--muted);
}

.proof-card-context {
  font-size: 0.82rem;
  color: var(--muted);
  border-top: 1px solid var(--line-soft);
  padding-top: 0.85rem;
}

.proof-arrows {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
}

.proof-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--line-soft);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: var(--soft);
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s, opacity 0.2s;
}

.proof-arrow:hover {
  background: rgba(255, 255, 255, 0.12);
}

.proof-arrow.hidden {
  opacity: 0;
  pointer-events: none;
}

.proof-dots {
  display: flex;
  gap: 0.45rem;
}

.proof-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--line);
  transition: background 0.2s, transform 0.2s;
}

.proof-dot.active {
  background: var(--blue);
  transform: scale(1.3);
}

/* ── Feedback grid ───────────────────────────────────── */
.feedback-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.15rem;
  margin-top: 2rem;
}

.feedback-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: rgba(18, 24, 35, 0.72);
  backdrop-filter: blur(14px);
}

.feedback-video-wrap {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #0a0e18;
  cursor: pointer;
}

.feedback-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feedback-play-btn {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.38);
  transition: opacity 0.2s;
}

.feedback-play-btn svg {
  width: 52px;
  height: 52px;
  color: #fff;
  filter: drop-shadow(0 2px 12px rgba(0,0,0,0.6));
}

.feedback-play-btn.hidden {
  opacity: 0;
  pointer-events: none;
}

.feedback-label {
  padding: 0 1rem 1rem;
  font-size: 0.84rem;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

/* ── My Process section ──────────────────────────────── */
.process-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-top: 2rem;
  position: relative;
}

.process-step {
  position: relative;
  padding: 1.4rem 1.2rem 1.4rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.process-step:not(:last-child) {
  padding-right: 2rem;
}

.process-connector {
  position: absolute;
  top: 2rem;
  right: 0;
  width: 2rem;
  height: 2px;
  background: linear-gradient(to right, var(--line-soft), transparent);
}

.process-number {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 900;
  line-height: 1;
  opacity: 0.22;
}

.process-step.accent-blue  .process-number { color: var(--blue); }
.process-step.accent-mint  .process-number { color: var(--mint); }
.process-step.accent-lime  .process-number { color: var(--lime); }
.process-step.accent-amber .process-number { color: var(--amber); }

.process-name {
  font-size: 1.05rem;
  color: var(--soft);
  line-height: 1.2;
}

.process-step.accent-blue  .process-name { color: var(--blue); }
.process-step.accent-mint  .process-name { color: var(--mint); }
.process-step.accent-lime  .process-name { color: var(--lime); }
.process-step.accent-amber .process-name { color: var(--amber); }

.process-body {
  font-size: 0.88rem;
  color: var(--muted);
  line-height: 1.6;
  margin: 0;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 900px) {
  .feedback-grid {
    grid-template-columns: 1fr;
  }

  .process-steps {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .process-step {
    padding-right: 0;
    border-left: 2px solid var(--line-soft);
    padding-left: 1.2rem;
  }

  .process-connector {
    display: none;
  }
}

@media (max-width: 1100px) {
  .feedback-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## Files to delete
None. Do not delete `AnimatedBackground.tsx` — it is imported nowhere now but leave the file in place.

---

## Constraints (beyond AGENTS.md)
- No em dashes anywhere in copy — use "to" or a comma instead
- No autoplay on feedback videos — user must click to play
- No external libraries — no Swiper, no Embla, no Framer Motion
- ProofCarousel and FeedbackGrid must be "use client" — they use useState and useRef
- processSteps and mediaResults and feedbackVideos come from data.ts — do not hardcode in page.tsx
- The `systems` export from data.ts is no longer imported in page.tsx — remove it from the import only, do not delete the export from data.ts
- Do not touch: presentation/page.tsx, system/page.tsx, audit/page.tsx, resume/page.tsx, layout.tsx

## Acceptance criteria
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No em dashes in any new copy (`grep -rn "[—–]" app/components/ProofCarousel.tsx app/components/FeedbackGrid.tsx app/page.tsx`)
- [ ] ProofCarousel renders 6 cards with arrow nav and dots
- [ ] Left arrow hidden on card 1, right arrow hidden on card 6
- [ ] Clicking arrow scrolls exactly one card
- [ ] FeedbackGrid renders 3 video cards
- [ ] Videos do NOT autoplay on page load
- [ ] Clicking play on video 2 while video 1 is playing pauses video 1
- [ ] process-steps renders 4 steps in a row on desktop
- [ ] Old founder-section block is gone from page.tsx
- [ ] No console errors in browser

## Out of scope
- Do not change any existing sections (hero, before/after, funnel stages, why this works, ai-section, who I help, FAQ, final CTA)
- Do not modify globals.css existing rules — only append new rules
- Do not change data.ts existing exports — only add new ones
- Do not touch layout.tsx

## Notes for Codex
- The `accent-*` CSS pattern already exists in globals.css for other components — follow the same pattern for process steps
- CSS variable names: `--blue`, `--mint`, `--lime`, `--amber`, `--bg`, `--panel`, `--text`, `--muted`, `--soft`, `--line`, `--line-soft`, `--radius-xl`, `--radius-lg`, `--radius-md`
- The page uses Next.js 15 App Router. Server components by default. Only add "use client" to ProofCarousel and FeedbackGrid.
- AuditPopup is already imported in page.tsx — no need to re-import
- SectionLabel is a local function in page.tsx, not an import
