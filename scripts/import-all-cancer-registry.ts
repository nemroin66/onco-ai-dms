/**
 * Import all 21 cancer registry sheets from Excel → Firestore patients collection.
 *
 * Handles:
 *   - 3-tier sheets (header + sub-header + data)
 *   - 2-tier sheets (header + data)
 *   - Malformed sheets (data in header row — Renal, Colorectal, Gall bladder)
 *   - Shee8 (unnamed — mapped to "Colorectal" based on column structure)
 *
 * Common fields → PatientRecord. Sheet-specific fields → `{cancerType}_data` map.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{...}' npx tsx scripts/import-all-cancer-registry.ts
 */

import * as XLSX from "xlsx";
import path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

const EXCEL_PATH = path.resolve(
  process.env.HOME || "/Users/nemroin",
  "Downloads/Patient database Copy 1 (1)-2-1.xlsx"
);

function ensureAdminApp() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON env var required");
    const sa = JSON.parse(raw);
    initializeApp({
      credential: cert(sa),
      projectId:
        process.env.FIREBASE_WEB_PROJECT_ID ||
        process.env.VITE_FIREBASE_PROJECT_ID ||
        sa.project_id,
    });
  }
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

// ── Common field mappings ──────────────────────────────────────────────
// Keys (lowercased, stripped) → PatientRecord field + optional transform
const COMMON_MAP: Record<
  string,
  { field: string; transform?: (v: any) => any }
> = {
  name: { field: "first_name" },
  date: { field: "date" },
  age: { field: "age", transform: (v) => String(v || "").replace(/y$/i, "") },
  gender: { field: "gender", transform: (v) => String(v || "").toUpperCase().charAt(0) },
  bht: { field: "bht" },
  "clinic file no": { field: "clinic" },
  "clinic no": { field: "clinic" },
  "contact no": { field: "tp" },
  "contact number": { field: "tp" },
  "tp no": { field: "tp" },
  hospital: { field: "hospital" },
  "co-morbidities": { field: "comorbidity" },
  "co mobidities": { field: "comorbidity" },
  "co mobidity": { field: "comorbidity" },
  "co mobid": { field: "comorbidity" },
  "co-morbid": { field: "comorbidity" },
  "comobiditi": { field: "comorbidity" },
  "past surgery": { field: "past_surgical_history" },
  "past sx": { field: "past_surgical_history" },
  "pshx": { field: "past_surgical_history" },
  "family history": { field: "family_history" },
  "family hx": { field: "family_history" },
  "fhx": { field: "family_history" },
  "social history": { field: "social_history" },
  "social hx": { field: "social_history" },
};

// Sheets where row 1 contains data values instead of headers
const MALFORMED_HEADER_SHEETS = new Set(["Renal", "Colorectal", "Gall bladder"]);

function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 /]/g, "")
    .trim();
}

// ── Sheet parsing ──────────────────────────────────────────────────────

interface SheetMeta {
  cancerType: string;
  headers: string[];
  rows: any[][];
}

function parseSheet(wb: XLSX.WorkBook, sheetName: string): SheetMeta {
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as any[][];

  if (raw.length === 0) return { cancerType: sheetName, headers: [], rows: [] };

  let headerRow: string[] = [];
  let dataStartRow = 1;

  if (MALFORMED_HEADER_SHEETS.has(sheetName)) {
    // Headers are in row 0, values interleaved with header names via ">"
    // e.g. "DATE > 2019-06-11 00:00:00"
    // Extract header names from the > pattern
    headerRow = raw[0].map((cell: any) => {
      const s = String(cell || "");
      const m = s.match(/^(.+?)\s*>/);
      return m ? m[1].trim() : s;
    });
    dataStartRow = 1;
  } else if (raw.length >= 2) {
    // Check if row 1 has substantial non-null content (sub-header pattern)
    const row0Len = raw[0].filter((c: any) => String(c || "").trim()).length;
    const row1Len = raw[1].filter((c: any) => String(c || "").trim()).length;

    if (row1Len > row0Len * 0.3 && row1Len >= 3) {
      // Sub-header pattern: combine row 0 (group) + row 1 (sub-field)
      headerRow = raw[0].map((h: any, i: number) => {
        const group = String(h || "").trim();
        const sub = String(raw[1]?.[i] || "").trim();
        if (group && sub && group !== sub) return `${group} > ${sub}`;
        return group || sub;
      });
      dataStartRow = 2;
    } else {
      // Simple header row
      headerRow = raw[0].map((h: any) => String(h || "").trim());
      dataStartRow = 1;
    }
  }

  // Extract actual data rows
  const rows: any[][] = [];
  for (let r = dataStartRow; r < raw.length; r++) {
    if (raw[r].some((cell: any) => String(cell || "").trim())) {
      rows.push(raw[r]);
    }
  }

  return { cancerType: sheetName, headers: headerRow, rows };
}

