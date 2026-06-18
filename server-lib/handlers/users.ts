import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestoreDoc } from "../firebase.js";
import { vercelUser } from "../auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = vercelUser(req);
    const profile = await getFirestoreDoc("users", user.uid);
    return res.json(profile || { name: user.name, email: user.email, role: user.role });
  } catch (error: any) {
    console.error("[users] Error:", error?.message || error);
    return res.status(500).json({ error: "Failed to load profile." });
  }
}
