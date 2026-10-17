import { prisma } from "./prisma";
import { decryptPhi, generatePseudonymousAlias } from "./crypto";
import { appUrl, isDemoMode } from "./config";
import { audit, WorkflowError } from "./vault-store";

async function hubspot(path: string, method = "GET", body?: unknown) {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) throw new Error("HUBSPOT_NOT_CONFIGURED");
  const response = await fetch(`https://api.hubapi.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HUBSPOT_HTTP_${response.status}`);
  return response.status === 204 ? {} : response.json();
}
export async function syncHubspot(
  patientId: string,
  stage: "TRIAGED" | "APPROVED" | "ONBOARDED",
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PatientVault" WHERE id = ${patientId}::uuid FOR UPDATE`;
      const record = await tx.patientVault.findUnique({
        where: { id: patientId },
      });
      if (!record) throw new WorkflowError("Patient not found", 404);
      if (
        stage === "APPROVED" &&
        !["APPROVED", "ONBOARDED"].includes(record.status)
      )
        throw new WorkflowError("Approval is required before CRM progression");
      if (stage === "ONBOARDED" && record.status !== "ONBOARDED")
        throw new WorkflowError("Booking is required before CRM completion");
      if (record.status === "ONBOARDED") stage = "ONBOARDED";
      else if (record.status === "APPROVED") stage = "APPROVED";
      const ranks = { TRIAGED: 1, APPROVED: 2, ONBOARDED: 3 };
      if (
        record.crmSyncStage &&
        ranks[record.crmSyncStage as keyof typeof ranks] >= ranks[stage]
      )
        return record;
      const alias = generatePseudonymousAlias(patientId);
      if (process.env.AEGIS_CRM_MODE === "simulated" && isDemoMode()) {
        return tx.patientVault.update({
          where: { id: patientId },
          data: {
            hubspotContactId: `sim_contact_${patientId}`,
            hubspotDealId: `sim_deal_${patientId}`,
            crmSyncStage: stage,
          },
        });
      }
      const pipeline = process.env.HUBSPOT_PIPELINE_ID;
      const dealStage =
        process.env[
          `HUBSPOT_STAGE_${record.status === "EMERGENCY_HALTED" ? "EMERGENCY" : stage}`
        ];
      if (!pipeline || !dealStage)
        throw new Error("HUBSPOT_PIPELINE_NOT_CONFIGURED");
      const contacts = await hubspot(
        "/crm/v3/objects/contacts/batch/upsert",
        "POST",
        {
          inputs: [
            {
              id: alias.email,
              idProperty: "email",
              properties: {
                email: alias.email,
                firstname: alias.firstName,
                lifecyclestage: stage === "ONBOARDED" ? "customer" : "lead",
              },
            },
          ],
        },
      );
      // A unique custom property makes a retried create safe after ambiguous network timeouts.
      const deals = await hubspot(
        "/crm/v3/objects/deals/batch/upsert",
        "POST",
        {
          inputs: [
            {
              id: patientId,
              idProperty: "aegis_patient_uuid",
              properties: {
                aegis_patient_uuid: patientId,
                dealname: `AegisFlow ${alias.firstName}`,
                pipeline,
                dealstage: dealStage,
                vault_review_url: `${appUrl()}/admin/vault/${patientId}`,
              },
            },
          ],
        },
      );
      const contactId = String(contacts.results?.[0]?.id ?? "");
      const dealId = String(deals.results?.[0]?.id ?? "");
      if (!contactId || !dealId) throw new Error("HUBSPOT_INVALID_RESPONSE");
      await hubspot(
        `/crm/v4/objects/deals/${dealId}/associations/default/contacts/${contactId}`,
        "PUT",
      );
      return tx.patientVault.update({
        where: { id: patientId },
        data: {
          hubspotContactId: contactId,
          hubspotDealId: dealId,
          crmSyncStage: stage,
        },
      });
    },
    { maxWait: 15000, timeout: 60000 },
  );
}

