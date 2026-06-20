import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  buildFlatPatientExport,
  buildFlatPatientJson,
  buildPatientCsvPackage,
  buildPatientDataDictionary,
  buildSelectedPatientExportRows,
  flattenPatient,
} from "../server-lib/patient-export.js";
import { isPrivilegedRole } from "../server-lib/auth.js";

const patients = [
  {
    id: "pat_1",
    auto_id: "PT-001",
    first_name: "Ana, \"A\"",
    isDeleted: false,
    consent_ai_processing: true,
    imagingTable: [
      { imaging_date: "2026-01-01", imaging_findings: "Line one\nLine two", mass_size: 12.5 },
      { imaging_date: "2026-02-01", imaging_findings: "දත්ත" },
    ],
    examFindingsTable: [
      { date: "2026-03-01", entries: [{ organ_system: "CNS", findings: "Normal" }] },
    ],
    oncology_types: ["Lung", "Breast"],
    nullableLegacyValue: null,
    legacy: { uncommon: "preserved" },
    emptyArray: [],
  },
  {
    id: "pat_2",
    auto_id: "PT-002",
    first_name: "Ben",
    isDeleted: true,
    imagingTable: [{ imaging_date: "2026-04-01", imaging_findings: "Stable" }],
  },
];

const first = flattenPatient(patients[0]);
assert.equal(first["imagingTable[0].imaging_date"], "2026-01-01");
assert.equal(first["imagingTable[1].imaging_findings"], "දත්ත");
assert.equal(first["examFindingsTable[0].entries[0].findings"], "Normal");
assert.equal(first["oncology_types[1]"], "Breast");
assert.equal(first.nullableLegacyValue, null);
assert.equal(first["legacy.uncommon"], "preserved");
assert.ok(!("imagingTable" in first), "arrays must not remain as nested cells");
assert.ok(!("emptyArray" in first), "empty containers have no scalar leaf");

const flat = buildFlatPatientExport(patients);
assert.equal(flat.records.length, 2, "active and deleted records must both export");
assert.ok(flat.columns.includes("imagingTable[1].imaging_findings"));
assert.ok(flat.columns.includes("legacy.uncommon"));
for (const record of flat.records) {
  for (const value of Object.values(record)) {
    assert.ok(value === null || ["string", "number", "boolean"].includes(typeof value));
  }
}

const dictionary = buildPatientDataDictionary(flat.columns, flat.records);
assert.equal(dictionary.length, flat.columns.length);
assert.equal(new Set(dictionary.map((entry) => entry.column_name)).size, flat.columns.length);
assert.ok(dictionary.every((entry) => entry.field_label && entry.description && entry.data_type));
assert.equal(dictionary.find((entry) => entry.column_name === "imagingTable[1].imaging_findings")?.form_section, "Medical Investigations");
assert.equal(dictionary.find((entry) => entry.column_name === "legacy.uncommon")?.form_section, "Additional Stored Fields");

const flatJson = buildFlatPatientJson(patients);
const parsedFlatJson = JSON.parse(flatJson.json);
assert.equal(parsedFlatJson.length, 2);
assert.equal(parsedFlatJson[0]["examFindingsTable[0].entries[0].organ_system"], "CNS");
assert.equal(parsedFlatJson[1]["imagingTable[1].imaging_findings"], null);

const tableRows = buildSelectedPatientExportRows(patients, {
  mode: "table-row",
  rowSource: "imagingTable",
  columns: ["imagingTable.imaging_date", "imagingTable.imaging_findings"],
});
assert.equal(tableRows.rows.length, 3);
assert.ok(tableRows.columns.includes("imagingTable.imaging_date"));
assert.equal(tableRows.rows[1]["imagingTable.imaging_findings"], "දත්ත");

const packaged = await buildPatientCsvPackage(patients);
assert.equal(packaged.patientCount, 2);
assert.equal(packaged.columnCount, flat.columns.length);
const zip = await JSZip.loadAsync(packaged.buffer);
assert.deepEqual(Object.keys(zip.files).sort(), ["data_dictionary.csv", "patient_data_flat.csv"]);
const patientCsv = await zip.file("patient_data_flat.csv")!.async("string");
const dictionaryCsv = await zip.file("data_dictionary.csv")!.async("string");
assert.ok(patientCsv.includes('"Ana, ""A"""'));
assert.ok(patientCsv.includes("Line one\nLine two"));
assert.ok(patientCsv.includes("දත්ත"));
assert.ok(dictionaryCsv.includes("Zero-based row index: 1"));

assert.deepEqual(JSON.parse(JSON.stringify(patients)), patients, "raw JSON backup must remain structurally exact");
assert.equal(isPrivilegedRole("admin"), true);
assert.equal(isPrivilegedRole("researcher"), true);
assert.equal(isPrivilegedRole("auditor"), true);
assert.equal(isPrivilegedRole("user"), false);

console.log(`Patient export tests passed: ${packaged.patientCount} patients, ${packaged.columnCount} columns.`);
