# Task: homepage-critical-fixes

## Goal
Fix five high-impact issues on the homepage: unify CTA copy, replace hero metrics with real proof numbers, inline proof screenshots into the carousel cards, add a semantic footer, and clean the public nav.

## Why
The portfolio site currently buries its strongest proof (PHP 100M+ revenue, $4M+ ad spend, 429+ campaigns) in a lower section while the hero shows vague labels ("Full funnel end to end"). The proof carousel hides screenshots behind a button click. The CTA text has four different wordings. The public nav exposes internal pages. There is no footer. These are the highest-priority fixes from a full UX audit.

## Files to modify

- `app/page.tsx` — four changes: (1) unify CTA copy, (2) replace hero metrics, (3) update stat wall, (4) add footer
- `app/nav.ts` — remove two nav links
- `app/components/ProofCarousel.tsx` — add inline screenshot thumbnail above the stat content in each card
- `app/globals.css` — add styles for inline proof image and footer; no other changes

## Files to create
None.

## Files to delete
None.

---

## Change 1: Unify CTA copy in page.tsx

Find every `<AuditPopup>` call in `app/page.tsx` and change all button text to exactly `"Book Free Audit"`.

Current variants to replace:
- `"Book Free System Audit"` -> `"Book Free Audit"`
- `"Start with a Free Audit"` -> `"Book Free Audit"`
- `"Book Free Funnel Audit"` -> `"Book Free Audit"`

The `<AuditPopup className="nav-cta">Free Audit</AuditPopup>` in the header stays as-is (it uses a different class and is space-constrained).

---

## Change 2: Replace hero metrics with real proof numbers in page.tsx

Find this block:
```tsx
<div className="hero-metrics" aria-label="Business system outcomes">
  <span><strong>Full</strong> funnel end to end</span>
  <span><strong>AI</strong> systems and automation</span>
  <span><strong>Ads</strong> that fill the system</span>
</div>
```

Replace with:
```tsx
<div className="hero-metrics" aria-label="Proof metrics">
  <span><strong>$4M+</strong> ad spend managed</span>
  <span><strong>429+</strong> campaigns run</span>
  <span><strong>PHP 100M+</strong> revenue driven</span>
</div>
```

---

## Change 3: Expand stat wall in the "Why This Works" section in page.tsx

Find this block inside the `funnel-why-section`:
```tsx
<div className="funnel-why-stats" aria-label="Paid media proof points">
  <article>
    <strong>PHP 100M+</strong>
    <span>Revenue driven through Meta Ads funnels</span>
  </article>
  <article>
    <strong>Multi-brand</strong>
    <span>Operator running parallel ad and system stacks</span>
  </article>
  <article>
    <strong>End to end</strong>
    <span>Ads, system, automation, and reports, one builder</span>
  </article>
</div>
```

Replace with four real stats:
```tsx
<div className="funnel-why-stats" aria-label="Paid media proof points">
  <article>
    <strong>PHP 100M+</strong>
    <span>Revenue driven through Meta Ads funnels</span>
  </article>
  <article>
    <strong>$4M+</strong>
    <span>Total ad spend managed across brands</span>
  </article>
  <article>
    <strong>429+</strong>
    <span>Campaigns run across ecommerce and service brands</span>
  </article>
  <article>
    <strong>10x+ ROAS</strong>
    <span>Peak return on ad spend, Kynship USA 2023</span>
  </article>
</div>
```

Also update the CSS for `.funnel-why-stats` in `globals.css` to use a 2x2 grid on desktop:
```css
.funnel-why-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}
```

And increase the stat number font size:
```css
.funnel-why-stats strong {
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  color: var(--blue);
  line-height: 1;
}
```

---

## Change 4: Add a footer in page.tsx

After the closing `</main>` tag and before the closing `</>` fragment, add:
```tsx
<footer className="site-footer">
  <div className="footer-inner">
    <div className="footer-brand">
      <span>Kuya Ken</span>
      <small>Kevin Rholette Allego</small>
    </div>
    <p className="footer-tagline">Full funnel builder. Meta Ads, AI systems, and automation.</p>
    <nav className="footer-nav" aria-label="Footer navigation">
      <a href="/#systems">Services</a>
      <a href="/#faq">FAQ</a>
      <a href="/#audit">Contact</a>
      <a href="/system">How I Work</a>
    </nav>
    <p className="footer-copy">Kevin Rholette Allego. Philippines.</p>
  </div>
</footer>
```

Add these styles to `globals.css`:
```css
/* ── Footer ─────────────────────────────────────────── */
.site-footer {
  position: relative;
  z-index: 2;
  border-top: 1px solid var(--line-soft);
  padding: clamp(2.5rem, 5vw, 4rem) clamp(1.1rem, 4vw, 4rem);
}

.footer-inner {
  width: min(100%, 1480px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 1.2rem 2.5rem;
}

.footer-brand span {
  display: block;
  font-weight: 800;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  color: var(--soft);
}

.footer-brand small {
  display: block;
  color: var(--muted);
  font-size: 0.72rem;
}

.footer-tagline {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.footer-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.2rem;
  justify-content: flex-end;
}

.footer-nav a {
  color: var(--muted);
  font-size: 0.88rem;
  font-weight: 800;
  text-decoration: none;
  transition: color 0.2s;
}

.footer-nav a:hover {
  color: var(--soft);
}

.footer-copy {
  grid-column: 1 / -1;
  margin: 0;
  color: rgba(182, 192, 207, 0.5);
  font-size: 0.78rem;
}

@media (max-width: 680px) {
  .footer-inner {
    grid-template-columns: 1fr;
  }

  .footer-nav {
    justify-content: flex-start;
  }
}
```

