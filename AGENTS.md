# Codex Project Rules — Kuya Ken Portfolio

You are working on Kevin Rholette Allego's (Kuya Ken's) public portfolio at `www.kradigital.site`. Claude (Opus) plans, you execute.
You will usually be invoked with `codex exec --full-auto "Read tasks/<slug>.md and execute the plan exactly. Run acceptance checks at the end and report results."`

## How to work

1. Open the spec at `tasks/<slug>.md`. Treat it as the source of truth.
2. Make exactly the changes listed. No extras. No "while you're at it" cleanup.
3. Run the acceptance checks at the bottom of the spec.
4. Report what you changed and the check results. If a check fails, do not retry blindly. Stop and report.
5. If the spec is ambiguous, do nothing and report what's unclear. Never guess on judgment calls (copy, design choices, naming).

## Project conventions

### Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- Plain CSS in `app/globals.css`. No Tailwind, no CSS-in-JS, no styled-components.
- Static images in `public/assets/`
- Deployed on Vercel; canonical host `www.kradigital.site` via `middleware.ts`

### Visual system (use these literal CSS variables, defined in `app/globals.css`)
- `--bg #0b0f17` page foundation
- `--panel rgba(21,27,38,0.64)` glass panels
- `--text #f4f7fb` primary text
- `--muted #b6c0cf` secondary text
- `--soft #e4ebf4` body emphasis
- `--blue #4f8cff` primary accent
- `--mint #54d0c0`, `--lime #9be37a`, `--amber #ffbf6d`, `--rose #ff7ca8` secondary accents
- `--line / --line-soft` borders
- Radii: `--radius-xl 22px`, `--radius-lg 16px`, `--radius-md 12px`
- Type scale variables: `--fs-h1`, `--fs-h2`, `--fs-body`, `--fs-eyebrow`, `--fs-slide`

### Copy rules (non-negotiable)
- **No em dashes (—) or en dashes (–) anywhere.** Use periods, commas, or "to" for ranges.
- **No emojis in user-facing copy** unless the spec explicitly says to use one.
- Direct, owner-voice. Plain language. No jargon.
- Filipino currency: `PHP 123` or `₱123`, no decimals.

### File structure
- Pages: `app/<route>/page.tsx`
- Shared components: `app/components/*.tsx`
- Site data + types: `app/data.ts`
- Global styles: `app/globals.css`
- Static assets: `public/assets/...`
- Metadata + JSON-LD: `app/layout.tsx`

### Component patterns
- Use `Link` from `next/link` for internal navigation. `<a target="_blank" rel="noreferrer">` for external.
- For new images prefer `next/image` with explicit `width` and `height`. Existing `<img>` tags are okay to keep unless the spec says to migrate them.
- Keep `"use client"` only on components that actually need state, refs, or browser APIs (e.g. `AuditPopup`, `AnimatedBackground`).
- Reuse existing classes in `globals.css` before inventing new ones. If a new class is needed, add it under the matching section in that file.

## Hard limits

- **Do not add npm dependencies** unless the spec explicitly lists them.
- **Do not modify `package.json`, `next.config.mjs`, `tsconfig.json`, `vercel.json`, or `middleware.ts`** unless the spec says so.
- **Do not delete files** unless the spec lists them under "Files to delete".
- **Do not run `npm install`** unless installing a dependency listed in the spec.
- **Do not commit** unless the spec says to. Claude handles commits.
- **Do not push to git** ever. Claude handles pushes.
- **Do not generate or replace binary assets** (images, favicons) unless the spec gives an exact source path. If a binary is needed and unspecified, stop and report.

## Verification

After every change, run these unless the spec overrides:

```bash
# 1. No em or en dashes anywhere in source
grep -rn "[—–]" app && echo "FAIL: dashes found" || echo "PASS: no dashes"

# 2. TypeScript compiles
npx tsc --noEmit

# 3. Next.js build succeeds (only if spec says deploy-bound)
# npm run build
```

Report results in this format:
```
SPEC: tasks/<slug>.md
CHANGES:
  - modified: <file>
  - created: <file>
  - deleted: <file>
CHECKS:
  - dashes: PASS
  - tsc: PASS
  - <custom check from spec>: PASS/FAIL
NOTES: <anything Claude should know on review>
```

## When to bounce back to Claude

Stop and report instead of guessing if you encounter:
- Two valid ways to implement and the spec doesn't say which
- A copy choice not provided in the spec
- A build error whose fix isn't obvious from the error message
- A file that doesn't match what the spec described (drift)
- Anything that would require touching files outside the spec's scope

## Existing patterns to mimic

- Page with header + sections: `app/page.tsx`
- Client component with form state: `app/components/AuditPopup.tsx`
- Dynamic route + `generateStaticParams`: `app/case-studies/[slug]/page.tsx`
- Metadata + JSON-LD: `app/layout.tsx`
- Site-wide content/data shape: `app/data.ts`
