# Task: funnel-wiring

## Goal
Make the audit form actually deliver leads, replace the placeholder Calendly URL, and install GA4 + Meta Pixel so every conversion is tracked.

## Why
Right now the audit form submission is a no-op (`setSubmitted(true)` with no network call). The success state links to `https://calendly.com` which is a broken funnel. There is no GA4 or Meta Pixel, so Ken cannot measure traffic, conversions, or run retargeting. This task wires the entire pipe end-to-end and makes the system functional once Ken drops real env values in.

## Files to modify
- `app/components/AuditPopup.tsx` — submit via `submitAuditForm`, real Calendly URL from env, loading + error states.
- `app/audit/page.tsx` — same submit + Calendly changes as the popup, mirrored.
- `app/layout.tsx` — mount the new `<Analytics />` component in `<body>` after `<AnimatedBackground />` and before the JSON-LD script.

## Files to create
- `app/lib/audit.ts` — exports `submitAuditForm(form)`. POSTs to Formspree, returns `{ ok: boolean; error?: string }`. On success, fires `window.gtag('event', 'lead', ...)` and `window.fbq('track', 'Lead')` if those globals exist.
- `app/components/Analytics.tsx` — server component that renders GA4 + Meta Pixel `<Script>` tags only when their env vars are set. No client-side JS in the component itself, only the injected script tags.
- `.env.local.example` — template listing the four required env vars with comments. Do not create `.env.local` itself.

## Files to delete
None.

## Constraints
- Inherits from `AGENTS.md`. No em dashes. No new npm dependencies.
- All four env vars are `NEXT_PUBLIC_*` since they are client-readable. This is fine for these specific values (Formspree endpoints, Calendly URLs, GA IDs, and Pixel IDs are public by design).
- The site must build and render correctly with **none** of the env vars set. In that case: form still submits visually (use a fallback that no-ops with `ok: false` and shows an error message), Calendly button hides, analytics scripts do not render at all.
- Do not introduce a global error boundary or toast library. Use inline error text.
- Use `next/script` for analytics, not raw `<script>` tags.

## Exact changes

### 1. `app/lib/audit.ts` (new file)

```ts
export type AuditFormPayload = {
  name: string;
  businessName: string;
  industry: string;
  mainProblem: string;
  salesRange: string;
  contactPreference: string;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export type SubmitResult = {
  ok: boolean;
  error?: string;
};

export async function submitAuditForm(form: AuditFormPayload): Promise<SubmitResult> {
  const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;

  if (!endpoint) {
    return {
      ok: false,
      error: "Form endpoint is not configured yet. Please contact Kuya Ken directly."
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      return { ok: false, error: "Could not send right now. Please try again in a moment." };
    }

    if (typeof window !== "undefined") {
      window.gtag?.("event", "lead", {
        event_category: "audit",
        event_label: form.industry || "unknown",
        contact_preference: form.contactPreference
      });
      window.fbq?.("track", "Lead", {
        content_name: "Free Business System Audit",
        content_category: form.industry || "unknown"
      });
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export function getCalendlyUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_CALENDLY_URL;
  return url && url.length > 0 ? url : undefined;
}
```

### 2. `app/components/Analytics.tsx` (new file)

```tsx
import Script from "next/script";

export default function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      )}

      {pixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
```

### 3. `.env.local.example` (new file at project root)

```
# Required for the audit form to actually deliver leads.
# Create a free form at https://formspree.io and paste the full endpoint URL.
NEXT_PUBLIC_FORMSPREE_ENDPOINT=

# Real Calendly booking link. Used in the success state after audit submission.
# Example: https://calendly.com/kenrholette/free-audit
NEXT_PUBLIC_CALENDLY_URL=

# Google Analytics 4 measurement ID. Format: G-XXXXXXXXXX
# Get from https://analytics.google.com -> Admin -> Data Streams -> Web stream details.
NEXT_PUBLIC_GA_ID=

# Meta Pixel ID. Format: 15-16 digit number.
# Get from https://business.facebook.com -> Events Manager -> Data Sources.
NEXT_PUBLIC_META_PIXEL_ID=
```

### 4. `app/layout.tsx` mount Analytics

Add this import after the existing `AnimatedBackground` import:

```tsx
import Analytics from "./components/Analytics";
```

In the JSX body, place `<Analytics />` after `<AnimatedBackground />` and before the existing `<script type="application/ld+json" .../>`. So the body becomes:

```tsx
<body>
  <AnimatedBackground />
  <Analytics />
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
  />
  {children}
</body>
```

### 5. `app/components/AuditPopup.tsx` updates

Add imports at the top (alongside the existing `useState` import):

```tsx
import { submitAuditForm, getCalendlyUrl } from "../lib/audit";
```

Replace the existing `handleSubmit` function and add two new state hooks. The state block should look like:

```tsx
const [open, setOpen] = useState(false);
const [submitted, setSubmitted] = useState(false);
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
const [form, setForm] = useState<AuditForm>(initialState);
```

Replace `handleSubmit` with:

