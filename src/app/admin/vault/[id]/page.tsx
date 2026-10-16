"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Unlock,
  UserCheck,
  FileText,
  CheckCircle2,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  KeyRound,
  LogOut,
  Send,
  Activity,
} from "lucide-react";

interface DecryptedVaultResponse {
  clinician: {
    sub: string;
    name: string;
    role: string;
    specialty: string;
    npi: string;
  };
  patientId: string;
  status: string;
  decryptedPii: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dob: string;
    insuranceProvider: string;
    memberId: string;
  };
  decryptedSymptoms: string;
  scrubbedSymptoms: string;
  aiTriage: {
    urgency_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    recommended_specialty: string;
    clinical_summary: string;
    insurance_verified: boolean;
    copay_estimate_usd: number;
    requires_human_review: boolean;
    confidence_score: number;
  } | null;
  hubspotContactId: string | null;
  hubspotDealId: string | null;
  assignedDoctor: string | null;
  magicLinkUrl: string | null;
  rawOnboardingToken: string | null;
  auditLogs: Array<{
    id: string;
    actorType: string;
    actorId: string;
    action: string;
    ipAddress: string;
    metadataJson: Record<string, unknown>;
    createdAt: string;
  }>;
}

const SPECIALIST_OPTIONS = [
  "Dr. Sarah Chen, MD (Cardiology)",
  "Dr. Marcus Vance, MD (Dermatology)",
  "Dr. Elena Rostova, MD (Internal Medicine)",
  "Dr. David Kim, MD (Pulmonology & Critical Care)",
];

