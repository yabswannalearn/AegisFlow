ALTER TABLE "PatientVault"
  ADD COLUMN "encryptedOnboardingToken" TEXT,
  ADD COLUMN "executionMode" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "crmSyncStage" TEXT,
  ADD COLUMN "notificationMode" TEXT,
  ADD COLUMN "inspectorAccessHash" VARCHAR(64);
ALTER TABLE "ConsentRecord" ALTER COLUMN "signatureText" TYPE TEXT;

CREATE TABLE "OutboxDelivery" (
  "id" UUID PRIMARY KEY,
  "patientId" UUID NOT NULL REFERENCES "PatientVault"("id") ON DELETE RESTRICT,
  "stage" VARCHAR(40) NOT NULL,
  "idempotencyKey" VARCHAR(128) NOT NULL UNIQUE,
  "encryptedPayload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "OutboxDelivery_status_availableAt_idx" ON "OutboxDelivery"("status", "availableAt");
