import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const WORK_TIME_ZONE = "Asia/Manila";
const TODAY = new Date();
const TODAY_ISO = formatDateISO(TODAY);

function formatDateISO(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WORK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

const PROJECT_TEMPLATES = {
  "Personal brand": {
    buildNeeds: [
      "Keep prior personal brand notes available as reference",
      "Do not route weekly execution capacity here"
    ],
    backlog: [
      "Retain archive notes for future lookup",
      "Only reactivate after an explicit project-state decision"
    ],
    decisionTitle: "Keep Personal Brand archived",
    decisionImpact: "Treating archived brand work as active can split focus from current revenue, automation offer, and product work.",
    recommendation: "Keep in archives unless Ken explicitly reactivates the personal brand project.",
    tasks: [
      { title: "Move Personal Brand project folder to archives", status: "Done", priority: "High" },
      { title: "Mark Personal Brand as archived in operating docs", status: "Done", priority: "High" },
      { title: "Preserve notes for future reference", status: "Done", priority: "Medium" },
      { title: "Reassess only if reactivated", status: "Todo", priority: "Low" }
    ]
  },
  "Hilas Program": {
    buildNeeds: [
      "Keep course planning notes available as reference",
      "Do not route weekly execution capacity here"
    ],
    backlog: [
      "Retain archive notes for future lookup",
      "Only reactivate after an explicit project-state decision"
    ],
    decisionTitle: "Keep Hilas Program archived",
    decisionImpact: "Treating archived work as active can split focus from current content, automation offer, and product work.",
    recommendation: "Keep in archives unless Ken explicitly reactivates the course project.",
    tasks: [
      { title: "Move Hilas project folder to archives", status: "Done", priority: "High" },
      { title: "Mark Hilas as archived in operating docs", status: "Done", priority: "High" },
      { title: "Preserve course notes for future reference", status: "Done", priority: "Medium" },
      { title: "Reassess only if reactivated", status: "Todo", priority: "Low" }
    ]
  },
  "Hinilas Pro SaaS": {
    buildNeeds: [
      "Stabilize admin workflows and release cadence",
      "Document feature acceptance criteria per sprint"
    ],
    backlog: [
      "Close pending UX cleanup items on core flows",
      "Strengthen deployment rollback checklist"
    ],
    decisionTitle: "Prioritize feature velocity vs reliability hardening",
    decisionImpact: "Feature-heavy sprints may increase incident risk.",
    recommendation: "Allocate sprint capacity 70% reliability, 30% new features until defect rate drops.",
    tasks: [
      { title: "Review sprint backlog health", status: "In Progress", priority: "High" },
      { title: "Fix deployment regression checklist gaps", status: "Todo", priority: "High" },
      { title: "Finalize monitoring alerts", status: "Blocked", priority: "Medium" },
      { title: "Ship minor UX fixes", status: "Done", priority: "Medium" }
    ]
  },
  "Saiko web app": {
    buildNeeds: [
      "Finish remaining admin and order management polish",
      "Improve operational reporting visibility"
    ],
    backlog: [
      "Align dashboard reporting widgets with operations needs",
      "Reduce manual reconciliation steps for orders"
    ],
    decisionTitle: "Approve final scope for admin reporting upgrade",
    decisionImpact: "Unclear scope can delay release and cause rework.",
    recommendation: "Freeze must-have reporting items for the next release cycle.",
    tasks: [
      { title: "Audit admin order workflow", status: "Done", priority: "High" },
      { title: "Implement reporting summary panels", status: "In Progress", priority: "High" },
      { title: "Backfill missing order event data", status: "Todo", priority: "Medium" },
      { title: "Validate mobile admin screens", status: "Blocked", priority: "Low" }
    ]
  },
  Portfolio: {
    buildNeeds: [
      "Keep offer narrative current with latest proof",
      "Maintain streamlined conversion flow"
    ],
    backlog: [
      "Refresh selected case evidence sections",
      "Tune CTA placements using current analytics"
    ],
    decisionTitle: "Approve next portfolio proof set to feature",
    decisionImpact: "Outdated proof lowers conversion confidence.",
    recommendation: "Update proof modules tied to active offers first.",
    tasks: [
      { title: "Review homepage messaging", status: "Done", priority: "Medium" },
      { title: "Update case-study proof blocks", status: "In Progress", priority: "High" },
      { title: "Add latest client outcomes", status: "Todo", priority: "High" },
      { title: "Benchmark bounce rate by section", status: "Todo", priority: "Low" }
    ]
  },
  "Automation offer assets": {
    buildNeeds: [
      "Package service ladder with clear entry offer",
      "Define repeatable lead handoff and onboarding flow"
    ],
    backlog: [
      "Finalize outreach script variants by industry",
      "Set acceptance criteria for audit delivery quality"
    ],
    decisionTitle: "Choose dominant offer entrypoint (audit vs blueprint)",
    decisionImpact: "Entry offer drives lead quality and close speed.",
    recommendation: "Lead with audit as low-friction entry then upsell blueprint.",
    tasks: [
      { title: "Refine service ladder packaging", status: "In Progress", priority: "High" },
      { title: "Finalize outreach-ready one-pager", status: "Todo", priority: "High" },
      { title: "Prepare lead qualification checklist", status: "Done", priority: "Medium" },
      { title: "Map retainer conversion path", status: "Todo", priority: "Medium" }
    ]
  },
  "Content engine pipeline": {
    buildNeeds: [
      "Reduce failure points in publish automation",
      "Improve weekly monitoring and retry workflow"
    ],
    backlog: [
      "Document failure taxonomy for faster triage",
      "Create simple reliability dashboard for publish runs"
    ],
    decisionTitle: "Decide tolerance for manual intervention",
    decisionImpact: "No threshold means inconsistency in response time.",
    recommendation: "Define response SLA and weekly reliability target.",
    tasks: [
      { title: "Check publish retry logs", status: "In Progress", priority: "High" },
      { title: "Patch unstable publisher edge case", status: "Blocked", priority: "High" },
      { title: "Document fallback procedure", status: "Todo", priority: "Medium" },
      { title: "Validate token refresh flow", status: "Done", priority: "Medium" }
    ]
  },
  "Base dashboard app": {
    buildNeeds: [
      "Re-scope product fit and feature direction",
      "Define criteria to reactivate roadmap"
    ],
    backlog: [
      "Capture open product assumptions before restart",
      "Set revive date based on core portfolio priorities"
    ],
    decisionTitle: "Keep parked or reactivate this quarter",
    decisionImpact: "Premature reactivation could dilute current execution focus.",
    recommendation: "Reassess only after active workstreams hit planned milestones.",
    tasks: [
      { title: "Document parked reasons", status: "Done", priority: "Medium" },
      { title: "Identify must-have MVP features", status: "Todo", priority: "Medium" },
      { title: "Estimate restart effort", status: "Todo", priority: "Low" },
      { title: "Assign future owner", status: "Blocked", priority: "Low" }
    ]
  },
  "Static spa landing sets": {
    buildNeeds: [
      "Define reuse strategy vs archive strategy",
      "Tag templates by quality and readiness"
    ],
    backlog: [
      "Review template quality consistency",
      "Create clear naming taxonomy for reuse"
    ],
    decisionTitle: "Select keep/rework/archive candidates",
    decisionImpact: "Unsorted assets add noise to production priorities.",
    recommendation: "Keep only templates that support active offer themes.",
    tasks: [
      { title: "Inventory all landing variants", status: "In Progress", priority: "Low" },
      { title: "Tag production-worthy templates", status: "Todo", priority: "Low" },
      { title: "Archive low-value variants", status: "Todo", priority: "Low" },
      { title: "Draft reuse checklist", status: "Done", priority: "Low" }
    ]
  },
  "Historical project copy": {
    buildNeeds: [
      "Ensure read-only archival discipline",
      "Retain only files with reference value"
    ],
    backlog: [
      "Prune duplicated historical artifacts",
      "Add archive notes for future lookup"
    ],
    decisionTitle: "Keep archive as-is or compress further",
    decisionImpact: "Unmaintained archive can grow clutter over time.",
    recommendation: "Maintain minimal archive with a short index file.",
    tasks: [
      { title: "Confirm archive boundaries", status: "Done", priority: "Low" },
      { title: "Annotate historical context", status: "Todo", priority: "Low" },
      { title: "Compress nonessential copies", status: "Todo", priority: "Low" },
      { title: "Verify no active links depend on archive", status: "Done", priority: "Medium" }
    ]
  }
};

const PROJECT_DESCRIPTIONS = {
  "Personal brand": "Archived personal brand reference for content output, audience development, and lead conversion ideas.",
  "Hilas Program": "Archived education product reference for curriculum, launch planning, and enrollment ideas.",
  "Hinilas Pro SaaS": "Core SaaS product execution for roadmap delivery, stability, and deployment quality.",
  "Saiko web app": "Web app operations and feature delivery for admin workflow, order flow, and reporting visibility.",
  Portfolio: "Public-facing KRA Digital portfolio used to position offers, showcase proof, and drive inquiries.",
  "Automation offer assets": "Sales and delivery assets for the automation offer, from outreach to onboarding.",
  "Content engine pipeline": "Automation pipeline for content production and publishing reliability across channels.",
  "Base dashboard app": "Parked dashboard concept awaiting re-scope and reactivation decision.",
  "Static spa landing sets": "Collection of landing page templates kept for reuse experiments and creative testing.",
  "Historical project copy": "Archived reference material retained for context and historical lookup only."
};

const PROJECT_SKILL_HINTS = {
  "Personal brand": ["content-calendar", "content-ideas", "content-script", "content-publish", "content-repurpose"],
  "Hilas Program": ["content-calendar", "content-script", "video-analysis", "presentation-builder"],
  "Hinilas Pro SaaS": ["saas-init", "saas-admin", "saas-ai-module", "deploy-check", "new-api-route"],
  "Saiko web app": ["saas-admin", "saas-auth-supabase", "saas-feedback", "deploy-check"],
  Portfolio: ["web-builder", "new-page", "deploy-check"],
  "Automation offer assets": ["pipeline-run", "assistant-tasklist", "credit-audit", "daily-report"],
  "Content engine pipeline": ["pipeline-run", "daily-report", "fb-page-post"],
  "Base dashboard app": ["saas-init", "new-page", "deploy-check"],
  "Static spa landing sets": ["web-builder", "new-page"],
  "Historical project copy": ["assistant-tasklist"]
};

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function findRootDir() {
  const candidates = [
    process.env.EXEC_ASSISTANT_ROOT,
    path.resolve(process.cwd(), ".."),
    process.cwd()
  ].filter(Boolean);

  for (const candidate of candidates) {
    const required = [
      path.join(candidate, "context", "current-priorities.md"),
      path.join(candidate, "context", "active-work-registry.md"),
      path.join(candidate, "decisions", "log.md")
    ];
    if (required.every((file) => fs.existsSync(file))) {
      return candidate;
    }
  }

  throw new Error("Could not locate Executive Assistant root.");
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function shiftDate(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return formatDateISO(next);
}

function parseTableRows(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .slice(2)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length > 1 && !cells.every((cell) => cell.startsWith("---")));
}

function parseActiveRegistry(markdown) {
  const rows = parseTableRows(markdown);
  return rows.map((cells) => ({
    workArea: cells[0] || "",
    location: cells[1] || "",
    state: cells[2] || "",
    owner: cells[3] || "",
    nextAction: cells[4] || "",
    nextReview: cells[5] || ""
  }));
}

function parseDecisionEntries(markdown) {
  const regex = /^\[(\d{4}-\d{2}-\d{2})\]\s+DECISION:\s+(.*?)\s+\|\s+REASONING:\s+(.*?)\s+\|\s+CONTEXT:\s+(.*)$/;
  const entries = [];
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(regex);
    if (!match) continue;
    entries.push({
      date: match[1],
      decision: match[2],
      reasoning: match[3],
      context: match[4]
    });
  }
  return entries.reverse();
}

