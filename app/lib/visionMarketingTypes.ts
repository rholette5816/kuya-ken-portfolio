export type MarketingSegment =
  | "excluded"
  | "active_order"
  | "open_issue"
  | "bulk_handoff"
  | "recovery_cooldown"
  | "vip"
  | "repeat"
  | "recent_delivered"
  | "dormant"
  | "failed_winback"
  | "inquiry"
  | "waiting";

export type CustomerMarketingFacts = {
  customerId: string;
  name: string;
  phone: string;
  /** Explicit false excludes the customer. Missing or null is treated as unknown. */
  smsMarketingConsent?: boolean | null;
  doNotContact: boolean;
  smsSuppressed: boolean;
  totalOrders: number;
  deliveredCount: number;
  failedCount: number;
  returnedCount: number;
  cancelledCount: number;
  lifetimeValue: number;
  lastStatus: string | null;
  /** ISO date string or null. */
  lastOrderDate: string | null;
  /** ISO date string or null. */
  lastInteractionDate: string | null;
  hasActiveConversation: boolean;
  hasOpenIssue: boolean;
  hasOpenBulkHandoff: boolean;
  /** ISO date string or null. */
  cooldownUntil: string | null;
  currentSequence: string | null;
};

export type MarketingDecision = {
  customerId: string;
  segment: MarketingSegment;
  eligible: boolean;
  /** 0 to 100. */
  priorityScore: number;
  reason: string;
  /** ISO date string or null. */
  nextEligibleDate: string | null;
  recommendedSequenceId: string | null;
};
