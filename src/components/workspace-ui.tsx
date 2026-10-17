import Link from "next/link";
import {
  ShieldCheck,
  ArrowUpRight,
  Check,
  LockKeyhole,
  BrainCircuit,
  UserRoundCheck,
  CalendarCheck2,
} from "lucide-react";
import type { ReactNode } from "react";

export function WorkspaceHeader({
  section = "Intake workspace",
  actions,
}: {
  section?: string;
  actions?: ReactNode;
}) {
  return (
    <>
      <div className="af-notice">
        <span className="af-dot" /> Portfolio demonstration{" "}
        <span className="af-notice-divider">/</span> Synthetic data only
      </div>
      <header className="af-header">
        <div className="af-header-inner">
          <Link href="/" className="af-brand" aria-label="AegisFlow home">
            <span className="af-brand-mark">
              <ShieldCheck size={23} strokeWidth={1.8} />
            </span>
            <span>
              Aegis<span className="af-brand-light">Flow</span>
              <small>Thoughtfully connected care</small>
            </span>
          </Link>
          <div className="af-nav-location">
            <span className="af-dot" />
            {section}
          </div>
          <div className="af-header-actions">
            {actions ?? (
              <Link href="/" className="af-button af-button-quiet">
                Intake workspace <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

const journey = [
  { label: "Intake", detail: "A secure beginning", Icon: LockKeyhole },
  { label: "AI routing", detail: "Gemini + guided tools", Icon: BrainCircuit },
  {
    label: "Clinician review",
    detail: "A human decision",
    Icon: UserRoundCheck,
  },
  {
    label: "Onboarding",
    detail: "One seamless next step",
    Icon: CalendarCheck2,
  },
];
export function Journey({ current = 0 }: { current?: number }) {
  return (
    <ol className="af-journey" aria-label="Intake workflow">
      {journey.map(({ label, detail, Icon }, i) => (
        <li
          key={label}
          className={
            i === current ? "is-current" : i < current ? "is-complete" : ""
          }
        >
          <span className="af-journey-icon">
            {i < current ? <Check size={17} /> : <Icon size={18} />}
          </span>
          <div>
            <strong>{label}</strong>
            <small>{detail}</small>
          </div>
          <span className="af-journey-line" />
        </li>
      ))}
    </ol>
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`af-field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "blue";
}) {
  return (
    <span className={`af-badge af-badge-${tone}`}>
      <span className="af-dot" />
      {children}
    </span>
  );
}

export function WorkspaceFooter() {
  return (
    <footer className="af-footer">
      <span>
        AegisFlow <span className="af-footer-sep">/</span> A little more
        clarity. At every step.
      </span>
      <span>Synthetic portfolio demo · Not a clinical service</span>
    </footer>
  );
}
