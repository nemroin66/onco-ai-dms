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
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-flash-image-preview",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite-preview-09-2025",
  "gemini-2.5-flash",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.5-pro",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
  "gemini-2.0-pro-exp",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash-exp",
  "gemini-1.5-pro",
  "gemini-1.5-pro-exp",
  "gemini-pro",
  "gemini-1.0-pro",
];

export async function runGemini(contents: any, systemInstruction?: string, responseMimeType?: string) {
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

  const apiVersions = ["v1beta", "v1"];
  let lastError: any;

  // Phase 1: Try each configured model with v1beta then v1
  for (const attempt of attempts) {
    for (const apiVersion of apiVersions) {
      try {
        const ai = new GoogleGenAI({ apiKey: attempt.key, apiVersion });
        const modelName = attempt.model.replace(/^models\//, "");
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: { systemInstruction, responseMimeType },
        });
        return response.text || "";
      } catch (error: any) {
        lastError = error;
      }
    }
  }

  // Phase 2: Discover models via REST API and try each
  for (const attempt of attempts) {
    for (const apiVersion of apiVersions) {
      const discovered = await discoverModelsViaRest(attempt.key, apiVersion);
      for (const model of discovered) {
        try {
          const ai = new GoogleGenAI({ apiKey: attempt.key, apiVersion });
          const response = await ai.models.generateContent({
            model,
            contents,
            config: { systemInstruction, responseMimeType },
          });
          return response.text || "";
        } catch (error: any) {
          lastError = error;
        }
      }
    }
  }

  // Phase 3: Hardcoded comprehensive fallback list
  for (const attempt of attempts) {
    for (const apiVersion of apiVersions) {
      for (const model of FALLBACK_MODELS) {
        try {
          const ai = new GoogleGenAI({ apiKey: attempt.key, apiVersion });
          const response = await ai.models.generateContent({
            model,
            contents,
            config: { systemInstruction, responseMimeType },
          });
          return response.text || "";
        } catch (error: any) {
          lastError = error;
        }
      }
    }
  }

  throw lastError || new Error("No usable Gemini models found.");
}
