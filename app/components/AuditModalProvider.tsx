"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getCalendlyUrl, submitAuditForm } from "../lib/audit";

type AuditForm = {
  name: string;
  businessName: string;
  industry: string;
  mainProblem: string;
  salesRange: string;
  contactPreference: string;
};

type AuditModalContextValue = {
  openAudit: () => void;
};

const AuditModalContext = createContext<AuditModalContextValue | null>(null);

const initialState: AuditForm = {
  name: "",
  businessName: "",
  industry: "",
  mainProblem: "",
  salesRange: "",
  contactPreference: "Messenger"
};

export function useAuditModal() {
  const context = useContext(AuditModalContext);
  if (!context) {
    throw new Error("useAuditModal must be used inside AuditModalProvider.");
  }
  return context;
}

export default function AuditModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AuditForm>(initialState);
  const calendlyUrl = getCalendlyUrl();

  const contextValue = useMemo<AuditModalContextValue>(() => ({
    openAudit: () => {
      setError(null);
      setSubmitting(false);
      if (submitted) {
        setSubmitted(false);
        setForm(initialState);
      }
      setOpen(true);
    }
  }), [submitted]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function handleChange<K extends keyof AuditForm>(key: K, value: AuditForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function closeModal() {
    setOpen(false);
  }

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

  return (
    <AuditModalContext.Provider value={contextValue}>
      {children}
      {open && (
        <div className="audit-modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <section
            className="audit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="audit-close" onClick={closeModal} aria-label="Close audit form">
              x
            </button>

            {!submitted ? (
              <>
                <p className="eyebrow">Free Business System Audit</p>
                <h2 id="audit-modal-title">Tell me about your business in 60 seconds.</h2>
                <p className="lead">I will review your setup and map what can be automated first.</p>

                <form className="audit-form" onSubmit={handleSubmit}>
                  <label>
                    Name
                    <input
                      required
                      value={form.name}
                      onChange={(event) => handleChange("name", event.target.value)}
                      placeholder="Your full name"
                    />
                  </label>

                  <label>
                    Business name
                    <input
                      required
                      value={form.businessName}
                      onChange={(event) => handleChange("businessName", event.target.value)}
                      placeholder="Your business or brand"
                    />
                  </label>

                  <label>
                    Industry
                    <input
                      required
                      value={form.industry}
                      onChange={(event) => handleChange("industry", event.target.value)}
                      placeholder="Food, services, transport, ecommerce, SaaS, etc."
                    />
                  </label>

                  <label>
                    Main problem now
                    <textarea
                      required
                      rows={3}
                      value={form.mainProblem}
                      onChange={(event) => handleChange("mainProblem", event.target.value)}
                      placeholder="What manual work or bottleneck is slowing your business?"
                    />
                  </label>

                  <label>
                    Monthly sales range (optional)
                    <select
                      value={form.salesRange}
                      onChange={(event) => handleChange("salesRange", event.target.value)}
                    >
                      <option value="">Select range</option>
                      <option value="under-100k">Under 100k PHP</option>
                      <option value="100k-300k">100k to 300k PHP</option>
                      <option value="300k-1m">300k to 1M PHP</option>
                      <option value="1m-plus">1M+ PHP</option>
                    </select>
                  </label>

                  <label>
                    Preferred contact
                    <div className="contact-row">
                      {["Messenger", "Email", "WhatsApp"].map((option) => (
                        <button
                          type="button"
                          key={option}
                          className={`contact-chip ${form.contactPreference === option ? "active" : ""}`}
                          onClick={() => handleChange("contactPreference", option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </label>

                  {error && <p className="audit-error" role="alert">{error}</p>}
                  <button type="submit" className="btn primary audit-submit" disabled={submitting}>
                    {submitting ? "Sending..." : "Send Audit Request"}
                  </button>
                </form>
              </>
            ) : (
              <div className="audit-success">
                <p className="eyebrow">Request Received</p>
                <h2>Thanks, {form.name.split(" ")[0] || "there"}.</h2>
                <p className="lead">
                  Your audit request is in. Next step: book your call slot so we can review your system together.
                </p>
                <div className="cta-row">
                  {calendlyUrl ? (
                    <a href={calendlyUrl} target="_blank" rel="noreferrer" className="btn primary">
                      Book Call Slot
                    </a>
                  ) : null}
                  <button type="button" className="btn secondary" onClick={closeModal}>
                    Continue Browsing
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </AuditModalContext.Provider>
  );
}
