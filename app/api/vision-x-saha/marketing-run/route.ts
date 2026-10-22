import { NextRequest, NextResponse } from "next/server";
import { crmSelectAll } from "../../../lib/secureCodCrm";
import {
  crmRowToMarketingFacts,
  loadMarketingConfig,
  loadMarketingEnrollments,
  loadMarketingEvents,
  recordMarketingEvent,
  renderMarketingMessage,
  saveMarketingEnrollment,
  type MarketingEnrollment,
  type MarketingSequence
} from "../../../lib/visionMarketingEngine";
import { classifyMarketingCustomer, sortMarketingDecisions } from "../../../lib/visionMarketingSegmentation";
import { sendTrackedInfotxtSms } from "../../../lib/visionSmsTrackedSend";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive"
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function authorized(request: NextRequest) {
  const cookie = request.cookies.get("vision_x_saha_access")?.value || "";
  const dashboard = [process.env.VISION_X_SAHA_DASHBOARD_ACCESS_TOKEN, process.env.VISION_X_SAHA_RUSTAN_ACCESS_TOKEN].filter(Boolean).includes(cookie);
  const cronSecret = process.env.CRON_SECRET?.trim() || "";
  const bearer = request.headers.get("authorization") || "";
  return dashboard || Boolean(cronSecret && bearer === `Bearer ${cronSecret}`);
}

function manilaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function manilaDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = manilaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function withinWindow(start: string, end: string) {
  const parts = manilaParts();
  const current = `${parts.hour}:${parts.minute}`;
  return current >= start && current < end;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000).toISOString();
}

async function dispatchStep(enrollment: MarketingEnrollment, sequence: MarketingSequence, now: Date, dryRun: boolean) {
  const step = sequence.steps[enrollment.stepIndex];
  if (!step) return { action: "skipped", customerId: enrollment.customerId, reason: "Sequence has no remaining step." };
  const message = renderMarketingMessage(step.template, { name: enrollment.customerName });
  if (dryRun) {
    const preview = await saveMarketingEnrollment({ ...enrollment, status: "preview", nextActionAt: enrollment.nextActionAt || now.toISOString() });
    await recordMarketingEvent({
      customerId: preview.customerId,
      phoneMasked: preview.phone.replace(/.(?=.{4})/g, "*"),
      enrollmentId: preview.id,
      sequenceId: preview.sequenceId,
      stepId: step.id,
      type: "previewed",
      detail: "Dry-run preview generated. No SMS was sent.",
      amount: 0
    });
    return { action: "previewed", customerId: enrollment.customerId, step: step.id };
  }

  const result = await sendTrackedInfotxtSms({
    orderId: `marketing-${enrollment.customerId}`,
    event: `marketing_${sequence.id}_${step.id}`,
    eventLabel: `${sequence.name}: ${step.label}`,
    recipient: "customer",
    phone: enrollment.phone,
    message,
    source: "marketing_campaign",
    eventAt: `${enrollment.id}:${step.id}`,
    templateVersion: 1
  });
  if (!result.accepted) {
    await recordMarketingEvent({
      customerId: enrollment.customerId,
      phoneMasked: enrollment.phone.replace(/.(?=.{4})/g, "*"),
      enrollmentId: enrollment.id,
      sequenceId: enrollment.sequenceId,
      stepId: step.id,
      type: "failed",
      detail: "InfoTXT did not accept the marketing SMS.",
      amount: 0
    });
    await saveMarketingEnrollment({ ...enrollment, status: "paused", nextActionAt: addDays(now, 1), closedReason: "InfoTXT send failed" });
    return { action: "failed", customerId: enrollment.customerId, step: step.id };
  }

  const nextIndex = enrollment.stepIndex + 1;
  const nextStep = sequence.steps[nextIndex];
  const finished = !nextStep;
  const saved = await saveMarketingEnrollment({
    ...enrollment,
    stepIndex: nextIndex,
    status: finished ? "completed" : "waiting",
    nextActionAt: nextStep ? addDays(now, nextStep.delayDays) : null,
    lastSentAt: now.toISOString(),
    cooldownUntil: finished ? addDays(now, sequence.cooldownDays) : null,
    closedReason: finished ? "Sequence completed without a reply" : ""
  });
  await recordMarketingEvent({
    customerId: saved.customerId,
    phoneMasked: saved.phone.replace(/.(?=.{4})/g, "*"),
    enrollmentId: saved.id,
    sequenceId: saved.sequenceId,
    stepId: step.id,
    type: "sent",
    detail: "Marketing SMS accepted by InfoTXT.",
    amount: 0
  });
  return { action: "sent", customerId: enrollment.customerId, step: step.id };
}

