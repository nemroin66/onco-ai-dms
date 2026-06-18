import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCollection, saveDocument, getFirestoreDoc, db } from "../firebase.js";
import { ensureDriveFolder } from "../drive.js";
import { bumpAnalyticsVersion } from "../analytics.js";
import { vercelUser } from "../auth.js";
import { logAudit } from "../audit.js";
import { cleanBody, patientSchema } from "../validate.js";
import crypto from "crypto";

function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    try {
      const user = vercelUser(req);
      const includeDeleted = String(req.query.includeDeleted || "").toLowerCase() === "true" || String(req.query.includeDeleted || "").trim() === "1";
      const searchQuery = String(req.query.search || "").trim().toLowerCase();
      const isSearch = !!searchQuery;
      const oncologyFilter = String(req.query.oncology || "").trim();
      const bhtFilter = String(req.query.bht || "").trim();
      const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 5000);

      const where: { field: string; op: any; value: any }[] = [];
      if (user.role !== "admin") where.push({ field: "createdBy", op: "==", value: user.uid });
      if (oncologyFilter) where.push({ field: "oncology", op: "==", value: oncologyFilter });
      if (bhtFilter) where.push({ field: "bht", op: "==", value: bhtFilter });

      let patients: Record<string, any>[];
      if (isSearch) {
        patients = await listCollection("patients", { where });
      } else {
        const queryLimit = includeDeleted ? limit : Math.min(limit * 2, 5000);
        try {
          patients = await listCollection("patients", { where, orderBy: "updatedAt desc", limit: queryLimit });
        } catch (error: any) {
          console.warn("[patients] Falling back to in-memory ordering:", error?.message || error);
          patients = await listCollection("patients", { where });
        }
      }

      // Filter isDeleted in-memory to support docs missing the field
      if (!includeDeleted) {
        patients = patients.filter((p: any) => p.isDeleted !== true);
      }

      if (isSearch) {
        const terms = searchQuery.split(/\s+/).filter(Boolean);
        const scored = patients.map((p: any) => {
          const textBlob = [
            p.title, p.first_name, p.last_name, p.initials,
            p.auto_id, p.nic, p.tp, p.bht, p.clinic, p.hospital, p.ward_no,
          ].filter(Boolean).map((v: any) => String(v).toLowerCase()).join(" ");
          const score = terms.filter((t: string) => textBlob.includes(t)).length;
          return { patient: p, score };
        });
        patients = scored.filter((s: any) => s.score > 0)
          .sort((a: any, b: any) => b.score - a.score)
          .map((s: any) => s.patient)
          .slice(0, limit);
      } else {
        if (patients.length > limit) {
          patients.sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
        }
        patients = patients.slice(0, limit);
      }

      return res.json(patients);
    } catch (error: any) {
      console.error("[handler] Error:", error?.message || error);
      if (error?.stack) console.error(error.stack);
      return res.status(500).json({ error: "Request failed." });
    }
  }

  if (req.method === "POST") {
    try {
      const safeBody = cleanBody(req.body);
      const parsed = patientSchema.parse(safeBody);
      const id = parsed.id || newId("pat");
      const now = new Date().toISOString();
      const user = vercelUser(req);

      let auto_id = parsed.auto_id;
      if (!auto_id) {
        const countSnap = await db().collection("patients").count().get();
        const count = countSnap.data().count || 0;
        auto_id = `PT-${String(count + 1).padStart(3, "0")}`;
      }

      const record = {
        ...parsed,
        id,
        createdBy: user.uid,
        auto_id,
        isDeleted: false,
        createdAt: parsed.createdAt || now,
        updatedAt: now,
      };
      record.driveFolderId = await ensureDriveFolder(record);
      const saved = await saveDocument("patients", id, record);
      await bumpAnalyticsVersion();
      await logAudit(user, "patient.create", id);
      return res.json(saved);
    } catch (error: any) {
      console.error("[handler] Error:", error?.message || error);
      if (error?.stack) console.error(error.stack);
      return res.status(500).json({ error: "Request failed." });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
