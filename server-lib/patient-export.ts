import MANIFEST, { getExportKeyOrder, type ManifestField } from "../src/formManifest.js";

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
  id: "Patient ID",
  auto_id: "Auto ID",
  createdBy: "Created By",
  createdAt: "Created At",
  updatedAt: "Updated At",
  isDeleted: "Deleted",
  driveFolderId: "Drive Folder ID",
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

function titleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  const parts = path.split(".");
  const walk = (current: unknown, index: number): unknown => {
    if (index >= parts.length) return current;
    if (current === undefined || current === null) return undefined;
    const part = parts[index];
    if (Array.isArray(current)) {
      const collected = current.map((item) => walk(item, index));
      const values = collected.flatMap((item) => Array.isArray(item) ? item : [item]).filter((item) => item !== undefined && item !== null && item !== "");
      return values.length ? values : undefined;
    }
    if (!isPlainObject(current)) return undefined;
    return walk(current[part], index + 1);
  };
  return walk(value, 0);
}

function getArrayAtPath(value: unknown, path: string): unknown[] {
  const found = getAtPath(value, path);
  return Array.isArray(found) ? found : [];
}

function valueForSelectedPath(patient: Record<string, any>, path: string): string {
  const value = getAtPath(patient, path);
  return stringifyCell(value);
}

function fieldNode(
  path: string,
  label: string,
  repeated = false,
  repeatRoot?: string,
  children?: PatientExportColumnNode[],
  kind: PatientExportColumnNode["kind"] = "field",
): PatientExportColumnNode {
  return {
    key: path,
    path,
    label,
    kind,
    selectable: kind === "field",
    repeated,
    repeatRoot,
    children,
  };
}

function buildManifestFieldNodes(
  fields: Record<string, ManifestField>,
  prefix = "",
  repeatRoot?: string,
): PatientExportColumnNode[] {
  return Object.entries(fields).map(([name, field]) => {
    const path = prefix ? `${prefix}.${name}` : name;
    const currentRepeatRoot = repeatRoot || (field.isArray ? path : undefined);
    const children = field.itemFields
      ? buildManifestFieldNodes(field.itemFields, path, currentRepeatRoot)
      : undefined;

    if (field.isArray && children?.length) {
      return {
        key: path,
        path,
        label: titleCase(name),
        kind: "table",
        selectable: false,
        repeated: true,
        repeatRoot: currentRepeatRoot,
        children,
      };
    }

    if (children?.length) {
      return {
        key: path,
        path,
        label: titleCase(name),
        kind: "group",
        selectable: false,
        repeated: Boolean(repeatRoot),
        repeatRoot,
        children,
      };
    }

    return fieldNode(path, titleCase(name), Boolean(repeatRoot), repeatRoot);
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

function discoveredPathNodes(paths: string[], knownPaths: Set<string>): PatientExportColumnNode[] {
  return paths
    .filter((path) => !knownPaths.has(path))
    .sort((a, b) => a.localeCompare(b))
    .map((path) => fieldNode(path, titleCase(path.split(".").pop() || path)));
}

function discoverPatientPaths(value: unknown, prefix: string, paths: Set<string>) {
  if (!prefix) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isPlainObject(item)) {
        for (const [key, childValue] of Object.entries(item)) {
          discoverPatientPaths(childValue, `${prefix}.${key}`, paths);
        }
      }
    }
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, childValue] of Object.entries(value)) {
      discoverPatientPaths(childValue, `${prefix}.${key}`, paths);
    }
    return;
  }
  paths.add(prefix);
}

function selectedColumnsWithIdentity(columns: string[]) {
  return uniq([...REQUIRED_IDENTITY_KEYS, ...columns]);
}

function csvFromRows(columns: string[], rows: Row[]) {
  const csvRows = [
    columns.map(csvEscape).join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column] ?? "")).join(",")),
  ];
  return `\uFEFF${csvRows.join("\n")}`;
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

export function buildPatientExportColumnTree(patients: Record<string, any>[] = []) {
  const manifestSections: PatientExportColumnNode[] = Object.values(MANIFEST.sections).map((section) => ({
    key: section.key,
    path: section.key,
    label: section.label,
    kind: "group",
    selectable: false,
    children: buildManifestFieldNodes(section.fields),
  }));

  const knownPaths = collectLeafPaths(manifestSections);
  for (const key of [...SYSTEM_EXPORT_KEYS, ...REQUIRED_IDENTITY_KEYS]) knownPaths.add(key);

  const systemNode: PatientExportColumnNode = {
    key: "system",
    path: "system",
    label: "System Metadata",
    kind: "group",
    selectable: false,
    children: SYSTEM_EXPORT_KEYS.map((key) => fieldNode(key, SYSTEM_COLUMN_LABELS[key] || titleCase(key))),
  };

  const discoveredPaths = new Set<string>();
  for (const patient of patients) {
    for (const [key, value] of Object.entries(patient)) {
      discoverPatientPaths(value, key, discoveredPaths);
    }
  }
  const additionalChildren = discoveredPathNodes(Array.from(discoveredPaths), knownPaths);

  const tree = [
    ...manifestSections,
    systemNode,
    ...(additionalChildren.length
      ? [{
        key: "additionalStoredFields",
        path: "additionalStoredFields",
        label: "Additional Stored Fields",
        kind: "group" as const,
        selectable: false,
        children: additionalChildren,
      }]
      : []),
  ];

  return {
    tree,
    requiredColumns: REQUIRED_IDENTITY_KEYS,
    defaultColumns: uniq([...REQUIRED_IDENTITY_KEYS, ...getExportKeyOrder()]),
    tableSources: collectTableNodes(tree).map((node) => ({
      path: node.path,
      label: node.label,
      repeatRoot: node.repeatRoot || node.path,
    })),
  };
}

export function buildSelectedPatientExportRows(
  patients: Record<string, any>[],
  options: SelectedPatientCsvOptions,
) {
  const columns = selectedColumnsWithIdentity(options.columns);
  const mode = options.mode === "table-row" ? "table-row" : "patient-wide";

  if (mode === "table-row") {
    const rowSource = String(options.rowSource || "").trim();
    if (!rowSource) throw new Error("A repeatable table row source is required for table-row CSV export.");
    const rows: Row[] = [];
    for (const patient of patients) {
      const items = getArrayAtPath(patient, rowSource);
      const sourceRows = items.length ? items : [undefined];
      for (const item of sourceRows) {
        const row: Row = {};
        for (const column of columns) {
          const relativePath = column.startsWith(`${rowSource}.`) ? column.slice(rowSource.length + 1) : "";
          row[column] = relativePath && item !== undefined
            ? stringifyCell(getAtPath(item, relativePath))
            : valueForSelectedPath(patient, column);
        }
        rows.push(row);
      }
    }
    return { columns, rows };
  }

  return {
    columns,
    rows: patients.map((patient) => {
      const row: Row = {};
      for (const column of columns) row[column] = valueForSelectedPath(patient, column);
      return row;
    }),
  };
}

export function buildPatientCsv(patients: Record<string, any>[]) {
  const { columns, rows } = buildPatientExportRows(patients);
  return csvFromRows(columns, rows);
}

export function buildSelectedPatientCsv(
  patients: Record<string, any>[],
  options: SelectedPatientCsvOptions,
) {
  const { columns, rows } = buildSelectedPatientExportRows(patients, options);
  return csvFromRows(columns, rows);
}

export function patientExportFileName(extension: "csv" | "json") {
  return `FullBackups_OncoRegistry_${new Date().toISOString().slice(0, 10)}.${extension}`;
}
