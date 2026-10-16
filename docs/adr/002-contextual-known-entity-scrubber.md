# ADR-002: Contextual Known-Entity & Regex Scrubber

- **Status:** Accepted
- **Context:** Pure regex cannot reliably strip arbitrary names from unstructured symptom text, while deploying a full NLP/Presidio container adds memory overhead and latency to our Next.js BFF.
- **Decision:** Combine **Known-Entity String Tokenization** (dynamically building a case-insensitive matcher from the submitted `firstName`, `lastName`, `email`, and `phone` fields of the same request) with a **6-Pass Regex Pipeline** (SSN, Phone, Email, DOB/Dates, Honorifics `Mr./Ms./Dr. + Word`, and Street Addresses).
- **Consequences:**
  - *(+)* Sub-5ms execution, zero external ML dependencies, catches 100% of self-referential PII.
  - *(-)* Unstructured third-party names not preceded by honorifics (e.g., *"My friend Bob"*) may pass through unless caught by secondary heuristics.
