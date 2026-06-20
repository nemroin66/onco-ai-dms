import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../firebase.js";
import { vercelUser } from "../../auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = vercelUser(req);
    const isAdmin = user.role !== "user";
    const [totalSnap, deletedSnap] = await Promise.all([
      db().collection("patients").count().get(),
      db().collection("patients").where("isDeleted", "==", true).count().get(),
    ]);
    const total = totalSnap.data().count;
    const deleted = deletedSnap.data().count;
    // Non-admin users see only their own patients; admin sees all
    if (isAdmin) {
      return res.json({ active: total - deleted, deleted, total });
    }
    const userTotalSnap = await db().collection("patients").where("createdBy", "==", user.uid).count().get();
    const userDeletedSnap = await db().collection("patients").where("createdBy", "==", user.uid).where("isDeleted", "==", true).count().get();
    const userTotal = userTotalSnap.data().count;
    const userDeleted = userDeletedSnap.data().count;
    return res.json({ active: userTotal - userDeleted, deleted: userDeleted, total: userTotal });
  } catch (error: any) {
    console.error("[count] Error:", error?.message || error);
    return res.status(500).json({ error: "Count request failed." });
  }
}
