import JSZip from "jszip";
import MANIFEST, { getExportKeyOrder, type ManifestField } from "../src/formManifest.js";

export type FlatScalar = string | number | boolean | null;
type FlatRow = Record<string, FlatScalar>;

const SYSTEM_EXPORT_KEYS = [
  "id",
  "auto_id",
  "createdBy",
  "createdAt",
  "updatedAt",
  "isDeleted",
  "driveFolderId",
];

const REQUIRED_IDENTITY_KEYS = [
  "id",
  "auto_id",
  "title",
  "initials",
  "first_name",
  "last_name",
  "nic",
  "clinic",
  "bht",
  "tp",
];

const SYSTEM_COLUMN_LABELS: Record<string, string> = {
  id: "Patient document ID",
  auto_id: "Registry patient ID",
  createdBy: "Record creator user ID",
  createdAt: "Record creation timestamp",
  updatedAt: "Last update timestamp",
  isDeleted: "Soft-deleted record indicator",
  driveFolderId: "Google Drive patient folder ID",
};

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  tp: "Telephone number",
  nic: "National identity card number",
  bht: "Bed head ticket / clinic book reference",
  dob: "Date of birth",
  bmi: "Body mass index",
  bsa: "Body surface area",
  ecog_status: "ECOG performance status",
  lvi: "Lymphovascular invasion",
  ihc_panel: "Immunohistochemistry panel",
  ihc_marker: "Immunohistochemistry marker",
  tnm_stage: "TNM stage",
  icu_done: "Intensive care admission status",
  pv_status: "Portal vein status",
  sma_status: "Superior mesenteric artery status",
};

export type PatientExportMode = "patient-wide" | "table-row";

export interface PatientExportColumnNode {
  key: string;
  path: string;
  label: string;
  kind: "group" | "field" | "table";
  selectable: boolean;
  repeated?: boolean;
  repeatRoot?: string;
  children?: PatientExportColumnNode[];
}

export interface SelectedPatientCsvOptions {
  mode: PatientExportMode;
  columns: string[];
  rowSource?: string;
}

export interface PatientExportDictionaryEntry {
  column_name: string;
  form_section: string;
  form_table: string;
  row_index: string;
  field_label: string;
  description: string;
  data_type: string;
  allowed_values: string;
  system_metadata: "yes" | "no";
}

interface ManifestDescriptor {
  pattern: string;
  section: string;
  table: string;
  label: string;
  description: string;
  dataType: string;
  allowedValues: string;
  order: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function titleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fieldLabel(path: string, field?: ManifestField) {
  const key = path.split(".").pop()?.replace(/\[\]/g, "") || path;
  return field?.label || FIELD_LABEL_OVERRIDES[key] || titleCase(key);
}

function fieldDescription(section: string, label: string, field?: ManifestField, repeated = false) {
  if (field?.description) return field.description;
  return repeated
    ? `${label} recorded in a repeatable row of the ${section} section.`
    : `${label} recorded in the ${section} section of the patient data form.`;
}

function buildManifestDescriptors() {
  const descriptors: ManifestDescriptor[] = [];
  let order = 0;
  const visit = (
    fields: Record<string, ManifestField>,
    section: string,
    prefix = "",
    table = "",
    repeated = false,
  ) => {
    for (const [name, field] of Object.entries(fields)) {
      const path = prefix ? `${prefix}.${name}` : name;
      const pattern = field.isArray ? `${path}[]` : path;
      const currentTable = field.isArray ? path : table;
      if (field.itemFields) {
        visit(field.itemFields, section, pattern, currentTable, true);
        continue;
      }
      const label = fieldLabel(pattern, field);
      descriptors.push({
        pattern,
        section,
        table: currentTable,
        label,
        description: fieldDescription(section, label, field, repeated || field.isArray === true),
        dataType: field.type,
        allowedValues: field.options?.join(" | ") || "",
        order: order++,
      });
    }
  };
  for (const section of Object.values(MANIFEST.sections)) {
    visit(section.fields, section.label);
  }
  return descriptors;
}

const MANIFEST_DESCRIPTORS = buildManifestDescriptors();
const DESCRIPTOR_BY_PATTERN = new Map(MANIFEST_DESCRIPTORS.map((item) => [item.pattern, item]));

function normalizeIndexedPath(path: string) {
  return path.replace(/\[\d+\]/g, "[]");
}

function stripIndexes(path: string) {
  return path.replace(/\[\d+\]/g, "").replace(/\[\]/g, "");
}

function descriptorForColumn(column: string) {
  const normalized = normalizeIndexedPath(column);
  const exact = DESCRIPTOR_BY_PATTERN.get(normalized);
  if (exact) return exact;
  const withoutArrayMarkers = stripIndexes(normalized);
  return MANIFEST_DESCRIPTORS.find((descriptor) => stripIndexes(descriptor.pattern) === withoutArrayMarkers);
}

function scalarType(value: FlatScalar) {
  if (value === null) return "null";
  return typeof value;
}

function flattenValue(value: unknown, prefix: string, row: FlatRow) {
  if (value === undefined || !prefix) return;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    row[prefix] = value as FlatScalar;
    return;
  }
  if (typeof value === "bigint") {
    row[prefix] = String(value);
    return;
  }
  if (value instanceof Date) {
    row[prefix] = value.toISOString();
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenValue(item, `${prefix}[${index}]`, row));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenValue(child, `${prefix}.${key}`, row);
    }
    return;
  }
  row[prefix] = String(value);
}