async function execute() {
  const config = await loadMarketingConfig();
  if (config.activationLocked || config.mode === "off" || !config.enrollmentEnabled) {
    return {
      executed: false,
      sent: 0,
      preview: { evaluated: 0, eligible: 0, topCustomerIds: [] },
      reason: "Marketing activation is locked. No customer was enrolled or messaged."
    };
  }
  const customers = await crmSelectAll("crm_customer_overview");
  const facts = customers.map(crmRowToMarketingFacts);
  const decisions = sortMarketingDecisions(facts.map(customer => classifyMarketingCustomer(customer)));
  const preview = {
    evaluated: decisions.length,
    eligible: decisions.filter(decision => decision.eligible).length,
    topCustomerIds: decisions.filter(decision => decision.eligible).slice(0, Math.min(20, config.dailyEnrollmentLimit)).map(decision => decision.customerId)
  };

  if (!withinWindow(config.quietStart, config.quietEnd)) {
    return { executed: false, sent: 0, preview, reason: `Outside the ${config.quietStart} to ${config.quietEnd} sending window.` };
  }

  const [enrollments, events] = await Promise.all([loadMarketingEnrollments(), loadMarketingEvents(1000)]);
  const today = manilaDay(new Date().toISOString());
  const sentToday = events.filter(event => event.type === "sent" && manilaDay(event.createdAt) === today).length;
  // Two batches a day (morning ~8am + evening ~6pm). Cap each run at half the daily
  // limit so the morning run does not consume the whole day's budget and the evening
  // run still has a batch to send. The daily total never exceeds dailyEnrollmentLimit.
  const perBatch = Math.max(1, Math.ceil(config.dailyEnrollmentLimit / 2));
  let remaining = Math.max(0, Math.min(perBatch, config.dailyEnrollmentLimit - sentToday));
  if (!remaining) return { executed: false, sent: 0, preview, reason: "This batch's marketing send limit has been reached." };

  const now = new Date();
  const sequenceMap = new Map(config.sequences.filter(sequence => sequence.enabled).map(sequence => [sequence.id, sequence]));
  const actions: Array<Record<string, unknown>> = [];
  const due = enrollments.filter(row => ["active", "waiting"].includes(row.status) && row.nextActionAt && Date.parse(row.nextActionAt) <= now.getTime());
  for (const enrollment of due) {
    if (!remaining) break;
    const sequence = sequenceMap.get(enrollment.sequenceId);
    if (!sequence) continue;
    actions.push(await dispatchStep(enrollment, sequence, now, config.mode === "dry_run" || !config.smsSendingEnabled));
    remaining -= 1;
  }

  const existingByCustomer = new Map(enrollments.map(row => [row.customerId, row]));
  const factsById = new Map(facts.map(row => [row.customerId, row]));
  for (const decision of decisions) {
    if (!remaining || !decision.eligible || !decision.recommendedSequenceId) break;
    const sequence = sequenceMap.get(decision.recommendedSequenceId);
    const customer = factsById.get(decision.customerId);
    if (!sequence || !customer) continue;
    const previous = existingByCustomer.get(decision.customerId);
    if (previous && ["active", "waiting", "replied", "ordered", "bulk_handoff", "preview"].includes(previous.status)) continue;
    if (previous?.cooldownUntil && Date.parse(previous.cooldownUntil) > now.getTime()) continue;
    const enrollment = await saveMarketingEnrollment({
      customerId: customer.customerId,
      customerName: customer.name,
      phone: customer.phone,
      segment: decision.segment,
      sequenceId: sequence.id,
      stepIndex: 0,
      status: config.mode === "dry_run" ? "preview" : "active",
      campaignId: `${sequence.id}-${today}`,
      nextActionAt: now.toISOString(),
      lastSentAt: null,
      lastReplyAt: null,
      cooldownUntil: null,
      closedReason: ""
    });
    await recordMarketingEvent({
      customerId: enrollment.customerId,
      phoneMasked: enrollment.phone.replace(/.(?=.{4})/g, "*"),
      enrollmentId: enrollment.id,
      sequenceId: enrollment.sequenceId,
      stepId: "enrollment",
      type: "enrolled",
      detail: config.mode === "dry_run" ? "Customer added to the dry-run preview." : "Customer enrolled in the marketing sequence.",
      amount: 0
    });
    actions.push(await dispatchStep(enrollment, sequence, now, config.mode === "dry_run" || !config.smsSendingEnabled));
    remaining -= 1;
  }

  return {
    executed: true,
    mode: config.mode,
    sent: actions.filter(action => action.action === "sent").length,
    previewed: actions.filter(action => action.action === "previewed").length,
    failed: actions.filter(action => action.action === "failed").length,
    actions,
    preview
  };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);
  try {
    return json(await execute());
  } catch (error) {
    console.error("VISION X SAHA marketing run failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: error instanceof Error ? error.message : "The marketing run failed." }, 502);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
