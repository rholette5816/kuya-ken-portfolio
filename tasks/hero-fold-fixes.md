# Task: hero-fold-fixes

## Goal
Fix the five above-the-fold issues on the home hero so a cold visitor immediately understands who Ken is, what he ships, and what to do next.

## Why
The current hero pairs Ken's portrait with a figcaption that talks about a dashboard (image/copy mismatch). Pills and the secondary CTA are vague. There is no favicon and no proof strip. These are the highest-leverage changes for the home page first impression.

## Files to modify
- `app/page.tsx` — figcaption rewrite, pills rewrite, secondary CTA target, new trust strip block, swap hero `<img>` for `next/image`.
- `app/layout.tsx` — add `themeColor` to viewport export, add `icons` field if not auto-resolved.
- `app/globals.css` — add styles for the new `.trust-strip` block.
- `app/data.ts` — add a `trustProjects` array used by the trust strip.

## Files to create
- `app/icon.png` — **DO NOT GENERATE.** If `app/icon.png` does not exist after you finish all other steps, stop and report. Claude will hand-place a real icon. If a placeholder asset is needed for build to pass, use the existing `public/assets/kuya-ken-ai-business-systems.png` only if explicitly required, otherwise leave the file unreferenced.

## Constraints
- Inherits from `AGENTS.md`. Especially: no em dashes, no new npm deps, no edits to `package.json` / `next.config.mjs` / `middleware.ts` / `vercel.json`.
- All copy below is final. Do not paraphrase, shorten, or "improve" it. If anything is ambiguous, stop and report.
- Reuse existing CSS variables. Do not introduce new color hex codes.

## Exact changes

### 1. Figcaption rewrite (Option A: founder-led)

In `app/page.tsx`, the hero `<figure className="hero-card">` currently contains:

```tsx
<figcaption>
  <strong>Know what is happening today</strong>
  <span>See sales, orders, stock, and next steps in plain language.</span>
</figcaption>
```

Replace with exactly:

```tsx
<figcaption>
  <strong>Kevin Rholette Allego</strong>
  <span>I build the system. You run the business.</span>
</figcaption>
```

### 2. Hero image: swap `<img>` for `next/image`

In `app/page.tsx` hero section, the hero card currently uses:

```tsx
<img src={site.heroImage} alt="Kuya Ken AI business systems visual" />
```

Replace with:

```tsx
<Image
  src={site.heroImage}
  alt="Kevin Rholette Allego, Kuya Ken, AI business systems builder"
  width={540}
  height={675}
  priority
  sizes="(max-width: 1100px) 100vw, 540px"
/>
```

Add the import at the top of the file:

```tsx
import Image from "next/image";
```

Do **not** migrate any other `<img>` tags in the file or in other files. Hero only.

### 3. Pills rewrite

In `app/page.tsx` hero section, replace the existing `.pill-row`:

```tsx
<div className="pill-row" aria-label="Kuya Ken positioning">
  <span>Less manual work</span>
  <span>Clear daily view</span>
  <span>Easy reports</span>
</div>
```

With exactly:

```tsx
<div className="pill-row" aria-label="Kuya Ken positioning">
  <span>POS, Dashboards, AI Reports</span>
  <span>Built in weeks, not months</span>
  <span>Reports your team actually reads</span>
</div>
```

### 4. Secondary CTA: presentation to case studies

In `app/page.tsx` hero `.cta-row`, replace:

```tsx
<Link href="/presentation" className="btn secondary">Open Client Presentation</Link>
```

With exactly:

```tsx
<Link href="/case-studies" className="btn secondary">See Live Projects</Link>
```

Do **not** remove the presentation link from the header nav. It stays in the nav.

### 5. Trust strip

#### 5a. Data

In `app/data.ts`, append after the existing `industries` export:

```ts
export const trustProjects = [
  "Saiko Ramen & Sushi",
  "Hinilas Pro",
  "KRA Multi-brand Ecom"
];
```

#### 5b. Markup

In `app/page.tsx`, in the hero section, insert a new block **between** the `<p className="lead">...</p>` and the `<div className="pill-row">...</div>`. Use exactly:

```tsx
<div className="trust-strip" aria-label="Live builds and operations">
  <span className="trust-label">Live builds</span>
  <ul>
    {trustProjects.map((project) => (
      <li key={project}>{project}</li>
    ))}
  </ul>
</div>
```