// ── Value parsing ──────────────────────────────────────────────────────

function parseDate(val: any): string {
  if (!val) return "";
  // Excel serial number
  if (typeof val === "number" && val > 40000 && val < 60000) {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split("T")[0];
  }
  const s = String(val).trim();
  // "2019-06-04 00:00:00"
  const m1 = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m1) return m1[1];
  // "23/12/19" or "14/05/2020"
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (m2) {
    const [, d, mon, y] = m2;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mon.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

// ── Main ───────────────────────────────────────────────────────────────

async function main() {
  ensureAdminApp();
  const db = getFirestore();

  console.log(`Reading ${EXCEL_PATH}...`);
  const wb = XLSX.readFile(EXCEL_PATH);
  console.log(`Sheets: ${wb.SheetNames.length}`);

  const now = new Date().toISOString();
  let totalImported = 0;
  let totalSkipped = 0;

  for (const sheetName of wb.SheetNames) {
    const { cancerType, headers, rows } = parseSheet(wb, sheetName);

    if (rows.length === 0) {
      console.log(`\n[${sheetName}] SKIP — no data rows`);
      continue;
    }

    console.log(
      `\n[${sheetName}] ${rows.length} rows, ${headers.length} cols`
    );

    // Pre-process headers: normalize for matching
    const headerKeys = headers.map(normalizeKey);

    let sheetImported = 0;

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const nameIdx = headerKeys.findIndex(
        (k) => k === "name" || k === "name " || k === "name >"
      );
      const nameRaw = nameIdx >= 0 ? row[nameIdx] : "";
      const name = String(nameRaw || "").trim();

      if (!name) {
        totalSkipped++;
        continue;
      }

      // Build common fields
      const common: Record<string, any> = {};
      let dateVal = "";

      for (let ci = 0; ci < row.length && ci < headers.length; ci++) {
        const rawVal = row[ci];
        if (rawVal === undefined || rawVal === null || String(rawVal).trim() === "")
          continue;

        const key = headerKeys[ci];
        if (!key) continue;

        const mapping = COMMON_MAP[key];
        if (mapping) {
          const val = mapping.transform ? mapping.transform(rawVal) : rawVal;
          if (mapping.field === "date") {
            dateVal = parseDate(rawVal);
          } else {
            common[mapping.field] = val;
          }
        }
      }

      // Store all non-common fields in cancer-specific data map
      const cancerDataKey = `${cancerType
        .replace(/\s+/g, "_")
        .toLowerCase()}_data`;
      const cancerData: Record<string, any> = {};

      for (let ci = 0; ci < row.length && ci < headers.length; ci++) {
        const rawVal = row[ci];
        if (rawVal === undefined || rawVal === null || String(rawVal).trim() === "")
          continue;

        const key = headerKeys[ci];
        if (!key) continue;
        if (COMMON_MAP[key]) continue; // already in common

        // Build nested key from group > sub patterns
        const headerRaw = headers[ci];
        const parts = headerRaw.split(/\s*>\s*/).map((p) =>
          p
            .trim()
            .replace(/[^a-zA-Z0-9 ]/g, "")
            .replace(/\s+/g, "_")
        );
        const cleanKey = parts.join(".");

        if (!cleanKey) continue;

        // Check if it's a date field
        const isDateField =
          key.includes("date") ||
          key.includes("sx date") ||
          key.includes("surgery date") ||
          key.includes("doa") ||
          key.includes("dod") ||
          key.includes("ward in") ||
          key.includes("ward out") ||
          key.includes("discharge");

        cancerData[cleanKey] = isDateField ? parseDate(rawVal) : rawVal;
      }

      const id = newId(cancerType.slice(0, 3).toLowerCase());

      const patient: Record<string, any> = {
        id,
        ...common,
        first_name: common.first_name || name,
        auto_id: `${cancerType.slice(0, 3).toUpperCase()}-${String(ri + 1).padStart(3, "0")}`,
        age: String(common.age || ""),
        gender: common.gender || "",
        status: "active",
        oncology: cancerType,
        oncology_types: [cancerType],
        date: dateVal || now.split("T")[0],
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        [cancerDataKey]: cancerData,
      };

      // Remove empty fields
      Object.keys(patient).forEach((k) => {
        if (patient[k] === "" || patient[k] === undefined || patient[k] === null) {
          delete patient[k];
        }
      });

      try {
        await db.collection("patients").doc(id).set(patient, { merge: true });
        sheetImported++;
      } catch (err: any) {
        console.error(`  FAILED: ${name} → ${err.message}`);
      }
    }

    totalImported += sheetImported;
    console.log(`  → Imported: ${sheetImported}`);
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`Total imported: ${totalImported}`);
  console.log(`Total skipped (no name): ${totalSkipped}`);
  console.log(`═══════════════════════════════════════`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
