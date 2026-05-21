import type { Metadata } from "next";
import Link from "next/link";
import AuditPopup from "../components/AuditPopup";
import SiteHeader from "../components/SiteHeader";
import { publicNavLinks } from "../nav";

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
      "VS Code interface",
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
      "Codex CLI as bulk executor for 3+ file edits",
      "Vibe coding — prompt-driven, fast iteration",
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
    headline: "Build the structure first.",
    body:
      "This is where we build the actual system structure: pages, dashboards, data models, and workflow logic. The goal is a working foundation before automation is attached.",
    modules: [
      "Next.js + Supabase — web apps and SaaS products",
      "Expo + EAS — Android and iOS mobile apps",
      "Python — automation scripts, pipelines, bots",
      "Web app screens and role-based dashboards",
      "Data models for orders, sales, and operations",
      "Core business rules and workflow logic",
      "QA pass to validate end-to-end behavior",
      "Launch-ready baseline before automation"
    ],
    emphasized: true
  },
  {
    accent: "rose",
    number: "05",
    name: "Integrations",
    headline: "Connect APIs and automate operations.",
    body:
      "After the structure is stable, we connect tools through APIs and triggers so tasks run automatically across POS, CRM, ads, and reporting systems.",
    modules: [
      "API connections to existing business tools",
      "POS, payment, CRM, and operations sync",
      "Event triggers and scheduled automations",
      "Live dashboards and one-click reporting"
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
      "VS Code updates and confirmations",
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
    step: "Start a task directly from VS Code."
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
    step: "Build the structure: screens, dashboards, data model, and workflow rules."
  },
  {
    layer: "Integrations",
    color: "rose",
    step: "Connect APIs and automation: POS, CRM, ads, and reporting triggers."
  },
  {
    layer: "Output",
    color: "blue",
    step: "VS Code shows me completion logs with live links plus the dashboard URL."
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
  },
  {
    title: "Build for yourself first",
    body:
      "Every tool I deploy for clients I built for my own business first. Hinilas Pro, the content pipeline, the Telegram bot, the ad reporting scripts — all running live, all battle-tested."
  }
];

export default function SystemPage() {
  return (
    <>
      <SiteHeader
        brandSubtitle="How I Work"
        navLabel="System navigation"
        links={publicNavLinks}
        cta={<AuditPopup className="nav-cta">Free Audit</AuditPopup>}
      />

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
              <span>Next.js + Supabase</span>
              <span>Python automation</span>
              <span>Mobile (Expo / Android)</span>
              <span>30+ skills</span>
              <span>Memory across sessions</span>
            </div>
            <div className="cta-row">
              <AuditPopup>Book Free System Audit</AuditPopup>
              <Link href="#architecture" className="btn secondary">See the architecture</Link>
              <Link href="/system/dashboard" className="btn secondary">Open OS Portal</Link>
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

          <div className="system-algo" aria-label="Workflow algorithm network">
            <svg className="system-algo-lines" viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker
                  id="flow-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill="rgba(173, 211, 255, 0.92)" />
                </marker>
              </defs>

              <path className="flow-base" d="M120 280 L300 180" markerEnd="url(#flow-arrow)" />
              <path className="flow-base" d="M360 180 L520 180" markerEnd="url(#flow-arrow)" />
              <path className="flow-base" d="M580 180 L760 280" markerEnd="url(#flow-arrow)" />
              <path className="flow-base" d="M820 280 L980 280" markerEnd="url(#flow-arrow)" />
              <path className="flow-base" d="M1040 280 L1080 175" markerEnd="url(#flow-arrow)" />
              <path className="flow-base flow-return" d="M1080 175 C1130 320 1010 470 680 484 C370 500 185 430 120 300" markerEnd="url(#flow-arrow)" />

              <path className="flow-link" d="M320 210 L320 360" markerEnd="url(#flow-arrow)" />
              <path className="flow-link" d="M740 250 L740 140" markerEnd="url(#flow-arrow)" />
              <path className="flow-link" d="M980 312 L980 390" markerEnd="url(#flow-arrow)" />
              <path className="flow-link" d="M520 215 L520 360" markerEnd="url(#flow-arrow)" />
              <path className="flow-link" d="M320 360 L520 360" markerEnd="url(#flow-arrow)" />

              <path className="flow-run run-1" d="M120 280 L300 180" />
              <path className="flow-run run-2" d="M360 180 L520 180" />
              <path className="flow-run run-3" d="M580 180 L760 280" />
              <path className="flow-run run-4" d="M820 280 L980 280" />
              <path className="flow-run run-5" d="M1040 280 L1080 175" />
              <path className="flow-run run-6" d="M1080 175 C1130 320 1010 470 680 484 C370 500 185 430 120 300" />
              <path className="flow-run side-1" d="M320 210 L320 360" />
              <path className="flow-run side-2" d="M740 250 L740 140" />
              <path className="flow-run side-3" d="M980 312 L980 390" />
            </svg>

            <article className="algo-node accent-blue node-input">
              <small>01</small>
              <p>Input</p>
            </article>
            <article className="algo-node accent-mint node-context">
              <small>02</small>
              <p>Context</p>
            </article>
            <article className="algo-node accent-lime node-agent">
              <small>03</small>
              <p>Agent</p>
            </article>
            <article className="algo-node accent-amber node-execution">
              <small>04</small>
              <p>Execution</p>
            </article>
            <article className="algo-node accent-rose node-integrations">
              <small>05</small>
              <p>Integrations</p>
            </article>
            <article className="algo-node accent-blue node-output">
              <small>06</small>
              <p>Output</p>
            </article>

            <article className="algo-node algo-side accent-mint node-memory">
              <small>M</small>
              <p>Memory Sync</p>
            </article>
            <article className="algo-node algo-side accent-amber node-approval">
              <small>A</small>
              <p>Approval Gate</p>
            </article>
            <article className="algo-node algo-side accent-rose node-retry">
              <small>R</small>
              <p>Retry Loop</p>
            </article>
            <article className="algo-node algo-side accent-blue node-metrics">
              <small>K</small>
              <p>KPI Signal</p>
            </article>
          </div>

          <ol className="system-flow system-flow-detail">
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
