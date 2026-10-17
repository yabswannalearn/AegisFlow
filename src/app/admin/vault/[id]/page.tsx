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
  ShieldCheck,
  Lock,
  Unlock,
  UserCheck,
  FileText,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
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
    triage_rationale_redacted: string;
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
    actorRole: string;
    actorId: string;
    action: string;
    ipAddress: string;
    metadata: Record<string, unknown>;
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
  const [approvalError, setApprovalError] = useState<string | null>(null);
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
    setApprovalError(null);
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
      } else {
        setApprovalError((await res.json()).error ?? "Approval failed");
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
    <div className="af-app">
      <WorkspaceHeader
        section="Clinician workspace"
        actions={
          <>
            {vault?.clinician && (
              <span className="af-session">
                <span className="af-dot" />
                {vault.clinician.name}
              </span>
            )}
            <Link
              href="/"
              aria-label="Back to intake"
              className="af-button af-button-quiet"
            >
              <ArrowLeft size={14} />
              <span>Back to intake</span>
            </Link>
            {vault && (
              <button
                className="af-button af-button-secondary"
                onClick={handleSignOut}
              >
                <LogOut size={13} /> Sign out
              </button>
            )}
          </>
        }
      />
      <main className="af-main">
        {loading ? (
          <div className="af-card af-skeleton">
            <Activity size={18} className="animate-pulse" /> Opening the private
            patient record…
          </div>
        ) : unauthorized ? (
          <section className="af-card af-centered">
            <Lock size={35} strokeWidth={1.4} />
            <p className="af-eyebrow" style={{ justifyContent: "center" }}>
              A human decision starts here
            </p>
            <h1>Your clinician workspace</h1>
            <p>
              Sign in to review the synthetic patient’s details, consider the
              routing recommendation, and approve their next step.
            </p>
            <button
              className="af-button af-button-primary af-button-wide"
              onClick={handleDemoClinicianSignIn}
              disabled={signingIn}
            >
              <UserCheck size={16} />
              {signingIn
                ? "Signing in…"
                : "Sign in as Demo Clinician (Dr. Sarah Chen)"}
            </button>
            <p className="af-field-help">
              Demonstration identity · Synthetic patient records only
            </p>
          </section>
        ) : notFound || !vault ? (
          <section className="af-card af-centered">
            <AlertTriangle size={32} />
            <h1>This record isn’t available</h1>
            <p>Return to the intake workspace and submit a new demo case.</p>
            <Link className="af-button af-button-primary" href="/">
              Back to intake <ArrowLeft size={14} />
            </Link>
          </section>
        ) : (
          <>
            <div className="af-page-intro">
              <p className="af-eyebrow">
                Clinician review <span style={{ color: "#c0cce2" }}>/</span>{" "}
                Case {patientId.slice(0, 8)}
              </p>
              <h1 className="af-page-title">A thoughtful next step.</h1>
              <p>
                Review the full picture. You decide how this patient’s journey
                continues.
              </p>
            </div>
            <Journey
              current={
                vault.status === "ONBOARDED" || vault.status === "APPROVED"
                  ? 3
                  : 2
              }
            />
            <div className="af-alert af-alert-info">
              <Unlock size={17} />
              <div>
                <strong>Private details are visible in this session.</strong>
                This view is recorded in the audit history. Only synthetic data
                belongs in this demonstration.
              </div>
            </div>
            {approvalError && (
              <div className="af-alert" role="alert">
                <AlertTriangle size={17} />
                <div>{approvalError}</div>
              </div>
            )}
            {vault.status === "EMERGENCY_HALTED" && (
              <div className="af-alert" role="alert">
                <AlertTriangle size={19} />
                <div>
                  <strong>Emergency escalation — scheduling is paused.</strong>
                  Call 911 or your local emergency service. This case cannot be
                  approved for routine onboarding.
                </div>
              </div>
            )}
            <div className="af-review-grid">
              <div className="af-stack">
                <section className="af-card">
                  <div className="af-card-head">
                    <div className="af-person">
                      <div className="af-avatar">
                        {vault.decryptedPii.firstName[0]}
                        {vault.decryptedPii.lastName[0]}
                      </div>
                      <div>
                        <h2>
                          {vault.decryptedPii.firstName}{" "}
                          {vault.decryptedPii.lastName}
                        </h2>
                        <p>Private patient record · {patientId.slice(0, 8)}</p>
                      </div>
                    </div>
                    <StatusBadge tone="blue">Synthetic</StatusBadge>
                  </div>
                  <div className="af-card-body">
                    <dl className="af-demographics">
                      {[
                        ["Email address", vault.decryptedPii.email],
                        ["Phone number", vault.decryptedPii.phone],
                        ["Date of birth", vault.decryptedPii.dob],
                        [
                          "Insurance provider",
                          vault.decryptedPii.insuranceProvider.replaceAll(
                            "_",
                            " ",
                          ),
                        ],
                        ["Member ID", vault.decryptedPii.memberId],
                        [
                          "Assigned clinician",
                          vault.assignedDoctor ?? "Awaiting your selection",
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
                <section className="af-card">
                  <div className="af-card-head">
                    <h2>In the patient’s words</h2>
                    <FileText size={17} style={{ color: "#8ca2c5" }} />
                  </div>
                  <div className="af-card-body">
                    <p className="af-clinical-note">
                      {vault.decryptedSymptoms}
                    </p>
                    <details className="af-detail">
                      <summary>
                        See the scrubbed version sent for routing
                      </summary>
                      <pre className="af-code">{vault.scrubbedSymptoms}</pre>
                    </details>
                  </div>
                </section>
                <section className="af-card">
                  <div className="af-card-head">
                    <div>
                      <h2>A record of every handoff</h2>
                      <p className="af-card-subtitle">
                        Append-only audit history
                      </p>
                    </div>
                    <span className="af-card-icon">
                      <ShieldCheck size={16} />
                    </span>
                  </div>
                  <div className="af-card-body" style={{ paddingTop: 7 }}>
                    <ul className="af-audit">
                      {vault.auditLogs.map((log) => (
                        <li key={log.id}>
                          <span className="af-dot" />
                          <div>
                            {log.action.replaceAll("_", " ")}
                            <small
                              style={{
                                display: "block",
                                color: "#a1aec2",
                                marginTop: 4,
                              }}
                            >
                              {log.actorId}
                            </small>
                          </div>
                          <time>
                            {new Date(log.createdAt).toLocaleTimeString(
                              undefined,
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </time>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              </div>
              <div className="af-stack">
                <section className="af-card">
                  <div className="af-live-header">
                    <div>
                      <p className="af-eyebrow">
                        <Activity size={12} /> Gemini routing suggestion
                      </p>
                      <h3>
                        {vault.aiTriage?.recommended_specialty ??
                          "Manual review"}
                      </h3>
                    </div>
                    <StatusBadge>
                      {vault.aiTriage?.urgency_level ?? "Review"}
                    </StatusBadge>
                  </div>
                  {vault.aiTriage ? (
                    <>
                      <div className="af-result-grid">
                        <div>
                          <small>Urgency</small>
                          <strong>{vault.aiTriage.urgency_level}</strong>
                        </div>
                        <div>
                          <small>Demo copay</small>
                          <strong>${vault.aiTriage.copay_estimate_usd}</strong>
                        </div>
                        <div>
                          <small>Coverage tool</small>
                          <strong>
                            {vault.aiTriage.insurance_verified
                              ? "Verified"
                              : "Review"}
                          </strong>
                        </div>
                      </div>
                      <p className="af-result-rationale">
                        <strong>Why this route</strong>
                        {vault.aiTriage.triage_rationale_redacted}
                      </p>
                    </>
                  ) : (
                    <div className="af-card-body">
                      <p className="af-card-subtitle">
                        A structured routing result isn’t available. Review the
                        intake before making a decision.
                      </p>
                    </div>
                  )}
                </section>
                <section className="af-card">
                  <div className="af-card-head">
                    <div>
                      <h2>Continue the patient journey</h2>
                      <p className="af-card-subtitle">
                        Your review comes before an invitation.
                      </p>
                    </div>
                  </div>
                  <div className="af-card-body">
                    <Field label="Receiving specialist">
                      <select
                        className="af-input"
                        value={selectedDoctor}
                        onChange={(e) => setSelectedDoctor(e.target.value)}
                        disabled={vault.status === "ONBOARDED"}
                        aria-label="Receiving specialist"
                      >
                        {SPECIALIST_OPTIONS.map((doctor) => (
                          <option key={doctor}>{doctor}</option>
                        ))}
                      </select>
                    </Field>
                    <div style={{ marginTop: 22 }}>
                      <button
                        className="af-button af-button-primary af-button-wide"
                        onClick={handleApprovePatient}
                        disabled={
                          approving ||
                          ["EMERGENCY_HALTED", "ONBOARDED"].includes(
                            vault.status,
                          )
                        }
                      >
                        {approving
                          ? "Preparing invitation…"
                          : vault.status === "ONBOARDED"
                            ? "Onboarding completed"
                            : vault.status === "EMERGENCY_HALTED"
                              ? "Emergency escalation required"
                              : vault.status === "APPROVED"
                                ? "View active invitation"
                                : "Approve & Create Onboarding Invitation"}
                        <ArrowRight size={15} />
                      </button>
                      <p className="af-under-button">
                        <Lock size={10} /> Private invitation · Valid for 48
                        hours
                      </p>
                    </div>
                    {onboardingHref && (
                      <div
                        className="af-alert af-alert-success"
                        style={{ margin: "22px 0 0", display: "block" }}
                      >
                        <CheckCircle2 size={19} />
                        <strong style={{ marginTop: 8 }}>
                          The invitation is ready.
                        </strong>
                        <p style={{ margin: "6px 0 14px", fontSize: 10 }}>
                          Delivery is queued. In the public demo, you can
                          continue directly using the portal below.
                        </p>
                        <Link
                          className="af-button af-button-secondary af-button-wide"
                          href={onboardingHref}
                        >
                          Open 3-Step Patient Onboarding Portal{" "}
                          <ExternalLink size={13} />
                        </Link>
                      </div>
                    )}
                  </div>
                </section>
                <section className="af-card af-evidence">
                  <h3 className="af-panel-heading">
                    <KeyRound size={15} /> Connected, without sharing identity
                  </h3>
                  <p>
                    HubSpot follows the pseudonymous case. Patient details stay
                    in the vault.
                  </p>
                  <div className="af-stat-pair">
                    <div className="af-mini-stat">
                      <span>CONTACT</span>
                      <strong>{vault.hubspotContactId ?? "Pending"}</strong>
                    </div>
                    <div className="af-mini-stat">
                      <span>DEAL</span>
                      <strong>{vault.hubspotDealId ?? "Pending"}</strong>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </main>
      <WorkspaceFooter />
    </div>
  );
}
