import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCollection } from "../../firebase.js";
import { vercelUser } from "../../auth.js";
import {
  buildPatientCsv,
  buildPatientExportColumnTree,
  buildSelectedPatientCsv,
  patientExportFileName,
  type PatientExportMode,
} from "../../patient-export.js";

function parseSelectedExportBody(body: any) {
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const mode: PatientExportMode = body?.mode === "table-row" ? "table-row" : "patient-wide";
  const columns = Array.isArray(body?.columns)
    ? body.columns.map((column: unknown) => String(column || "").trim()).filter(Boolean)
    : [];
  const rowSource = String(body?.rowSource || "").trim();
  return { mode, columns, rowSource };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = vercelUser(req);
    const where = user.role === "admin" ? [] : [{ field: "createdBy", op: "==" as const, value: user.uid }];
    const patients = (await listCollection("patients", { where }))
      .sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    if (String(req.query.exportPath || "") === "columns") {
      return res.status(200).json(buildPatientExportColumnTree(patients));
    }

    if (req.method === "POST") {
      const selected = parseSelectedExportBody(req.body || {});
      if (!selected.columns.length) {
        return res.status(400).json({ error: "Select at least one CSV column before exporting." });
      }
      if (selected.mode === "table-row" && !selected.rowSource) {
        return res.status(400).json({ error: "Select one repeatable table source for table-row CSV export." });
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${patientExportFileName("csv")}"`);
      return res.status(200).send(buildSelectedPatientCsv(patients, selected));
    }

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
