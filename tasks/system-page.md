# Task: system-page

## Goal
Build a new `/system` page that showcases Ken's executive assistant operating system. Native HTML/CSS visual diagram (no external image asset). Focus on the processing layers (Context, Agent Orchestration, Execution). Brand integrations layer is intentionally minimized.

## Why
The system is Ken's strongest credibility asset. Most freelancers cannot show their own backend. This page is meta-proof: the operating system that ships his code and runs his businesses is itself a portfolio piece. Framing is **educational/technical**: "Inside My Operating System." Brand platforms (Meta Ads, Pancake, FB, IG, etc.) are not the moat. The processing layers are.

## Files to modify
- `app/page.tsx` — add "How I Work" link in header nav.
- `app/presentation/page.tsx` — add "How I Work" link in header nav.
- `app/case-studies/page.tsx` — add "How I Work" link in header nav.
- `app/case-studies/[slug]/page.tsx` — add "How I Work" link in header nav.
- `app/globals.css` — add styles for the new `.system-*` classes used by the new page.

## Files to create
- `app/system/page.tsx` — full new page. Server component. No `"use client"` directive.

## Files to delete
None.

## Constraints
- Inherits from `AGENTS.md`. No em dashes. No new npm dependencies.
- Use **only** existing CSS variables for color: `--blue`, `--mint`, `--lime`, `--amber`, `--rose`, plus the existing `--text`, `--muted`, `--soft`, `--line`, `--line-soft`, `--bg`, `--panel`, radius tokens, etc.
- Reuse existing site classes where they already exist: `.site-header`, `.brand`, `.nav-cta`, `.btn`, `.primary`, `.secondary`, `.eyebrow`. Do not redefine them.
- All new class names live under the `.system-` prefix to avoid collision.
- No "use client" components. The page is purely static markup. The only interactive element is the existing `AuditPopup`.
- Do not embed any external image assets. The architecture diagram is built natively in HTML and CSS.
- Mobile: page should not break, but elaborate visuals (the architecture grid, layer cards) can simplify on small viewports. Use one `@media (max-width: 900px)` block for collapses.

## Exact changes

### 1. `app/system/page.tsx` (new file)

Use exactly this content:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import AuditPopup from "../components/AuditPopup";

export const metadata: Metadata = {
  title: "Inside My Operating System",
  description:
    "The AI-augmented operating system that runs Kuya Ken's businesses, ships his code, and delivers your audit. Built for himself first, deployed to clients.",
  alternates: {
    canonical: "/system"
  }
};

const layers = [
  {
    accent: "blue",
    number: "01",
    name: "Input",
    headline: "One way in. No app-switching.",
    body:
      "Every request, voice note, video, or status check enters the same place. The system never asks me which app to open.",
    modules: [
      "Telegram Bot interface",
      "Voice or text input",
      "Status and retry commands"
    ]
  },
  {
    accent: "mint",
    number: "02",
    name: "Context and Memory",
    headline: "The system remembers everything.",
    body:
      "Context is loaded automatically on every request. The system already knows who I am, what we sell, who is on the team, what the current priorities are, and what decisions led here. Nothing has to be re-explained.",
    modules: [
      "Identity and role context",
      "Active business and brand context",
      "Team structure and responsibilities",
      "Current priorities and goals",
      "Decision log with reasoning",
      "SOPs, playbooks, and references",
      "Skill library (30+ skills)",
      "Persistent memory across sessions"
    ],
    emphasized: true
  },
  {
    accent: "lime",
    number: "03",
    name: "Agent Orchestration",
    headline: "Routes work to the right tool.",
    body:
      "Judgment work goes to Claude. Mechanical work routes to Codex. Repeat patterns route to skills. The agent chooses the executor based on the task shape, not based on what is convenient.",
    modules: [
      "Routing logic (judgment vs mechanical)",
      "Claude as planner and decision maker",
      "Codex CLI as bulk executor",
      "Skill library lookup",
      "Context retrieval before action",
      "Local LLM fallback (free tier)"
    ],
    emphasized: true
  },
  {
    accent: "amber",
    number: "04",
    name: "Execution",
    headline: "Where the work actually gets done.",
    body:
      "Real outputs, not chat. Pipelines run end to end. Reports generate without human stitching. Skills handle anything that has been done more than twice.",
    modules: [
      "10-step content pipeline (video to multi-channel posts)",
      "Daily business reports (sales, ads, ROAS)",
      "Scheduled scripts and triggers",
      "Custom skills for recurring patterns",
      "Codex-paired multi-file edits",
      "Cached LLM responses for free retries"
    ],
    emphasized: true
  },
  {
    accent: "rose",
    number: "05",
    name: "Integrations",
    headline: "Connected where work needs to land.",
    body:
      "The system reaches into the platforms a real business already uses. The processing happens here. The platforms are interchangeable.",
    modules: [
      "Business platform APIs",
      "Operations and POS systems",
      "Ad and analytics platforms",
      "Workspace and storage"
    ]
  },
  {
    accent: "blue",
    number: "06",
    name: "Output",
    headline: "Delivered where I will see it.",
    body:
      "Finished work lands in the right place automatically. Posts go live. Files save. The system pings me when something needs my attention.",
    modules: [
      "Telegram updates and confirmations",
      "Files and assets to cloud storage",
      "Reports and dashboards",
      "Live content on the right channels"
    ]
  }
];

