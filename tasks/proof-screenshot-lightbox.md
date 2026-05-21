# Task: proof-screenshot-lightbox

## Goal
Add a lightbox to the proof carousel so clicking "View Screenshot" on any stat card opens the full ads manager screenshot in a full-screen overlay. Remove the cropped inline screenshot from the card and replace with a clean button.

## Why
The ads manager screenshots are dense data tables. Cropped thumbnails inside the card lose the actual numbers. A lightbox gives full-resolution access on demand while keeping the carousel card clean.

---

## Files to create

### `app/components/ScreenshotLightbox.tsx`
- "use client" component
- Props:
  ```ts
  type Props = {
    src: string
    alt: string
    onClose: () => void
  }
  ```
- Renders a full-screen fixed overlay:
  - Dark semi-transparent backdrop: `rgba(0, 0, 0, 0.88)`
  - Centered `<img>` tag: `max-width: 92vw`, `max-height: 88vh`, `object-fit: contain`, `border-radius: var(--radius-lg)`
  - Close button top-right corner: X symbol, styled as a round button
  - Clicking the backdrop closes the lightbox
  - ESC key closes the lightbox (useEffect keydown listener)
  - Body scroll lock when open: `document.body.style.overflow = 'hidden'` on mount, restore on unmount
- CSS classes: `.lightbox-backdrop`, `.lightbox-img`, `.lightbox-close`
- z-index: 100 (above everything including the nav at z-index 30)

---

## Files to modify

### `app/components/ProofCarousel.tsx`
1. Add `useState<string | null>` for `lightboxSrc` — null means closed
2. Add `useState<string>` for `lightboxAlt`
3. Remove the `.proof-card-screenshot` block entirely from the card JSX (the `{card.image && (...)}` block)
4. Add a "View Screenshot" button at the bottom of each card — only render if `card.image` exists:
   ```tsx
   {card.image && (
     <button
       className="proof-view-btn"
       onClick={() => {
         setLightboxSrc(card.image!)
         setLightboxAlt(`${card.tag} ads manager result`)
       }}
     >
       View Screenshot
     </button>
   )}
   ```
5. Render `ScreenshotLightbox` below the carousel track when `lightboxSrc` is not null:
   ```tsx
   {lightboxSrc && (
     <ScreenshotLightbox
       src={lightboxSrc}
       alt={lightboxAlt}
       onClose={() => setLightboxSrc(null)}
     />
   )}
   ```
6. Import `ScreenshotLightbox` at the top

### `app/globals.css`
Append these styles after the existing `.proof-card-context` block:

```css
.proof-view-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.25rem;
  padding: 0.55rem 1rem;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--soft);
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s;
  align-self: flex-start;
}

.proof-view-btn:hover {
  background: rgba(255, 255, 255, 0.13);
}

.lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(8px);
  padding: 2rem;
  animation: lightbox-in 0.18s ease;
}

@keyframes lightbox-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.lightbox-img {
  max-width: 92vw;
  max-height: 88vh;
  object-fit: contain;
  border-radius: var(--radius-lg);
  border: 1px solid var(--line-soft);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
}

.lightbox-close {
  position: fixed;
  top: 1.2rem;
  right: 1.2rem;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1px solid var(--line-soft);
  background: rgba(20, 27, 40, 0.9);
  color: var(--soft);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  transition: background 0.2s;
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.12);
}
```

Also remove the `.proof-card-screenshot` and `.proof-card-screenshot img` blocks that were added previously — find and delete them from globals.css.

---

## Files to delete
None.

---

## Constraints (beyond AGENTS.md)
- No em dashes in any copy
- No external libraries — no lightbox package, no portal library
- The lightbox must render inside ProofCarousel.tsx — do not create a separate portal or context
- Body scroll lock must be restored on unmount — use useEffect cleanup
- ESC key listener must be removed on unmount — use useEffect cleanup
- Do not touch: FeedbackGrid.tsx, page.tsx, data.ts, layout.tsx, or any other file

## Acceptance criteria
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No em dashes in new copy
- [ ] `.proof-card-screenshot` block is gone from ProofCarousel.tsx
- [ ] `.proof-card-screenshot` CSS is gone from globals.css
- [ ] Each card shows "View Screenshot" button only if `card.image` exists
- [ ] Clicking "View Screenshot" opens lightbox with correct image
- [ ] Clicking backdrop closes lightbox
- [ ] Pressing ESC closes lightbox
- [ ] Body scroll is locked when lightbox is open and restored when closed
- [ ] Close button (X) in top-right corner works
- [ ] No console errors in browser

## Out of scope
- Do not change the stat card layout, colors, or other card content
- Do not modify the carousel scroll or dot logic
- Do not add animations to the image itself — only the backdrop fade-in
- Do not touch any section outside the proof carousel

## Notes for Codex
- CSS variables available: `--radius-lg`, `--radius-md`, `--line-soft`, `--soft`, `--muted`, `--blue`
- The nav has z-index 30 — lightbox must be z-index 100 to appear above it
- AuditModalProvider already does body scroll lock for the audit modal — follow the same pattern (set `document.body.style.overflow = 'hidden'` on open, restore on close)
- The `card.image` type is `string | undefined` — use non-null assertion `card.image!` only after checking it exists

---

## Self-verification and deployment (Codex must do this after changes)

After making all changes, run the following steps in order. Do not skip any.

### Step 1 — TypeScript check
```bash
cd kuya-ken-portfolio && npx tsc --noEmit
```
Must return zero output (no errors). If there are errors, fix them before proceeding.

### Step 2 — Em dash check
```bash
grep -rn "[—–]" kuya-ken-portfolio/app/components/ScreenshotLightbox.tsx kuya-ken-portfolio/app/components/ProofCarousel.tsx
```
Must return no matches. If any found, remove them.

### Step 3 — Confirm screenshot block removed
```bash
grep -n "proof-card-screenshot" kuya-ken-portfolio/app/components/ProofCarousel.tsx kuya-ken-portfolio/app/globals.css
```
Must return no matches. If found, delete those blocks.

### Step 4 — Commit
Stage and commit only the files changed for this task:
```bash
cd ..
git add kuya-ken-portfolio/app/components/ScreenshotLightbox.tsx kuya-ken-portfolio/app/components/ProofCarousel.tsx kuya-ken-portfolio/app/globals.css
git commit -m "Add screenshot lightbox to proof carousel"
```

### Step 5 — Deploy to production
```bash
cd kuya-ken-portfolio && npx vercel --prod --yes
```
Wait for the deploy to finish and confirm the production URL is aliased to https://www.kradigital.site
