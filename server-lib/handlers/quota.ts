import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const primaryGeminiKey = process.env.GEMINI_API_KEY_PRIMARY || process.env.GEMINI_API_KEY;
  const secondaryGeminiKey = process.env.GEMINI_API_KEY_SECONDARY;
  const pooledGeminiKeys = String(process.env.GEMINI_API_KEYS || "").split(",");
  const configuredKeys = [primaryGeminiKey, secondaryGeminiKey, ...pooledGeminiKeys]
    .map((key) => String(key || "").trim())
    .filter(Boolean);
  const uniqueKeyCount = new Set(configuredKeys).size;
  const hasActiveKeys = uniqueKeyCount > 0;

  return res.json({
    status: hasActiveKeys ? "Active" : "No Gemini key configured",
    configuredKeyCount: configuredKeys.length,
    uniqueKeyCount,
    duplicateKeysDetected: configuredKeys.length !== uniqueKeyCount,
  });
}