const workflow = [
  {
    layer: "Input",
    color: "blue",
    step: "Send a 60-second clip to Telegram."
  },
  {
    layer: "Context",
    color: "mint",
    step: "System loads my voice, brand tone, current campaign, and posting calendar from memory."
  },
  {
    layer: "Agent",
    color: "lime",
    step: "Routes to the content pipeline skill. Claude plans the angles, Codex handles the mechanical steps."
  },
  {
    layer: "Execution",
    color: "amber",
    step: "Transcribe, analyze, generate copy, generate images, build the post calendar."
  },
  {
    layer: "Integrations",
    color: "rose",
    step: "Schedule across the right channels. Save assets to cloud storage. Update the tracking sheet."
  },
  {
    layer: "Output",
    color: "blue",
    step: "Telegram pings me with every live link plus the dashboard URL."
  }
];

const principles = [
  {
    title: "Memory is the moat",
    body:
      "Most assistants forget. This one remembers every decision, preference, and SOP. Future work compounds on past work."
  },
  {
    title: "Routing beats brute force",
    body:
      "Sending every task to the most expensive model is wasteful. The system routes by task shape, so each request hits the right tool at the right cost."
  },
  {
    title: "Skills are written once, reused forever",
    body:
      "Anything done more than twice becomes a skill. The skill library grows with every workflow."
  },
  {
    title: "The owner stays in the loop",
    body:
      "The system never takes shared, public, or destructive actions without explicit confirmation. Speed without losing control."
  }
];

