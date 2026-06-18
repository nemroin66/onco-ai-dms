/**
 * One-shot import: pancreas registry Excel → Firestore patients collection.
 *
 * Common fields map to PatientRecord. Pancreas-specific fields stored
 * in `pancreas_data` map on each document.
 *
 * Usage:
 *   npx tsx scripts/import-pancreas-excel.ts
 */

import * as XLSX from "xlsx";
import path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

const EXCEL_PATH = path.resolve(process.env.HOME || "/Users/nemroin", "Downloads/Patient database Copy 1 (1)-2-1.xlsx");

function ensureAdminApp() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON env var required");
    const sa = JSON.parse(raw);
    initializeApp({
      credential: cert(sa),
      projectId: process.env.FIREBASE_WEB_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || sa.project_id,
    });
  }
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

// Map Excel column index to key path
// Row 1 = group header, Row 2 = sub-header
function buildColumnMap(sheet: XLSX.WorkSheet): string[] {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:CB2");
  const headers: string[] = [];
  const row1: string[] = [];
  const row2: string[] = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr1 = XLSX.utils.encode_cell({ r: 0, c });
    const addr2 = XLSX.utils.encode_cell({ r: 1, c });
    const v1 = (sheet[addr1]?.v ?? "") as string;
    const v2 = (sheet[addr2]?.v ?? "") as string;
    row1.push(String(v1));
    row2.push(String(v2));
  }

  for (let c = 0; c < row1.length; c++) {
    const group = row1[c] ? String(row1[c]).trim() : "";
    const sub = row2[c] ? String(row2[c]).trim() : "";
    const key = group && sub && group !== sub ? `${group}.${sub}` : (group || sub);
    headers.push(key);
  }
  return headers;
}

// Top-level keys that map to PatientRecord fields
const COMMON_KEYS = new Set([
  "Date", "Name", "Age", "Gender", "BHT", "Clinic file no",
  "Contact No", "Hospital", "Co-morbidities", "Past surgery",
  "Family History", "Social history",
]);

// Date columns
const DATE_KEYS = new Set(["Date", "Surgery Date"]);

function parseRow(row: any[], colMap: string[]): { common: Record<string, any>; pancreas_data: Record<string, any>; date: string } {
  const common: Record<string, any> = {};
  const pancreas_data: Record<string, any> = {};
  let date = "";

  for (let c = 0; c < row.length && c < colMap.length; c++) {
    const key = colMap[c];
    if (!key) continue;
    let val = row[c];

    // Handle dates
    if (DATE_KEYS.has(key)) {
      if (val instanceof Date) {
        val = val.toISOString().split("T")[0];
      }
    }

    if (COMMON_KEYS.has(key)) {
      if (key === "Date") date = val || "";
      else if (key === "Name") common["first_name"] = val || "";
      else if (key === "BHT") common["bht"] = String(val || "");
      else if (key === "Clinic file no") common["clinic"] = String(val || "");
      else if (key === "Contact No") common["tp"] = String(val || "");
      else if (key === "Co-morbidities") common["comorbidity"] = val || "";
      else if (key === "Past surgery") common["past_surgical_history"] = val || "";
      else if (key === "Family History") common["familyHistory"] = val || "";
      else common[key.toLowerCase().replace(/\s+/g, "_")] = val;
    } else {
      // All pancreas-specific fields go into pancreas_data map
      if (val !== null && val !== undefined && val !== "") {
        setNested(pancreas_data, key, val);
      }
    }
  }

  return { common, pancreas_data, date };
}

function setNested(obj: any, path: string, val: any) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i].replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    if (!cur[p]) cur[p] = {};
    cur = cur[p];
  }
  const last = parts[parts.length - 1].replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  cur[last] = val;
}

async function main() {
  ensureAdminApp();
  const db = getFirestore();

  // Read Excel
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }) as any[][];

  if (data.length < 3) {
    console.error("Not enough rows");
    process.exit(1);
  }

  const colMap = buildColumnMap(sheet);

  const now = new Date().toISOString();
  let imported = 0;
  let skipped = 0;

  for (let r = 2; r < data.length; r++) {
    const row = data[r];
    const name = row[1]; // Name column
    if (!name || String(name).trim() === "") {
      skipped++;
      continue;
    }

    const { common, pancreas_data, date } = parseRow(row, colMap);
    const id = newId("pan");

    const patient: Record<string, any> = {
      ...common,
      id,
      auto_id: `PAN-${String(r - 1).padStart(3, "0")}`,
      age: String(common.age || ""),
      gender: common.gender || "",
      status: "active",
      oncology: "Pancreas",
      oncology_types: ["Pancreas"],
      date: date || now.split("T")[0],
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      pancreas_data,
    };

    await db.collection("patients").doc(id).set(patient, { merge: true });
    imported++;
    console.log(`  [${imported}] ${patient.first_name || "Unnamed"} → ${id}`);
  }

  console.log(`\nDone. Imported: ${imported}, Skipped (empty): ${skipped}`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