export async function gmailToken() {
  if (
    process.env.GMAIL_REFRESH_TOKEN &&
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET
  ) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`GMAIL_OAUTH_HTTP_${response.status}`);
    return (await response.json()).access_token as string;
  }
  if (process.env.GMAIL_ACCESS_TOKEN) return process.env.GMAIL_ACCESS_TOKEN;
  throw new Error("GMAIL_NOT_CONFIGURED");
}
export async function dispatchBlindNotification(patientId: string) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PatientVault" WHERE id = ${patientId}::uuid FOR UPDATE`;
      const record = await tx.patientVault.findUnique({
        where: { id: patientId },
      });
      if (!record) throw new WorkflowError("Patient not found", 404);
      if (record.status === "ONBOARDED")
        return { dispatched: false, mode: "TOKEN_ALREADY_BURNED" };
      if (record.notificationMode === "GMAIL_SENT")
        return { dispatched: true, mode: "GMAIL_SENT", duplicate: true };
      if (
        record.status !== "APPROVED" ||
        !record.encryptedOnboardingToken ||
        !record.tokenExpiresAt ||
        record.tokenExpiresAt <= new Date()
      )
        throw new WorkflowError("No active onboarding invitation");
      // Public portfolio demos must never send to arbitrary entered addresses.
      const preview = isDemoMode() && !process.env.GMAIL_TEST_RECIPIENT;
      if (preview) {
        await tx.patientVault.update({
          where: { id: patientId },
          data: { notificationMode: "PREVIEW_ONLY" },
        });
        return { dispatched: false, mode: "PREVIEW_ONLY" };
      }
      const pii = JSON.parse(decryptPhi(record.encryptedPiiJson)) as {
        email: string;
      };
      const recipient = isDemoMode()
        ? process.env.GMAIL_TEST_RECIPIENT!
        : pii.email;
      if (
        /[\r\n]/.test(recipient) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)
      )
        throw new WorkflowError("Invalid notification address", 422);
      const token = await gmailToken();
      // Gmail rewrote the custom Message-ID in the live self-test. Search a stable
      // subject reference instead; the token hash cannot reveal the capability.
      const reference = `AEGIS-${record.onboardingTokenHash!.slice(0, 32)}`;
      const headers = { authorization: `Bearer ${token}` };
      const search = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`in:sent subject:"${reference}"`)}`,
        { headers, signal: AbortSignal.timeout(15000) },
      );
      if (!search.ok) throw new Error(`GMAIL_SEARCH_HTTP_${search.status}`);
      const alreadySent = Boolean((await search.json()).messages?.length);
      if (!alreadySent) {
        const profile = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/profile",
          { headers, signal: AbortSignal.timeout(15000) },
        );
        if (!profile.ok)
          throw new Error(`GMAIL_PROFILE_HTTP_${profile.status}`);
        const sender = (await profile.json()).emailAddress as string;
        const url = `${appUrl()}/onboarding/${decryptPhi(record.encryptedOnboardingToken)}`;
        const raw = [
          `From: ${sender}`,
          `To: ${recipient}`,
          `Subject: Your secure onboarding invitation [${reference}]`,
          "MIME-Version: 1.0",
          "Content-Type: text/plain; charset=UTF-8",
          "",
          `Complete your onboarding using this single-use link (expires in 48 hours):\n\n${url}\n\nThis portfolio demonstration uses synthetic data.`,
        ].join("\r\n");
        const sent = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({
              raw: Buffer.from(raw).toString("base64url"),
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!sent.ok) throw new Error(`GMAIL_SEND_HTTP_${sent.status}`);
      }
      await tx.patientVault.update({
        where: { id: patientId },
        data: {
          notificationMode: "GMAIL_SENT",
          encryptedOnboardingToken: null,
        },
      });
      await audit(
        tx,
        patientId,
        "BLIND_NOTIFY_SENT",
        "NEXTJS_GMAIL_DISPATCH",
        "N8N_SYSTEM",
        { channel: "GMAIL", duplicate: alreadySent },
      );
      return { dispatched: true, mode: "GMAIL_SENT" };
    },
    { maxWait: 15000, timeout: 90000 },
  );
}
