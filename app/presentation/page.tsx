import type { Metadata } from "next";
import Link from "next/link";
import AuditPopup from "../components/AuditPopup";
import SiteHeader from "../components/SiteHeader";
import { caseStudies, site } from "../data";
import { publicNavLinks } from "../nav";

export const metadata: Metadata = {
  title: "Client Presentation - Manual Business to AI Systems",
  description:
    "Client presentation by Kuya Ken showing how manual businesses can move to clear apps, dashboards, automations, and reports.",
  alternates: {
    canonical: "/presentation"
  }
};

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
    eyebrow: "Example Builds",
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

export default function PresentationPage() {
  return (
    <>
      <SiteHeader
        className="presentation-header"
        brandSubtitle="Client Presentation"
        navLabel="Presentation navigation"
        links={publicNavLinks}
        cta={<AuditPopup className="nav-cta">Free Audit</AuditPopup>}
      />

      <main className="presentation-deck">
        {slides.map((slide, index) => (
          <section className={`pitch-slide accent-${slide.accent}`} key={slide.title}>
            <div className="pitch-count">
              <span className="pitch-count-label">Slide</span>
              <span className="pitch-count-value">
                {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
              </span>
            </div>
            <div className="pitch-stage">
              <div className="pitch-copy">
                <p className="eyebrow">{slide.eyebrow}</p>
                <h1>{slide.title}</h1>
                <p className="lead">{slide.body}</p>

                {slide.points && (
                  <div className="pitch-points">
                    {slide.points.map((point) => <span key={point}>{point}</span>)}
                  </div>
                )}

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

                {slide.lanes && (
                  <div className="pitch-lanes">
                    {slide.lanes.map(([label, value]) => (
                      <article key={label}>
                        <strong>{label}</strong>
                        <span>{value}</span>
                      </article>
                    ))}
                  </div>
                )}

                {slide.proof && (
                  <div className="pitch-proof-grid">
                    {caseStudies.map((study) => (
                      <article key={study.slug} className="pitch-proof-card">
                        <img src={study.screenshots[0].src} alt={study.screenshots[0].alt} loading="lazy" />
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

                {slide.cta && (
                  <div className="cta-row">
                    <AuditPopup>Start Free Audit</AuditPopup>
                    <Link href="/system" className="btn secondary">See How I Work</Link>
                  </div>
                )}

                {slide.midCta && (
                  <div className="pitch-mid-cta">
                    <AuditPopup className="btn primary">Skip Ahead. Book Audit.</AuditPopup>
                  </div>
                )}
              </div>

              {slide.visual && (
                <figure className="pitch-visual">
                  <img src={slide.visual} alt={slide.visualAlt} loading="lazy" />
                </figure>
              )}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
