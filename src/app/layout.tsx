import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AegisFlow — HIPAA-Compliant AI Patient Intake, Triage & HubSpot Engine",
  description:
    "Zero-PHI Hybrid Security Gateway (Next.js Vault) + Stateless Workflow Orchestration (Self-Hosted n8n) + HubSpot CRM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}