export function flattenPatient(patient: Record<string, unknown>): FlatRow {
  const row: FlatRow = {};
  for (const [key, value] of Object.entries(patient)) flattenValue(value, key, row);
  return row;
}

function compareColumns(a: string, b: string) {
  const aDescriptor = descriptorForColumn(a);
  const bDescriptor = descriptorForColumn(b);
  const aSystem = SYSTEM_EXPORT_KEYS.indexOf(stripIndexes(a));
  const bSystem = SYSTEM_EXPORT_KEYS.indexOf(stripIndexes(b));
  const aRank = aDescriptor?.order ?? (aSystem >= 0 ? 100_000 + aSystem : 200_000);
  const bRank = bDescriptor?.order ?? (bSystem >= 0 ? 100_000 + bSystem : 200_000);
  if (aRank !== bRank) return aRank - bRank;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function buildFlatPatientExport(patients: Record<string, unknown>[]) {
  const records = patients.map(flattenPatient);
  const columns = new Set<string>();
  for (const descriptor of MANIFEST_DESCRIPTORS) {
    if (!descriptor.pattern.includes("[]")) columns.add(descriptor.pattern);
  }
  for (const key of SYSTEM_EXPORT_KEYS) columns.add(key);
  for (const record of records) Object.keys(record).forEach((column) => columns.add(column));
  const orderedColumns = Array.from(columns).sort(compareColumns);
  return { columns: orderedColumns, records };
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function csvFromFlatRows(columns: string[], rows: FlatRow[]) {
  return `\uFEFF${[
    columns.map(csvEscape).join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column] ?? "")).join(",")),
  ].join("\n")}`;
}

function observedTypes(column: string, rows: FlatRow[]) {
  const types = new Set(rows.flatMap((row) => column in row ? [scalarType(row[column])] : []));
  return types.size ? Array.from(types).sort().join(" | ") : descriptorForColumn(column)?.dataType || "unknown";
}

export function buildPatientDataDictionary(columns: string[], rows: FlatRow[]): PatientExportDictionaryEntry[] {
  return columns.map((column) => {
    const descriptor = descriptorForColumn(column);
    const indexes = Array.from(column.matchAll(/\[(\d+)\]/g), (match) => match[1]);
    const systemKey = stripIndexes(column);
    const systemLabel = SYSTEM_COLUMN_LABELS[systemKey];
    const label = systemLabel || descriptor?.label || titleCase(column.split(".").pop()?.replace(/\[\d+\]/g, "") || column);
    const section = systemLabel ? "System Metadata" : descriptor?.section || "Additional Stored Fields";
    const table = descriptor?.table ? stripIndexes(descriptor.table) : "";
    const rowMeaning = indexes.length ? indexes.join(" > ") : "";
    const description = systemLabel
      ? systemLabel
      : descriptor?.description || `${label} stored in the patient record but not represented in the current form manifest.`;
    return {
      column_name: column,
      form_section: section,
      form_table: table,
      row_index: rowMeaning,
      field_label: label,
      description: indexes.length ? `${description} Zero-based row index: ${rowMeaning}.` : description,
      data_type: observedTypes(column, rows),
      allowed_values: descriptor?.allowedValues || "",
      system_metadata: systemLabel ? "yes" : "no",
    };
  });
}

function dictionaryCsv(entries: PatientExportDictionaryEntry[]) {
  const columns: (keyof PatientExportDictionaryEntry)[] = [
    "column_name", "form_section", "form_table", "row_index", "field_label",
    "description", "data_type", "allowed_values", "system_metadata",
  ];
  return `\uFEFF${[
    columns.map(csvEscape).join(","),
    ...entries.map((entry) => columns.map((column) => csvEscape(entry[column])).join(",")),
  ].join("\n")}`;
}

export async function buildPatientCsvPackage(patients: Record<string, unknown>[]) {
  const { columns, records } = buildFlatPatientExport(patients);
  const dictionary = buildPatientDataDictionary(columns, records);
  const zip = new JSZip();
  zip.file("patient_data_flat.csv", csvFromFlatRows(columns, records));
  zip.file("data_dictionary.csv", dictionaryCsv(dictionary));
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { buffer, patientCount: patients.length, columnCount: columns.length };
}

export function buildFlatPatientJson(patients: Record<string, unknown>[]) {
  const { columns, records } = buildFlatPatientExport(patients);
  const normalizedRecords = records.map((record) => Object.fromEntries(columns.map((column) => [column, record[column] ?? null])));
  return { json: JSON.stringify(normalizedRecords, null, 2), patientCount: patients.length, columnCount: columns.length };
}

function fieldNode(path: string, label: string, repeated = false, repeatRoot?: string, children?: PatientExportColumnNode[], kind: PatientExportColumnNode["kind"] = "field"): PatientExportColumnNode {
  return { key: path, path, label, kind, selectable: kind === "field", repeated, repeatRoot, children };
}

function buildManifestFieldNodes(fields: Record<string, ManifestField>, prefix = "", repeatRoot?: string): PatientExportColumnNode[] {
  return Object.entries(fields).map(([name, field]) => {
    const path = prefix ? `${prefix}.${name}` : name;
    const currentRepeatRoot = repeatRoot || (field.isArray ? path : undefined);
    const children = field.itemFields ? buildManifestFieldNodes(field.itemFields, path, currentRepeatRoot) : undefined;
    if (field.isArray && children?.length) return { key: path, path, label: fieldLabel(path, field), kind: "table", selectable: false, repeated: true, repeatRoot: currentRepeatRoot, children };
    if (children?.length) return { key: path, path, label: fieldLabel(path, field), kind: "group", selectable: false, repeated: Boolean(repeatRoot), repeatRoot, children };
    return fieldNode(path, fieldLabel(path, field), Boolean(repeatRoot), repeatRoot);
  });
}

function collectLeafPaths(nodes: PatientExportColumnNode[], paths = new Set<string>()) {
  for (const node of nodes) {
    if (node.selectable) paths.add(node.path);
    if (node.children) collectLeafPaths(node.children, paths);
  }
  return paths;
}

function collectTableNodes(nodes: PatientExportColumnNode[], tables: PatientExportColumnNode[] = []) {
  for (const node of nodes) {
    if (node.kind === "table") tables.push(node);
    if (node.children) collectTableNodes(node.children, tables);
  }
  return tables;
}

export function buildPatientExportColumnTree(patients: Record<string, unknown>[] = []) {
  const manifestSections: PatientExportColumnNode[] = Object.values(MANIFEST.sections).map((section) => ({
    key: section.key, path: section.key, label: section.label, kind: "group", selectable: false,
    children: buildManifestFieldNodes(section.fields),
  }));
  const knownPaths = collectLeafPaths(manifestSections);
  const { columns } = buildFlatPatientExport(patients);
  const additionalColumns = columns.filter((column) => {
    const unindexed = stripIndexes(column);
    return !knownPaths.has(unindexed) && !SYSTEM_EXPORT_KEYS.includes(unindexed);
  });
  const tree = [
    ...manifestSections,
    { key: "system", path: "system", label: "System Metadata", kind: "group" as const, selectable: false, children: SYSTEM_EXPORT_KEYS.map((key) => fieldNode(key, SYSTEM_COLUMN_LABELS[key])) },
    ...(additionalColumns.length ? [{ key: "additionalStoredFields", path: "additionalStoredFields", label: "Additional Stored Fields", kind: "group" as const, selectable: false, children: additionalColumns.map((path) => fieldNode(path, titleCase(path))) }] : []),
  ];
  return {
    tree,
    requiredColumns: REQUIRED_IDENTITY_KEYS,
    defaultColumns: Array.from(new Set([...REQUIRED_IDENTITY_KEYS, ...getExportKeyOrder()])),
    tableSources: collectTableNodes(tree).map((node) => ({ path: node.path, label: node.label, repeatRoot: node.repeatRoot || node.path })),
  };
}

function selectedFlatColumns(allColumns: string[], requested: string[]) {
  const wanted = new Set([...REQUIRED_IDENTITY_KEYS, ...requested]);
  return allColumns.filter((column) => wanted.has(column) || wanted.has(stripIndexes(column)));
}

function valueAtObjectPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split(".").reduce<unknown>((current, part) => {
    return isPlainObject(current) ? current[part] : undefined;
  }, value);
}

export function buildSelectedPatientExportRows(patients: Record<string, unknown>[], options: SelectedPatientCsvOptions) {
  if (options.mode === "table-row" && options.rowSource) {
    const rows: FlatRow[] = [];
    const discoveredColumns = new Set<string>(REQUIRED_IDENTITY_KEYS);
    for (const patient of patients) {
      const identity = flattenPatient(patient);
      const source = valueAtObjectPath(patient, options.rowSource);
      const items = Array.isArray(source) && source.length ? source : [undefined];
      for (const item of items) {
        const row: FlatRow = {};
        for (const key of REQUIRED_IDENTITY_KEYS) {
          if (key in identity) row[key] = identity[key];
        }
        if (item !== undefined) flattenValue(item, options.rowSource, row);
        Object.keys(row).forEach((column) => discoveredColumns.add(column));
        rows.push(row);
      }
    }
    const columns = selectedFlatColumns(Array.from(discoveredColumns).sort(compareColumns), options.columns);
    return { columns, rows };
  }
  const flat = buildFlatPatientExport(patients);
  const columns = selectedFlatColumns(flat.columns, options.columns);
  return { columns, rows: flat.records };
}

export function buildPatientExportRows(patients: Record<string, unknown>[]) {
  const { columns, records } = buildFlatPatientExport(patients);
  return { columns, rows: records };
}

export function buildPatientCsv(patients: Record<string, unknown>[]) {
  const { columns, records } = buildFlatPatientExport(patients);
  return csvFromFlatRows(columns, records);
}

export function buildSelectedPatientCsv(patients: Record<string, unknown>[], options: SelectedPatientCsvOptions) {
  const { columns, rows } = buildSelectedPatientExportRows(patients, options);
  return csvFromFlatRows(columns, rows);
}

export async function buildSelectedPatientCsvPackage(patients: Record<string, unknown>[], options: SelectedPatientCsvOptions) {
  const { columns, rows } = buildSelectedPatientExportRows(patients, options);
  const dictionary = buildPatientDataDictionary(columns, rows);
  const zip = new JSZip();
  zip.file("patient_data_selected.csv", csvFromFlatRows(columns, rows));
  zip.file("data_dictionary.csv", dictionaryCsv(dictionary));
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { buffer, patientCount: patients.length, columnCount: columns.length };
}

export function patientExportFileName(extension: "csv" | "json" | "zip", kind = "flat") {
  return `OncoRegistry_${kind}_${new Date().toISOString().slice(0, 10)}.${extension}`;
}
