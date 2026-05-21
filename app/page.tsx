import Link from "next/link";
import AuditPopup from "./components/AuditPopup";
import FeedbackGrid from "./components/FeedbackGrid";
import ProofCarousel from "./components/ProofCarousel";
import SiteHeader from "./components/SiteHeader";
import { feedbackVideos, funnelStages, industries, mediaResults, processSteps, site, transformations, trustProjects } from "./data";
import { publicNavLinks } from "./nav";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

const faqs = [
  {
    question: "Who is this for?",
    answer:
      "Product businesses, ecommerce operators, local SMEs, service businesses, and founders who want the ads and the system to work together instead of fighting each other."
  },
  {
    question: "Can you run the ads AND build the system?",
    answer:
      "Yes. That is the offer. I run Meta Ads and build the system the ads land on, so the page converts, the backend tracks everything, and you get clear reports on what is working."
  },
  {
    question: "Do I need both ads and a system?",
    answer:
      "If you are running ads to a broken page, you need the system first. If you have a good system but no traffic, you need the ads. The audit figures out which is the right first move."
  },
  {
    question: "Can you improve an existing website or app?",
    answer:
      "Yes. If you already have a website, dashboard, or workflow, I can improve the customer flow, admin controls, reporting, and automation."
  },
  {
    question: "What happens during the free audit?",
    answer:
      "We map the current funnel, ads, landing page, system, and follow-up, find the biggest leak, and plan the right fix first."
  }
];

