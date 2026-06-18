import { getAccessToken } from "./auth";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/** Structured error from API calls with status code and parsed body. */
export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: any;

  constructor(status: number, statusText: string, body?: any) {
    const msg =
      body?.error || body?.message || `Request failed (${status} ${statusText})`;
    super(msg);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

interface ApiFetchOptions extends RequestInit {
  /** Max retries for transient failures (default 0). GET requests default 1. */
  retries?: number;
  /** Whether to retry on 5xx / network errors (default true when retries>0). */
  retryOn5xx?: boolean;
  /** Timeout in ms (default 120000). Set 0 to wait for the server/provider response. */
  timeout?: number;
}

/** Internal fetch with optional retry. Returns raw Response (backward compat). */
export async function apiFetch(
  path: string,
  options?: ApiFetchOptions,
): Promise<Response> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : "/" + path}`;
  const token = await getAccessToken();
  const headers = new Headers(options?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = (options?.method || "GET").toUpperCase();
  const maxRetries = options?.retries ?? (method === "GET" ? 1 : 0);
  const retryOn5xx = options?.retryOn5xx ?? true;
  const timeout = options?.timeout ?? 120_000;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = timeout > 0 ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller?.signal,
      });

      if (timer) clearTimeout(timer);

      // Success — return raw Response for backward compat
      if (response.ok) return response;

      // 4xx — don't retry client errors (unless retryOn5xx only)
      if (response.status < 500) {
        const body = await safeParseJson(response);
        throw new ApiError(response.status, response.statusText, body);
      }

      // 5xx — retry if configured
      if (attempt < maxRetries && retryOn5xx) {
        await delay(1000 * Math.pow(2, attempt)); // exponential backoff
        continue;
      }

      const body = await safeParseJson(response);
      throw new ApiError(response.status, response.statusText, body);
    } catch (err: any) {
      lastError = err;

      // Abort = timeout
      if (err?.name === "AbortError") {
        lastError = new ApiError(0, "Timeout", {
          error: `Request timed out after ${timeout}ms`,
        });
      }

      // Network errors — retry if attempts remain
      if (attempt < maxRetries && !(lastError instanceof ApiError)) {
        await delay(1000 * Math.pow(2, attempt));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error("Unexpected fetch error");
}

/** Convenience: returns parsed JSON data, throws ApiError on failure. */
export async function apiFetchJson<T = any>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T> {
  const response = await apiFetch(path, options);
  // apiFetch already throws on non-ok, so response.ok is guaranteed here
  return response.json();
}

// Helpers

async function safeParseJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
