import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCollection } from "../../firebase.js";
import { vercelUser } from "../../auth.js";
import { buildPatientCsv, patientExportFileName } from "../../patient-export.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = vercelUser(req);
    const where = user.role === "admin" ? [] : [{ field: "createdBy", op: "==" as const, value: user.uid }];
    const patients = (await listCollection("patients", { where }))
      .sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    const format = String(req.query.format || "csv").toLowerCase();

    if (format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${patientExportFileName("json")}"`);
      return res.status(200).send(JSON.stringify(patients, null, 2));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${patientExportFileName("csv")}"`);
    return res.status(200).send(buildPatientCsv(patients));
  } catch (error: any) {
    console.error("[patients/export] Error:", error?.message || error);
    return res.status(500).json({ error: "Patient export failed." });
  }
}
