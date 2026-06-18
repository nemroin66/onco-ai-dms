import type { VercelRequest, VercelResponse } from "@vercel/node";
import { saveDocument, getFirestoreDoc } from "../../../firebase.js";
import { bumpAnalyticsVersion } from "../../../analytics.js";
import { vercelUser } from "../../../auth.js";
import { logAudit } from "../../../audit.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (req.method === "POST") {
    try {
      const patient = await getFirestoreDoc("patients", id as string);
      if (!patient || !patient.isDeleted) return res.status(404).json({ error: "Deleted patient not found." });

      const user = vercelUser(req);
      if (patient.createdBy && patient.createdBy !== user.uid && user.role !== "admin") {
        return res.status(403).json({ error: "Access denied." });
      }

      await saveDocument("patients", id as string, { ...patient, isDeleted: false, updatedAt: new Date().toISOString() });
      await bumpAnalyticsVersion();
      await logAudit(user, "patient.restore", id as string);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("[handler] Error:", error?.message || error);
      if (error?.stack) console.error(error.stack);
      return res.status(500).json({ error: "Request failed." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
