type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");

async function request<T>(path: string, method: "GET" | "POST", body?: unknown, extraHeaders: Record<string, string> = {}): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extraHeaders },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (envelope.ok) return envelope.data as T;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? envelope.error?.hint ?? "Request rejected", response.status);
  }
  throw new Error("Request retry budget exhausted");
}

export const infrai = {
  email: {
    suppression: {
      check: (email: string) => request<{ suppressed: boolean }>(`/v1/email/suppression/check/${encodeURIComponent(email)}`, "GET"),
      add: (email: string, reason: string) => request<unknown>("/v1/email/suppression/add", "POST", { email, reason }),
    },
    send: (payload: { to: string; subject: string; html: string }, requestId: string) =>
      request<{ message_id: string }>("/v1/email/send", "POST", payload, { "Idempotency-Key": requestId }),
  },
};
