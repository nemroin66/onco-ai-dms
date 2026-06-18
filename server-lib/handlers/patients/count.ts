import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../firebase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const col = db().collection("patients");
    const [totalSnap, deletedSnap] = await Promise.all([
      col.count().get(),
      col.where("isDeleted", "==", true).count().get(),
    ]);
    const total = totalSnap.data().count;
    const deleted = deletedSnap.data().count;
    return res.json({ active: total - deleted, deleted, total });
  } catch (error: any) {
    console.error("[count] Error:", error?.message || error);
    return res.status(500).json({ error: "Count request failed." });
  }
}
