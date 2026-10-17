import type { NextRequest } from "next/server";
import { CLINICIAN_COOKIE_NAME, verifyClinicianToken } from "./auth";
import { sha256Hash } from "./crypto";
import { safeEqual } from "./config";

export const INSPECTOR_COOKIE = "aegis_inspector";
export async function canInspect(request: NextRequest, record: { inspectorAccessHash: string | null }) {
  if (await verifyClinicianToken(request.cookies.get(CLINICIAN_COOKIE_NAME)?.value)) return true;
  const token = request.cookies.get(INSPECTOR_COOKIE)?.value;
  return Boolean(token && record.inspectorAccessHash && safeEqual(sha256Hash(token), record.inspectorAccessHash));
}
