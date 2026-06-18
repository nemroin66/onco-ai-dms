import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirestoreDoc, deleteDocument } from "../../../firebase.js";
import { wipePatientAssets } from "../../../drive.js";
import { bumpAnalyticsVersion } from "../../../analytics.js";
import { vercelUser } from "../../../auth.js";
import { logAudit } from "../../../audit.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (req.method === "DELETE") {
    try {
      const patient = await getFirestoreDoc("patients", id as string);
      if (!patient) return res.status(404).json({ error: "Patient not found." });
      if (!patient.isDeleted) return res.status(400).json({ error: "Patient must be moved to trash before permanent deletion." });

      const user = vercelUser(req);
      if (patient.createdBy && patient.createdBy !== user.uid && user.role !== "admin") {
        return res.status(403).json({ error: "Access denied." });
      }

      await wipePatientAssets(patient);
      await deleteDocument("patients", id as string);
      await bumpAnalyticsVersion();
      await logAudit(user, "patient.permanent_delete", id as string);
      return res.json({ success: true });
    } catch (error: any) {
      console.error("[handler] Error:", error?.message || error);
      if (error?.stack) console.error(error.stack);
      return res.status(500).json({ error: "Request failed." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
