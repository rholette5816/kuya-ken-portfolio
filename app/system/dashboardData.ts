export type HealthMetric = {
  label: string;
  value: string;
  note: string;
  accent: "blue" | "mint" | "lime" | "amber" | "rose";
};

export type CadenceItem = {
  cadence: string;
  owner: string;
  source: string;
  status: "Live" | "In Progress";
};

export type ModuleStatus = {
  module: string;
  file: string;
  status: "Complete" | "Active";
  note: string;
};

export const healthMetrics: HealthMetric[] = [
  {
    label: "OS Build",
    value: "100%",
    note: "Build phase complete. Execution phase active.",
    accent: "blue"
  },
  {
    label: "Weekly Cadence",
    value: "Live",
    note: "Command center, dashboard, and closeout loop are installed.",
    accent: "mint"
  },
  {
    label: "Revenue Pipeline",
    value: "Live",
    note: "Automation offer cadence is tracked daily by stage.",
    accent: "lime"
  },
  {
    label: "Data Readiness",
    value: "Partial",
    note: "Meta Ads insights still blocked by token permission.",
    accent: "amber"
  }
];

export const cadenceBoard: CadenceItem[] = [
  {
    cadence: "Daily",
    owner: "Ken + Assistant",
    source: "context/automation-revenue-pipeline.md",
    status: "Live"
  },
  {
    cadence: "Weekly",
    owner: "Ken + Assistant",
    source: "context/weekly-command-center.md",
    status: "Live"
  },
  {
    cadence: "Weekly Dashboard",
    owner: "Ken + Assistant",
    source: "context/weekly-ceo-dashboard.md",
    status: "Live"
  },
  {
    cadence: "Month End",
    owner: "Ken",
    source: "references/sops/monthly-business-review.md",
    status: "Live"
  },
  {
    cadence: "Quarter Start",
    owner: "Ken",
    source: "references/sops/quarterly-goals-refresh.md",
    status: "Live"
  }
];

export const moduleStatuses: ModuleStatus[] = [
  {
    module: "Command Center",
    file: "START_HERE.md",
    status: "Complete",
    note: "Routing and execution map installed."
  },
  {
    module: "SOP Library",
    file: "references/sops/README.md",
    status: "Complete",
    note: "Standardized format and governance flows complete."
  },
  {
    module: "Project State Governance",
    file: "context/active-work-registry.md",
    status: "Complete",
    note: "Active, parked, and sandbox work are classified."
  },
  {
    module: "CEO Dashboard",
    file: "context/weekly-ceo-dashboard.md",
    status: "Active",
    note: "Live weekly dashboard with execution blockers and decisions."
  },
  {
    module: "Automation Revenue Pipeline",
    file: "context/automation-revenue-pipeline.md",
    status: "Active",
    note: "Daily outreach and conversion tracking is ready."
  },
  {
    module: "OS Completion Registry",
    file: "context/os-completion-status.md",
    status: "Complete",
    note: "Build phase marked complete."
  }
];

export const thisWeekPriorities: string[] = [
  "Run the operating layer consistently using weekly command center and weekly review.",
  "Push automation-offer outreach cadence and move at least one lead to proposal stage.",
  "Maintain content cadence around active offers and ship one measurable active project milestone."
];

export const executionBlockers: string[] = [
  "Meta Ads insights token lacks required `ads_read` or `ads_management` permission.",
  "Lead and content actual metrics still depend on strict daily updates.",
  "Hilas Program is archived and should not be counted as an active weekly deliverable."
];

export const decisionsNeeded: string[] = [
  "Which revenue stream gets top operational focus this week?",
  "Which content channel gets primary distribution this cycle?",
  "Should automation outreach push audit-first or blueprint-first positioning?"
];
