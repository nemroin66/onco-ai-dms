import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../firebase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const col = db().collection("patients");
    const [activeSnap, deletedSnap] = await Promise.all([
      col.where("isDeleted", "==", false).count().get(),
      col.where("isDeleted", "==", true).count().get(),
    ]);
    return res.json({ active: activeSnap.data().count, deleted: deletedSnap.data().count, total: activeSnap.data().count + deletedSnap.data().count });
  } catch (error: any) {
    console.error("[count] Error:", error?.message || error);
    return res.status(500).json({ error: "Count request failed." });
  }
}
