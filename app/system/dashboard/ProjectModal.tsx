"use client";

import { useEffect, useState } from "react";
import CopyPathButton from "./CopyPathButton";
import { getProjectPaths } from "./pathUtils";

type ProjectModalProps = {
  project: any;
  rootPath: string;
  variant: "decision" | "registry";
  risk: string;
  openBacklog: number;
  recency?: {
    label: string;
    className: string;
  };
};

function renderPercentBar(value: number, tone = "neutral", label = `${value}%`) {
  const safeValue = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="cc-progress" aria-label={label}>
      <span className={`cc-progress-fill tone-${tone}`} style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function getTaskTone(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "done") return "healthy";
  if (normalized === "blocked") return "critical";
  if (normalized === "in progress") return "current";
  return "watch";
}

export default function ProjectModal({
  project,
  rootPath,
  variant,
  risk,
  openBacklog,
  recency
}: ProjectModalProps) {
  const [open, setOpen] = useState(false);
  const projectPaths = getProjectPaths(project.location, rootPath);
  const unfinished = (project.tasks || [])
    .filter((task: any) => task.status !== "Done")
    .sort((a: any, b: any) => {
      const rank = (status: string) => status === "Blocked" ? 0 : status === "In Progress" ? 1 : 2;
      return rank(a.status) - rank(b.status);
    });

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.body.classList.add("cc-modal-open");
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("cc-modal-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      {variant === "decision" ? (
        <button type="button" className={`cc-decision-item risk-${risk}`} onClick={() => setOpen(true)}>
          <div>
            <strong>{project.name}</strong>
            <p>{project.decision?.title || project.nextAction}</p>
          </div>
          <span>{openBacklog} open</span>
        </button>
      ) : (
        <article className={`cc-project-row risk-${risk}`}>
          <button type="button" className="cc-project-open" onClick={() => setOpen(true)}>
            <div className="cc-project-main">
              {recency ? <span className={`cc-recency ${recency.className}`}>{recency.label}</span> : null}
              <div>
                <span className="cc-project-title">{project.name}</span>
                <p>{project.description}</p>
                <small>recent work: {project.lastTouchedNote || project.nextAction}</small>
              </div>
            </div>
            <div className="cc-project-progress">
              <span>{project.progressPct}%</span>
              {renderPercentBar(project.progressPct || 0, risk === "critical" ? "critical" : risk === "watch" ? "watch" : "healthy")}
            </div>
            <div className="cc-project-meta">
              <span>{project.state}</span>
              <span>{openBacklog} backlog</span>
              <span>{project.counts?.blocked || 0} blocked</span>
            </div>
          </button>
          <div className="cc-path-strip cc-project-paths">
            {projectPaths.slice(0, 2).map((projectPath) => (
              <span key={projectPath.value} className="cc-path-pill">
                <code>{projectPath.label}</code>
                <CopyPathButton value={projectPath.value} />
              </span>
            ))}
          </div>
        </article>
      )}

      {open ? (
        <div className="cc-modal-backdrop" onClick={() => setOpen(false)}>
          <section
            className="cc-project-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`project-modal-${project.slug}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="cc-modal-head">
              <div>
                <p className="cc-kicker">Project Command View</p>
                <h2 id={`project-modal-${project.slug}`}>{project.name}</h2>
                <p>{project.description}</p>
              </div>
              <button type="button" className="cc-modal-close" onClick={() => setOpen(false)}>Close</button>
            </header>

            <div className="cc-modal-body">
              <section className="cc-modal-kpis">
                <article className="cc-kpi-card">
                  <p>Progress</p>
                  <strong>{project.progressPct}%</strong>
                  {renderPercentBar(project.progressPct || 0, project.progressPct < 35 ? "watch" : "healthy")}
                </article>
                <article className="cc-kpi-card">
                  <p>Open Backlog</p>
                  <strong>{openBacklog}</strong>
                  <span>{project.counts?.todo || 0} todo / {project.counts?.blocked || 0} blocked</span>
                </article>
                <article className="cc-kpi-card">
                  <p>Recently Worked</p>
                  <strong className="cc-date-value">{project.lastTouchedAt || "-"}</strong>
                  <span>{project.lastTouchedNote || "-"}</span>
                </article>
                <article className="cc-kpi-card">
                  <p>Next Review</p>
                  <strong className="cc-date-value">{project.nextReview}</strong>
                  <span>{project.owner} owns this lane</span>
                </article>
              </section>

              <section className="cc-modal-grid">
                <article className="cc-panel">
                  <div className="cc-panel-head">
                    <div>
                      <p>Workspace Paths</p>
                      <h2>Copy And Work</h2>
                    </div>
                  </div>
                  <div className="cc-path-list">
                    {projectPaths.length ? projectPaths.map((projectPath) => (
                      <div key={projectPath.value} className="cc-path-row">
                        <div>
                          <strong>{projectPath.label}</strong>
                          <code>{projectPath.value}</code>
                        </div>
                        <CopyPathButton value={projectPath.value} />
                      </div>
                    )) : (
                      <div className="cc-empty">No workspace path mapped for this project.</div>
                    )}
                  </div>
                </article>

                <article className="cc-panel cc-panel-priority">
                  <div className="cc-panel-head">
                    <div>
                      <p>Decision Support</p>
                      <h2>Owner Call</h2>
                    </div>
                  </div>
                  <div className="cc-decision-copy">
                    <p><strong>Decision:</strong> {project.decision?.title || project.nextAction}</p>
                    <p><strong>Delay cost:</strong> {project.decision?.impact || "No delay cost mapped yet."}</p>
                    <p><strong>Recommended move:</strong> {project.decision?.recommendedNextStep || "Confirm the next execution priority."}</p>
                  </div>
                </article>

                <article className="cc-panel">
                  <div className="cc-panel-head">
                    <div>
                      <p>Build Plan</p>
                      <h2>What Needs To Be Built</h2>
                    </div>
                  </div>
                  <ul className="cc-build-list">
                    {(project.buildNeeds || []).map((item: string) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </section>

              <section className="cc-panel">
                <div className="cc-panel-head">
                  <div>
                    <p>Execution Queue</p>
                    <h2>Backlog And Blockers First</h2>
                  </div>
                  <span>{unfinished.length} open tasks</span>
                </div>
                <div className="cc-task-list">
                  {unfinished.length ? unfinished.map((task: any) => (
                    <article key={task.id} className={`cc-task-item tone-${getTaskTone(task.status)}`}>
                      <div>
                        <strong>{task.title}</strong>
                        <p>{task.owner} / {task.priority} priority / updated {task.updatedAt}</p>
                      </div>
                      <span>{task.status}</span>
                    </article>
                  )) : (
                    <div className="cc-empty">No unfinished tasks.</div>
                  )}
                </div>
                {(project.backlog || []).length ? (
                  <ul className="cc-build-list compact">
                    {project.backlog.map((item: string) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <section className="cc-modal-grid two">
                <article className="cc-panel">
                  <div className="cc-panel-head">
                    <div>
                      <p>Skills Used</p>
                      <h2>Operating Leverage</h2>
                    </div>
                  </div>
                  <div className="cc-skill-compact">
                    {(project.skillsUsed || []).length ? project.skillsUsed.map((skill: any) => (
                      <article key={skill.name}>
                        <strong>{skill.name}</strong>
                        <p>{skill.purpose}</p>
                      </article>
                    )) : (
                      <article>
                        <strong>No mapped skills yet</strong>
                        <p>Skill mapping appears when sync data includes project-skill links.</p>
                      </article>
                    )}
                  </div>
                </article>

                <article className="cc-panel">
                  <div className="cc-panel-head">
                    <div>
                      <p>Activity</p>
                      <h2>Related Movement</h2>
                    </div>
                  </div>
                  <div className="cc-activity-list">
                    {(project.relatedActivity || []).length ? project.relatedActivity.map((item: any, idx: number) => (
                      <article key={`${item.date}-${item.title}-${idx}`}>
                        <span>{item.type}</span>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </article>
                    )) : (
                      <article>
                        <span>Idle</span>
                        <strong>No matched activity yet</strong>
                        <p>This project will show more items as weekly updates are logged.</p>
                      </article>
                    )}
                  </div>
                </article>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
