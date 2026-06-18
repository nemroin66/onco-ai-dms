import type { VercelRequest, VercelResponse } from "@vercel/node";
import { vercelUser } from "../auth.js";
import { getFirestoreDoc } from "../firebase.js";
import { runDocumentFill } from "../document-fill.js";
import { logAudit } from "../audit.js";

function validateExtractPayload(body: any): { patientId: string; fileContent: string; mimeType: string; fileName: string } {
  const patientId = String(body?.patientId || "");
  const fileContent = String(body?.fileContent || "");
  const mimeType = String(body?.mimeType || "application/pdf");
  const fileName = String(body?.fileName || "document").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  if (fileContent.length > 50 * 1024 * 1024) throw new Error("File content exceeds 50 MB limit.");
  if (!/^[A-Za-z0-9+/=]*$/.test(fileContent.replace(/^data:.*?;base64,/, ""))) throw new Error("Invalid base64 encoding.");
  return { patientId, fileContent, mimeType, fileName };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = vercelUser(req);
    const { patientId, fileContent, mimeType, fileName } = validateExtractPayload(req.body);

    if (patientId) {
      const patient = await getFirestoreDoc("patients", patientId);
      if (!patient) return res.status(404).json({ error: "Patient record not found." });
      if (patient.createdBy && patient.createdBy !== user.uid && user.role !== "admin") {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    const result = await runDocumentFill({ ...req.body, fileContent, mimeType, fileName });
    await logAudit(user, "document.ai_fill", patientId || null, fileName);
    return res.json(result);
  } catch (error: any) {
    console.error("[document-fill] Error:", error?.message || error);
    if (error?.stack) console.error(error.stack);
    const status = error?.status || 500;
    return res.status(error?.status || 500).json({
      error: error?.status ? error.message : "AI document understanding failed.",
      code: error?.code || "",
      retryable: status === 504 || status >= 500,
    });
  }
}
