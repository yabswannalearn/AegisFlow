"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  WorkspaceHeader,
  Journey,
  Field,
  StatusBadge,
  WorkspaceFooter,
} from "@/components/workspace-ui";
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  CreditCard,
  FileSignature,
  CalendarClock,
  Lock,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

interface TokenValidationResponse {
  valid: boolean;
  burned?: boolean;
  expired?: boolean;
  error?: string;
  patientId?: string;
  status?: string;
  tokenHashPrefix?: string;
  tokenUsedAt?: string | null;
  tokenExpiresAt?: string | null;
  assignedDoctor?: string;
  recommendedSpecialty?: string;
  copayEstimateUsd?: number;
  appointmentSlot?: string | null;
  hubspotDealId?: string | null;
  hubspotContactId?: string | null;
}

const AVAILABLE_SLOTS = [1, 2, 3].map((offset) => {
  const slot = new Date();
  slot.setDate(slot.getDate() + offset);
  slot.setUTCHours(14, 0, 0, 0);
  return {
    id: slot.toISOString(),
    label: `${slot.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} (Demo telehealth slot)`,
  };
});

export default function PatientOnboardingPage() {
  const params = useParams<{ token: string }>();
  const rawToken = params?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenValidationResponse | null>(
    null,
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [kycIdType, setKycIdType] = useState("Driver_License");
  const [kycCardNumberLast4, setKycCardNumberLast4] = useState("8944");
  const [nppSignatureText, setNppSignatureText] = useState("");
  const [appointmentSlotIso, setAppointmentSlotIso] = useState(
    AVAILABLE_SLOTS[0].id,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateToken = useCallback(async () => {
    if (!rawToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/onboarding/${rawToken}/complete`, {
        cache: "no-store",
      });
      const data: TokenValidationResponse = await res.json();
      setTokenInfo(data);
    } catch {
      setTokenInfo({ valid: false, error: "Network error validating token" });
    } finally {
      setLoading(false);
    }
  }, [rawToken]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  function handleAutoPopulateDemo() {
    setKycIdType("Driver_License");
    setKycCardNumberLast4("4821");
    setNppSignatureText("Patient Verified E-Signature");
    setAppointmentSlotIso(AVAILABLE_SLOTS[0].id);
  }

  async function handleCompleteOnboarding(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/onboarding/${rawToken}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kycIdType,
          kycCardNumberLast4,
          nppSignatureText: nppSignatureText.trim(),
          appointmentSlotIso,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to complete onboarding");
        await validateToken();
        return;
      }
      await validateToken();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="af-app">
      <WorkspaceHeader
        section="Patient onboarding"
        actions={
          <Link
            href="/"
            aria-label="Back to intake"
            className="af-button af-button-quiet"
          >
            <ArrowLeft size={14} />
            <span>Back to intake</span>
          </Link>
        }
      />
      <main className="af-main af-onboarding">
        {loading ? (
          <div className="af-card af-skeleton">
            <Lock size={17} /> Checking your private invitation…
          </div>
        ) : !tokenInfo || (!tokenInfo.valid && !tokenInfo.burned) ? (
          <section className="af-card af-centered">
            <AlertTriangle size={34} />
            <h1>This invitation is unavailable</h1>
            <p>
              {tokenInfo?.expired
                ? "Your invitation has expired. Ask the demo clinician to create a new one."
                : (tokenInfo?.error ??
                  "This link is invalid. Start a new demo intake to try the complete journey.")}
            </p>
            <Link className="af-button af-button-primary" href="/">
              Return to intake <ArrowRight size={14} />
            </Link>
          </section>
        ) : tokenInfo.burned ? (
          <section className="af-card af-receipt">
            <div className="af-receipt-icon">
              <CheckCircle2 size={34} strokeWidth={1.5} />
            </div>
            <StatusBadge tone="success">
              Your next step is confirmed
            </StatusBadge>
            <h1>Telehealth Onboarding &amp; Appointment Confirmed</h1>
            <p>
              The demo appointment has been recorded. This invitation is now
              complete and cannot be used to book again.
            </p>
            <dl className="af-demographics">
              <div>
                <dt>Receiving specialist</dt>
                <dd>{tokenInfo.assignedDoctor}</dd>
              </div>
              <div>
                <dt>Appointment time</dt>
                <dd>
                  {tokenInfo.appointmentSlot
                    ? new Date(tokenInfo.appointmentSlot).toLocaleString(
                        undefined,
                        { dateStyle: "medium", timeStyle: "short" },
                      )
                    : "Recorded"}
                </dd>
              </div>
              <div>
                <dt>Specialty</dt>
                <dd>{tokenInfo.recommendedSpecialty}</dd>
              </div>
              <div>
                <dt>Estimated demo copay</dt>
                <dd>${tokenInfo.copayEstimateUsd}</dd>
              </div>
            </dl>
            <p className="af-under-button">
              <Lock size={12} /> A single-use invitation. A recorded next step.
            </p>
            <details
              className="af-detail"
              style={{ textAlign: "left", marginTop: 25 }}
            >
              <summary>View workflow receipt</summary>
              <pre className="af-code">
                {JSON.stringify(
                  {
                    patientId: tokenInfo.patientId,
                    completedAt: tokenInfo.tokenUsedAt,
                    hubspotDealId: tokenInfo.hubspotDealId,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
            <Link
              href="/"
              className="af-button af-button-primary"
              style={{ marginTop: 28 }}
            >
              Explore another demo case <ArrowRight size={14} />
            </Link>
          </section>
        ) : (
          <>
            <div className="af-page-intro">
              <p className="af-eyebrow">
                <span className="af-dot" /> Your private invitation
              </p>
              <h1 className="af-page-title">You’re one step closer.</h1>
              <p>
                Confirm a few details, review the sample consent, and choose
                your demo appointment.
              </p>
            </div>
            <Journey current={3} />
            <div className="af-onboarding-grid">
              <aside>
                <nav className="af-card af-steps" aria-label="Onboarding steps">
                  {[
                    {
                      n: 1 as const,
                      title: "Your details",
                      subtitle: "Synthetic identity & card",
                      Icon: CreditCard,
                    },
                    {
                      n: 2 as const,
                      title: "Your consent",
                      subtitle: "Review & sign",
                      Icon: FileSignature,
                    },
                    {
                      n: 3 as const,
                      title: "Your appointment",
                      subtitle: "Choose a time",
                      Icon: CalendarClock,
                    },
                  ].map(({ n, title, subtitle, Icon }) => (
                    <button
                      key={n}
                      type="button"
                      className={`af-step ${step === n ? "is-current" : step > n ? "is-complete" : ""}`}
                      onClick={() => {
                        setStep(n);
                        setSubmitError(null);
                      }}
                      disabled={n > step}
                      aria-current={step === n ? "step" : undefined}
                    >
                      <span>
                        {step > n ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <Icon size={16} />
                        )}
                      </span>
                      <div>
                        <strong>{title}</strong>
                        <small>{subtitle}</small>
                      </div>
                    </button>
                  ))}
                </nav>
                <div className="af-onboarding-side-note">
                  <ShieldCheck size={24} strokeWidth={1.5} />
                  <strong
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "#738bad",
                      marginBottom: 7,
                    }}
                  >
                    A private path forward.
                  </strong>
                  Your invitation expires after 48 hours and can be used for one
                  booking. The details in this demonstration are synthetic.
                </div>
              </aside>
              <section className="af-card">
                <div className="af-card-head">
                  <div>
                    <p className="af-section-label" style={{ marginBottom: 7 }}>
                      Step {step} of 3
                    </p>
                    <h2>
                      {step === 1
                        ? "A quick introduction"
                        : step === 2
                          ? "On the same page"
                          : "Make time for the next step"}
                    </h2>
                  </div>
                  <button
                    className="af-button af-button-quiet"
                    type="button"
                    onClick={handleAutoPopulateDemo}
                  >
                    <Sparkles size={13} /> Use demo details
                  </button>
                </div>
                <form
                  className="af-onboarding-content"
                  onSubmit={handleCompleteOnboarding}
                >
                  {submitError && (
                    <div className="af-alert" role="alert">
                      <AlertTriangle size={16} />
                      {submitError}
                    </div>
                  )}
                  {step === 1 && (
                    <>
                      <h2>Confirm your details</h2>
                      <p>
                        Use a synthetic card to try this step. No identity or
                        insurance provider is contacted.
                      </p>
                      <div className="af-form-grid">
                        <Field label="Identification type">
                          <select
                            className="af-input"
                            aria-label="Demo identification type"
                            value={kycIdType}
                            onChange={(e) => setKycIdType(e.target.value)}
                          >
                            <option value="Driver_License">
                              Driver’s license
                            </option>
                            <option value="Passport">Passport</option>
                            <option value="State_ID">
                              State identification card
                            </option>
                          </select>
                        </Field>
                        <Field label="Insurance card · last four digits">
                          <input
                            className="af-input"
                            aria-label="Insurance card last four digits"
                            inputMode="numeric"
                            maxLength={4}
                            value={kycCardNumberLast4}
                            onChange={(e) =>
                              setKycCardNumberLast4(e.target.value)
                            }
                            required
                          />
                        </Field>
                      </div>
                      <div className="af-form-actions">
                        <span className="af-under-button">
                          <Lock size={11} /> Encrypted in the patient vault
                        </span>
                        <button
                          className="af-button af-button-primary"
                          type="button"
                          onClick={() => {
                            if (!/^\d{4}$/.test(kycCardNumberLast4)) {
                              setSubmitError(
                                "Enter four synthetic card digits to continue.",
                              );
                              return;
                            }
                            setSubmitError(null);
                            setStep(2);
                          }}
                        >
                          Continue to Step 2 <ArrowRight size={14} />
                        </button>
                      </div>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <h2>A moment to review</h2>
                      <p>
                        This sample shows how a consent step fits into the
                        onboarding journey.
                      </p>
                      <div className="af-consent-text">
                        <strong>
                          Demonstration privacy & telehealth consent
                        </strong>
                        Enter a synthetic name to try the consent step. Your
                        signature is encrypted with the consent version and
                        timestamp. This sample is not a clinical consent form.
                      </div>
                      <Field label="Type a synthetic name">
                        <input
                          className="af-input"
                          aria-label="Demo signature"
                          value={nppSignatureText}
                          onChange={(e) => setNppSignatureText(e.target.value)}
                          placeholder="e.g. Synthetic Patient"
                          required
                          style={{ fontFamily: "Sora,sans-serif" }}
                        />
                      </Field>
                      <div className="af-form-actions">
                        <button
                          className="af-button af-button-quiet"
                          type="button"
                          onClick={() => setStep(1)}
                        >
                          <ArrowLeft size={14} /> Back
                        </button>
                        <button
                          className="af-button af-button-primary"
                          type="button"
                          disabled={nppSignatureText.trim().length < 3}
                          onClick={() => setStep(3)}
                        >
                          Continue to Step 3 <ArrowRight size={14} />
                        </button>
                      </div>
                    </>
                  )}
                  {step === 3 && (
                    <>
                      <h2>Choose a time that works</h2>
                      <p>
                        {tokenInfo.recommendedSpecialty} ·{" "}
                        {tokenInfo.assignedDoctor}
                      </p>
                      {AVAILABLE_SLOTS.map((slot) => (
                        <label
                          key={slot.id}
                          className={`af-slot ${appointmentSlotIso === slot.id ? "is-selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name="appointment"
                            value={slot.id}
                            checked={appointmentSlotIso === slot.id}
                            onChange={() => setAppointmentSlotIso(slot.id)}
                          />
                          <CalendarClock
                            size={19}
                            style={{ color: "#829ac4" }}
                          />
                          <span>
                            <strong>
                              {new Date(slot.id).toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                              })}
                            </strong>
                            <small>
                              {new Date(slot.id).toLocaleTimeString(undefined, {
                                hour: "numeric",
                                minute: "2-digit",
                                timeZoneName: "short",
                              })}{" "}
                              · Demo telehealth appointment
                            </small>
                          </span>
                        </label>
                      ))}
                      <div className="af-form-actions">
                        <button
                          type="button"
                          className="af-button af-button-quiet"
                          onClick={() => setStep(2)}
                        >
                          <ArrowLeft size={14} /> Back
                        </button>
                        <button
                          type="submit"
                          className="af-button af-button-primary"
                          disabled={submitting}
                        >
                          {submitting ? "Confirming…" : "Confirm Appointment"}
                          <CheckCircle2 size={15} />
                        </button>
                      </div>
                      <p className="af-under-button">
                        Estimated demo copay: ${tokenInfo.copayEstimateUsd} · No
                        payment is collected.
                      </p>
                    </>
                  )}
                </form>
              </section>
            </div>
          </>
        )}
      </main>
      <WorkspaceFooter />
    </div>
  );
}
