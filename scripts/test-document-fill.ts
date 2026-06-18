import assert from "node:assert/strict";
import { validateDocumentData } from "../server-lib/document-fill.js";

const wrapped = validateDocumentData(
  {
    data: {
      demographics: {
        gender: "female",
        status: "under treatment",
      },
      id: "server-field-must-not-fill",
      made_up_field: "not in manifest",
    },
    proposedChanges: [
      {
        target: "gender",
        action: "fill_field",
        value: "female",
        evidence: {
          quote: "Female patient reviewed in clinic",
          location: "clinic letter",
          reason: "Demographic field explicitly documented",
        },
        sourceDocument: "clinic-letter.pdf",
      },
    ],
    reviewIssues: [],
  },
  "",
  "clinic-letter.txt",
  "Female patient reviewed in clinic"
);

assert.equal(wrapped.data.gender, "Female");
assert.equal(wrapped.data.status, "under_treatment");
assert.equal(wrapped.data.id, undefined);
assert.equal(wrapped.data.made_up_field, undefined);
assert.ok(wrapped.reviewIssues.some((issue) => issue.includes("id: blocked system field")));
assert.ok(wrapped.reviewIssues.some((issue) => issue.includes("made_up_field: skipped unknown form field; saved as suggested elsewhere")));
assert.ok(wrapped.proposedChanges.some((change) => change.target === "gender" && change.evidence.quote.includes("Female patient")));
assert.ok(wrapped.proposedChanges.some((change) => change.target === "status" && change.action === "fill_field"));
assert.ok(wrapped.suggestedElsewhere.some((suggestion) => suggestion.sourceKey === "made_up_field"));

const investigationRows = validateDocumentData(
  {
    data: {
      imagingTable: [
        {
          imaging_type: "CT",
          imaging_date: "2026-05-20",
          imaging_findings: "Left lung mass",
          mass_present: "yes",
          ascites: "large",
        },
        {
          imaging_type: "MRI",
          imaging_date: "20/05/2026",
          imaging_findings: "No brain metastases",
          mass_present: "No",
        },
      ],
    },
    proposedChanges: [
      {
        target: "imagingTable[0]",
        action: "append_row",
        value: {},
        evidence: {
          quote: "CT 20 May 2026: left lung mass",
          location: "radiology report",
          reason: "Imaging row anchored by modality and date",
        },
        sourceDocument: "ct-report.pdf",
        rowGroup: "CT|2026-05-20|left lung",
      },
      {
        target: "imagingTable[1]",
        action: "append_row",
        value: {},
        evidence: {
          quote: "MRI brain: no brain metastases",
          location: "radiology report",
          reason: "Separate modality should be a separate row",
        },
        sourceDocument: "ct-report.pdf",
        rowGroup: "MRI|brain",
      },
    ],
    reviewIssues: [],
  },
  "",
  "ct-report.pdf",
  "CT 20 May 2026: left lung mass. MRI brain: no brain metastases."
);

assert.equal(investigationRows.data.imagingTable.length, 2);
assert.equal(investigationRows.data.imagingTable[0].mass_present, "Yes");
assert.equal(investigationRows.data.imagingTable[0].ascites, undefined);
assert.equal(investigationRows.data.imagingTable[1].imaging_date, undefined);
assert.ok(investigationRows.reviewIssues.some((issue) => issue.includes("imagingTable.ascites: skipped unsupported option")));
assert.ok(investigationRows.reviewIssues.some((issue) => issue.includes("imagingTable.imaging_date: skipped because date was not explicit")));

const sectionBareFields = validateDocumentData(
  {
    data: {
      laterality: "left",
      specimen_type: "core needle biopsy",
      diagnosis_date: "2026-05-18",
    },
    proposedChanges: [],
    reviewIssues: [],
  },
  "tumorCharacteristics",
  "biopsy-report.pdf"
);

assert.deepEqual(sectionBareFields.data.tumorCharacteristicsTable, [
  {
    laterality: "Left",
    specimen_type: "Core needle biopsy",
    diagnosis_date: "2026-05-18",
  },
]);
assert.ok(sectionBareFields.proposedChanges.some((change) => change.target === "tumorCharacteristicsTable[0]" && change.action === "append_row"));

const evidencedSectionBareFields = validateDocumentData(
  {
    data: {
      laterality: "left",
      specimen_type: "core needle biopsy",
      diagnosis_date: "2026-05-18",
    },
    proposedChanges: [
      {
        target: "tumorCharacteristicsTable[0]",
        action: "append_row",
        value: {},
        evidence: {
          quote: "Left breast core needle biopsy reported on 2026-05-18",
          location: "biopsy report",
          reason: "Specimen, laterality, and diagnosis date are explicit",
        },
        sourceDocument: "biopsy-report.pdf",
        rowGroup: "2026-05-18|Core needle biopsy|Left",
      },
    ],
    reviewIssues: [],
  },
  "tumorCharacteristics",
  "biopsy-report.pdf",
  "Left breast core needle biopsy reported on 2026-05-18"
);

assert.deepEqual(evidencedSectionBareFields.data.tumorCharacteristicsTable, [
  {
    laterality: "Left",
    specimen_type: "Core needle biopsy",
    diagnosis_date: "2026-05-18",
  },
]);
assert.ok(evidencedSectionBareFields.proposedChanges.some((change) => change.rowGroup === "2026-05-18|Core needle biopsy|Left"));

const unverifiedQuote = validateDocumentData(
  {
    data: { gender: "Female" },
    proposedChanges: [
      {
        target: "gender",
        action: "fill_field",
        value: "Female",
        evidence: { quote: "Female patient", reason: "Explicit demographic" },
        sourceDocument: "clinic-letter.txt",
      },
    ],
    reviewIssues: [],
  },
  "",
  "clinic-letter.txt",
  "Male patient reviewed in clinic"
);

assert.equal(unverifiedQuote.data.gender, "Female");
assert.ok(unverifiedQuote.proposedChanges.some((change) => change.target === "gender" && change.action === "fill_field"));

const binaryWithoutText = validateDocumentData(
  {
    data: { gender: "Female" },
    proposedChanges: [
      {
        target: "gender",
        action: "fill_field",
        value: "Female",
        evidence: { quote: "Female patient", reason: "Model quote from image/PDF" },
        sourceDocument: "scan.pdf",
      },
    ],
    reviewIssues: [],
  },
  "",
  "scan.pdf"
);

assert.equal(binaryWithoutText.data.gender, "Female");
assert.equal(binaryWithoutText.reviewIssues.some((issue) => issue.includes("No deterministic extracted text is available")), false);

console.log("document fill validator tests passed");
