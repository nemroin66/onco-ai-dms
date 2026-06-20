import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCollection } from "../../firebase.js";
import { isPrivilegedRole, vercelUser } from "../../auth.js";
import {
  buildFlatPatientJson,
  buildPatientCsvPackage,
  buildPatientExportColumnTree,
  buildSelectedPatientCsvPackage,
  patientExportFileName,
  type PatientExportMode,
} from "../../patient-export.js";
import { logAudit } from "../../audit.js";

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
    const where = isPrivilegedRole(user.role) ? [] : [{ field: "createdBy", op: "==" as const, value: user.uid }];
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
      const result = await buildSelectedPatientCsvPackage(patients, selected);
      setExportHeaders(res, result.patientCount, result.columnCount);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${patientExportFileName("zip", "selected-flat-csv")}"`);
      await logAudit(user, "patient.export", null, JSON.stringify({ format: "selected-flat-csv", scope: "active-and-deleted", patientCount: result.patientCount, columnCount: result.columnCount }));
      return res.status(200).send(result.buffer);
    }

    const format = String(req.query.format || "flat-csv").toLowerCase();

    if (format === "raw-json" || format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${patientExportFileName("json", "raw-backup")}"`);
      setExportHeaders(res, patients.length, 0);
      await logAudit(user, "patient.export", null, JSON.stringify({ format: "raw-json", scope: "active-and-deleted", patientCount: patients.length }));
      return res.status(200).send(JSON.stringify(patients, null, 2));
    }

    if (format === "flat-json") {
      const result = buildFlatPatientJson(patients);
      setExportHeaders(res, result.patientCount, result.columnCount);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${patientExportFileName("json", "flat-analysis")}"`);
      await logAudit(user, "patient.export", null, JSON.stringify({ format: "flat-json", scope: "active-and-deleted", patientCount: result.patientCount, columnCount: result.columnCount }));
      return res.status(200).send(result.json);
    }

    const result = await buildPatientCsvPackage(patients);
    setExportHeaders(res, result.patientCount, result.columnCount);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${patientExportFileName("zip", "flat-csv")}"`);
    await logAudit(user, "patient.export", null, JSON.stringify({ format: "flat-csv", scope: "active-and-deleted", patientCount: result.patientCount, columnCount: result.columnCount }));
    return res.status(200).send(result.buffer);
  } catch (error: any) {
    console.error("[patients/export] Error:", error?.message || error);
    return res.status(500).json({ error: "Patient export failed." });
  }
}

function setExportHeaders(res: VercelResponse, patientCount: number, columnCount: number) {
  res.setHeader("X-Export-Patient-Count", String(patientCount));
  res.setHeader("X-Export-Column-Count", String(columnCount));
  res.setHeader("X-Export-Excel-Column-Warning", columnCount > 16_384 ? "true" : "false");
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Export-Patient-Count, X-Export-Column-Count, X-Export-Excel-Column-Warning");
}
