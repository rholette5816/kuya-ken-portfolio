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
