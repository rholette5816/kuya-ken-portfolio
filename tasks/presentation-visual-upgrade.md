# Task: presentation-visual-upgrade

## Goal
Turn the `/presentation` deck into a visually rich big-screen sales tool. Add per-slide color theming, stronger interpretations of each idea (numbers, mock UI, step flow), and rebuild the proof slide as the showpiece.

## Why
Ken uses this deck himself on large monitors during prospect conversations. The current deck has only one visual (slide 1) and eight text-only slides, which reads flat at projector/4K scale. Mobile parity is **not** a priority. Optimize for ≥1440px viewports.

## Files to modify
- `app/presentation/page.tsx` — slide data adds `accent` field per slide, plus inline metrics on slide 3, plus a mock report panel on slide 6, plus a fully rewritten proof block for slide 7, plus mid-deck CTAs on slides 4 and 7.
- `app/globals.css` — add per-slide accent rules, bigger typography for the deck, restyle `.pitch-counts`, restyle `.pitch-proof` as the new showpiece, add new utility classes listed below.

## Files to create
None.

## Files to delete
None.

## Constraints
- Inherits from `AGENTS.md`. No em dashes. No new npm dependencies. No icon libraries.
- Use **only** existing CSS variables for color: `--blue`, `--mint`, `--lime`, `--amber`, `--rose`. No new hex codes.
- Inline SVG only when explicitly listed below. Do not invent new SVGs.
- **Do not change** mobile breakpoints (`@media max-width: 1100px` and `@media max-width: 720px`). Leave those rules untouched. All new styles target the default desktop layout.
- Do not touch the home page, case studies pages, audit page, or the `AuditPopup` component.
- Keep all existing slide copy verbatim except where this spec explicitly rewrites it (slide 3 stats and slide 9 closer get small rewrites).

## Exact changes

### A. `app/presentation/page.tsx` — slide data + render updates

#### A1. Update the `slides` array

Replace the existing `slides` array with the following. Diff intent: add `accent` to each slide, replace slide 3 stats with concrete numbers, add a `report` payload to slide 6, no other copy changes.

```tsx
const slides = [
  {
    accent: "blue",
    eyebrow: "Client Meeting Deck",
    title: "Your business is not the problem. The manual work is.",
    body:
      "You already have demand, customers, and daily operations. The next growth block is usually messy tracking, slow reports, and repeated work.",
    points: ["Orders", "Sales", "Inventory", "Follow-up", "Reports"],
    visual: site.heroImage,
    visualAlt: "Kuya Ken AI business systems visual"
  },
  {
    accent: "rose",
    eyebrow: "The Problem",
    title: "When the work is scattered, the owner becomes the system.",
    body:
      "If everything depends on memory, chats, notebooks, and manual checking, the business can run, but it becomes hard to scale.",
    points: [
      "Orders get missed",
      "Sales are counted late",
      "Stock is hard to trust",
      "Customers are not followed up",
      "Decisions wait for manual reports",
      "The team keeps asking the owner"
    ]
  },
  {
    accent: "amber",
    eyebrow: "The Hidden Cost",
    title: "Manual work looks cheap until it starts costing sales.",
    body:
      "The real cost is not only time. It is missed customers, weak decisions, staff confusion, and slow action.",
    stats: [
      ["3 to 5 hrs", "Lost per role per week to manual checking"],
      ["20 to 30%", "Of inquiries drop with no follow-up system"],
      ["2 to 7 days", "Reports arrive after the problem already happened"]
    ]
  },
  {
    accent: "mint",
    eyebrow: "The Shift",
    title: "The goal is one clear operating system for the business.",
    body:
      "Customers use a clean front end. Your team uses a simple dashboard. You get reports that explain what to do next.",
    lanes: [
      ["Customer side", "Website, ordering, booking, forms, portal"],
      ["Team side", "POS, admin dashboard, tasks, inventory, contacts"],
      ["Owner side", "Sales view, alerts, one-click reports, AI analysis"]
    ],
    midCta: true
  },
  {
    accent: "blue",
    eyebrow: "What I Build",
    title: "I turn manual business work into tools your team can use every day.",
    body:
      "Not a fancy website only. The build is meant to help the business sell, operate, track, and improve.",
    points: [
      "POS and order systems",
      "Admin dashboards",
      "SaaS platforms",
      "Customer portals",
      "Automation flows",
      "AI report views"
    ]
  },
  {
    accent: "lime",
    eyebrow: "AI Reporting",
    title: "Your numbers should explain the next move.",
    body:
      "A good report should answer simple business questions: what is selling, what is slow, what needs attention, and what action comes next.",
    report: {
      title: "Weekly Business Report",
      lines: [
        ["Sales", "Weekends are stronger than weekdays."],
        ["Stock", "Three top items are almost out."],
        ["Customers", "Repeat buyers respond well to quick follow-up."],
        ["Next Step", "Push best-seller bundles and send reminders."]
      ]
    },
    stats: [
      ["Today", "What happened?"],
      ["Pattern", "What keeps happening?"],
      ["Next step", "What should we do now?"]
    ]
  },
  {
    accent: "blue",
    eyebrow: "Proof",
    title: "Two real builds show the kind of systems I create.",
    body:
      "Saiko shows restaurant ordering and operations. Hinilas Pro shows AI workflow, dashboard control, usage tracking, and reporting.",
    proof: true,
    midCta: true
  },
  {
    accent: "amber",
    eyebrow: "The Offer",
    title: "The free audit finds what your business should stop doing by hand.",
    body:
      "We map the manual work, pick the highest-impact fix, and turn it into a clear build plan.",
    lanes: [
      ["Step 1", "Map the current workflow"],
      ["Step 2", "Find the biggest bottleneck"],
      ["Step 3", "Plan the app, dashboard, or automation"]
    ]
  },
  {
    accent: "lime",
    eyebrow: "Next Step",
    title: "Let us find the first system your business actually needs.",
    body:
      "Start with the audit. After that, you will know what to build first, what can wait, and what should be automated.",
    cta: true
  }
];
```

