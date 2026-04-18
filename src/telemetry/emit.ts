const TRACER_URL = process.env.NEURUH_TRACER_URL || "http://localhost:8787/emit";

export async function emit(
  asset_id: string,
  caller?: string,
  op: string = "invoke",
  ms?: number,
  trace_id?: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    await fetch(TRACER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id, caller, op, ms, trace_id, meta }),
      signal: AbortSignal.timeout(500),
    });
  } catch {}
}

export async function traced<T>(
  asset_id: string,
  op: string,
  fn: () => Promise<T> | T,
  caller?: string,
): Promise<T> {
  const t0 = Date.now();
  const trace_id = Math.random().toString(36).slice(2, 14);
  try {
    return await fn();
  } finally {
    emit(asset_id, caller, op, Date.now() - t0, trace_id);
  }
}
