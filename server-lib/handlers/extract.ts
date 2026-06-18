import type { VercelRequest, VercelResponse } from "@vercel/node";
import { vercelUser } from "../auth.js";
import { getFirestoreDoc } from "../firebase.js";
import { runDocumentFill } from "../document-fill.js";
import { logAudit } from "../audit.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = vercelUser(req);
    const patientId = String(req.body?.patientId || "");
    if (patientId) {
      const patient = await getFirestoreDoc("patients", patientId);
      if (!patient) return res.status(404).json({ error: "Patient record not found." });
      if (patient.createdBy && patient.createdBy !== user.uid && user.role !== "admin") {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    const result = await runDocumentFill(req.body || {});
    await logAudit(user, "document.ai_fill", patientId || null, req.body?.fileName || "clinical-document");
    return res.json(result);
  } catch (error: any) {
    console.error("[document-fill] Error:", error?.message || error);
    if (error?.stack) console.error(error.stack);
    return res.status(error?.status || 500).json({
      error: error?.status ? error.message : "AI document understanding failed.",
    });
  }
}
