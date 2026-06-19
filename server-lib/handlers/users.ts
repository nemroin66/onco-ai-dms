import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestoreDoc, saveDocument } from "../firebase.js";
import { vercelUser } from "../auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = vercelUser(req);

    if (req.method === "GET") {
      const profile = await getFirestoreDoc("users", user.uid);
      return res.json(profile || { name: user.name, email: user.email, role: user.role });
    }

    if (req.method === "PATCH") {
      const { name } = req.body || {};
      if (name !== undefined && (typeof name !== "string" || !name.trim())) {
        return res.status(400).json({ error: "Name must be a non-empty string." });
      }
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update." });
      }
      await saveDocument("users", user.uid, updates);
      return res.json({ ...updates });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("[users] Error:", error?.message || error);
    return res.status(500).json({ error: "Failed to process request." });
  }
}
