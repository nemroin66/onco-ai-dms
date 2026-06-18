import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCollection, deleteDocument } from "../../firebase.js";
import { wipePatientAssets } from "../../drive.js";
import { bumpAnalyticsVersion } from "../../analytics.js";
import { vercelUser } from "../../auth.js";
import { logAudit } from "../../audit.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    try {
      const user = vercelUser(req);
      const where: { field: string; op: any; value: any }[] = [{ field: "isDeleted", op: "==", value: true }];
      if (user.role !== "admin") where.push({ field: "createdBy", op: "==", value: user.uid });
      let patients = await listCollection("patients", { where });
      patients.sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      return res.json(patients);
    } catch (error: any) {
      console.error("[handler] Error:", error?.message || error);
      if (error?.stack) console.error(error.stack);
      return res.status(500).json({ error: "Request failed." });
    }
  }

  if (req.method === "POST") {
    try {
      const user = vercelUser(req);
      if (user.role !== "admin") return res.status(403).json({ error: "Admin access required." });
      const patients = await listCollection("patients");
      const deletedPatients = patients.filter((p: any) => p.isDeleted);

      for (const patient of deletedPatients) {
        await wipePatientAssets(patient);
        await deleteDocument("patients", patient.id);
      }

      await bumpAnalyticsVersion();
      await logAudit(user, "trash.clear_all");
      return res.json({ success: true });
    } catch (error: any) {
      console.error("[handler] Error:", error?.message || error);
      if (error?.stack) console.error(error.stack);
      return res.status(500).json({ error: "Request failed." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
