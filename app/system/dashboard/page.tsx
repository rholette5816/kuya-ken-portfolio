import type { Metadata } from "next";
import activitySnapshot from "../activitySnapshot.json";
import journalLog from "../journal.json";
import projectsData from "../projects.json";
import MinimalMode from "./MinimalMode";
import AutoRefresh from "./AutoRefresh";
import CopyPathButton from "./CopyPathButton";
import ProjectModal from "./ProjectModal";
import { getProjectPaths } from "./pathUtils";

export const metadata: Metadata = {
  title: "KRA Digital OS Portal",
  description:
    "Private OS Portal for project progress, backlog pressure, decisions, skills, and operating analytics.",
  alternates: {
    canonical: "/system/dashboard"
  }
};

const DAY_MS = 1000 * 60 * 60 * 24;
const SKILL_CATEGORY_ORDER = [
  "Content",
  "SaaS / Web Build",
  "Assistant / Operations",
  "Ads / Reporting",
  "Automation / Pipeline",
  "Creative / Video",
  "Other"
];

function getSnapshotDate() {
  return activitySnapshot.generatedAt
    ? new Date(activitySnapshot.generatedAt)
    : new Date();
}

function formatSyncDate(dateValue?: string) {
  if (!dateValue) return "Not synced";
  return new Date(dateValue).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

function getDaysSince(dateValue?: string) {
  if (!dateValue) return 999;
  const snapshotDate = getSnapshotDate();
  const touchedDate = new Date(dateValue);
  return Math.max(0, Math.floor((snapshotDate.getTime() - touchedDate.getTime()) / DAY_MS));
}

function getRecency(project: any) {
  const days = getDaysSince(project.lastTouchedAt);
  if (days === 0) return { label: "Today", className: "is-fresh", weight: 0 };
  if (days <= 3) return { label: `${days}d`, className: "is-current", weight: 1 };
  if (days <= 7) return { label: `${days}d`, className: "is-watch", weight: 2 };
  return { label: `${days}d`, className: "is-stale", weight: 3 };
}

function getProjectRisk(project: any) {
  const openBacklog = (project.counts?.todo || 0) + (project.counts?.blocked || 0);
  const blocked = project.counts?.blocked || 0;
  const recency = getRecency(project);

  if (blocked > 0 || recency.weight >= 3) return "critical";
  if (openBacklog >= 2 || project.progressPct < 35 || recency.weight >= 2) return "watch";
  return "healthy";
}

function renderPercentBar(value: number, tone = "neutral", label = `${value}%`) {
  const safeValue = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="cc-progress" aria-label={label}>
      <span className={`cc-progress-fill tone-${tone}`} style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function renderWorkHoursChart() {
  const dailyWorkHours = activitySnapshot.analytics?.dailyWorkHours || [];
  const maxValue = Math.max(8, ...dailyWorkHours.map((item: any) => item.hours || 0));

  return (
    <div className="cc-bars" aria-label="Estimated daily work hours">
      {dailyWorkHours.map((item: any) => (
        <div key={item.date} className="cc-hours-row">
          <p>{item.label}</p>
          <div className="cc-bar-track">
            <span
              className="cc-bar-fill tone-current"
              style={{ width: `${Math.round(((item.hours || 0) / maxValue) * 100)}%` }}
            />
          </div>
          <strong>{item.hours || 0}h</strong>
        </div>
      ))}
      <p className="cc-chart-note">Estimated from captured OS activity. Real timer tracking can be added later.</p>
    </div>
  );
}

function renderStatusMix(analytics: any) {
  const total = analytics?.totalTasks || 1;
  const segments = [
    { label: "Done", value: analytics?.completedTasks || 0, tone: "healthy" },
    { label: "In Progress", value: analytics?.inProgressTasks || 0, tone: "current" },
    { label: "Todo", value: analytics?.todoTasks || 0, tone: "watch" },
    { label: "Blocked", value: analytics?.blockedTasks || 0, tone: "critical" }
  ];

  return (
    <div className="cc-stack">
      <div className="cc-stack-bar">
        {segments.map((segment) => (
          <span
            key={segment.label}
            className={`cc-stack-segment tone-${segment.tone}`}
            style={{ width: `${Math.round((segment.value / total) * 100)}%` }}
          />
        ))}
      </div>
      <div className="cc-stack-legend">
        {segments.map((segment) => (
          <span key={segment.label}>{segment.label}: {segment.value}</span>
        ))}
      </div>
    </div>
  );
}

function groupSkills(skillsCatalog: any[]) {
  return SKILL_CATEGORY_ORDER
    .map((category) => ({
      category,
      skills: skillsCatalog.filter((skill: any) => (skill.category || "Other") === category)
    }))
    .filter((group) => group.skills.length > 0);
}

function getPrimarySkillCommand(skill: any) {
  return (skill.commands || [skill.name])[0] || skill.name;
}

export default function OSDashboardPage() {
  const archivedProjects = (projectsData as any[])
    .filter((project: any) => String(project.state || "").toLowerCase() === "archived")
    .slice();
  const projects = (projectsData as any[])
    .filter((project: any) => String(project.state || "").toLowerCase() !== "archived")
    .slice();
  projects.sort((a: any, b: any) => Date.parse(b.lastTouchedAt || "") - Date.parse(a.lastTouchedAt || ""));

  const feedRows = (journalLog as any[]).slice().reverse();
  const skillsCatalog = activitySnapshot.skillsCatalog || [];
  const skillGroups = groupSkills(skillsCatalog);
  const summary = activitySnapshot.summary;
  const analytics = activitySnapshot.analytics;
  const decisionQueue = projects
    .filter((project: any) => getProjectRisk(project) !== "healthy")
    .sort((a: any, b: any) => {
      const riskScore = (project: any) => {
        const blocked = project.counts?.blocked || 0;
        const open = (project.counts?.todo || 0) + (project.counts?.blocked || 0);
        return blocked * 10 + open * 3 + (100 - (project.progressPct || 0)) / 10 + getRecency(project).weight;
      };
      return riskScore(b) - riskScore(a);
    })
    .slice(0, 5);

  return (
    <>
      <MinimalMode />
      <main className="cc-main">
        <header className="cc-topbar">
          <div>
            <p className="cc-kicker">Private Operating System</p>
            <h1>OS Portal</h1>
            <p className="cc-subtitle">A focused owner view for priorities, backlog pressure, decisions, and project momentum.</p>
            <AutoRefresh />
          </div>
          <div className="cc-top-actions">
            <p>Last sync: {formatSyncDate(activitySnapshot.generatedAt)}</p>
            <form method="post" action="/system/logout">
              <button type="submit" className="cc-lock">Lock</button>
            </form>
          </div>
        </header>

        <section className="cc-kpi-grid" aria-label="Command center KPI summary">
          <article className="cc-kpi-card">
            <p>Completion</p>
            <strong>{analytics?.completionRate || 0}%</strong>
            {renderPercentBar(analytics?.completionRate || 0, "healthy")}
          </article>
          <article className="cc-kpi-card">
            <p>Open Backlog</p>
            <strong>{analytics?.openBacklogItems || 0}</strong>
            <span>{analytics?.todoTasks || 0} todo / {analytics?.blockedTasks || 0} blocked</span>
          </article>
          <article className="cc-kpi-card tone-critical">
            <p>Needs Decision</p>
            <strong>{analytics?.projectsNeedingDecision || 0}</strong>
            <span>Projects requiring owner attention</span>
          </article>
          <article className="cc-kpi-card">
            <p>Active Projects</p>
            <strong>{analytics?.activeProjects || summary?.active || 0}</strong>
            <span>{analytics?.totalProjects || summary?.total || 0} total tracked</span>
          </article>
          <article className="cc-kpi-card">
            <p>Skills</p>
            <strong>{summary?.skillFolderCount || 0}</strong>
            <span>skills available</span>
          </article>
        </section>

        <section className="cc-dashboard-grid">
          <article className="cc-panel cc-panel-priority">
            <div className="cc-panel-head">
              <div>
                <p>Priority Queue</p>
                <h2>Decisions To Clear</h2>
              </div>
              <span>{decisionQueue.length} active</span>
            </div>
            <div className="cc-decision-list">
              {decisionQueue.length ? decisionQueue.map((project: any) => {
                const risk = getProjectRisk(project);
                const openBacklog = (project.counts?.todo || 0) + (project.counts?.blocked || 0);
                return (
                  <ProjectModal
                    key={project.slug}
                    project={project}
                    rootPath={activitySnapshot.rootPath}
                    variant="decision"
                    risk={risk}
                    openBacklog={openBacklog}
                  />
                );
              }) : (
                <div className="cc-empty">No decision pressure detected.</div>
              )}
            </div>
          </article>

          <article className="cc-panel">
            <div className="cc-panel-head">
              <div>
                <p>Task Mix</p>
                <h2>Execution Health</h2>
              </div>
            </div>
            {renderStatusMix(analytics)}
          </article>
        </section>

        <section className="cc-panel">
          <div className="cc-panel-head">
            <div>
              <p>Project Registry</p>
              <h2>Projects By Recent Work</h2>
            </div>
            <span>Most recently worked projects appear first</span>
          </div>
          <div className="cc-project-list is-scrollable">
            {projects.map((project: any) => {
              const recency = getRecency(project);
              const risk = getProjectRisk(project);
              const openBacklog = (project.counts?.todo || 0) + (project.counts?.blocked || 0);
              return (
                <ProjectModal
                  key={project.slug}
                  project={project}
                  rootPath={activitySnapshot.rootPath}
                  variant="registry"
                  risk={risk}
                  openBacklog={openBacklog}
                  recency={recency}
                />
              );
            })}
          </div>
        </section>

        <section className="cc-dashboard-grid secondary">
          <article className="cc-panel">
            <div className="cc-panel-head">
              <div>
                <p>Latest Activity</p>
                <h2>Recent Movement</h2>
              </div>
              <span>{feedRows.length} items</span>
            </div>
            <div className="cc-scroll-box compact cc-activity-list">
              {feedRows.map((item: any, idx: number) => (
                <article key={`${item.date}-${item.title}-${idx}`}>
                  <span>{item.type}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="cc-panel">
            <div className="cc-panel-head">
              <div>
                <p>Archives</p>
                <h2>Stored Projects</h2>
              </div>
              <span>{archivedProjects.length} archived</span>
            </div>
            <div className="cc-scroll-box compact">
              {archivedProjects.length ? archivedProjects.map((project: any) => (
                <article key={project.slug} className="cc-archive-item">
                  <div>
                    <strong>{project.name}</strong>
                    <p>{project.description}</p>
                    <small>{project.lastTouchedAt || project.nextReview || "No review date"}</small>
                  </div>
                  <div className="cc-path-strip">
                    {getProjectPaths(project.location, activitySnapshot.rootPath).slice(0, 2).map((projectPath) => (
                      <span key={projectPath.value} className="cc-path-pill">
                        <code>{projectPath.label}</code>
                        <CopyPathButton value={projectPath.value} />
                      </span>
                    ))}
                  </div>
                </article>
              )) : (
                <div className="cc-empty">No archived projects.</div>
              )}
            </div>
          </article>
        </section>

        <section className="cc-panel">
          <div className="cc-panel-head">
            <div>
              <p>Skills Library</p>
              <h2>One Command Per Skill</h2>
            </div>
            <span>{skillsCatalog.length} skills</span>
          </div>
          <div className="cc-scroll-box skills-drawer">
            {skillGroups.map((group) => (
              <section key={group.category} className="cc-skill-group">
                <header>
                  <h3>{group.category}</h3>
                  <span>{group.skills.length}</span>
                </header>
                <div className="cc-skill-rows">
                  {group.skills.map((skill: any) => {
                    const primaryCommand = getPrimarySkillCommand(skill);
                    return (
                      <article key={skill.name} className="cc-skill-row">
                        <strong>{skill.name}</strong>
                        <span className="cc-command-pill">
                          <code>{primaryCommand}</code>
                          <CopyPathButton value={primaryCommand} />
                        </span>
                        <p>{skill.purpose}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
