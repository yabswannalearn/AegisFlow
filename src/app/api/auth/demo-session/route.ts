import { NextResponse } from "next/server";
import {
  CLINICIAN_COOKIE_NAME,
  DEMO_CLINICIAN_PROFILE,
  mintClinicianToken,
} from "@/lib/auth";

export async function POST() {
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
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.delete(CLINICIAN_COOKIE_NAME);
  return response;
}