export default function Home() {
  return (
    <>
      <SiteHeader
        brandSubtitle="Kevin Rholette Allego"
        navLabel="Primary navigation"
        links={publicNavLinks}
        cta={<AuditPopup className="nav-cta">Free Audit</AuditPopup>}
      />
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <SectionLabel>Kuya Ken, Full Funnel Builder</SectionLabel>
            <h1>I build the full funnel. AI systems, automation, and the ads that fill them.</h1>
            <p className="lead">
              Most businesses hire two people for this. I do it end to end, the Meta Ads that
              bring buyers, the AI-powered system that converts and operates, and the automation
              that keeps it running.
            </p>
            <div className="trust-strip" aria-label="Live builds and operations">
              <span className="trust-label">Live builds</span>
              <ul>
                {trustProjects.map((project) => (
                  <li key={project}>{project}</li>
                ))}
              </ul>
            </div>
            <div className="pill-row" aria-label="Kuya Ken positioning">
              <span>Meta Ads + Paid Media</span>
              <span>POS + Orders</span>
              <span>Dashboards + Reports</span>
              <span>Automation + AI</span>
            </div>
            <div className="cta-row">
              <AuditPopup>Book Free Audit</AuditPopup>
              <Link href="/system" className="btn secondary">See How I Work</Link>
            </div>
            <div className="hero-metrics" aria-label="Proof metrics">
              <span><strong>$4M+</strong> ad spend managed</span>
              <span><strong>429+</strong> campaigns run</span>
              <span><strong>PHP 100M+</strong> revenue driven</span>
            </div>
          </div>
          <figure className="system-hero" aria-label="Business system preview">
            <div className="system-window">
              <div className="window-bar"><i /><i /><i /><strong>Your Future Operating System</strong></div>
              <div className="funnel-flow">
                {[
                  { accent: "blue",  label: "Ads",        sub: "Meta Ads drives targeted traffic" },
                  { accent: "mint",  label: "Landing",     sub: "Clicks become leads and buyers" },
                  { accent: "lime",  label: "Convert",     sub: "System closes and operates" },
                  { accent: "amber", label: "AI Reports",  sub: "Data drives the next move" }
                ].map((stage, i) => (
                  <div key={stage.label} className="ff-item">
                    <div className={`ff-stage accent-${stage.accent}`}>
                      <div className="ff-dot" />
                      <div className="ff-text">
                        <strong>{stage.label}</strong>
                        <span>{stage.sub}</span>
                      </div>
                    </div>
                    {i < 3 && (
                      <div className="ff-connector">
                        <div className="ff-line" />
                        <div className="ff-drop" style={{ animationDelay: `${i * 0.8}s` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <figcaption className="founder-chip">
              <video
                src="/assets/ken-portrait.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="founder-chip-video"
                aria-label="Kevin Rholette Allego"
              />
              <span>
                <strong>Kevin Rholette Allego</strong>
                I build the system. You run the business.
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="section old-new-section">
          <div className="compare-head">
            <SectionLabel>The Old Way</SectionLabel>
            <h2>Most businesses are still running on chats, notes, and owner memory.</h2>
            <p>
              That works until the business gets busier. Then orders get missed, reports arrive
              late, staff keeps asking, and decisions become guesswork.
            </p>
          </div>
          <div className="compare-columns" aria-label="Before and after comparison">
            <article className="compare-column before-col">
              <header>
                <span className="state-tag before-tag">Before</span>
                <h3>How things look now</h3>
              </header>
              <ul>
                {transformations.map(([before]) => (
                  <li key={before}>{before}</li>
                ))}
              </ul>
            </article>

            <article className="compare-column after-col">
              <header>
                <span className="state-tag after-tag">After</span>
                <h3>The better way</h3>
              </header>
              <ul>
                {transformations.map(([, after]) => (
                  <li key={after}>{after}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section id="systems" className="section">
          <SectionLabel>The Full Funnel</SectionLabel>
          <h2>One builder. Every layer of the funnel.</h2>
          <p className="lead">
            From the ad that gets the click to the system that handles the order, I build and
            run the whole thing so nothing is disconnected.
          </p>
          <div className="funnel-stages">
            {funnelStages.map((stage) => (
              <div key={stage.stage} className={`funnel-stage accent-${stage.accent}`}>
                <div className="funnel-stage-label">{stage.stage}</div>
                <div className="funnel-stage-cards">
                  {stage.items.map((item) => (
                    <article key={item.title} className="system-card">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section funnel-why-section">
          <div className="funnel-why-copy">
            <SectionLabel>Why This Works</SectionLabel>
            <h2>Most businesses hire two people. You only need one.</h2>
            <p>
              When the ads guy and the dev guy are different people, there is always a gap. The
              page does not match the ad. The system does not track what the ads need. Results
              suffer and nobody owns the problem.
            </p>
            <p>
              I build the system and run the ads. That means everything is designed to work
              together, the ad, the landing page, the backend, and the report.
            </p>
          </div>
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
        </section>

        <section className="section">
          <SectionLabel>Paid Media Results</SectionLabel>
          <h2>Real campaigns. Real numbers.</h2>
          <p className="lead">
            These are results from actual Meta Ads campaigns, not estimates, not projections.
          </p>
          <ProofCarousel items={mediaResults} />
        </section>

        <section className="section">
          <SectionLabel>Client Feedback</SectionLabel>
          <h2>Hear it from the people who worked with me.</h2>
          <FeedbackGrid videos={feedbackVideos} />
        </section>

        <section className="section process-section">
          <SectionLabel>How It Works</SectionLabel>
          <h2>From audit to live system in four steps.</h2>
          <div className="process-steps">
            {processSteps.map((step, i) => (
              <div key={step.number} className={`process-step accent-${step.accent}`}>
                {i < processSteps.length - 1 && <div className="process-connector" />}
                <div className="process-number">{step.number}</div>
                <strong className="process-name">{step.name}</strong>
                <p className="process-body">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="cta-row" style={{ marginTop: "2rem" }}>
            <AuditPopup>Book Free Audit</AuditPopup>
          </div>
        </section>

        <section className="section ai-section">
          <div>
            <SectionLabel>Easy Reports</SectionLabel>
            <h2>Your numbers should explain the next move.</h2>
            <p>
              You should not need to study big spreadsheets. The report should tell you what is
              strong, what is weak, and what to do next.
            </p>
          </div>
          <div className="report-panel" aria-label="AI report sample">
            <div className="window-bar"><i /><i /><i /><strong>Quick Business Report</strong></div>
            <dl>
              <div><dt>Sales</dt><dd>Weekends are stronger than weekdays.</dd></div>
              <div><dt>Stock</dt><dd>Three top items are almost out.</dd></div>
              <div><dt>Customers</dt><dd>Repeat buyers respond well to quick follow-up.</dd></div>
              <div><dt>Next Step</dt><dd>Push best-seller bundles and send reminders.</dd></div>
            </dl>
          </div>
        </section>

        <section className="section">
          <SectionLabel>Who I Help</SectionLabel>
          <h2>Built for businesses that take orders, serve people, and track daily work.</h2>
          <div className="industry-row">
            {industries.map((industry) => <span key={industry}>{industry}</span>)}
          </div>
        </section>

        <section id="faq" className="section faq-section">
          <SectionLabel>FAQ</SectionLabel>
          <h2>Questions business owners usually ask first.</h2>
          <div className="faq-list">
            {faqs.map((faq) => (
              <article key={faq.question} className="faq-item">
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="audit" className="section final-section">
          <SectionLabel>Free Funnel Audit</SectionLabel>
          <h2>Find out where your funnel is leaking first.</h2>
          <p>
            Whether the problem is the ads, the page, the system, or the follow-up, the audit
            finds the biggest gap and builds the plan to fix it.
          </p>
          <AuditPopup>Book Free Audit</AuditPopup>
        </section>
      </main>
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
    </>
  );
}
