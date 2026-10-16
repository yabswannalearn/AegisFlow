"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
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

const AVAILABLE_SLOTS = [
  {
    id: "2026-10-19T14:00:00.000Z",
    label: "Monday, Oct 19 • 10:00 AM EDT (Telehealth Video)",
  },
  {
    id: "2026-10-19T16:30:00.000Z",
    label: "Monday, Oct 19 • 12:30 PM EDT (Telehealth Video)",
  },
  {
    id: "2026-10-20T15:00:00.000Z",
    label: "Tuesday, Oct 20 • 11:00 AM EDT (Priority Specialist Slot)",
  },
];

export default function PatientOnboardingPage() {
  const params = useParams<{ token: string }>();
  const rawToken = params?.token ?? "";

  const [loading, setLoading] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenValidationResponse | null>(
    null
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [kycIdType, setKycIdType] = useState("Driver_License");
  const [kycCardNumberLast4, setKycCardNumberLast4] = useState("8944");
  const [nppSignatureText, setNppSignatureText] = useState("");
  const [appointmentSlotIso, setAppointmentSlotIso] = useState(
    AVAILABLE_SLOTS[0].id
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
          nppSignatureText:
            nppSignatureText.trim() || "Patient Verified E-Signature",
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to X-Ray Inspector
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-bold text-white">
                AegisFlow Patient Onboarding Portal
              </span>
            </div>
          </div>

          {tokenInfo?.tokenHashPrefix && (
            <span className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-slate-400">
              SHA-256 Token: {tokenInfo.tokenHashPrefix}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center text-sm text-slate-400">
            Verifying single-use 48-hour SHA-256 capability token...
          </div>
        ) : !tokenInfo || (!tokenInfo.valid && !tokenInfo.burned) ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-red-500/40 bg-slate-900 p-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
            <h1 className="mt-3 text-lg font-bold text-white">
              Invalid or Expired Onboarding Link
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              {tokenInfo?.error ??
                "This capability token does not exist or has expired past its 48-hour window."}
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
            >
              Return to Main Workspace
            </Link>
          </div>
        ) : tokenInfo.burned ? (
          /* Burned Capability Token Read-Only Receipt View (ADR-007) */
          <div className="mx-auto max-w-2xl rounded-2xl border border-emerald-500/40 bg-slate-900/90 p-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-300">
                    Single-Use Capability Token Burned (ADR-007)
                  </span>
                  <h1 className="mt-1 text-xl font-bold text-white">
                    Telehealth Onboarding & Appointment Confirmed
                  </h1>
                </div>
              </div>
              <Lock className="h-5 w-5 text-slate-500" />
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-300">
              This capability token has been cryptographically burned (
              <code className="font-mono text-emerald-300">
                tokenUsedAt ={" "}
                {tokenInfo.tokenUsedAt
                  ? new Date(tokenInfo.tokenUsedAt).toISOString()
                  : "burned"}
              </code>
              ) and cannot be replayed. Re-visiting this URL displays your
              immutable appointment confirmation receipt.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-[10px] uppercase text-slate-400">
                  Assigned Specialist
                </span>
                <p className="mt-1 text-sm font-semibold text-white">
                  {tokenInfo.assignedDoctor}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-[10px] uppercase text-slate-400">
                  Confirmed Appointment Slot
                </span>
                <p className="mt-1 font-mono text-xs font-semibold text-emerald-300">
                  {tokenInfo.appointmentSlot
                    ? new Date(tokenInfo.appointmentSlot).toLocaleString()
                    : "Booked"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-[10px] uppercase text-slate-400">
                  HubSpot Deal Stage (n8n #3)
                </span>
                <p className="mt-1 text-xs font-semibold text-sky-300">
                  Closed Won — Appointment Booked ({tokenInfo.hubspotDealId})
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <span className="text-[10px] uppercase text-slate-400">
                  HubSpot Contact Lifecycle
                </span>
                <p className="mt-1 font-mono text-xs font-semibold text-emerald-300">
                  lifecyclestage = &quot;customer&quot;
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-5">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
              >
                Inspect Full Closed-Loop Telemetry in X-Ray UI
              </Link>
              {tokenInfo.patientId && (
                <Link
                  href={`/admin/vault/${tokenInfo.patientId}`}
                  className="text-xs font-medium text-slate-400 underline hover:text-white"
                >
                  View Clinician Vault Record
                </Link>
              )}
            </div>
          </div>
        ) : (
          /* Active 3-Step Onboarding Wizard */
          <div className="space-y-6">
            {/* Header Summary Card */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                  Clinician-Approved Telehealth Onboarding
                </span>
                <h1 className="mt-0.5 text-lg font-bold text-white">
                  {tokenInfo.assignedDoctor} • {tokenInfo.recommendedSpecialty}
                </h1>
                <p className="text-xs text-slate-400">
                  Estimated In-Network Copay:{" "}
                  <strong className="text-emerald-300">
                    ${tokenInfo.copayEstimateUsd}.00 USD
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={handleAutoPopulateDemo}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                1-Click Demo Auto-Fill All 3 Steps
              </button>
            </div>

            {/* Step Indicator Pills */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  num: 1 as const,
                  title: "1. KYC & Insurance Card",
                  icon: CreditCard,
                },
                {
                  num: 2 as const,
                  title: "2. Telehealth NPP E-Sign",
                  icon: FileSignature,
                },
                {
                  num: 3 as const,
                  title: "3. Specialist Slot Booking",
                  icon: CalendarClock,
                },
              ].map((item) => {
                const Icon = item.icon;
                const active = step === item.num;
                const done = step > item.num;
                return (
                  <button
                    key={item.num}
                    type="button"
                    onClick={() => setStep(item.num)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left text-xs font-semibold transition ${
                      active
                        ? "border-emerald-500 bg-emerald-500/10 text-white"
                        : done
                        ? "border-emerald-500/30 bg-slate-900 text-emerald-300"
                        : "border-slate-800 bg-slate-900/50 text-slate-400"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </button>
                );
              })}
            </div>

            <form
              onSubmit={handleCompleteOnboarding}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6"
            >
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-white">
                    Step 1: Identity (KYC) & Insurance Card Verification
                  </h2>
                  <p className="text-xs text-slate-400">
                    Verify your government-issued photo ID and the last 4 digits
                    of your subscriber card.
                  </p>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Government Photo ID Type
                      </label>
                      <select
                        value={kycIdType}
                        onChange={(e) => setKycIdType(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white"
                      >
                        <option value="Driver_License">
                          State Driver&apos;s License
                        </option>
                        <option value="Passport">U.S. / Foreign Passport</option>
                        <option value="State_ID">State Identification Card</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300">
                        Insurance Member Card (Last 4 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={kycCardNumberLast4}
                        onChange={(e) => setKycCardNumberLast4(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-xs text-white"
                        placeholder="8944"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                    >
                      Continue to Step 2: Telehealth NPP Consent →
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-white">
                    Step 2: HIPAA Notice of Privacy Practices (NPP) & Telehealth
                    E-Signature
                  </h2>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-300">
                    <p className="font-semibold text-white">
                      AegisFlow HIPAA Privacy & Telehealth Informed Consent
                      (Document v2026.1)
                    </p>
                    <p className="mt-1">
                      By signing below, I acknowledge receipt of the Notice of
                      Privacy Practices (`NPP_AND_TELEHEALTH_CONSENT`). My
                      electronic signature, timestamp, IP address, and SHA-256
                      document hash are recorded in the immutable{" "}
                      <code>ConsentRecord</code> table.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300">
                      Type Full Legal Name as Electronic Signature
                    </label>
                    <input
                      type="text"
                      value={nppSignatureText}
                      onChange={(e) => setNppSignatureText(e.target.value)}
                      placeholder="e.g., Eleanor Vance"
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-serif text-sm italic text-emerald-300"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!nppSignatureText.trim()) {
                          setNppSignatureText("Patient Verified E-Signature");
                        }
                        setStep(3);
                      }}
                      className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                    >
                      Continue to Step 3: Select Specialist Slot →
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-white">
                    Step 3: Select Specialist Telehealth Appointment Slot
                  </h2>
                  <p className="text-xs text-slate-400">
                    Confirming your appointment burns this single-use 48-hour
                    capability token (`tokenUsedAt = now()`) and triggers n8n
                    Workflow #3 to transition your HubSpot Deal to{" "}
                    <strong className="text-emerald-300">
                      Closed Won — Appointment Booked
                    </strong>
                    .
                  </p>

                  <div className="space-y-2.5">
                    {AVAILABLE_SLOTS.map((slot) => (
                      <label
                        key={slot.id}
                        className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 text-xs transition ${
                          appointmentSlotIso === slot.id
                            ? "border-emerald-500 bg-emerald-500/10 text-white"
                            : "border-slate-800 bg-slate-950 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="slot"
                            checked={appointmentSlotIso === slot.id}
                            onChange={() => setAppointmentSlotIso(slot.id)}
                            className="accent-emerald-500"
                          />
                          <span className="font-semibold">{slot.label}</span>
                        </div>
                        <span className="font-mono text-[11px] text-emerald-300">
                          {tokenInfo.assignedDoctor}
                        </span>
                      </label>
                    ))}
                  </div>

                  {submitError && (
                    <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-300">
                      {submitError}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300"
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {submitting
                        ? "Burning Token & Syncing HubSpot Deal (Closed Won)..."
                        : "Confirm Appointment & Burn Single-Use Capability Token"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
