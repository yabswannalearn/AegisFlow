export interface KnownPatientEntities {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  memberId?: string;
}

export interface RedactedSpan {
  original: string;
  replacement: string;
  pass: string;
}

export interface ScrubResult {
  scrubbedText: string;
  redactedSpans: RedactedSpan[];
  redactionCount: number;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Contextual Known-Entity + 6-Pass Regex PII/PHI Scrubber (ADR-002).
 * Strips self-referential patient fields first, then runs 6 deterministic regex passes
 * before symptom text ever leaves the Next.js boundary.
 */
export function scrubSymptoms(
  rawText: string,
  knownEntities: KnownPatientEntities = {}
): ScrubResult {
  let text = rawText;
  const redactedSpans: RedactedSpan[] = [];

  const applyPattern = (
    regex: RegExp,
    replacement: string,
    passName: string
  ) => {
    text = text.replace(regex, (match) => {
      redactedSpans.push({
        original: match,
        replacement,
        pass: passName,
      });
      return replacement;
    });
  };

  // --- Pass 0: Contextual Known-Entity Matching (ADR-002) ---
  if (knownEntities.email && knownEntities.email.trim().length >= 3) {
    applyPattern(
      new RegExp(escapeRegExp(knownEntities.email.trim()), "gi"),
      "[REDACTED_EMAIL]",
      "PASS_0_KNOWN_EMAIL"
    );
  }

  if (knownEntities.memberId && knownEntities.memberId.trim().length >= 3) {
    applyPattern(
      new RegExp(escapeRegExp(knownEntities.memberId.trim()), "gi"),
      "[REDACTED_MEMBER_ID]",
      "PASS_0_KNOWN_MEMBER_ID"
    );
  }

  if (knownEntities.dob && knownEntities.dob.trim().length >= 4) {
    applyPattern(
      new RegExp(escapeRegExp(knownEntities.dob.trim()), "gi"),
      "[REDACTED_DATE]",
      "PASS_0_KNOWN_DOB"
    );
  }

  if (knownEntities.phone && knownEntities.phone.trim().length >= 7) {
    const rawPhone = knownEntities.phone.trim();
    applyPattern(
      new RegExp(escapeRegExp(rawPhone), "gi"),
      "[REDACTED_PHONE]",
      "PASS_0_KNOWN_PHONE"
    );
    const digitsOnly = rawPhone.replace(/\D/g, "");
    if (digitsOnly.length >= 10) {
      const last10 = digitsOnly.slice(-10);
      const flexiblePhoneRegex = new RegExp(
        `(?:\\+?1[-.\\s]?)?\\(?${last10.slice(0, 3)}\\)?[-.\\s]?${last10.slice(3, 6)}[-.\\s]?${last10.slice(6)}`,
        "g"
      );
      applyPattern(
        flexiblePhoneRegex,
        "[REDACTED_PHONE]",
        "PASS_0_KNOWN_PHONE"
      );
    }
  }

  const first = knownEntities.firstName?.trim();
  const last = knownEntities.lastName?.trim();
  if (first && last && first.length >= 2 && last.length >= 2) {
    applyPattern(
      new RegExp(`\\b${escapeRegExp(first)}\\s+${escapeRegExp(last)}\\b`, "gi"),
      "[REDACTED_NAME]",
      "PASS_0_KNOWN_FULL_NAME"
    );
  }
  if (first && first.length >= 2) {
    applyPattern(
      new RegExp(`\\b${escapeRegExp(first)}\\b`, "gi"),
      "[REDACTED_NAME]",
      "PASS_0_KNOWN_FIRST_NAME"
    );
  }
  if (last && last.length >= 2) {
    applyPattern(
      new RegExp(`\\b${escapeRegExp(last)}\\b`, "gi"),
      "[REDACTED_NAME]",
      "PASS_0_KNOWN_LAST_NAME"
    );
  }

  // --- Pass 1: Honorifics & Self-Identifying Introductions ---
  applyPattern(
    /\b(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
    "[REDACTED_NAME]",
    "PASS_1_HONORIFIC_NAME"
  );
  applyPattern(
    /\b(?:my name is|I am|I'm|this is|patient name is|husband|wife|partner|mother|father|son|daughter|friend)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g,
    "[REDACTED_NAME]",
    "PASS_1_CONTEXT_NAME"
  );

  // --- Pass 2: US Social Security Numbers (SSN) ---
  applyPattern(
    /\b\d{3}[-.\s]\d{2}[-.\s]\d{4}\b|\b\d{9}\b/g,
    "[REDACTED_SSN]",
    "PASS_2_SSN"
  );

  // --- Pass 3: Phone Numbers (US & International formats) ---
  applyPattern(
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b|\+\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
    "[REDACTED_PHONE]",
    "PASS_3_PHONE"
  );

  // --- Pass 4: Email Addresses ---
  applyPattern(
    /(?:[a-zA-Z0-9._%+-]|\[REDACTED_NAME\])+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[REDACTED_EMAIL]",
    "PASS_4_EMAIL"
  );

  // --- Pass 5: Dates & Date of Birth (ISO, US Slash/Dash, Written Months) ---
  applyPattern(
    /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g,
    "[REDACTED_DATE]",
    "PASS_5_DATE_NUMERIC"
  );
  applyPattern(
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi,
    "[REDACTED_DATE]",
    "PASS_5_DATE_WRITTEN"
  );

  // --- Pass 6: Street Addresses & Insurance Member IDs ---
  applyPattern(
    /\b\d{1,5}\s+[A-Za-z0-9.\s]{2,25}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Parkway|Pkwy)\.?\b/gi,
    "[REDACTED_ADDRESS]",
    "PASS_6_ADDRESS"
  );
  applyPattern(
    /\b[A-Z]{2,4}[-]?[0-9]{6,12}\b/g,
    "[REDACTED_MEMBER_ID]",
    "PASS_6_MEMBER_ID"
  );

  return {
    scrubbedText: text,
    redactedSpans,
    redactionCount: redactedSpans.length,
  };
}
