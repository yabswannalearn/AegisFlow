import crypto from "crypto";
import { requiredSecret } from "./config";

const DEFAULT_WEBHOOK_SECRET = "aegis-dev-hmac-webhook-secret-key-2026";
const MAX_TIMESTAMP_DRIFT_SECONDS = 300; // ±5 minutes replay window

function getWebhookSecret(overrideSecret?: string): string {
  return (
    overrideSecret ?? requiredSecret("AEGIS_WEBHOOK_SECRET", DEFAULT_WEBHOOK_SECRET)
  );
}

export interface SignedWebhookHeaders {
  "x-aegis-signature": string;
  "x-aegis-timestamp": string;
}

/**
 * Computes HMAC-SHA256(secret, `${timestampSeconds}.${rawBody}`) and returns headers.
 */
export function signWebhookPayload(
  rawBody: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
  overrideSecret?: string
): SignedWebhookHeaders {
  const secret = getWebhookSecret(overrideSecret);
  const canonicalPayload = `${timestampSeconds}.${rawBody}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(canonicalPayload, "utf8")
    .digest("hex");

  return {
    "x-aegis-signature": signature,
    "x-aegis-timestamp": String(timestampSeconds),
  };
}

/**
 * Verifies HMAC-SHA256 webhook signature using timingSafeEqual and enforces a ±300s replay window.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  timestampHeader: string | null | undefined,
  options?: {
    overrideSecret?: string;
    nowSeconds?: number;
    maxDriftSeconds?: number;
  }
): { valid: boolean; reason?: string } {
  if (!signatureHeader || !timestampHeader) {
    return { valid: false, reason: "Missing signature or timestamp header" };
  }

  const timestampSeconds = Number(timestampHeader);
  if (!/^\d+$/.test(timestampHeader) || !Number.isSafeInteger(timestampSeconds) || !/^[a-f0-9]{64}$/i.test(signatureHeader)) {
    return { valid: false, reason: "Invalid timestamp header format" };
  }

  const nowSeconds = options?.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxDrift = options?.maxDriftSeconds ?? MAX_TIMESTAMP_DRIFT_SECONDS;
  if (Math.abs(nowSeconds - timestampSeconds) > maxDrift) {
    return {
      valid: false,
      reason: "Timestamp drift exceeds replay protection window",
    };
  }

  const expectedHeaders = signWebhookPayload(
    rawBody,
    timestampSeconds,
    options?.overrideSecret
  );
  const expectedSig = expectedHeaders["x-aegis-signature"];

  const sigBuffer = Buffer.from(signatureHeader, "hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");

  if (
    sigBuffer.length !== expectedBuffer.length ||
    sigBuffer.length === 0 ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return { valid: false, reason: "HMAC signature mismatch" };
  }

  return { valid: true };
}