#### A2. Update the render JSX

In the existing `<main className="presentation-deck">` map, the `<section className="pitch-slide">` element currently has key `slide.title`. Update it to also apply the accent as a class. Replace:

```tsx
<section className="pitch-slide" key={slide.title}>
```

With:

```tsx
<section className={`pitch-slide accent-${slide.accent}`} key={slide.title}>
```

#### A3. Render the report panel on slide 6

Inside the same `<div className="pitch-copy">` block, **after** the existing `slide.points` block and **before** the `slide.stats` block, add this new conditional block:

```tsx
{slide.report && (
  <div className="pitch-report" aria-label="Sample weekly report">
    <div className="pitch-report-bar"><i /><i /><i /><strong>{slide.report.title}</strong></div>
    <dl>
      {slide.report.lines.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  </div>
)}
```

Add `report?: { title: string; lines: [string, string][] }` to the slide shape implicitly. Codex does not need to add an explicit type — the inferred type from the array is sufficient. If TypeScript complains, add a `// @ts-expect-error optional payload` line above the conditional. Prefer making it work without that.

#### A4. Render the mid-deck CTA on slides 4 and 7

Inside the `pitch-copy` block, **after** all existing conditional blocks and **before** the closing `</div>` of `.pitch-copy`, add:

```tsx
{slide.midCta && (
  <div className="pitch-mid-cta">
    <AuditPopup className="btn primary">Skip Ahead. Book Audit.</AuditPopup>
  </div>
)}
```

#### A5. Rebuild the proof block

The current proof rendering is:

```tsx
{slide.proof && (
  <div className="pitch-proof">
    {caseStudies.map((study) => (
      <article key={study.slug}>
        <img src={study.screenshots[0].src} alt={study.screenshots[0].alt} />
        <div>
          <strong>{study.name}</strong>
          <span>{study.teaser}</span>
        </div>
      </article>
    ))}
  </div>
)}
```

Replace with the full showpiece block:

```tsx
{slide.proof && (
  <div className="pitch-proof-grid">
    {caseStudies.map((study) => (
      <article key={study.slug} className="pitch-proof-card">
        <img src={study.screenshots[0].src} alt={study.screenshots[0].alt} />
        <div className="pitch-proof-body">
          <p className="pitch-proof-type">{study.type}</p>
          <h3>{study.name}</h3>
          <p className="pitch-proof-signal">{study.signal}</p>
          <ul>
            {study.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
          </ul>
          <a href={study.url} target="_blank" rel="noreferrer" className="pitch-proof-link">
            Open live build
          </a>
        </div>
      </article>
    ))}
  </div>
)}
```

#### A6. Slide counter visibility

Find the existing element:

```tsx
<div className="pitch-count">{String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</div>
```

Wrap the value in a `<span>` and add a label:

```tsx
<div className="pitch-count">
  <span className="pitch-count-label">Slide</span>
  <span className="pitch-count-value">
    {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
  </span>
</div>
```

#### A7. Pitch-stats cards on slide 3

The existing stats render is:

```tsx
{slide.stats && (
  <div className="pitch-stats">
    {slide.stats.map(([label, value]) => (
      <article key={label}>
        <strong>{label}</strong>
        <span>{value}</span>
      </article>
    ))}
  </div>
)}
```

