import { getExportKeyOrder } from "../src/formManifest.js";

type Row = Record<string, string>;

const SYSTEM_EXPORT_KEYS = [
  "id",
  "auto_id",
  "createdBy",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "driveFolderId",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value: unknown) {
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function stringifyCell(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return stableJson(value);
}

function flattenForCsv(value: unknown, prefix: string, row: Row, columns: Set<string>) {
  if (!prefix) return;
  columns.add(prefix);

  if (Array.isArray(value)) {
    row[prefix] = stableJson(value);
    return;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      row[prefix] = "{}";
      return;
    }
    row[prefix] = stableJson(value);
    for (const [key, childValue] of entries) {
      flattenForCsv(childValue, `${prefix}.${key}`, row, columns);
    }
    return;
  }

  row[prefix] = stringifyCell(value);
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function buildPatientExportRows(patients: Record<string, any>[]) {
  const columns = new Set<string>([
    ...SYSTEM_EXPORT_KEYS,
    ...getExportKeyOrder(),
  ]);

  const rows = patients.map((patient) => {
    const row: Row = {};
    for (const [key, value] of Object.entries(patient)) {
      flattenForCsv(value, key, row, columns);
    }
    return row;
  });

  return {
    columns: Array.from(columns),
    rows,
  };
}

export function buildPatientCsv(patients: Record<string, any>[]) {
  const { columns, rows } = buildPatientExportRows(patients);
  const csvRows = [
    columns.map(csvEscape).join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column] ?? "")).join(",")),
  ];
  return `\uFEFF${csvRows.join("\n")}`;
}

export function patientExportFileName(extension: "csv" | "json") {
  return `FullBackups_OncoRegistry_${new Date().toISOString().slice(0, 10)}.${extension}`;
}
