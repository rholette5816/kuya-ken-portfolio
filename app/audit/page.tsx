"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";
import { submitAuditForm, getCalendlyUrl } from "../lib/audit";
import { publicNavLinks } from "../nav";

type AuditForm = {
  name: string;
  businessName: string;
  industry: string;
  mainProblem: string;
  salesRange: string;
  contactPreference: string;
};

const initialState: AuditForm = {
  name: "",
  businessName: "",
  industry: "",
  mainProblem: "",
  salesRange: "",
  contactPreference: "Messenger"
};

export default function AuditPage() {
  const [form, setForm] = useState<AuditForm>(initialState);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calendlyUrl = getCalendlyUrl();

  function handleChange<K extends keyof AuditForm>(key: K, value: AuditForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    <>
      <SiteHeader
        brandSubtitle="Free Audit"
        navLabel="Audit navigation"
        links={publicNavLinks}
        cta={<Link href="/audit" className="nav-cta">Free Audit</Link>}
      />

      <main>
        <section className="section audit-wrap">
          <div className="audit-shell">
            {!submitted ? (
              <>
                <p className="eyebrow">Free Business System Audit</p>
                <h1>Tell me about your business in 60 seconds.</h1>
                <p className="lead">
                  I will review your setup and map what can be automated first.
                </p>

                <form className="audit-form" onSubmit={handleSubmit}>
                  <label>
                    Name
                    <input
                      required
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="Your full name"
                    />
                  </label>

                  <label>
                    Business name
                    <input
                      required
                      value={form.businessName}
                      onChange={(e) => handleChange("businessName", e.target.value)}
                      placeholder="Your business or brand"
                    />
                  </label>

                  <label>
                    Industry
                    <input
                      required
                      value={form.industry}
                      onChange={(e) => handleChange("industry", e.target.value)}
                      placeholder="Food, services, transport, ecommerce, SaaS, etc."
                    />
                  </label>

                  <label>
                    Main problem now
                    <textarea
                      required
                      rows={4}
                      value={form.mainProblem}
                      onChange={(e) => handleChange("mainProblem", e.target.value)}
                      placeholder="What manual work or bottleneck is slowing your business?"
                    />
                  </label>

                  <label>
                    Monthly sales range (optional)
                    <select
                      value={form.salesRange}
                      onChange={(e) => handleChange("salesRange", e.target.value)}
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
                <h1>Thanks, {form.name.split(" ")[0] || "there"}.</h1>
                <p className="lead">
                  Your audit request is in. Next step: book your call slot so we can review your system together.
                </p>
                <div className="cta-row">
                  {calendlyUrl ? (
                    <a
                      href={calendlyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn primary"
                    >
                      Book Call Slot
                    </a>
                  ) : null}
                  <Link href="/" className="btn secondary">Back to Portfolio</Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