function parseTopPriorities(markdown) {
  const section = markdown.split("## Top 3 Priorities")[1] || "";
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .slice(0, 3)
    .map((line) => line.replace(/^\d+\.\s+/, ""));
}

function getGitStatusSummary(rootDir) {
  try {
    const output = execSync("git status --short", {
      cwd: rootDir,
      encoding: "utf8"
    });
    const lines = output
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean);

    const changed = [];
    let untracked = 0;
    let trackedChanges = 0;

    for (const line of lines) {
      const code = line.slice(0, 2);
      const file = line.slice(3).trim();
      if (code === "??") {
        untracked += 1;
      } else {
        trackedChanges += 1;
      }
      changed.push({ code, file });
    }

    return {
      trackedChanges,
      untracked,
      changedFiles: changed,
      changedFilesPreview: changed.slice(0, 15)
    };
  } catch {
    return {
      trackedChanges: 0,
      untracked: 0,
      changedFiles: [],
      changedFilesPreview: []
    };
  }
}

function buildActivityFeed(decisions, priorities, gitSummary) {
  const feed = [];

  for (const decision of decisions.slice(0, 10)) {
    feed.push({
      date: decision.date,
      type: "Decision",
      title: decision.decision,
      detail: decision.reasoning,
      source: "decisions/log.md"
    });
  }

  priorities.forEach((priority, idx) => {
    feed.push({
      date: TODAY_ISO,
      type: "Priority",
      title: `Top Priority ${idx + 1}`,
      detail: priority,
      source: "context/weekly-command-center.md"
    });
  });

  gitSummary.changedFilesPreview.forEach((fileChange) => {
    feed.push({
      date: TODAY_ISO,
      type: "File Update",
      title: `${fileChange.code} ${fileChange.file}`,
      detail: "Detected in workspace git status snapshot.",
      source: "git status --short"
    });
  });

  return feed.slice(0, 24);
}

