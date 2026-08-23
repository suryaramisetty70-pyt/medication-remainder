export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
  readonly message: string;
  readonly status: number;
  readonly offline: boolean;

  constructor(message: string, status: number, offline = false) {
    super(message);
    this.message = message;
    this.status = status;
    this.offline = offline;
    this.name = "ApiError";
  }
}

const MESSAGES: Record<number, string> = {
  400: "That request wasn't valid. Please check the details and try again.",
  401: "You're not authorised. Please sign in again.",
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  409: "That conflicts with existing data.",
  413: "That file is too large.",
  422: "Some fields need attention before we can save this.",
  429: "Too many requests — give Aegis a moment.",
  500: "The Aegis backend hit an internal error.",
  502: "The Aegis backend is unreachable right now.",
  503: "The Aegis backend is temporarily unavailable.",
};

async function extractError(res: Response): Promise<string> {
  try {
    const data = await res.clone().json();
    const detail = (data as { detail?: unknown; message?: unknown }).detail ?? (data as { message?: unknown }).message;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0] as { msg?: string; loc?: string[] };
      if (first?.msg) return `${first.loc?.slice(-1)[0] ?? "Field"}: ${first.msg}`;
    }
  } catch {
    /* not JSON */
  }
  return MESSAGES[res.status] ?? `Request failed (${res.status}).`;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, timeoutMs = 20_000, headers, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const isForm = body instanceof FormData;

  try {
    const res = await fetch(`${API_BASE}/api${path}`, {
      ...rest,
      signal: controller.signal,
      // NOTE: never set Content-Type for FormData — the browser adds the boundary.
      headers: isForm
        ? { Accept: "application/json", ...headers }
        : { Accept: "application/json", "Content-Type": "application/json", ...headers },
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) throw new ApiError(await extractError(res), res.status);
    if (res.status === 204) return undefined as T;

    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("The request timed out before Aegis could respond.", 408, true);
    }
    throw new ApiError("Unable to connect to the Aegis backend.", 0, true);
  } finally {
    clearTimeout(timer);
  }
}

export async function healthCheck(): Promise<boolean> {
  for (const path of ["/health", "/medications"]) {
    try {
      await request(path, { method: "GET", timeoutMs: 6000 });
      return true;
    } catch (err) {
      if (err instanceof ApiError && !err.offline && err.status !== 404) return true; // server answered
    }
  }
  return false;
}