```tsx
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if (submitting) return;
  setSubmitting(true);
  setError(null);

  const result = await submitAuditForm(form);
  setSubmitting(false);

  if (result.ok) {
    setSubmitted(true);
  } else {
    setError(result.error ?? "Could not send right now. Please try again.");
  }
}
```

In the JSX, replace the submit button and add an error message above it. Find:

```tsx
<button type="submit" className="btn primary audit-submit">Send Audit Request</button>
```

Replace with:

```tsx
{error && <p className="audit-error" role="alert">{error}</p>}
<button type="submit" className="btn primary audit-submit" disabled={submitting}>
  {submitting ? "Sending..." : "Send Audit Request"}
</button>
```

In the success state JSX, replace the hardcoded Calendly anchor:

```tsx
<a href="https://calendly.com" target="_blank" rel="noreferrer" className="btn primary">
  Book Call Slot
</a>
```

With this conditional block. Compute `const calendlyUrl = getCalendlyUrl();` near the top of the component body (before the `return`). Then:

```tsx
{calendlyUrl ? (
  <a href={calendlyUrl} target="_blank" rel="noreferrer" className="btn primary">
    Book Call Slot
  </a>
) : null}
```

### 6. `app/audit/page.tsx` updates

Apply the same five changes as `AuditPopup.tsx`:
- Add `import { submitAuditForm, getCalendlyUrl } from "../lib/audit";`
- Add `submitting` and `error` state
- Convert `handleSubmit` to async, calling `submitAuditForm`
- Wrap submit button with disabled state + show inline error
- Replace hardcoded Calendly anchor with conditional based on `getCalendlyUrl()`

The `event.target` handlers in this file use `e.target.value` (single letter `e`), preserve that style locally. Do not rename to `event`.

### 7. CSS for error message

In `app/globals.css`, append to the audit-form related styles. Place this rule directly after the existing `.audit-submit` rule (search for `.audit-submit {`):

```css
.audit-error {
  margin: 0;
  padding: 0.6rem 0.8rem;
  border: 1px solid rgba(255, 124, 168, 0.4);
  border-radius: var(--radius-md);
  color: #ffd1de;
  background: rgba(255, 124, 168, 0.12);
  font-size: 0.88rem;
  font-weight: 700;
}

.audit-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

## Reference patterns
- Existing client component with form state: `app/components/AuditPopup.tsx`
- Existing data module pattern: `app/data.ts`
- Next 15 metadata + viewport pattern: `app/layout.tsx`
- next/script usage: official Next docs (you have this knowledge), strategy `afterInteractive`

## Acceptance criteria
- [ ] `grep -rn "[—–]" app` returns nothing
- [ ] `npx tsc --noEmit` passes
- [ ] `grep -n "https://calendly.com\"" app` returns nothing (the bare placeholder URL must be gone)
- [ ] `grep -n "submitAuditForm" app/components/AuditPopup.tsx app/audit/page.tsx` returns matches in both files
- [ ] `grep -n "NEXT_PUBLIC_FORMSPREE_ENDPOINT\|NEXT_PUBLIC_CALENDLY_URL\|NEXT_PUBLIC_GA_ID\|NEXT_PUBLIC_META_PIXEL_ID" app .env.local.example` returns matches across `audit.ts`, `Analytics.tsx`, and `.env.local.example`
- [ ] `grep -n "Analytics" app/layout.tsx` returns at least 2 matches (import + usage)
- [ ] No new entries in `package.json` dependencies
- [ ] `.env.local.example` exists at project root and lists exactly four `NEXT_PUBLIC_*` keys
- [ ] With no env vars set, `npm run build` completes without runtime errors (do not run build, just confirm there is no top-level throw on missing env)

## Out of scope
- Do not change copy in the form fields, labels, or success messages other than what is listed.
- Do not refactor the duplicate form definitions in `AuditPopup.tsx` and `audit/page.tsx` into a shared component. They stay as two siblings calling the shared helper.
- Do not add route-change pageview tracking for analytics. Initial pageview only.
- Do not modify the favicon, the hero, or any section already shipped.
- Do not add a server-side API route. Submission is direct browser-to-Formspree.
- Do not add captcha, honeypot, or rate limiting. Formspree handles abuse.

## Notes for Codex
- The Formspree free tier allows 50 submissions/month, which is enough for v1.
- `window.gtag` and `window.fbq` will be undefined when env vars are missing. The `?.` optional chaining handles that.
- The `declare global { interface Window ... }` block in `audit.ts` adds typing for the analytics globals so TS does not complain about `window.gtag` / `window.fbq`.
- `getCalendlyUrl()` returns `undefined` when the env var is empty. Both consumers must check before rendering the button.
- All four env vars must work as `process.env.NEXT_PUBLIC_*` in client components because `next/script` and form code runs in the browser. Next.js inlines these at build time.
- The Analytics component is a server component (no "use client"). It only emits `<Script>` tags. The actual GA/Pixel JS runs on the client, but the component itself does not need to be a client component.
- If a `next/script` import error occurs, the import path is `import Script from "next/script"`.