function countSopFiles(rootDir) {
  const sopDir = path.join(rootDir, "references", "sops");
  if (!fs.existsSync(sopDir)) return 0;
  return fs
    .readdirSync(sopDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== ".gitkeep")
    .length;
}

function countSkillFolders(rootDir) {
  const skillsDir = path.join(rootDir, ".claude", "skills");
  if (!fs.existsSync(skillsDir)) return 0;
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .length;
}

function walkSkillFiles(baseDir, matcher, acc = []) {
  if (!fs.existsSync(baseDir)) return acc;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      walkSkillFiles(fullPath, matcher, acc);
      continue;
    }
    if (matcher(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function normalizeSkillName(name) {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractSkillPurpose(markdown) {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim());
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("##")) continue;
    return line;
  }
  return "Operational helper skill used inside the Executive Assistant system.";
}

function extractSkillCommands(markdown, slug) {
  const commands = new Set([slug]);
  const usageSection = markdown.split(/^## Usage\s*$/m)[1]?.split(/^##\s+/m)[0] || "";

  for (const match of usageSection.matchAll(/"([^"]+)"/g)) {
    if (match[1]) commands.add(match[1].trim());
  }

  usageSection
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const cleaned = line
        .replace(/^[-*]\s*/, "")
        .replace(/^User says:\s*/i, "")
        .replace(/^Say:\s*/i, "")
        .trim();
      const isNoise =
        cleaned.includes("```") ||
        cleaned.includes("--") ||
        cleaned.includes("c:/") ||
        cleaned.includes("C:/") ||
        cleaned.includes("path/to") ||
        cleaned.includes("cd ") ||
        cleaned.includes("\"") && cleaned.includes(",") ||
        cleaned.endsWith(":");
      if (cleaned && cleaned.length <= 80 && !cleaned.includes("|") && !isNoise) {
        commands.add(cleaned);
      }
    });

  return Array.from(commands).slice(0, 6);
}

