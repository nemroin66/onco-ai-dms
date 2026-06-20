import type { VercelRequest, VercelResponse } from "@vercel/node";
import { saveDocument, getFirestoreDoc, deleteDocument } from "../../../firebase.js";
import { ensureDriveFolder, wipePatientAssets } from "../../../drive.js";
import { bumpAnalyticsVersion } from "../../../analytics.js";
import { vercelUser } from "../../../auth.js";
import { logAudit } from "../../../audit.js";
import { cleanBody, patientSchema } from "../../../validate.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (req.method === "PUT") {
    try {
      const user = vercelUser(req);
      const patient = await getFirestoreDoc("patients", id as string);
      if (!patient) return res.status(404).json({ error: "Patient not found." });
      if (patient.createdBy && patient.createdBy !== user.uid && user.role === "user") {
        return res.status(403).json({ error: "Access denied." });
      }
      const safeBody = cleanBody(req.body);
      const parsed = patientSchema.parse(safeBody);
      const record = { ...parsed, id, createdBy: patient.createdBy || user.uid, updatedAt: new Date().toISOString() };
      record.driveFolderId = await ensureDriveFolder(record);
      const saved = await saveDocument("patients", id as string, record);
      await bumpAnalyticsVersion();
      await logAudit(user, "patient.update", id as string);
      return res.json(saved);
    } catch (error: any) {
      console.error("[handler] Error:", error?.message || error);
      if (error?.stack) console.error(error.stack);
      return res.status(500).json({ error: "Request failed." });
    }
  }

  if (req.method === "DELETE") {
    try {
      const user = vercelUser(req);
      const patient = await getFirestoreDoc("patients", id as string);
      if (!patient) return res.status(404).json({ error: "Patient not found." });
      if (patient.createdBy && patient.createdBy !== user.uid && user.role === "user") {
        return res.status(403).json({ error: "Access denied." });
      }

      if (patient.isDeleted) {
        await wipePatientAssets(patient);
        await deleteDocument("patients", id as string);
        await bumpAnalyticsVersion();
        await logAudit(user, "patient.permanent_delete", id as string);
        return res.json({ success: true, permanent: true });
      } else {
        await saveDocument("patients", id as string, { 
          ...patient, 
          isDeleted: true, 
          updatedAt: new Date().toISOString() 
        });
        await bumpAnalyticsVersion();
        await logAudit(user, "patient.soft_delete", id as string);
        return res.json({ success: true, permanent: false });
      }
    } catch (error: any) {
      console.error("[handler] Error:", error?.message || error);
      if (error?.stack) console.error(error.stack);
      return res.status(500).json({ error: "Request failed." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