export default function ClinicianVaultPage() {
  const params = useParams<{ id: string }>();
  const patientId = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [vault, setVault] = useState<DecryptedVaultResponse | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState(SPECIALIST_OPTIONS[0]);
  const [signingIn, setSigningIn] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{
    onboardingPath: string;
    onboardingTokenHash: string;
    tokenExpiresAt: string;
  } | null>(null);

  const loadVaultRecord = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/vault/${patientId}/approve`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        setUnauthorized(true);
        setVault(null);
        setLoading(false);
        return;
      }
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data: DecryptedVaultResponse = await res.json();
      setUnauthorized(false);
      setNotFound(false);
      setVault(data);
      if (data.assignedDoctor) {
        setSelectedDoctor(data.assignedDoctor);
      } else if (data.aiTriage?.recommended_specialty === "Dermatology") {
        setSelectedDoctor(SPECIALIST_OPTIONS[1]);
      }
    } catch {
      // Ignore transient error
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadVaultRecord();
  }, [loadVaultRecord]);

  async function handleDemoClinicianSignIn() {
    setSigningIn(true);
    try {
      await fetch("/api/auth/demo-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      await loadVaultRecord();
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/demo-session", { method: "DELETE" });
    setUnauthorized(true);
    setVault(null);
  }

  async function handleApprovePatient() {
    setApproving(true);
    try {
      const res = await fetch(`/api/vault/${patientId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignedDoctor: selectedDoctor }),
      });
      if (res.ok) {
        const data = await res.json();
        setApprovalResult({
          onboardingPath: data.onboardingPath,
          onboardingTokenHash: data.onboardingTokenHash,
          tokenExpiresAt: data.tokenExpiresAt,
        });
        await loadVaultRecord();
      }
    } finally {
      setApproving(false);
    }
  }

  const onboardingHref =
    approvalResult?.onboardingPath ??
    (vault?.rawOnboardingToken
      ? `/onboarding/${vault.rawOnboardingToken}`
      : null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to X-Ray Inspector
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-bold text-white">
                AegisFlow Clinician HITL Decryption Vault
              </span>
            </div>
          </div>

          {vault?.clinician && (
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1 text-xs text-emerald-300">
                <span className="font-semibold">{vault.clinician.name}</span>{" "}
                <span className="text-emerald-400/75">
                  ({vault.clinician.npi})
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center text-sm text-slate-400">
            Verifying Clinician RBAC JWT session & querying PatientVault...
          </div>
        ) : unauthorized ? (
          /* RBAC Barrier (ADR-006) */
          <div className="mx-auto max-w-xl rounded-2xl border border-amber-500/40 bg-slate-900/90 p-8 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-white">
              Clinician RBAC Authentication Required (HTTP 401)
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Patient record{" "}
              <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
                {patientId}
              </code>{" "}
              is encrypted at rest with{" "}
              <span className="font-semibold text-white">AES-256-GCM</span>.
              Decrypting Protected Health Information (PHI) requires a signed{" "}
              <code className="font-mono text-xs text-amber-300">
                CLINICIAN
              </code>{" "}
              JWT session and writes an immutable{" "}
              <code className="font-mono text-xs text-amber-300">
                PHI_DECRYPTED_VIEW
              </code>{" "}
              audit log entry (`ADR-006`).
            </p>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-400">
              <p className="font-semibold text-slate-200">
                Frictionless Portfolio Evaluation (`ADR-006`):
              </p>
              <p className="mt-1">
                Click below to mint a real{" "}
                <code className="text-emerald-300">HS256</code> JWT cookie (
                <code className="text-emerald-300">
                  aegis_clinician_session
                </code>
                ) for{" "}
                <strong className="text-white">
                  Dr. Sarah Chen, MD (actorId: dr_chen_demo)
                </strong>{" "}
                and unlock the vault.
              </p>
            </div>

            <button
              onClick={handleDemoClinicianSignIn}
              disabled={signingIn}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {signingIn
                ? "Minting Signed Clinician JWT..."
                : "Sign in as Demo Clinician (Dr. Sarah Chen, MD)"}
            </button>
          </div>
        ) : notFound || !vault ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-red-500/40 bg-slate-900 p-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-400" />
            <h2 className="mt-3 text-lg font-bold text-white">
              PatientVault Record Not Found
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              No intake record matches UUID{" "}
              <code className="font-mono text-red-300">{patientId}</code>.
              Submit a patient intake on the main workspace first.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
            >
              Go to Patient Intake Workspace
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Audited Decryption Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/25 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                  <Unlock className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      AES-256-GCM Vault Decrypted in BFF Memory
                    </span>
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                      PHI_DECRYPTED_VIEW LOGGED
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Actor{" "}
                    <code className="font-mono text-emerald-300">
                      {vault.clinician.sub}
                    </code>{" "}
                    ({vault.clinician.name}) • Patient UUID{" "}
                    <code className="font-mono text-slate-200">
                      {vault.patientId}
                    </code>{" "}
                    • Status:{" "}
                    <span className="font-semibold text-amber-300">
                      {vault.status}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Decrypted Patient PHI & Symptom Comparison */}
              <div className="space-y-6 lg:col-span-7">
                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-emerald-400" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                        Decrypted Patient Identity (Vault-Only PHI)
                      </h2>
                    </div>
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                      Never sent to n8n / HubSpot
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <span className="text-[10px] uppercase text-slate-400">
                        Legal Full Name
                      </span>
                      <p className="mt-0.5 text-sm font-semibold text-white">
                        {vault.decryptedPii.firstName}{" "}
                        {vault.decryptedPii.lastName}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <span className="text-[10px] uppercase text-slate-400">
                        Date of Birth
                      </span>
                      <p className="mt-0.5 font-mono text-sm text-white">
                        {vault.decryptedPii.dob}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <span className="text-[10px] uppercase text-slate-400">
                        Insurance Payer
                      </span>
                      <p className="mt-0.5 text-sm font-medium text-emerald-300">
                        {vault.decryptedPii.insuranceProvider}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <span className="text-[10px] uppercase text-slate-400">
                        Email Address
                      </span>
                      <p className="mt-0.5 truncate font-mono text-xs text-slate-200">
                        {vault.decryptedPii.email}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <span className="text-[10px] uppercase text-slate-400">
                        Phone Number
                      </span>
                      <p className="mt-0.5 font-mono text-xs text-slate-200">
                        {vault.decryptedPii.phone}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <span className="text-[10px] uppercase text-slate-400">
                        Member ID
                      </span>
                      <p className="mt-0.5 font-mono text-xs text-amber-300">
                        {vault.decryptedPii.memberId}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-sky-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                      Clinical Symptom Narrative (Decrypted vs. Scrubbed)
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-[11px] font-semibold text-emerald-400">
                        1. Raw Decrypted Narrative (Clinician View Only):
                      </span>
                      <div className="mt-1.5 rounded-xl border border-emerald-500/20 bg-slate-950 p-3.5 text-xs leading-relaxed text-slate-200">
                        {vault.decryptedSymptoms}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400">
                        2. De-Identified Narrative Sent to n8n AI Agent:
                      </span>
                      <div className="mt-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 font-mono text-[11px] leading-relaxed text-slate-400">
                        {vault.scrubbedSymptoms}
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column: AI Triage Card & HITL Approval Action */}
              <div className="space-y-6 lg:col-span-5">
                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-violet-400" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                        AI Clinical Triage & Routing
                      </h2>
                    </div>
                    {vault.aiTriage && (
                      <span className="rounded-md bg-violet-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-violet-300">
                        {vault.aiTriage.urgency_level} URGENCY
                      </span>
                    )}
                  </div>

                  {vault.aiTriage ? (
                    <div className="space-y-3 text-xs">
                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5">
                        <span className="text-[10px] uppercase text-slate-400">
                          AI Clinical Summary
                        </span>
                        <p className="mt-1 text-slate-200">
                          {vault.aiTriage.clinical_summary}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                          <span className="text-[10px] uppercase text-slate-400">
                            Recommended Specialty
                          </span>
                          <p className="mt-0.5 font-semibold text-white">
                            {vault.aiTriage.recommended_specialty}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                          <span className="text-[10px] uppercase text-slate-400">
                            Verified Copay Est.
                          </span>
                          <p className="mt-0.5 font-mono font-semibold text-emerald-300">
                            ${vault.aiTriage.copay_estimate_usd}.00 USD
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      AI triage is still pending or requires manual review.
                    </p>
                  )}

                  {/* HITL Approval Form */}
                  <div className="mt-6 border-t border-slate-800 pt-5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Assign Receiving Specialist for Onboarding
                    </label>
                    <select
                      value={selectedDoctor}
                      onChange={(e) => setSelectedDoctor(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      {SPECIALIST_OPTIONS.map((doc) => (
                        <option key={doc} value={doc}>
                          {doc}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleApprovePatient}
                      disabled={approving}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {approving
                        ? "Generating 48h SHA-256 Token & Triggering n8n #2..."
                        : vault.status === "APPROVED_FOR_ONBOARDING" ||
                          vault.status === "ONBOARDING_COMPLETED"
                        ? "Re-Issue 48h Onboarding Magic Link"
                        : "Approve Triage & Dispatch 48h Onboarding Link"}
                    </button>
                  </div>

                  {/* Magic Link Box once approved */}
                  {onboardingHref && (
                    <div className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" />
                        Single-Use 48h Capability Token Dispatched
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">
                        n8n Workflow #2 triggered{" "}
                        <code className="font-mono text-emerald-300">
                          POST /api/internal/notify
                        </code>{" "}
                        (Blind Notification Dispatch) so patient email never
                        left the local PostgreSQL Vault (`ADR-001`).
                      </p>

                      <Link
                        href={onboardingHref}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-slate-200"
                      >
                        Open 3-Step Patient Onboarding Portal
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* Immutable Audit Log Stream */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-300">
                Append-Only HIPAA Audit Trail (PostgreSQL Trigger Protected)
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 pr-4">Timestamp</th>
                      <th className="pb-2 pr-4">Actor</th>
                      <th className="pb-2 pr-4">Action</th>
                      <th className="pb-2">Metadata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {vault.auditLogs.map((log) => (
                      <tr key={log.id} className="text-slate-300">
                        <td className="py-2 pr-4 text-slate-400">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-emerald-300">
                            {log.actorType}:{log.actorId}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-semibold text-white">
                          {log.action}
                        </td>
                        <td className="py-2 text-slate-400">
                          {JSON.stringify(log.metadataJson)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