Add `trustProjects` to the named import from `./data` at the top of `app/page.tsx` (alongside `caseStudies, industries, site, systems, transformations`).

#### 5c. Styles

In `app/globals.css`, add the following block. Place it directly **after** the existing `.pill-row { margin-top: 1.3rem; }` rule so the cascade order matches the visual order in the hero.

```css
.trust-strip {
  margin-top: 1.6rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem 0.85rem;
}

.trust-strip .trust-label {
  color: #98b8ff;
  font-size: var(--fs-eyebrow);
  font-weight: 900;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.trust-strip ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.trust-strip li {
  position: relative;
  color: var(--soft);
  font-size: 0.86rem;
  font-weight: 800;
  padding-right: 0.75rem;
}

.trust-strip li:not(:last-child)::after {
  content: "·";
  position: absolute;
  right: 0;
  color: var(--muted);
}
```

Add this mobile rule inside the existing `@media (max-width: 720px)` block (append after the last rule in that block, before the closing brace):

```css
.trust-strip {
  gap: 0.45rem 0.6rem;
}

.trust-strip li {
  font-size: 0.8rem;
}
```

### 6. Favicon + theme color

#### 6a. Theme color

In `app/layout.tsx`, the file currently exports `metadata`. **Add a separate `viewport` export** (Next 15 split metadata/viewport convention) directly below the existing `metadata` export:

```tsx
import type { Metadata, Viewport } from "next";
```

(Update the existing `import type { Metadata } ...` line to include `Viewport`.)

Then add:

```tsx
export const viewport: Viewport = {
  themeColor: "#0b0f17"
};
```

#### 6b. Favicon

Do **not** create or modify any binary file. If `app/icon.png` or `app/favicon.ico` does not exist, leave the favicon to Next.js defaults for now. Just report `favicon: PENDING — needs Ken to drop a real icon at app/icon.png`.

## Reference patterns
- Existing hero markup: `app/page.tsx` lines 32-57 (before changes)
- Existing CSS variable usage: `app/globals.css` `:root` block
- Metadata pattern: `app/layout.tsx` existing `metadata` export
- Data export style: `app/data.ts` existing `industries` export

## Acceptance criteria
- [ ] `grep -rn "[—–]" app` returns nothing
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `grep -n "Open Client Presentation" app/page.tsx` returns nothing
- [ ] `grep -n "Less manual work" app/page.tsx` returns nothing
- [ ] `grep -n "Know what is happening today" app/page.tsx` returns nothing
- [ ] `grep -n "trustProjects" app/page.tsx app/data.ts` returns at least 2 matches (one definition, one usage)
- [ ] `grep -n "next/image" app/page.tsx` returns at least 1 match
- [ ] `grep -n "themeColor" app/layout.tsx` returns 1 match
- [ ] `grep -n "trust-strip" app/globals.css` returns at least 2 matches (base block + mobile override)
- [ ] No new entries in `package.json` dependencies

## Out of scope
- Do not migrate other `<img>` tags to `next/image`. Hero only.
- Do not touch `app/presentation/page.tsx`, `app/case-studies/`, `app/audit/`, or any component besides what is listed.
- Do not refactor the existing `metadata` block in `app/layout.tsx`. Only add the `Viewport` import and the `viewport` export.
- Do not change the JSON-LD structured data block.
- Do not edit the `AnimatedBackground` component or its dot count.
- Do not change the H1 copy, lead copy, or eyebrow copy. Only the elements listed above.

## Notes for Codex
- The `figcaption` lives inside `<figure className="hero-card">` in `app/page.tsx`. It is the only `<figcaption>` on that page.
- The `next/image` import must be a default import: `import Image from "next/image"`.
- When inserting the trust strip, the visual hero order from top to bottom becomes: eyebrow, h1, lead, **trust strip**, pill row, cta row.
- The pill row stays as-is structurally. Only the three `<span>` text contents change.
- Do not add `as const` or any type assertion to `trustProjects`. A plain `string[]` is intended.
- If `next/image` complains about an unconfigured remote loader, ignore it. The hero image is local under `/public/assets/`, which `next/image` handles natively without config.