function getSkillCategory(slug, purpose) {
  const text = `${slug} ${purpose}`.toLowerCase();
  if (text.includes("content") || text.includes("hook") || text.includes("fb page post")) return "Content";
  if (text.includes("ads") || text.includes("meta") || text.includes("report") || text.includes("pancake")) return "Ads / Reporting";
  if (text.includes("saas") || text.includes("api") || text.includes("page") || text.includes("web") || text.includes("deploy") || text.includes("supabase")) return "SaaS / Web Build";
  if (text.includes("pipeline") || text.includes("automation") || text.includes("botcake") || text.includes("omni")) return "Automation / Pipeline";
  if (text.includes("assistant") || text.includes("task") || text.includes("daily") || text.includes("operation")) return "Assistant / Operations";
  if (text.includes("video") || text.includes("cinematic") || text.includes("veo") || text.includes("story")) return "Creative / Video";
  return "Other";
}

function collectSkillCatalog(rootDir) {
  const skillsDir = path.join(rootDir, ".claude", "skills");
  if (!fs.existsSync(skillsDir)) return [];
  const files = walkSkillFiles(skillsDir, (name) => name.toLowerCase() === "skill.md");

  const catalog = files.map((filePath) => {
    const folder = path.basename(path.dirname(filePath));
    const content = readFileSafe(filePath);
    const purpose = extractSkillPurpose(content);
    return {
      key: folder.toLowerCase(),
      name: normalizeSkillName(folder),
      slug: folder,
      category: getSkillCategory(folder, purpose),
      purpose,
      commands: extractSkillCommands(content, folder),
      source: path.relative(rootDir, filePath).replace(/\\/g, "/")
    };
  });

  catalog.sort((a, b) => a.name.localeCompare(b.name));
  return catalog;
}

