import type { Metadata } from "next";
import Link from "next/link";
import AuditPopup from "../components/AuditPopup";
import SiteHeader from "../components/SiteHeader";
import { publicNavLinks } from "../nav";

export const metadata: Metadata = {
  title: "Resume - Kevin Rholette Allego",
  description:
    "Resume of Kevin Rholette Allego (Kuya Ken), AI business systems builder for operations, automation, and reporting.",
  alternates: {
    canonical: "/resume"
  }
};

export default function ResumePage() {
  return (
    <>
      <SiteHeader
        brandSubtitle="Resume"
        navLabel="Resume navigation"
        links={publicNavLinks}
        cta={<AuditPopup className="nav-cta">Free Audit</AuditPopup>}
      />

      <main>
        <section className="section resume-wrap">
          <div className="resume-shell">
            <div className="resume-head">
              <p className="eyebrow">Kevin Rholette Allego</p>
              <h1>Resume</h1>
              <div className="cta-row">
                <a href="/resume/index.html" target="_blank" rel="noreferrer" className="btn secondary">
                  Open Full Resume
                </a>
                <Link href="/system" className="btn secondary">How I Work</Link>
              </div>
            </div>

            <iframe
              src="/resume/index.html"
              title="Kevin Rholette Allego Resume"
              className="resume-frame"
              loading="lazy"
            />
          </div>
        </section>
      </main>
    </>
  );
}
