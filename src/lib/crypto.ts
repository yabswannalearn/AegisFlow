import crypto from "crypto";
import { requiredSecret } from "./config";

const ALGORITHM = "aes-256-gcm";
const IV_BYTE_LENGTH = 12;
const AUTH_TAG_BYTE_LENGTH = 16;
const VERSION_PREFIX = "v1";
const DEFAULT_DEV_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function getMasterKey(overrideKeyHex?: string): Buffer {
  const keyHex =
    overrideKeyHex ?? requiredSecret("PHI_ENCRYPTION_KEY", DEFAULT_DEV_KEY);
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "Invalid PHI_ENCRYPTION_KEY: expected 64-character hex string (32 bytes)."
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts plaintext PHI using AES-256-GCM.
 * Canonical storage format: `v1:{iv_hex}:{authTag_hex}:{ciphertext_hex}`
 */
export function encryptPhi(plaintext: string, overrideKeyHex?: string): string {
  const key = getMasterKey(overrideKeyHex);
  const iv = crypto.randomBytes(IV_BYTE_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTE_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${VERSION_PREFIX}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts canonical AES-256-GCM ciphertext (`v1:{iv_hex}:{authTag_hex}:{ciphertext_hex}`).
 * Throws if format is invalid or if ciphertext/authTag has been tampered with.
 */
export function decryptPhi(payload: string, overrideKeyHex?: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error("Invalid encrypted PHI format: expected v1:iv:authTag:ciphertext");
  }

  const [, ivHex, authTagHex, ciphertextHex] = parts;
  if (!ivHex || !authTagHex || ciphertextHex === undefined) {
    throw new Error("Malformed encrypted PHI segments");
  }

  const key = getMasterKey(overrideKeyHex);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  if (iv.length !== IV_BYTE_LENGTH || authTag.length !== AUTH_TAG_BYTE_LENGTH) {
    throw new Error("Invalid IV or AuthTag byte length in encrypted PHI");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTE_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Deterministic SHA-256 hex digest for emailHash, idempotency_key, and onboardingTokenHash (ADR-007).
 */
export function sha256Hash(input: string): string {
  return crypto
    .createHash("sha256")
    .update(input.trim().toLowerCase(), "utf8")
    .digest("hex");
}

/**
 * Generates a cryptographically random 32-byte capability token and its SHA-256 hash (ADR-007).
 */
export function generateCapabilityToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hash(rawToken);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
  return { rawToken, tokenHash, expiresAt };
}

/**
 * Generates a deterministic Pseudonymous CRM Alias for HubSpot so zero plaintext PII leaves the Vault (ADR-001).
 */
export function generatePseudonymousAlias(patientUuid: string): {
  shortId: string;
  firstName: string;
  lastName: string;
  email: string;
} {
  const cleanHex = patientUuid.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
  const shortId = cleanHex.slice(0, 6) || "000000";
  return {
    shortId,
    firstName: `Patient_${shortId}`,
    lastName: "VaultProtected",
    email: `${patientUuid.toLowerCase()}@vault.example.com`,
  };
}