function buildStateSummary(registryRows) {
  const summary = {
    total: registryRows.length,
    active: 0,
    maintenance: 0,
    parked: 0,
    archived: 0,
    sandbox: 0
  };

  for (const row of registryRows) {
    const key = row.state.toLowerCase();
    if (key in summary) summary[key] += 1;
  }

  return summary;
}

function decorateTask(task, projectSlug, projectOwner, rowIndex, taskIndex) {
  const updatedAt = shiftDate(TODAY, -((rowIndex + taskIndex) % 14));
  return {
    id: `${projectSlug}-${taskIndex + 1}`,
    title: task.title,
    status: task.status,
    priority: task.priority,
    owner: projectOwner,
    updatedAt,
    notes: ""
  };
}

function buildDefaultTemplate(row) {
  return {
    description: `${row.workArea} execution lane for ${row.state.toLowerCase()} operations, managed by ${row.owner || "Team"}.`,
    buildNeeds: [row.nextAction || `Define next build milestone for ${row.workArea}`],
    backlog: [`Create weekly execution checklist for ${row.workArea}`],
    decisionTitle: `Confirm next execution priority for ${row.workArea}`,
    decisionImpact: "Without a clear priority, project execution can drift.",
    recommendation: "Approve one weekly goal and one measurable output target.",
    tasks: [
      { title: "Review current status and scope", status: "Done", priority: "Medium" },
      { title: row.nextAction || "Define next action", status: "In Progress", priority: "High" },
      { title: "Resolve open blockers", status: "Blocked", priority: "Medium" },
      { title: "Document next milestone", status: "Todo", priority: "Medium" }
    ]
  };
}

