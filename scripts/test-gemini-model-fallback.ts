import assert from "node:assert/strict";
import {
  GEMINI_EXTRACTION_FALLBACK_MODELS,
  isUsableExtractionModelName,
  modelSupportsGenerateContent,
  orderGeminiExtractionModels,
} from "../server-lib/gemini.js";

assert.ok(GEMINI_EXTRACTION_FALLBACK_MODELS.includes("gemini-3.5-flash"));
assert.ok(GEMINI_EXTRACTION_FALLBACK_MODELS.includes("gemini-3.1-flash-lite"));
assert.ok(GEMINI_EXTRACTION_FALLBACK_MODELS.includes("gemini-2.5-flash"));
assert.ok(GEMINI_EXTRACTION_FALLBACK_MODELS.includes("gemini-2.0-flash"));
assert.ok(GEMINI_EXTRACTION_FALLBACK_MODELS.includes("gemini-1.5-flash"));

assert.equal(isUsableExtractionModelName("models/gemini-3.5-flash"), true);
assert.equal(isUsableExtractionModelName("gemini-3.1-pro-preview"), true);
assert.equal(isUsableExtractionModelName("gemini-2.5-flash-lite"), true);
assert.equal(isUsableExtractionModelName("gemini-embedding-001"), false);
assert.equal(isUsableExtractionModelName("gemini-3.1-flash-tts-preview"), false);
assert.equal(isUsableExtractionModelName("gemini-3.1-flash-live-preview"), false);
assert.equal(isUsableExtractionModelName("gemini-3.1-flash-image-preview"), false);
assert.equal(isUsableExtractionModelName("imagen-4.0-generate-001"), false);
assert.equal(isUsableExtractionModelName("veo-3.1-generate-preview"), false);
assert.equal(isUsableExtractionModelName("gemma-3n-e4b-it"), false);

assert.equal(modelSupportsGenerateContent({ supportedMethods: ["generateContent"] }), true);
assert.equal(modelSupportsGenerateContent({ supportedGenerationMethods: ["generateContent"] }), true);
assert.equal(modelSupportsGenerateContent({ supportedGenerationMethods: ["embedContent"] }), false);

assert.deepEqual(
  orderGeminiExtractionModels([
    "models/gemini-2.5-flash",
    "models/gemini-embedding-001",
    "models/gemini-3.5-flash",
    "models/gemini-3.5-flash",
    "models/gemini-3.1-flash-image-preview",
  ]),
  ["gemini-3.5-flash", "gemini-2.5-flash"]
);

console.log("Gemini extraction fallback model selector passed.");
