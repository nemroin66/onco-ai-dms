import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const primaryGeminiKey = process.env.GEMINI_API_KEY_PRIMARY || process.env.GEMINI_API_KEY;
  const secondaryGeminiKey = process.env.GEMINI_API_KEY_SECONDARY;
  const hasActiveKeys = Boolean(primaryGeminiKey || secondaryGeminiKey);

  return res.json({
    status: hasActiveKeys ? "Active" : "No Gemini key configured",
  });
}
