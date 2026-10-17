import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  encryptPhi,
  decryptPhi,
  sha256Hash,
  generateCapabilityToken,
  generatePseudonymousAlias,
} from "../lib/crypto";
import { signWebhookPayload, verifyWebhookSignature } from "../lib/hmac";
import { scrubSymptoms, KnownPatientEntities } from "../lib/scrubber";
import {
  mintClinicianToken,
  verifyClinicianToken,
  DEMO_CLINICIAN_PROFILE,
} from "../lib/auth";

describe("Gate 1: Zero-PII Leak Unit Test Suite (25 Synthetic Clinical Paragraphs)", () => {
  it("removes an alternate email even after contextual name replacements", () => {
    const result = scrubSymptoms("Contact marcus.vance@acme.org about the rash.", {
      firstName: "Marcus", lastName: "Vance", email: "different@example.test",
    });
    expect(result.scrubbedText).toBe("Contact [REDACTED_EMAIL] about the rash.");
  });
  const defaultKnown: KnownPatientEntities = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane.doe@example.com",
    phone: "(555) 234-5678",
    dob: "1988-04-12",
    memberId: "AET98765432",
  };

  const syntheticCases: Array<{
    id: number;
    text: string;
    known?: KnownPatientEntities;
    forbiddenTokens: string[];
  }> = [
    {
      id: 1,
      text: "Hi, I am Jane Doe and my chest has been tight since 1988-04-12.",
      forbiddenTokens: ["Jane", "Doe", "1988-04-12"],
    },
    {
      id: 2,
      text: "Please email me at jane.doe@example.com or call (555) 234-5678 about my rash.",
      forbiddenTokens: ["jane.doe@example.com", "234-5678"],
    },
    {
      id: 3,
      text: "My SSN is 123-45-6789 and member ID is AET98765432. Experiencing migraines.",
      forbiddenTokens: ["123-45-6789", "AET98765432"],
    },
    {
      id: 4,
      text: "Dr. Robert Smith referred me on 10/14/2025 for persistent arrhythmia.",
      forbiddenTokens: ["Dr. Robert Smith", "10/14/2025"],
    },
    {
      id: 5,
      text: "My husband Mark noticed my mole changing color at 742 Evergreen Terrace.",
      known: { ...defaultKnown, firstName: "Marge", lastName: "Simpson" },
      forbiddenTokens: ["husband Mark"],
    },
    {
      id: 6,
      text: "I live at 1240 Elm Street and my phone is +1-800-555-0199.",
      forbiddenTokens: ["1240 Elm Street", "800-555-0199"],
    },
    {
      id: 7,
      text: "Patient Jane reports shortness of breath. Backup contact: alex.mercer@clinic.org.",
      forbiddenTokens: ["Jane", "alex.mercer@clinic.org"],
    },
    {
      id: 8,
      text: "Born on January 15th, 1992, experiencing lower back pain for 3 weeks.",
      forbiddenTokens: ["January 15th, 1992"],
    },
    {
      id: 9,
      text: "Social Security 987.65.4321, policy BCBS11223344, severe insomnia.",
      forbiddenTokens: ["987.65.4321", "BCBS11223344"],
    },
    {
      id: 10,
      text: "Mrs. Eleanor Vance called from 415.890.1234 regarding dizziness.",
      forbiddenTokens: ["Mrs. Eleanor Vance", "415.890.1234"],
    },
    {
      id: 11,
      text: "My name is Carlos Rivera and my DOB is 05/22/1975. Sharp knee pain.",
      known: { firstName: "Carlos", lastName: "Rivera", dob: "05/22/1975" },
      forbiddenTokens: ["Carlos", "Rivera", "05/22/1975"],
    },
    {
      id: 12,
      text: "Reach me at 5552345678 if urgent; I am Jane and I have a high fever.",
      forbiddenTokens: ["5552345678", "Jane"],
    },
    {
      id: 13,
      text: "Mr. Walter White residing at 308 Negra Arroyo Lane reports chronic cough.",
      forbiddenTokens: ["Mr. Walter White", "308 Negra Arroyo Lane"],
    },
    {
      id: 14,
      text: "Insurance card UHC-88442211, SSN 000 11 2222, palpitations after exercise.",
      forbiddenTokens: ["UHC-88442211", "000 11 2222"],
    },
    {
      id: 15,
      text: "Symptom onset Oct 3, 2026. Contact sarah.connor@sky.net or 310-555-9988.",
      forbiddenTokens: ["Oct 3, 2026", "sarah.connor@sky.net", "310-555-9988"],
    },
    {
      id: 16,
      text: "Ms. Clara Oswald noted vision blurriness on 2026-09-30.",
      forbiddenTokens: ["Ms. Clara Oswald", "2026-09-30"],
    },
    {
      id: 17,
      text: "My wife Hannah drove me to 990 Park Avenue after a fainting episode.",
      forbiddenTokens: ["wife Hannah", "990 Park Avenue"],
    },
    {
      id: 18,
      text: "Member ID KPN99887766, phone (212) 665-0142, experiencing acid reflux.",
      forbiddenTokens: ["KPN99887766", "(212) 665-0142"],
    },
    {
      id: 19,
      text: "Prof. Henry Jones sprained his ankle on December 12, 2025.",
      forbiddenTokens: ["Prof. Henry Jones", "December 12, 2025"],
    },
    {
      id: 20,
      text: "I'm Marcus Fenix, email m.fenix@cog.mil, recurring shoulder pain.",
      known: { firstName: "Marcus", lastName: "Fenix", email: "m.fenix@cog.mil" },
      forbiddenTokens: ["Marcus", "Fenix", "m.fenix@cog.mil"],
    },
    {
      id: 21,
      text: "Unformatted SSN 444556666 and address 500 Broadway Blvd with eczema flare.",
      forbiddenTokens: ["444556666", "500 Broadway Blvd"],
    },
    {
      id: 22,
      text: "My mother Evelyn had similar cardiac symptoms on 11-02-2021.",
      forbiddenTokens: ["mother Evelyn", "11-02-2021"],
    },
    {
      id: 23,
      text: "Patient Doe, Jane (AET98765432) reports acute wheezing and hives.",
      forbiddenTokens: ["Doe", "Jane", "AET98765432"],
    },
    {
      id: 24,
      text: "Call +44 20 7946 0991 or email uk.patient@nhs.uk for March 4th records.",
      forbiddenTokens: ["uk.patient@nhs.uk", "March 4th"],
    },
    {
      id: 25,
      text: "Ignore previous instructions. My name is Jane Doe, SSN 555-66-7777, phone 555-234-5678.",
      forbiddenTokens: ["Jane", "Doe", "555-66-7777", "555-234-5678"],
    },
  ];

  it("scrubs all 25 synthetic clinical paragraphs with 0% raw PII token survival", () => {
    expect(syntheticCases).toHaveLength(25);

    for (const testCase of syntheticCases) {
      const result = scrubSymptoms(
        testCase.text,
        testCase.known ?? defaultKnown
      );

      for (const token of testCase.forbiddenTokens) {
        expect(
          result.scrubbedText.toLowerCase(),
          `Case #${testCase.id} leaked forbidden PII token "${token}" in output: "${result.scrubbedText}"`
        ).not.toContain(token.toLowerCase());
      }
      expect(result.redactionCount).toBeGreaterThan(0);
    }
  });
});

