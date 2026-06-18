import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCollection, saveDocument, getFirestoreDoc } from "../firebase.js";
import { ensureDriveFolder, uploadToDrive } from "../drive.js";
import { vercelUser } from "../auth.js";
import { logAudit } from "../audit.js";
import crypto from "crypto";

function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    try {
      const user = vercelUser(req);
      // Project only needed fields — reduces payload 5-10x vs full documents
      const FILE_FIELDS = ["id", "patientId", "name", "mimeType", "size", "uploadDate", "driveFileId", "webViewLink", "webContentLink", "driveFolderId"];
      const files = await listCollection("files", { select: FILE_FIELDS });
      const patientWhere: { field: string; op: any; value: any }[] = [];
      if (user.role !== "admin") patientWhere.push({ field: "createdBy", op: "==", value: user.uid });
      const allPatients = (await listCollection("patients", { where: patientWhere, select: ["id", "createdBy", "isDeleted"] })).filter((p: any) => p.isDeleted !== true);
      const visiblePatientIds = new Set(allPatients.map((p: any) => p.id));
      return res.json(files.filter((f: any) => visiblePatientIds.has(f.patientId)));
    } catch (error: any) {
      console.error("[handler] Error:", error?.message || error);
      if (error?.stack) console.error(error.stack);
      return res.status(500).json({ error: "Request failed." });
    }
  }

  if (req.method === "POST") {
    try {
      const user = vercelUser(req);
      const patient = await getFirestoreDoc("patients", req.body.patientId);
      if (!patient) return res.status(404).json({ error: "Patient record not found." });
      if (patient.createdBy && patient.createdBy !== user.uid && user.role !== "admin") {
        return res.status(403).json({ error: "Access denied." });
      }
      
      const folderId = await ensureDriveFolder(patient);
      const driveFile = await uploadToDrive(req.body, folderId);
      
      const id = newId("file");
      const metadata = {
        id,
        patientId: req.body.patientId,
        name: req.body.name,
        mimeType: req.body.mimeType,
        size: Number(driveFile.size || req.body.size || 0),
        uploadDate: new Date().toISOString().split("T")[0],
        driveFileId: driveFile.id,
        driveFolderId: folderId,
        webViewLink: driveFile.webViewLink || "",
        webContentLink: driveFile.webContentLink || "",
      };
      
      const saved = await saveDocument("files", id, metadata);
      await logAudit(user, "file.upload", req.body.patientId, metadata.name);
      return res.json(saved);
    } catch (error: any) {
      console.error("[handler] Error:", error?.message || error);
      if (error?.stack) console.error(error.stack);
      return res.status(500).json({ error: "Request failed." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
