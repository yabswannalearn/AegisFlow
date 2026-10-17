export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.AEGIS_OUTBOX_WORKER === "true") {
    const { dispatchPendingOutbox } = await import("./lib/outbox");
    const state = globalThis as typeof globalThis & { aegisWorker?: ReturnType<typeof setInterval> };
    if (!state.aegisWorker) state.aegisWorker = setInterval(() => {
      void dispatchPendingOutbox().catch(() => console.error("AegisFlow outbox unavailable; pending deliveries remain durable"));
    }, 3000).unref();
  }
}