Keep this block exactly as-is. Slide 3 will inherit the new visual treatment via the CSS `.accent-amber .pitch-stats article` selector defined below. Slide 6 stats reuse the same component — that is intentional.

### B. `app/globals.css` — new styles

All additions go **after** the existing `.pitch-count { ... }` rule (search for `.pitch-count {` in the file). Append this entire block in the order shown.

```css
/* Slide counter (revamped) */
.pitch-count {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  align-items: flex-end;
}

.pitch-count-label {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}

.pitch-count-value {
  font-size: 1.1rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.7);
}

/* Per-slide accent: tints the eyebrow, accent rings, and key UI bits */
.pitch-slide.accent-blue { --slide-accent: var(--blue); }
.pitch-slide.accent-mint { --slide-accent: var(--mint); }
.pitch-slide.accent-lime { --slide-accent: var(--lime); }
.pitch-slide.accent-amber { --slide-accent: var(--amber); }
.pitch-slide.accent-rose { --slide-accent: var(--rose); }

.pitch-slide .eyebrow {
  color: var(--slide-accent, #98b8ff);
}

.pitch-slide::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 8% 12%, color-mix(in oklab, var(--slide-accent, var(--blue)) 22%, transparent), transparent 38%),
    radial-gradient(circle at 92% 88%, color-mix(in oklab, var(--slide-accent, var(--mint)) 14%, transparent), transparent 42%);
  opacity: 0.85;
}

.pitch-slide .pitch-stage,
.pitch-slide .pitch-count {
  position: relative;
  z-index: 1;
}

/* Bigger typography for big-screen presenter mode */
.pitch-copy h1 {
  font-size: clamp(2.05rem, 5.4vw, 5.6rem);
  letter-spacing: -0.005em;
}

.pitch-copy .lead {
  font-size: clamp(1.05rem, 1.3vw, 1.4rem);
  max-width: 64ch;
}

/* Cards (points / stats / lanes / proof) get a left accent bar tied to the slide */
.pitch-points span,
.pitch-stats article,
.pitch-lanes article {
  position: relative;
  border-color: color-mix(in oklab, var(--slide-accent, var(--line)) 26%, var(--line-soft));
}

.pitch-points span::before,
.pitch-stats article::before,
.pitch-lanes article::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.65rem;
  bottom: 0.65rem;
  width: 3px;
  border-radius: 3px;
  background: var(--slide-accent, var(--blue));
}

/* Slide 3 stats: big number on top, label below */
.pitch-stats article {
  padding: 1.2rem 1.2rem 1.1rem 1.4rem;
}

.pitch-stats strong {
  font-size: clamp(1.6rem, 2.4vw, 2.4rem);
  color: var(--slide-accent, #bdd4ff);
  letter-spacing: -0.01em;
  text-transform: none;
}

.pitch-stats span {
  font-size: clamp(0.95rem, 1.05vw, 1.1rem);
  color: var(--soft);
  line-height: 1.5;
}

/* Slide 6 mock report panel */
.pitch-report {
  margin-top: 1.5rem;
  width: min(100%, 720px);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025)),
    rgba(18, 24, 36, 0.78);
  backdrop-filter: blur(16px) saturate(130%);
  overflow: hidden;
  box-shadow: var(--shadow);
}

.pitch-report-bar {
  display: flex;
  align-items: center;
  gap: 0.46rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.06);
}

.pitch-report-bar i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--rose);
}

.pitch-report-bar i:nth-child(2) { background: var(--amber); }
.pitch-report-bar i:nth-child(3) { background: var(--lime); }

.pitch-report-bar strong {
  margin-left: 0.6rem;
  color: var(--soft);
}

.pitch-report dl {
  display: grid;
  gap: 0.7rem;
  margin: 0;
  padding: 1rem 1.1rem;
}

.pitch-report dl div {
  padding: 0.85rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
}

.pitch-report dt {
  margin-bottom: 0.3rem;
  color: var(--slide-accent, #9dc0ff);
  font-weight: 900;
  letter-spacing: 0.02em;
}

.pitch-report dd {
  margin: 0;
  color: var(--soft);
  line-height: 1.55;
}

/* Mid-deck CTA */
.pitch-mid-cta {
  margin-top: 1.7rem;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Proof showpiece (slide 7) */
.pitch-proof-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  margin-top: 1.8rem;
}

.pitch-proof-card {
  display: grid;
  grid-template-rows: auto 1fr;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-xl);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025)),
    rgba(18, 24, 36, 0.78);
  overflow: hidden;
  backdrop-filter: blur(16px) saturate(130%);
  box-shadow: var(--shadow);
}

.pitch-proof-card img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  object-position: top center;
  border-bottom: 1px solid var(--line-soft);
}

.pitch-proof-body {
  display: grid;
  gap: 0.7rem;
  padding: 1.4rem 1.5rem 1.6rem;
}

.pitch-proof-type {
  margin: 0;
  color: var(--slide-accent, var(--amber));
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.pitch-proof-card h3 {
  margin: 0;
  font-size: clamp(1.4rem, 1.8vw, 1.8rem);
  line-height: 1.2;
  font-weight: 900;
}

.pitch-proof-signal {
  margin: 0;
  color: var(--muted);
  line-height: 1.55;
  font-size: clamp(0.96rem, 1.05vw, 1.08rem);
}

.pitch-proof-card ul {
  display: grid;
  gap: 0.45rem;
  margin: 0.2rem 0 0;
  padding-left: 1.1rem;
  color: var(--soft);
  font-size: clamp(0.94rem, 1vw, 1.04rem);
}

.pitch-proof-link {
  margin-top: 0.4rem;
  width: fit-content;
  color: #a7cbff;
  font-weight: 900;
  text-decoration: none;
  letter-spacing: 0.02em;
}

.pitch-proof-link::after {
  content: " →";
}
```

