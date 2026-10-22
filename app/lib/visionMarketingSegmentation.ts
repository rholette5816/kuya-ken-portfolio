import type {
  CustomerMarketingFacts,
  MarketingDecision,
  MarketingSegment,
} from "./visionMarketingTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

const ACTIVE_ORDER_STATUSES = new Set([
  "new",
  "confirmed",
  "packed",
  "shipped",
  "in_transit",
  "out_for_delivery",
]);

const VIP_LIFETIME_VALUE = 10000;
const VIP_DELIVERED_ORDERS = 5;
const REORDER_MIN_DAYS = 21;

const SCORES: Record<string, number> = {
  vip: 100,
  repeat: 85,
  recent_delivered: 70,
  dormant: 55,
  failed_winback: 40,
  inquiry: 25,
};

export function normalizePhilippineMarketingMobile(value: string): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("0063")) digits = digits.slice(2);
  if (digits.startsWith("63") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (!/^9\d{9}$/.test(digits)) return "";
  return `63${digits}`;
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function daysSince(value: string | null | undefined, now: Date): number | null {
  const time = parseDate(value);
  if (time === null) return null;
  return (now.getTime() - time) / DAY_MS;
}

function addDays(value: string | null, days: number): string | null {
  const time = parseDate(value);
  if (time === null) return null;
  return new Date(time + days * DAY_MS).toISOString();
}

function decide(
  facts: CustomerMarketingFacts,
  segment: MarketingSegment,
  eligible: boolean,
  reason: string,
  options: { nextEligibleDate?: string | null; sequenceId?: string | null } = {}
): MarketingDecision {
  const raw = eligible ? SCORES[segment] ?? 0 : 0;
  return {
    customerId: facts.customerId,
    segment,
    eligible,
    priorityScore: Math.max(0, Math.min(100, raw)),
    reason,
    nextEligibleDate: options.nextEligibleDate ?? null,
    recommendedSequenceId: eligible ? options.sequenceId ?? null : null,
  };
}

export function classifyMarketingCustomer(
  facts: CustomerMarketingFacts,
  now: Date = new Date()
): MarketingDecision {
  // 1. Exclusions
  if (!normalizePhilippineMarketingMobile(facts.phone)) {
    return decide(facts, "excluded", false, "Invalid Philippine mobile number");
  }
  if (facts.doNotContact) {
    return decide(facts, "excluded", false, "Customer is flagged do not contact");
  }
  if (facts.smsSuppressed) {
    return decide(facts, "excluded", false, "SMS is suppressed for this customer");
  }
  if (facts.smsMarketingConsent === false) {
    return decide(facts, "excluded", false, "SMS marketing consent is explicitly false");
  }

  // 2. Active order
  const status = (facts.lastStatus ?? "").trim().toLowerCase();
  if (ACTIVE_ORDER_STATUSES.has(status)) {
    return decide(facts, "active_order", false, `Order is still active (${status})`);
  }

  // 3. Open issue
  if (facts.hasOpenIssue) {
    return decide(facts, "open_issue", false, "Customer has an open issue");
  }

  // 4. Open bulk handoff
  if (facts.hasOpenBulkHandoff) {
    return decide(facts, "bulk_handoff", false, "Bulk handoff is still open");
  }

  // 5. Cooldown
  const cooldownTime = parseDate(facts.cooldownUntil);
  if (cooldownTime !== null && cooldownTime > now.getTime()) {
    return decide(facts, "recovery_cooldown", false, "Customer is in recovery cooldown", {
      nextEligibleDate: new Date(cooldownTime).toISOString(),
    });
  }

  // 6. Active conversation or sequence
  if (facts.hasActiveConversation || facts.currentSequence) {
    return decide(
      facts,
      "waiting",
      false,
      facts.hasActiveConversation
        ? "Active conversation in progress"
        : `Already in sequence ${facts.currentSequence}`
    );
  }

  const sinceOrder = daysSince(facts.lastOrderDate, now);
  const sinceInteraction = daysSince(facts.lastInteractionDate, now);
  const delivered = facts.deliveredCount;

  // 7. VIP
  if (facts.lifetimeValue >= VIP_LIFETIME_VALUE || delivered >= VIP_DELIVERED_ORDERS) {
    if (sinceOrder !== null && sinceOrder < REORDER_MIN_DAYS) {
      return decide(facts, "vip", false, "VIP customer ordered less than 21 days ago", {
        nextEligibleDate: addDays(facts.lastOrderDate, REORDER_MIN_DAYS),
      });
    }
    return decide(facts, "vip", true, "VIP customer past the 21 day reorder window", {
      sequenceId: "vip_repeat",
    });
  }

  // 8. Repeat
  if (delivered >= 2) {
    if (sinceOrder !== null && sinceOrder < REORDER_MIN_DAYS) {
      return decide(facts, "repeat", false, "Repeat customer ordered less than 21 days ago", {
        nextEligibleDate: addDays(facts.lastOrderDate, REORDER_MIN_DAYS),
      });
    }
    return decide(facts, "repeat", true, "Repeat customer past the 21 day reorder window", {
      sequenceId: "repeat_reorder",
    });
  }

  // 9. Recent delivered -> enter the plant lifecycle soon after delivery (near planting).
  if (delivered >= 1 && sinceOrder !== null && sinceOrder >= 3 && sinceOrder <= 45) {
    return decide(facts, "recent_delivered", true, "Delivered order 3 to 45 days ago", {
      sequenceId: "plant_lifecycle",
    });
  }

  // 10. Dormant
  if (delivered >= 1 && sinceOrder !== null && sinceOrder >= 60 && sinceOrder <= 365) {
    return decide(facts, "dormant", true, "Delivered order 60 to 365 days ago", {
      sequenceId: "dormant_winback",
    });
  }

  // 11. Failed winback
  if (
    facts.failedCount + facts.returnedCount + facts.cancelledCount > 0 &&
    sinceOrder !== null &&
    sinceOrder >= 30
  ) {
    return decide(facts, "failed_winback", true, "Failed, returned, or cancelled order 30 or more days ago", {
      sequenceId: "failed_winback",
    });
  }

  // 12. Inquiry
  if (
    facts.totalOrders === 0 &&
    sinceInteraction !== null &&
    sinceInteraction >= 0 &&
    sinceInteraction <= 90
  ) {
    return decide(facts, "inquiry", true, "Inquiry with interaction in the last 90 days", {
      sequenceId: "inquiry_followup",
    });
  }

  // 13. Fallback
  return decide(facts, "waiting", false, "No segment rule matched yet");
}

export function sortMarketingDecisions(decisions: MarketingDecision[]): MarketingDecision[] {
  return [...decisions].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
    return a.customerId < b.customerId ? -1 : a.customerId > b.customerId ? 1 : 0;
  });
}
