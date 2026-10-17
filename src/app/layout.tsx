import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AegisFlow — Privacy-Focused Gemini Intake & Onboarding Prototype",
  description:
    "Encrypted Patient Intake Prototype (Next.js Vault) + Stateless Workflow Orchestration (Self-Hosted n8n) + HubSpot CRM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
