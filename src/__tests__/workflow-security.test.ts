import { describe, expect, it } from "vitest";
import fs from "fs";
import vm from "vm";
import crypto from "crypto";
import { signWebhookPayload } from "../lib/hmac";

describe("Exported n8n signature verification", () => {
  const workflow = JSON.parse(fs.readFileSync("n8n/workflows/triage-agent.json", "utf8"));
  const code = workflow.nodes.find((node: { name: string }) => node.name === "Verify HMAC").parameters.jsCode;
  const secret = "synthetic-webhook-test-secret-2026";
  async function verify(body: string, headers: object) {
    return vm.runInNewContext(`(async function(){${code}}).call({helpers:{getBinaryDataBuffer:async()=>Buffer.from(rawBody)}})`, {
      require: (name: string) => { if(name === "crypto") return crypto; throw new Error("Unexpected import"); },
      Buffer, Date, rawBody: body, $input: { first: () => ({ json: { headers } }) }, $env: { AEGIS_WEBHOOK_SECRET: secret },
    });
  }
  it("accepts only signatures over the exact request bytes and rejects unsigned, stale, and tampered requests", async () => {
    const body = JSON.stringify({ patient_uuid: crypto.randomUUID() });
    const headers = signWebhookPayload(body, Math.floor(Date.now()/1000), secret);
    expect((await verify(body,headers))[0].json.authorized).toBe(true);
    expect((await verify(body,{}))[0].json.authorized).toBe(false);
    expect((await verify(body+" ",headers))[0].json.authorized).toBe(false);
    expect((await verify(body,signWebhookPayload(body,1,secret)))[0].json.authorized).toBe(false);
  });
});
