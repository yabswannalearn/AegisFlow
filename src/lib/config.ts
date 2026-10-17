import crypto from "crypto";

export function isDemoMode() {
  return process.env.AEGIS_DEMO_MODE === "true";
}

export function requiredSecret(name: string, developmentDefault?: string): string {
  const value = process.env[name];
  if (value && value.length >= 24 && !/^(replace|your-|changeme)/i.test(value) && !(process.env.NODE_ENV === "production" && value === developmentDefault)) return value;
  if (process.env.NODE_ENV !== "production" && developmentDefault) return developmentDefault;
  throw new Error(`${name} must be configured with at least 24 characters`);
}

export function safeEqual(left: string | null | undefined, right: string) {
  if (!left) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3005").replace(/\/$/, "");
}
