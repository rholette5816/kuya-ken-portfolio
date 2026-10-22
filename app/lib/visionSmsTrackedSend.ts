import { sendInfotxtSms } from "./visionInfotxt";
import { recordInfotxtOutbound } from "./visionInfotxtRecords";
import {
  maskSmsPhone,
  recordSmsAutomationLog,
  SmsRecipient,
  updateSmsAutomationLog
} from "./visionSmsAutomation";

type TrackedSmsInput = {
  orderId: string;
  tracking?: string;
  event: string;
  eventLabel: string;
  recipient: SmsRecipient;
  phone: string;
  message: string;
  source: "order_confirmation" | "customer_reply" | "ai_reply" | "rider_coordination" | "abandon_recovery" | "marketing_campaign";
  eventAt: string;
  templateVersion?: number;
};

export async function sendTrackedInfotxtSms(input: TrackedSmsInput) {
  const reserved = await recordSmsAutomationLog({
    orderId: input.orderId || "unmatched",
    tracking: input.tracking || "",
    event: input.event,
    eventLabel: input.eventLabel,
    recipient: input.recipient,
    destinationMasked: maskSmsPhone(input.phone),
    status: "submitting",
    message: "Message generated; content not retained in the audit log.",
    reason: "Submitting to InfoTXT.",
    source: input.source,
    templateVersion: input.templateVersion || 1,
    eventAt: input.eventAt
  });

  if (!reserved.created) {
    return { accepted: ["accepted", "queued", "dispatched", "sent"].includes(reserved.record.status), duplicate: true, smsId: reserved.record.providerSmsId || "" };
  }

  try {
    const outcome = await sendInfotxtSms(input.phone, input.message);
    if (!outcome.accepted) {
      await updateSmsAutomationLog(reserved.record.id, {
        status: "failed",
        providerCode: outcome.providerStatus,
        providerStatus: "failed",
        reason: outcome.error
      });
      return { ...outcome, duplicate: false };
    }

    if (outcome.smsId) {
      await recordInfotxtOutbound({
        providerSmsId: outcome.smsId,
        source: input.source,
        auditId: reserved.record.id,
        orderId: input.orderId,
        tracking: input.tracking || "",
        eventLabel: input.eventLabel,
        recipient: input.recipient,
        destinationMasked: maskSmsPhone(input.phone),
        message: input.message,
        submittedAt: new Date().toISOString()
      });
    }
    await updateSmsAutomationLog(reserved.record.id, {
      status: "accepted",
      providerSmsId: outcome.smsId,
      providerCode: outcome.providerStatus,
      providerStatus: "queued",
      acceptedAt: new Date().toISOString(),
      reason: `InfoTXT accepted the SMS${outcome.smsId ? ` (ID ${outcome.smsId})` : ""}; handset delivery is not confirmed.`
    });
    return { ...outcome, duplicate: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "InfoTXT submission failed.";
    await updateSmsAutomationLog(reserved.record.id, { status: "failed", reason });
    throw error;
  }
}