function extractLocationHints(location) {
  const hints = [];
  const quoted = [...String(location || "").matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  quoted.forEach((part) => {
    String(part)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => hints.push(value.replace(/^\.\//, "").replace(/\/+$/, "")));
  });

  if (!hints.length && location) {
    hints.push(String(location).replace(/^\.\//, "").replace(/\/+$/, ""));
  }

  return Array.from(new Set(hints));
}

function fileMatchesLocation(filePath, locationHints) {
  const normalized = String(filePath || "").replace(/\\/g, "/");
  return locationHints.some((hint) => {
    const cleanHint = hint.replace(/\\/g, "/");
    return normalized.startsWith(cleanHint) || normalized.includes(`/${cleanHint}/`);
  });
}

function getSourcePriority(source) {
  if (source === "git") return 3;
  if (source === "activity") return 2;
  return 1;
}

function buildLastTouchedMeta(row, tasks, relatedActivity, gitSummary) {
  const locationHints = extractLocationHints(row.location);
  const gitHit = gitSummary.changedFiles.find((change) =>
    fileMatchesLocation(change.file, locationHints)
  );

  if (gitHit) {
    return {
      lastTouchedAt: TODAY_ISO,
      lastTouchedSource: "git",
      lastTouchedNote: `${gitHit.code} ${gitHit.file}`,
      lastTouchedPriority: getSourcePriority("git")
    };
  }

  if (relatedActivity.length) {
    const latest = relatedActivity
      .slice()
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
    return {
      lastTouchedAt: latest.date,
      lastTouchedSource: "activity",
      lastTouchedNote: latest.title,
      lastTouchedPriority: getSourcePriority("activity")
    };
  }

  const latestTaskDate = tasks
    .map((task) => task.updatedAt)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return {
    lastTouchedAt: latestTaskDate || TODAY_ISO,
    lastTouchedSource: "task",
    lastTouchedNote: row.nextAction || "Task backlog update",
    lastTouchedPriority: getSourcePriority("task")
  };
}

function pickProjectSkills(row, skillCatalog) {
  if (String(row.state || "").toLowerCase() === "archived") {
    return [];
  }

  const hinted = PROJECT_SKILL_HINTS[row.workArea] || [];
  const hintedMatches = hinted
    .map((hint) => skillCatalog.find((skill) => skill.slug.toLowerCase() === hint.toLowerCase()))
    .filter(Boolean);

  if (hintedMatches.length) {
    return hintedMatches.map((skill) => ({
      name: skill.name,
      purpose: skill.purpose
    }));
  }

  const areaTokens = `${row.workArea} ${row.nextAction} ${row.location}`.toLowerCase();
  const scored = skillCatalog
    .map((skill) => {
      let score = 0;
      const slug = skill.slug.toLowerCase();
      const name = skill.name.toLowerCase();
      if (areaTokens.includes(slug)) score += 3;
      if (areaTokens.includes(name)) score += 2;
      if (areaTokens.includes("content") && slug.includes("content")) score += 1;
      if (areaTokens.includes("saas") && slug.includes("saas")) score += 1;
      if (areaTokens.includes("ads") && slug.includes("ads")) score += 1;
      if (areaTokens.includes("dashboard") && slug.includes("dashboard")) score += 1;
      return { skill, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => ({
      name: entry.skill.name,
      purpose: entry.skill.purpose
    }));

  return scored;
}

function buildProjects(registryRows, activityFeed, gitSummary, skillCatalog) {
  const projects = registryRows.map((row, rowIndex) => {
    const slug = slugify(row.workArea);
    const template = PROJECT_TEMPLATES[row.workArea] || buildDefaultTemplate(row);
    const description =
      PROJECT_DESCRIPTIONS[row.workArea] ||
      template.description ||
      `${row.workArea} project tracked in the operating system for weekly execution.`;
    const tasks = template.tasks.map((task, taskIndex) =>
      decorateTask(task, slug, row.owner || "Team", rowIndex, taskIndex)
    );
    const done = tasks.filter((task) => task.status === "Done").length;
    const inProgress = tasks.filter((task) => task.status === "In Progress").length;
    const blocked = tasks.filter((task) => task.status === "Blocked").length;
    const todo = tasks.filter((task) => task.status === "Todo").length;
    const progressPct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const relatedActivity = activityFeed
      .filter((entry) => {
        const needle = row.workArea.toLowerCase();
        return (
          entry.title.toLowerCase().includes(needle) ||
          entry.detail.toLowerCase().includes(needle)
        );
      })
      .slice(0, 4);
    const lastTouched = buildLastTouchedMeta(row, tasks, relatedActivity, gitSummary);
    const skillsUsed = pickProjectSkills(row, skillCatalog);

    return {
      slug,
      name: row.workArea,
      description,
      state: row.state,
      owner: row.owner,
      location: row.location,
      nextAction: row.nextAction,
      nextReview: row.nextReview,
      progressPct,
      lastTouchedAt: lastTouched.lastTouchedAt,
      lastTouchedSource: lastTouched.lastTouchedSource,
      lastTouchedNote: lastTouched.lastTouchedNote,
      lastTouchedPriority: lastTouched.lastTouchedPriority,
      lastUpdated: tasks[0]?.updatedAt || TODAY_ISO,
      counts: {
        total: tasks.length,
        done,
        inProgress,
        blocked,
        todo
      },
      buildNeeds: Array.from(new Set([row.nextAction, ...template.buildNeeds].filter(Boolean))),
      backlog: template.backlog,
      decision: {
        title: template.decisionTitle,
        impact: template.decisionImpact,
        recommendedNextStep: template.recommendation
      },
      skillsUsed,
      tasks,
      relatedActivity
    };
  });

  projects.sort((a, b) => {
    const dateDiff = Date.parse(b.lastTouchedAt) - Date.parse(a.lastTouchedAt);
    if (dateDiff !== 0) return dateDiff;
    const priorityDiff = (b.lastTouchedPriority || 0) - (a.lastTouchedPriority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return a.name.localeCompare(b.name);
  });

  return projects;
}

function buildAnalytics(projects, activityFeed, stateSummary) {
  const allTasks = projects.flatMap((project) => project.tasks);
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((task) => task.status === "Done").length;
  const inProgressTasks = allTasks.filter((task) => task.status === "In Progress").length;
  const blockedTasks = allTasks.filter((task) => task.status === "Blocked").length;
  const todoTasks = allTasks.filter((task) => task.status === "Todo").length;
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const weeklyActivityItems = activityFeed.filter((item) => item.date >= shiftDate(TODAY, -7)).length;
  const projectsNeedingDecision = projects.filter(
    (project) => project.counts.blocked > 0 || project.counts.todo > 1
  ).length;

  const dailyWorkHours = Array.from({ length: 7 }).map((_, index) => {
    const date = shiftDate(TODAY, -(6 - index));
    const activityCount = activityFeed.filter((item) => item.date === date).length;
    const estimatedHours = activityCount
      ? Math.min(10, Math.max(1, Math.round((0.75 + activityCount * 0.85) * 2) / 2))
      : 0;

    return {
      date,
      label: date.slice(5),
      hours: estimatedHours,
      activityCount
    };
  });
  const todayWorkHours = dailyWorkHours[dailyWorkHours.length - 1]?.hours || 0;
  const avgDailyWorkHours = Math.round(
    (dailyWorkHours.reduce((sum, day) => sum + day.hours, 0) / dailyWorkHours.length) * 10
  ) / 10;

  return {
    totalProjects: projects.length,
    activeProjects: stateSummary.active,
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    todoTasks,
    completionRate,
    openBacklogItems: todoTasks + blockedTasks,
    activityItems: activityFeed.length,
    weeklyActivityItems,
    projectsNeedingDecision,
    dailyWorkHours,
    todayWorkHours,
    avgDailyWorkHours
  };
}

function run() {
  const rootDir = findRootDir();
  const activeRegistryMd = readFileSafe(path.join(rootDir, "context", "active-work-registry.md"));
  const decisionsMd = readFileSafe(path.join(rootDir, "decisions", "log.md"));
  const weeklyMd = readFileSafe(path.join(rootDir, "context", "weekly-command-center.md"));

  const registryRows = parseActiveRegistry(activeRegistryMd);
  const decisions = parseDecisionEntries(decisionsMd);
  const priorities = parseTopPriorities(weeklyMd);
  const gitSummary = getGitStatusSummary(rootDir);
  const stateSummary = buildStateSummary(registryRows);
  const skillCatalog = collectSkillCatalog(rootDir);
  const activityFeed = buildActivityFeed(decisions, priorities, gitSummary);
  const projects = buildProjects(registryRows, activityFeed, gitSummary, skillCatalog);
  const analytics = buildAnalytics(projects, activityFeed, stateSummary);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    rootPath: rootDir,
    summary: {
      ...stateSummary,
      sopCount: countSopFiles(rootDir),
      skillFolderCount: countSkillFolders(rootDir),
      trackedChanges: gitSummary.trackedChanges,
      untrackedChanges: gitSummary.untracked
    },
    analytics,
    skillsCatalog: skillCatalog.map((skill) => ({
      name: skill.name,
      category: skill.category,
      purpose: skill.purpose,
      commands: skill.commands,
      source: skill.source
    })),
    projects,
    projectProgress: registryRows.map((row) => ({
      workArea: row.workArea,
      state: row.state,
      owner: row.owner,
      nextAction: row.nextAction,
      nextReview: row.nextReview,
      location: row.location
    })),
    activityFeed
  };

  const targetFile = path.join(process.cwd(), "app", "system", "activitySnapshot.json");
  fs.writeFileSync(targetFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`OS snapshot generated: ${targetFile}`);
}

run();