### C. Mobile rules (do not touch)

Do not edit any rule inside `@media (max-width: 1100px)` or `@media (max-width: 720px)`. The deck is desktop-first by spec.

If the new `.pitch-proof-grid` looks broken below 1100px during local checking, that is acceptable. Mobile is explicitly out of scope for this task.

### D. Imports

`app/presentation/page.tsx` already imports `AuditPopup` and `caseStudies, site` from existing modules. No new imports are needed.

## Reference patterns
- Existing slide structure: `app/presentation/page.tsx` map over `slides`
- Existing report panel pattern (for visual cue): `app/page.tsx` `.report-panel` block, lines around the `.report-panel dl` rule in `app/globals.css`
- Existing case study card: `app/page.tsx` `.case-card`
- Existing CSS variable use: `app/globals.css` `:root` block

## Acceptance criteria
- [ ] `grep -rn "[—–]" app` returns nothing
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `grep -n "accent: \"" app/presentation/page.tsx` returns 9 matches (one per slide)
- [ ] `grep -n "accent-blue\|accent-mint\|accent-lime\|accent-amber\|accent-rose" app/globals.css` returns at least 5 matches
- [ ] `grep -n "pitch-proof-grid\|pitch-proof-card\|pitch-proof-body" app/globals.css app/presentation/page.tsx` returns matches in both files
- [ ] `grep -n "pitch-report\|pitch-report-bar" app/globals.css app/presentation/page.tsx` returns matches in both files
- [ ] `grep -n "pitch-mid-cta\|Skip Ahead" app/globals.css app/presentation/page.tsx` returns matches in both files
- [ ] `grep -n "pitch-count-value\|pitch-count-label" app/globals.css app/presentation/page.tsx` returns matches in both files
- [ ] No new entries in `package.json`
- [ ] The string `Open Client Presentation` does not reappear anywhere

## Out of scope
- Mobile and tablet layout. Do not modify `@media` rules.
- Keyboard navigation (arrow keys to advance). Skip for now.
- PDF export, print stylesheet. Skip.
- Slide animations or scroll-driven reveals. Skip.
- Editing copy on any slide other than slide 3 stats (which becomes concrete numbers).
- Editing the home page, case studies, audit form, or any component outside `app/presentation/page.tsx` and `app/globals.css`.

## Notes for Codex
- `color-mix(in oklab, ...)` is supported in modern Chromium, Safari, and Firefox. Required for the accent overlays. Do not substitute with rgba blending.
- The accent overlay uses a `::before` pseudo-element on `.pitch-slide`. The existing `.pitch-slide` rule does not have `position: relative` explicitly set, but it is implicit via `position: absolute` children. Verify the existing rule already has `position: relative` (it does, search for `.pitch-slide {`). If it does not, **stop and report**, do not add it on your own judgment.
- Slide 3 stats text is rewritten to be concrete numbers. These are reasonable industry estimates for SME ops. Ken approved.
- Slide 6 now has BOTH a mock report panel AND the existing Today/Pattern/Next-step stats array. Both render on the same slide. The report panel sits above the stats.
- Slide 7 proof block is fully rewritten to include `study.outcomes` (array exists in `app/data.ts`) and `study.signal` (also exists). Use them as-is, do not modify `data.ts`.
- The mid-deck CTA is the existing `<AuditPopup>` component reused. It opens the same modal as the home page CTA. No new component needed.
- If `color-mix` fails in TypeScript or in Codex's static analysis, ignore — it is a pure CSS feature and TS/lint should not flag it.
