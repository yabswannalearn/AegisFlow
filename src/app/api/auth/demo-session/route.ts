import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";
import {
  CLINICIAN_COOKIE_NAME,
  DEMO_CLINICIAN_PROFILE,
  mintClinicianToken,
} from "@/lib/auth";

export async function POST() {
  if (!isDemoMode()) return NextResponse.json({ error: "Demo sessions are disabled" }, { status: 403 });
  const token = await mintClinicianToken(DEMO_CLINICIAN_PROFILE);

  const response = NextResponse.json({
    authenticated: true,
    clinician: DEMO_CLINICIAN_PROFILE,
    expiresIn: "1h",
  });

  response.cookies.set(CLINICIAN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
    secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(CLINICIAN_COOKIE_NAME);
  return response;
}