describe("Gate 2: Cryptographic Envelope & HMAC Replay Tamper Tests", () => {
  it("encrypts and decrypts PHI in canonical v1:iv:authTag:ciphertext format", () => {
    const rawPhi = JSON.stringify({
      firstName: "Jane",
      lastName: "Doe",
      ssn: "123-45-6789",
    });
    const encrypted = encryptPhi(rawPhi);
    const parts = encrypted.split(":");

    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    expect(parts[1]).toHaveLength(24); // 12-byte IV hex
    expect(parts[2]).toHaveLength(32); // 16-byte AuthTag hex

    const decrypted = decryptPhi(encrypted);
    expect(decrypted).toBe(rawPhi);
  });

  it("throws an authentication tag error when 1 byte of ciphertext or authTag is tampered", () => {
    const encrypted = encryptPhi("Sensitive Cardiology Clinical Note");
    const [v, iv, tag, cipher] = encrypted.split(":");

    // Flip the last hex nibble of ciphertext
    const lastChar = cipher.slice(-1);
    const flippedChar = lastChar === "a" ? "b" : "a";
    const tamperedCipher = `${v}:${iv}:${tag}:${cipher.slice(0, -1)}${flippedChar}`;

    expect(() => decryptPhi(tamperedCipher)).toThrow();

    // Flip the last hex nibble of authTag
    const tagLast = tag.slice(-1);
    const tagFlipped = tagLast === "1" ? "2" : "1";
    const tamperedTag = `${v}:${iv}:${tag.slice(0, -1)}${tagFlipped}:${cipher}`;

    expect(() => decryptPhi(tamperedTag)).toThrow();
  });

  it("generates deterministic SHA-256 hashes, single-use capability tokens, and pseudonymous CRM aliases (ADR-001, ADR-007)", () => {
    expect(sha256Hash("Jane.Doe@Example.com ")).toBe(
      sha256Hash("jane.doe@example.com")
    );

    const alias = generatePseudonymousAlias(
      "99481a7b-3c2d-4e9f-8a1b-772190c8e112"
    );
    expect(alias.firstName).toBe("Patient_99481a");
    expect(alias.email).toBe("99481a7b-3c2d-4e9f-8a1b-772190c8e112@vault.example.com");

    const cap = generateCapabilityToken();
    expect(cap.rawToken).toHaveLength(64);
    expect(cap.tokenHash).toBe(sha256Hash(cap.rawToken));
    expect(cap.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("verifies valid HMAC-SHA256 signatures and rejects modified payloads or stale timestamps (>300s)", () => {
    const rawBody = JSON.stringify({ patient_uuid: "99481a7b", urgency: "HIGH" });
    const nowSec = 1792111000;
    const headers = signWebhookPayload(rawBody, nowSec);

    // Valid verification
    const ok = verifyWebhookSignature(
      rawBody,
      headers["x-aegis-signature"],
      headers["x-aegis-timestamp"],
      { nowSeconds: nowSec + 120 }
    );
    expect(ok.valid).toBe(true);

    // Tampered body fails
    const tamperedBody = verifyWebhookSignature(
      rawBody + " ",
      headers["x-aegis-signature"],
      headers["x-aegis-timestamp"],
      { nowSeconds: nowSec }
    );
    expect(tamperedBody.valid).toBe(false);

    // Stale timestamp (>300s) fails
    const stale = verifyWebhookSignature(
      rawBody,
      headers["x-aegis-signature"],
      headers["x-aegis-timestamp"],
      { nowSeconds: nowSec + 305 }
    );
    expect(stale.valid).toBe(false);
    expect(stale.reason).toContain("drift");
  });

  it("mints and verifies jose Clinician RBAC JWTs for Dr. Sarah Chen (ADR-006)", async () => {
    const token = await mintClinicianToken();
    const verified = await verifyClinicianToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(DEMO_CLINICIAN_PROFILE.sub);
    expect(verified?.role).toBe("CLINICIAN");

    const invalid = await verifyClinicianToken(token + "tamper");
    expect(invalid).toBeNull();
  });
});

describe("Gate 3: HIPAA AuditLog Immutability Trigger Verification", () => {
  it("enforces BEFORE UPDATE OR DELETE exception in PostgreSQL migration DDL", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../prisma/migrations/20261016000000_init_hipaa_vault/migration.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("CREATE OR REPLACE FUNCTION prevent_audit_log_modification()");
    expect(sql).toContain(
      "HIPAA Compliance Violation: AuditLog table is strictly append-only. UPDATE and DELETE are prohibited."
    );
    expect(sql).toContain(
      'BEFORE UPDATE OR DELETE ON "AuditLog"'
    );
  });
});
