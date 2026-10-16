-- CreateEnum
CREATE TYPE "VaultStatus" AS ENUM (
  'SCRUBBED_DISPATCHED',
  'WEBHOOK_RETRY_PENDING',
  'AI_TRIAGED',
  'CRM_SYNCED',
  'TRIAGE_FAILED_MANUAL_REVIEW',
  'EMERGENCY_HALTED',
  'APPROVED',
  'ONBOARDED'
);

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('HIPAA_INTAKE', 'TCPA_SMS', 'TELEHEALTH_NPP');

-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('PATIENT', 'N8N_SYSTEM', 'CLINICIAN');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
  'INTAKE_SUBMITTED',
  'PII_SCRUBBED',
  'AI_TRIAGED',
  'TRIAGE_FAILED',
  'PHI_DECRYPTED_VIEW',
  'ONBOARDING_APPROVED',
  'BLIND_NOTIFY_SENT',
  'KYC_VERIFIED',
  'ONBOARDING_COMPLETED'
);

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable: PatientVault
CREATE TABLE "PatientVault" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "emailHash" VARCHAR(64) NOT NULL,
  "encryptedPiiJson" TEXT NOT NULL,
  "encryptedSymptoms" TEXT NOT NULL,
  "encryptedKycJson" TEXT,
  "scrubbedSymptoms" TEXT NOT NULL,
  "redactedSpansJson" JSONB,
  "aiTriageJson" JSONB,
  "onboardingTokenHash" VARCHAR(64),
  "tokenExpiresAt" TIMESTAMP(3),
  "tokenUsedAt" TIMESTAMP(3),
  "appointmentSlot" TIMESTAMP(3),
  "assignedDoctor" VARCHAR(120),
  "status" "VaultStatus" NOT NULL DEFAULT 'SCRUBBED_DISPATCHED',
  "hubspotContactId" VARCHAR(64),
  "hubspotDealId" VARCHAR(64),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PatientVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ConsentRecord
CREATE TABLE "ConsentRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "patientId" UUID NOT NULL,
  "consentType" "ConsentType" NOT NULL,
  "accepted" BOOLEAN NOT NULL DEFAULT true,
  "signatureText" VARCHAR(255),
  "ipAddress" VARCHAR(64) NOT NULL,
  "userAgent" TEXT NOT NULL,
  "policyVersion" VARCHAR(32) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditLog (Strictly Append-Only)
CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actorId" VARCHAR(128) NOT NULL,
  "actorRole" "ActorRole" NOT NULL,
  "patientId" UUID NOT NULL,
  "action" "AuditAction" NOT NULL,
  "metadata" JSONB,
  "ipAddress" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WebhookIdempotency
CREATE TABLE "WebhookIdempotency" (
  "key" VARCHAR(128) NOT NULL,
  "workflowName" VARCHAR(64) NOT NULL,
  "patientId" UUID,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebhookIdempotency_pkey" PRIMARY KEY ("key")
);

-- CreateIndexes
CREATE UNIQUE INDEX "PatientVault_onboardingTokenHash_key" ON "PatientVault"("onboardingTokenHash");
CREATE INDEX "PatientVault_emailHash_idx" ON "PatientVault"("emailHash");
CREATE INDEX "PatientVault_status_idx" ON "PatientVault"("status");
CREATE INDEX "ConsentRecord_patientId_idx" ON "ConsentRecord"("patientId");
CREATE INDEX "AuditLog_patientId_createdAt_idx" ON "AuditLog"("patientId", "createdAt");

-- AddForeignKeys
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientVault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- HIPAA Compliance Guardrail: Enforce Append-Only Immutability on AuditLog
-- Prohibits UPDATE and DELETE operations at the PostgreSQL engine level.
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_audit_log_modification() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'HIPAA Compliance Violation: AuditLog table is strictly append-only. UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
