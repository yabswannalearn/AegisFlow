import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

afterEach(() => vi.unstubAllEnvs());
describe("Public origin behind a container or reverse proxy", () => {
  it("accepts the configured browser origin despite a different internal listener", () => {
    vi.stubEnv("AEGIS_ALLOWED_ORIGIN", "http://localhost:3005");
    const request = new NextRequest("http://app:3000/api/intake", {
      method: "POST", headers: { origin: "http://localhost:3005", host: "localhost:3005" },
    });
    expect(middleware(request).status).toBe(200);
  });
  it("rejects a cross-site origin even when forwarding headers claim a trusted host", () => {
    vi.stubEnv("AEGIS_ALLOWED_ORIGIN", "https://demo.example.com");
    const request = new NextRequest("http://app:3000/api/intake", {
      method: "POST", headers: { origin: "https://attacker.example", host: "demo.example.com", "x-forwarded-host": "attacker.example" },
    });
    expect(middleware(request).status).toBe(403);
  });
});
