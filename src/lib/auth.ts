import { SignJWT, jwtVerify } from "jose";

export const CLINICIAN_COOKIE_NAME = "aegis_clinician_session";
const DEFAULT_JWT_SECRET = "aegis-dev-clinician-rbac-jwt-secret-key-2026";

export interface ClinicianSessionPayload {
  sub: string;
  name: string;
  specialty: string;
  role: "CLINICIAN";
}

export const DEMO_CLINICIAN_PROFILE: ClinicianSessionPayload = {
  sub: "dr_chen_demo",
  name: "Dr. Sarah Chen, MD",
  specialty: "Cardiology & Internal Medicine",
  role: "CLINICIAN",
};

function getJwtSecretKey(overrideSecret?: string): Uint8Array {
  const secret =
    overrideSecret ?? process.env.JWT_RBAC_SECRET ?? DEFAULT_JWT_SECRET;
  return new TextEncoder().encode(secret);
}

/**
 * Mints a cryptographically signed 1-hour JWT for Clinician RBAC (ADR-006).
 * Defaults to the 1-click Demo Clinician profile (`dr_chen_demo`).
 */
export async function mintClinicianToken(
  clinician: ClinicianSessionPayload = DEMO_CLINICIAN_PROFILE,
  overrideSecret?: string
): Promise<string> {
  const secretKey = getJwtSecretKey(overrideSecret);
  return await new SignJWT({
    name: clinician.name,
    specialty: clinician.specialty,
    role: clinician.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(clinician.sub)
    .setIssuedAt()
    .setIssuer("aegisflow:rbac")
    .setExpirationTime("1h")
    .sign(secretKey);
}

/**
 * Verifies a Clinician RBAC JWT token and ensures `role === "CLINICIAN"`.
 */
export async function verifyClinicianToken(
  token: string | undefined | null,
  overrideSecret?: string
): Promise<ClinicianSessionPayload | null> {
  if (!token) return null;
  try {
    const secretKey = getJwtSecretKey(overrideSecret);
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: "aegisflow:rbac",
    });

    if (payload.role !== "CLINICIAN" || typeof payload.sub !== "string") {
      return null;
    }

    return {
      sub: payload.sub,
      name:
        typeof payload.name === "string"
          ? payload.name
          : DEMO_CLINICIAN_PROFILE.name,
      specialty:
        typeof payload.specialty === "string"
          ? payload.specialty
          : DEMO_CLINICIAN_PROFILE.specialty,
      role: "CLINICIAN",
    };
  } catch {
    return null;
  }
}