export default function SystemPage() {
  return (
    <>
      <header className="site-header">
        <Link href="/" className="brand">
          <span>Kuya Ken</span>
          <small>Operating System</small>
        </Link>
        <nav aria-label="System navigation">
          <Link href="/">Portfolio</Link>
          <Link href="/presentation">Presentation</Link>
          <Link href="/case-studies">Case Studies</Link>
          <a href="/resume">Resume</a>
        </nav>
        <AuditPopup className="nav-cta">Free Audit</AuditPopup>
      </header>

      <main>
        <section className="hero-section compact-hero">
          <div className="hero-copy">
            <p className="eyebrow">Inside My Operating System</p>
            <h1>The system that runs my businesses, ships my code, and delivers your audit.</h1>
            <p className="lead">
              I built this AI-augmented operating system for myself first. Same architecture I deploy
              for clients. The processing is the moat, not the platforms it touches.
            </p>
            <div className="pill-row" aria-label="System headline stats">
              <span>30+ skills</span>
              <span>10-step content pipeline</span>
              <span>Single Telegram interface</span>
              <span>Memory across sessions</span>
            </div>
            <div className="cta-row">
              <AuditPopup>Book Free System Audit</AuditPopup>
              <Link href="#architecture" className="btn secondary">See the architecture</Link>
            </div>
          </div>
        </section>

        <section id="architecture" className="section system-section">
          <p className="eyebrow">Architecture</p>
          <h2>Six layers. One operating system.</h2>
          <p className="lead">
            Each layer has one job. Together they take a single voice note and turn it into shipped work,
            without me doing the stitching.
          </p>

          <div className="system-stack">
            {layers.map((layer) => (
              <article
                key={layer.number}
                className={`system-layer accent-${layer.accent} ${layer.emphasized ? "is-emphasized" : ""}`}
              >
                <div className="system-layer-head">
                  <span className="system-layer-number">{layer.number}</span>
                  <div>
                    <p className="system-layer-name">{layer.name}</p>
                    <h3>{layer.headline}</h3>
                  </div>
                </div>
                <p className="system-layer-body">{layer.body}</p>
                <ul className="system-layer-modules">
                  {layer.modules.map((module) => <li key={module}>{module}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="section system-section">
          <p className="eyebrow">Real Workflow</p>
          <h2>How a request actually flows.</h2>
          <p className="lead">
            One real task, traced through every layer. The processing is what saves the time.
          </p>

          <ol className="system-flow">
            {workflow.map((step, index) => (
              <li key={step.layer} className={`system-flow-step accent-${step.color}`}>
                <span className="system-flow-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="system-flow-layer">{step.layer}</p>
                  <p className="system-flow-text">{step.step}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="section system-section">
          <p className="eyebrow">Operating Principles</p>
          <h2>Why this system holds up.</h2>
          <div className="system-principles">
            {principles.map((principle) => (
              <article key={principle.title} className="system-principle">
                <h3>{principle.title}</h3>
                <p>{principle.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section final-section">
          <p className="eyebrow">For Your Business</p>
          <h2>Same systems thinking, scaled to your operation.</h2>
          <p>
            The pieces change. The principles do not. Memory, routing, skills, and a clear interface
            apply to any business that takes orders, serves people, or runs ads.
          </p>
          <AuditPopup>Book Free System Audit</AuditPopup>
        </section>
      </main>
    </>
  );
}
```

### 2. `app/globals.css` — append new styles

All additions go at the **bottom** of the file, **before** the final `}` of any media query if any closes the file. Read the file first; if it ends with a media query, place these new rules before that media query opens. Otherwise append at the end of the file.

```css
/* ===== System page (Inside My Operating System) ===== */

.system-section {
  width: min(100%, 1200px);
  margin: 0 auto;
}

.system-section .eyebrow {
  color: #98b8ff;
}

.system-section h2 {
  max-width: 22ch;
}

.system-stack {
  display: grid;
  gap: 1.2rem;
  margin-top: 2rem;
}

.system-layer {
  position: relative;
  padding: 1.6rem 1.7rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-xl);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
    rgba(18, 24, 36, 0.72);
  backdrop-filter: blur(16px) saturate(130%);
}

.system-layer.accent-blue { --layer-accent: var(--blue); }
.system-layer.accent-mint { --layer-accent: var(--mint); }
.system-layer.accent-lime { --layer-accent: var(--lime); }
.system-layer.accent-amber { --layer-accent: var(--amber); }
.system-layer.accent-rose { --layer-accent: var(--rose); }

.system-layer::before {
  content: "";
  position: absolute;
  left: 0;
  top: 1.2rem;
  bottom: 1.2rem;
  width: 4px;
  border-radius: 4px;
  background: var(--layer-accent, var(--blue));
}

.system-layer.is-emphasized {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025)),
    rgba(20, 28, 42, 0.86);
  box-shadow: 0 18px 50px rgba(2, 8, 20, 0.35);
}

.system-layer-head {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1.1rem;
  align-items: center;
  margin-bottom: 0.8rem;
}

.system-layer-number {
  display: inline-grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  border: 1px solid var(--line-soft);
  color: var(--layer-accent, var(--blue));
  background: rgba(255, 255, 255, 0.06);
  font-weight: 900;
  font-size: 1.05rem;
  letter-spacing: 0.04em;
}

.system-layer-name {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--layer-accent, var(--blue));
}

.system-layer h3 {
  margin: 0.2rem 0 0;
  font-size: clamp(1.15rem, 1.6vw, 1.45rem);
  line-height: 1.25;
  font-weight: 900;
  color: var(--text);
}

.system-layer-body {
  margin: 0 0 0.95rem;
  color: var(--muted);
  line-height: 1.6;
  font-size: var(--fs-body);
  max-width: 70ch;
}

.system-layer-modules {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.system-layer-modules li {
  position: relative;
  padding-left: 1.05rem;
  color: var(--soft);
  font-size: 0.96rem;
  line-height: 1.45;
}

.system-layer-modules li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.55rem;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--layer-accent, var(--blue));
  opacity: 0.85;
}

/* Real workflow flow */

.system-flow {
  display: grid;
  gap: 0.85rem;
  margin: 1.8rem 0 0;
  padding: 0;
  list-style: none;
  counter-reset: flow;
}

.system-flow-step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.2rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
    rgba(18, 24, 36, 0.72);
}

.system-flow-step.accent-blue { --layer-accent: var(--blue); }
.system-flow-step.accent-mint { --layer-accent: var(--mint); }
.system-flow-step.accent-lime { --layer-accent: var(--lime); }
.system-flow-step.accent-amber { --layer-accent: var(--amber); }
.system-flow-step.accent-rose { --layer-accent: var(--rose); }

.system-flow-index {
  display: inline-grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: rgba(255, 255, 255, 0.05);
  color: var(--layer-accent, var(--blue));
  font-weight: 900;
  font-size: 0.95rem;
  letter-spacing: 0.04em;
}

.system-flow-layer {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--layer-accent, var(--blue));
}

.system-flow-text {
  margin: 0.2rem 0 0;
  color: var(--soft);
  line-height: 1.55;
  font-size: clamp(0.98rem, 1.1vw, 1.08rem);
}

/* Operating principles */

.system-principles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.2rem;
  margin-top: 1.8rem;
}

.system-principle {
  padding: 1.3rem 1.4rem;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
    rgba(18, 24, 36, 0.72);
}

.system-principle h3 {
  margin: 0 0 0.55rem;
  font-size: clamp(1.05rem, 1.3vw, 1.2rem);
  font-weight: 900;
  color: var(--text);
}

.system-principle p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
  font-size: var(--fs-body);
}

/* Mobile collapse for the system page */

@media (max-width: 900px) {
  .system-layer-head {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .system-layer-number {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    font-size: 0.95rem;
  }

  .system-layer-modules {
    grid-template-columns: 1fr;
  }

  .system-flow-step {
    grid-template-columns: auto 1fr;
    align-items: flex-start;
  }

  .system-principles {
    grid-template-columns: 1fr;
  }
}
```

### 3. Header nav updates (4 files)

In each of the four files below, add `<a href="/system">How I Work</a>` **after** the existing `<a href="/resume">Resume</a>` line and before the closing `</nav>` tag.

#### 3a. `app/page.tsx`

Find:

```tsx
        <Link href="/case-studies">Case Studies</Link>
        <a href="/resume">Resume</a>
      </nav>
```

Replace with:

```tsx
        <Link href="/case-studies">Case Studies</Link>
        <a href="/resume">Resume</a>
        <Link href="/system">How I Work</Link>
      </nav>
```

#### 3b. `app/presentation/page.tsx`

Find:

```tsx
          <Link href="/case-studies">Case Studies</Link>
          <a href="/resume">Resume</a>
        </nav>
```

Replace with:

```tsx
          <Link href="/case-studies">Case Studies</Link>
          <a href="/resume">Resume</a>
          <Link href="/system">How I Work</Link>
        </nav>
```

#### 3c. `app/case-studies/page.tsx`

Find:

```tsx
          <Link href="/presentation">Presentation</Link>
          <a href="/resume">Resume</a>
        </nav>
```

Replace with:

```tsx
          <Link href="/presentation">Presentation</Link>
          <a href="/resume">Resume</a>
          <Link href="/system">How I Work</Link>
        </nav>
```

#### 3d. `app/case-studies/[slug]/page.tsx`

Find:

```tsx
          <Link href="/case-studies">All Case Studies</Link>
          <a href="/resume">Resume</a>
        </nav>
```

Replace with:

```tsx
          <Link href="/case-studies">All Case Studies</Link>
          <a href="/resume">Resume</a>
          <Link href="/system">How I Work</Link>
        </nav>
```

## Reference patterns
- Hero / pill-row / cta-row / final-section: `app/page.tsx`
- Eyebrow + h2 section structure: `app/page.tsx` other sections
- Per-slide accent pattern (blue/mint/lime/amber/rose): `app/globals.css` `.pitch-slide.accent-*` block
- Server-component page with metadata: `app/case-studies/page.tsx`

## Acceptance criteria
- [ ] `grep -rn "[—–]" app` returns nothing
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `app/system/page.tsx` exists and exports a default React component
- [ ] `grep -n "How I Work" app` returns exactly 4 matches (one per nav file)
- [ ] `grep -n "system-stack\|system-layer\|system-flow\|system-principles" app/globals.css` returns at least 4 matches
- [ ] `grep -n "system-stack\|system-layer\|system-flow" app/system/page.tsx` returns at least 3 matches
- [ ] `grep -n "Inside My Operating System" app/system/page.tsx` returns at least 1 match
- [ ] No new entries in `package.json`
- [ ] The page renders without "use client" anywhere in `app/system/page.tsx`

## Out of scope
- Do not embed any external image assets. The diagram is built natively.
- Do not list specific brand or platform names anywhere (no Meta Ads, FB, IG, Pancake, Webcake, etc.). The Integrations layer stays generic. This is intentional per the brief.
- Do not modify the home page hero, presentation slides, case studies content, audit form, or any existing component besides the listed nav additions.
- Do not refactor `AuditPopup` or `AuditModalProvider`. Use them as-is.
- Do not add scroll animations, intersection observers, or interactive expand/collapse. Static markup only.
- Do not add a "Print" or "Export" button to this page.
- Do not modify `next.config.mjs`, `package.json`, `middleware.ts`, or `vercel.json`.

## Notes for Codex
- The `<Link>` import must come from `next/link`. Use `<Link>` for internal Next routes (`/`, `/presentation`, `/case-studies`, `/system`). Use plain `<a>` for `/resume` because it serves a static HTML file outside the Next router.
- The hero uses the existing `compact-hero` modifier on `.hero-section` so it does not eat the full viewport height. There is no hero image on this page, that is intentional.
- The `is-emphasized` class on layers 2, 3, and 4 visually weights the processing layers heavier than 1, 5, and 6. This is the entire point of the layout. Do not remove the modifier.
- Layer 5 (Integrations) intentionally uses generic phrasing ("business platform APIs", "operations and POS systems"). Do not add specific brand names.
- The "How I Work" nav link is a `<Link>` (Next route) in 3 of the 4 files but ordered after the existing `<a href="/resume">` (which is a plain anchor). The mixed ordering is intentional. Do not consolidate.
- The new page is a server component. Do not add `"use client"` at the top. The only client-side component used is `AuditPopup`, which is already a client boundary.
- Total nav now has 5 items per page: Portfolio (or section anchors), Presentation, Case Studies, Resume, How I Work. Plus the Free Audit CTA. Visual density is acceptable on desktop. The mobile nav already collapses via the existing media query at 1100px.