---

## Change 5: Remove internal nav links in nav.ts

In `app/nav.ts`, remove the `"Presentation"` and `"OS Portal"` entries.

Current:
```ts
export const publicNavLinks = [
  { href: "/", label: "Home" },
  { href: "/presentation", label: "Presentation" },
  { href: "/resume", label: "Resume" },
  { href: "/system", label: "How I Work" },
  { href: "/system/dashboard", label: "OS Portal" }
];
```

Replace with:
```ts
export const publicNavLinks = [
  { href: "/", label: "Home" },
  { href: "/resume", label: "Resume" },
  { href: "/system", label: "How I Work" }
];
```

---

## Change 6: Inline proof screenshot in ProofCarousel.tsx

In `app/components/ProofCarousel.tsx`, add a thumbnail image at the top of each card when `card.image` exists. The image should be clickable and open the lightbox (same behavior as the current "View Screenshot" button). Remove the separate "View Screenshot" button.

Current card structure:
```tsx
<div key={card.headline + card.tag} className="proof-stat-card">
  <p className="proof-card-tag">{card.tag}</p>
  <div className="proof-card-hero">
    ...
  </div>
  <div className="proof-card-stats">...</div>
  <p className="proof-card-context">{card.context}</p>
  {card.image && (
    <button type="button" className="proof-view-btn" onClick={...}>
      View Screenshot
    </button>
  )}
</div>
```

Replace with:
```tsx
<div key={card.headline + card.tag} className="proof-stat-card">
  {card.image && (
    <button
      type="button"
      className="proof-thumb-btn"
      onClick={() => {
        setLightboxSrc(card.image!);
        setLightboxAlt(`${card.tag} ads manager result`);
      }}
      aria-label={`View ${card.tag} screenshot`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.image}
        alt={`${card.tag} ads manager result`}
        className="proof-thumb"
        loading="lazy"
      />
      <span className="proof-thumb-overlay">View Screenshot</span>
    </button>
  )}
  <p className="proof-card-tag">{card.tag}</p>
  <div className="proof-card-hero">
    ...keep existing content...
  </div>
  <div className="proof-card-stats">...keep existing...</div>
  <p className="proof-card-context">{card.context}</p>
</div>
```

Add these styles to `globals.css`:
```css
/* ── Proof card inline thumbnail ─────────────────────── */
.proof-thumb-btn {
  position: relative;
  display: block;
  width: 100%;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 1rem;
}

.proof-thumb {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--line-soft);
  transition: transform 0.25s ease;
}

.proof-thumb-btn:hover .proof-thumb {
  transform: scale(1.02);
}

.proof-thumb-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.42);
  color: var(--soft);
  font-size: 0.84rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  opacity: 0;
  transition: opacity 0.2s ease;
  border-radius: var(--radius-md);
}

.proof-thumb-btn:hover .proof-thumb-overlay,
.proof-thumb-btn:focus-visible .proof-thumb-overlay {
  opacity: 1;
}
```

Remove the `.proof-view-btn` CSS block from `globals.css` since it is no longer used.

---

## Constraints
- No new npm dependencies
- No em dashes anywhere
- Keep all existing CSS variables (--bg, --blue, --mint, etc.)
- Do not touch any file under `app/system/` or `app/presentation/`
- Do not modify `AuditPopup.tsx` or `AuditModalProvider.tsx`
- TypeScript must pass: `npx tsc --noEmit`
- Preserve the existing ScreenshotLightbox behavior and import

## Acceptance criteria
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] All `<AuditPopup>` calls (except the nav one with `className="nav-cta"`) show "Book Free Audit"
- [ ] Hero metrics block shows `$4M+`, `429+`, `PHP 100M+`
- [ ] `funnel-why-stats` has four articles with real numbers
- [ ] ProofCarousel cards show an inline image thumbnail; clicking it opens the lightbox
- [ ] No standalone "View Screenshot" button remains in the carousel
- [ ] Public nav shows only: Home, Resume, How I Work
- [ ] A `<footer>` element exists in the DOM on the homepage
- [ ] No console errors in browser dev mode
- [ ] `grep -rn "[—–]" app` returns nothing

## Out of scope
- `app/presentation/page.tsx` — do not touch
- `app/system/` — do not touch
- `app/resume/page.tsx` — do not touch
- `app/audit/page.tsx` — do not touch
- Any image optimization or Next.js Image component changes
- Removing dead CSS (separate task)

## Notes for Codex
- The `ProofCarousel` is a client component ("use client"). The thumbnail button uses an inline `<img>` tag, not Next.js `<Image>`, to avoid requiring width/height props on dynamic images. The eslint-disable comment is intentional.
- `card.image` is typed as `string | undefined` in `ProofCard` in `data.ts`. The existing null check pattern `{card.image && ...}` is correct.
- The footer sits outside `<main>` but inside the root fragment in `page.tsx`.
