import { GoogleGenAI } from "@google/genai";

function geminiConfig() {
  return {
    primaryGeminiKey: process.env.GEMINI_API_KEY_PRIMARY || process.env.GEMINI_API_KEY || "",
    secondaryGeminiKey: process.env.GEMINI_API_KEY_SECONDARY || "",
    primaryGeminiModel: process.env.GEMINI_MODEL_PRIMARY || "gemini-2.5-flash-lite",
    secondaryGeminiModel: process.env.GEMINI_MODEL_SECONDARY || "gemini-2.5-flash-lite",
  };
}

async function discoverModelsViaRest(apiKey: string, apiVersion: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey}`
    );
    const data: any = await response.json();
    if (data.models && Array.isArray(data.models)) {
      return data.models
        .filter((m: any) => m.supportedMethods?.includes("generateContent"))
        .map((m: any) => m.name.replace(/^models\//, ""));
    }
  } catch (_) {
    // REST discovery failed, will use hardcoded fallback
  }
  return [];
}

const FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

interface RunGeminiOptions {
  enableDiscovery?: boolean;
  fallbackModels?: string[];
  models?: string[];
  apiVersions?: string[];
  perAttemptTimeoutMs?: number;
  timeoutMs?: number;
}

function buildConfig(apiVersion: string, systemInstruction?: string, responseMimeType?: string) {
  const config: Record<string, any> = {};
  if (apiVersion === "v1beta") {
    if (systemInstruction) config.systemInstruction = systemInstruction;
    if (responseMimeType) config.responseMimeType = responseMimeType;
  }
  return config;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`${label} timed out.`);
        (error as Error & { status?: number; code?: string }).status = 504;
        (error as Error & { status?: number; code?: string }).code = "ATTEMPT_TIMEOUT";
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

function remainingMs(deadline: number) {
  return Math.max(0, deadline - Date.now());
}

function assertWithinDeadline(deadline: number) {
  if (remainingMs(deadline) <= 1_000) {
    const error = new Error("AI request timed out before a usable Gemini response was returned.");
    (error as Error & { status?: number; code?: string }).status = 504;
    (error as Error & { status?: number; code?: string }).code = "DEADLINE_TIMEOUT";
    throw error;
  }
}

function normalizeGeminiError(error: any) {
  const raw = String(error?.message || error || "");
  let parsed: any = null;
  try {
    parsed = raw.trim().startsWith("{") ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const providerError = parsed?.error || {};
  const status = typeof error?.status === "number" ? error.status : Number(providerError.code || 0);
  const message = String(providerError.message || raw);
  const providerStatus = String(providerError.status || "");
  const retryDelay = providerError.details
    ?.find((detail: any) => String(detail?.["@type"] || "").includes("RetryInfo"))
    ?.retryDelay;
  const retryAfterMs = retryDelay ? Math.max(0, Number.parseFloat(String(retryDelay).replace(/s$/, "")) * 1000) : 0;
  const hasZeroLimit = /limit:\s*0/i.test(message);
  const normalized = error as Error & {
    status?: number;
    code?: string;
    providerStatus?: string;
    retryAfterMs?: number;
    retryable?: boolean;
  };

  if (
    status === 404
    || providerStatus === "NOT_FOUND"
    || /not found for API version|not supported for generateContent/i.test(message)
  ) {
    normalized.status = 502;
    normalized.code = "MODEL_UNAVAILABLE";
    normalized.providerStatus = providerStatus || "NOT_FOUND";
    normalized.message = message;
  }

  if (status === 429 || providerStatus === "RESOURCE_EXHAUSTED") {
    normalized.status = hasZeroLimit ? 502 : 429;
    normalized.code = hasZeroLimit ? "MODEL_FREE_TIER_UNAVAILABLE" : "RATE_LIMITED";
    normalized.providerStatus = providerStatus || "RESOURCE_EXHAUSTED";
    normalized.retryAfterMs = retryAfterMs;
    normalized.retryable = hasZeroLimit || retryAfterMs > 0;
    normalized.message = hasZeroLimit
      ? "This Gemini model has no usable free-tier quota for the current API project. Trying another extraction model."
      : `Gemini rate limit reached. Retry after ${Math.max(1, Math.ceil(retryAfterMs / 1000))} seconds.`;
  }

  return normalized;
}

export async function runGemini(
  contents: any,
  systemInstruction?: string,
  responseMimeType?: string,
  options: RunGeminiOptions = {}
) {
  const {
    primaryGeminiKey,
    secondaryGeminiKey,
    primaryGeminiModel,
    secondaryGeminiModel,
  } = geminiConfig();
  const attempts = [
    { key: primaryGeminiKey, model: primaryGeminiModel },
    { key: secondaryGeminiKey, model: secondaryGeminiModel },
  ].filter((x) => x.key);

  if (attempts.length === 0) {
    throw new Error("No Gemini API keys configured.");
  }

  const apiVersions = options.apiVersions?.length ? options.apiVersions : ["v1beta", "v1"];
  const configuredAttempts = options.models?.length
    ? attempts.flatMap((attempt) =>
        Array.from(new Set(options.models)).map((model) => ({ key: attempt.key, model }))
      )
    : attempts;
  let lastError: any;
  const deadline = Date.now() + (options.timeoutMs || 55_000);
  const perAttemptTimeoutMs = options.perAttemptTimeoutMs || 25_000;

  const generate = async (apiKey: string, apiVersion: string, model: string) => {
    assertWithinDeadline(deadline);
    const ai = new GoogleGenAI({ apiKey, apiVersion });
    const availableMs = Math.min(perAttemptTimeoutMs, remainingMs(deadline) - 500);
    return withTimeout(
      ai.models.generateContent({
        model: model.replace(/^models\//, ""),
        contents,
        config: buildConfig(apiVersion, systemInstruction, responseMimeType),
      }),
      Math.max(1_000, availableMs),
      `Gemini ${model}`
    );
  };

  // Phase 1: Try configured or caller-provided models first.
  for (const attempt of configuredAttempts) {
    for (const apiVersion of apiVersions) {
      try {
        const response = await generate(attempt.key, apiVersion, attempt.model);
        return response.text || "";
      } catch (error: any) {
        lastError = normalizeGeminiError(error);
        if (error?.code === "DEADLINE_TIMEOUT") throw error;
      }
    }
  }

  // Phase 2: Discover models via REST API and try each
  if (options.enableDiscovery !== false) {
    for (const attempt of attempts) {
      for (const apiVersion of apiVersions) {
        assertWithinDeadline(deadline);
        const discovered = await withTimeout(
          discoverModelsViaRest(attempt.key, apiVersion),
          Math.min(5_000, Math.max(1_000, remainingMs(deadline) - 500)),
          "Gemini model discovery"
        );
        for (const model of discovered) {
          try {
            const response = await generate(attempt.key, apiVersion, model);
            return response.text || "";
          } catch (error: any) {
            lastError = normalizeGeminiError(error);
            if (error?.code === "DEADLINE_TIMEOUT") throw error;
          }
        }
      }
    }
  }

  // Phase 3: Hardcoded comprehensive fallback list
  const fallbackModels = options.fallbackModels || FALLBACK_MODELS;
  for (const attempt of attempts) {
    for (const apiVersion of apiVersions) {
      for (const model of fallbackModels) {
        try {
          const response = await generate(attempt.key, apiVersion, model);
          return response.text || "";
        } catch (error: any) {
          lastError = normalizeGeminiError(error);
          if (error?.code === "DEADLINE_TIMEOUT") throw error;
        }
      }
    }
  }

  throw lastError || new Error("No usable Gemini models found.");
}
