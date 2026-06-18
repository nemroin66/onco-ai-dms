import MANIFEST, { type ManifestField } from "../src/formManifest.js";
import { OncologyCategory } from "../src/types.js";
import { runGemini } from "./gemini.js";

export interface DocumentFillPayload {
  fileContent?: string;
  mimeType?: string;
  fileName?: string;
  sectionKey?: string;
  sectionTarget?: string;
  modelStartIndex?: number;
  extractionAttempt?: number;
}

export interface DocumentFillReport {
  mode: "document-understanding";
  fieldsFilled: number;
  rowsAdded: number;
  reviewIssues: string[];
  summary: string;
  targetSection: string;
  proposedChanges: ProposedChange[];
  suggestedElsewhere: SuggestedElsewhere[];
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/bmp",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/json",
]);
const BLOCKED_FORM_KEYS = new Set(["id", "auto_id", "createdAt", "updatedAt", "createdBy", "isDeleted", "driveFolderId"]);
const DOCUMENT_FILL_MODELS = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"];

export interface SourceEvidence {
  quote: string;
  location?: string;
  reason?: string;
}

export interface ProposedChange {
  target: string;
  action: "fill_field" | "append_value" | "append_row" | "review";
  value: unknown;
  evidence: SourceEvidence;
  sourceDocument: string;
  rowGroup?: string;
}

export interface SuggestedElsewhere {
  sourceKey: string;
  value: unknown;
  candidateTarget?: string;
  reason: string;
  sourceDocument: string;
}

type FieldRef = {
  sectionKey: string;
  sectionLabel: string;
  fieldKey: string;
  field: ManifestField;
  tableKey?: string;
};

function stripDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,(.*)$/);
  return {
    mimeFromDataUrl: match?.[1] || "",
    base64: match ? match[2] : value,
  };
}

export function extractJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const json = findFirstJsonObject(candidate);
  if (json) return JSON.parse(json);
  throw new Error("AI document understanding did not return a JSON object.");
}

function findFirstJsonObject(text: string) {
  const start = text.indexOf("{");
  if (start < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = inString;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return "";
}

function compactField(field: ManifestField): unknown {
  if (field.isArray) {
    return {
      type: "table",
      fields: Object.fromEntries(
        Object.entries(field.itemFields || {}).map(([key, itemField]) => [key, compactField(itemField)])
      ),
    };
  }
  if (field.options?.length) return { type: field.type, options: field.options };
  return field.type;
}

function normalizeToken(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeEvidenceText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} .:/+-]+/gu, "")
    .trim();
}

function valuesFromUnknown(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
  return value === undefined || value === null || value === "" ? [] : [value];
}

function coerceOption(value: unknown, options: string[]) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const rawToken = normalizeToken(raw);
  const exact = options.find((option) => option === raw);
  if (exact) return exact;
  return options.find((option) => normalizeToken(option) === rawToken) || "";
}

function coerceDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return "";
}

function coerceFieldValue(value: unknown, field: ManifestField, reviewIssues: string[], target: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (field.type === "readonly") {
    reviewIssues.push(`${target}: skipped readonly/calculated field.`);
    return undefined;
  }
  if (field.type === "date") {
    const date = coerceDate(value);
    if (!date) reviewIssues.push(`${target}: skipped because date was not explicit YYYY-MM-DD.`);
    return date || undefined;
  }
  if (field.type === "number") {
    const raw = String(value).trim();
    if (!raw || Number.isNaN(Number(raw))) {
      reviewIssues.push(`${target}: skipped non-numeric value "${raw}".`);
      return undefined;
    }
    return raw;
  }
  if (field.type === "select" || field.type === "radio") {
    if (!field.options?.length) return String(value).trim();
    const option = coerceOption(value, field.options);
    if (!option) {
      reviewIssues.push(`${target}: skipped unsupported option "${String(value)}".`);
      return undefined;
    }
    return option;
  }
  if (field.type === "multi-select" || field.type === "checkbox-group") {
    const values = valuesFromUnknown(value).map(String).map((item) => item.trim()).filter(Boolean);
    if (!field.options?.length) return values;
    const selected = values
      .map((item) => coerceOption(item, field.options || []))
      .filter(Boolean);
    const rejected = values.filter((item) => !coerceOption(item, field.options || []));
    rejected.forEach((item) => reviewIssues.push(`${target}: skipped unsupported option "${item}".`));
    return selected.length ? Array.from(new Set(selected)) : undefined;
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value).trim();
}

function buildFieldMap() {
  const topLevel = new Map<string, FieldRef>();
  const tableRows = new Map<string, Map<string, FieldRef>>();

  for (const [sectionKey, section] of Object.entries(MANIFEST.sections)) {
    for (const [fieldKey, field] of Object.entries(section.fields)) {
      topLevel.set(fieldKey, { sectionKey, sectionLabel: section.label, fieldKey, field });
      if (field.isArray && field.itemFields) {
        const rowMap = new Map<string, FieldRef>();
        for (const [rowFieldKey, rowField] of Object.entries(field.itemFields)) {
          rowMap.set(rowFieldKey, {
            sectionKey,
            sectionLabel: section.label,
            fieldKey: rowFieldKey,
            field: rowField,
            tableKey: fieldKey,
          });
        }
        tableRows.set(fieldKey, rowMap);
      }
    }
  }

  return { topLevel, tableRows };
}

function buildTargetSchema(sectionKey?: string) {
  const entries = Object.entries(MANIFEST.sections).filter(([key]) => {
    if (key === "documentExtractions") return false;
    return sectionKey ? key === sectionKey : true;
  });

  return Object.fromEntries(
    entries.map(([key, section]) => [
      key,
      {
        label: section.label,
        tableKey: section.tableKey || "",
        fields: Object.fromEntries(
          Object.entries(section.fields).map(([fieldKey, field]) => [fieldKey, compactField(field)])
        ),
      },
    ])
  );
}

function countData(data: Record<string, any>) {
  let fieldsFilled = 0;
  let rowsAdded = 0;
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) {
      rowsAdded += value.length;
      if (value.length > 0) fieldsFilled += 1;
    } else if (value && typeof value === "object") {
      if (Object.keys(value).length > 0) fieldsFilled += 1;
    } else if (value !== undefined && value !== null && String(value).trim() !== "") {
      fieldsFilled += 1;
    }
  }
  return { fieldsFilled, rowsAdded };
}

function textFromPlainPayload(mimeType: string, base64: string) {
  if (!/^(text\/|application\/json|text\/csv|application\/csv)/i.test(mimeType)) return "";
  return Buffer.from(base64, "base64").toString("utf8").slice(0, 200_000);
}

function normalizeMimeType(mimeType: string, fileName: string) {
  const lowerName = fileName.toLowerCase();
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".json")) return "application/json";
  if (lowerName.endsWith(".csv")) return "text/csv";
  if (lowerName.endsWith(".txt")) return "text/plain";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".tif") || lowerName.endsWith(".tiff")) return "image/tiff";
  if (lowerName.endsWith(".bmp")) return "image/bmp";
  if (lowerName.endsWith(".webp")) return "image/webp";
  return mimeType || "application/octet-stream";
}

function rotateModels(models: string[], startIndex: number) {
  const safeIndex = Number.isFinite(startIndex) ? Math.max(0, Math.floor(startIndex)) % models.length : 0;
  return [...models.slice(safeIndex), ...models.slice(0, safeIndex)];
}

function unwrapData(rawData: any) {
  const data = rawData?.data && typeof rawData.data === "object" ? rawData.data : rawData;
  const flat: Record<string, any> = {};
  for (const [key, value] of Object.entries(data || {})) {
    const section = MANIFEST.sections[key];
    if (section && value && typeof value === "object" && !Array.isArray(value)) {
      const sectionValue: any = value;
      const nested = sectionValue.fields && typeof sectionValue.fields === "object"
        ? sectionValue.fields
        : sectionValue.data && typeof sectionValue.data === "object"
          ? sectionValue.data
          : sectionValue;
      Object.assign(flat, nested);
    } else if (!["reviewIssues", "summary", "proposedChanges"].includes(key)) {
      flat[key] = value;
    }
  }
  return flat;
}

function evidenceByTarget(parsed: any, fileName: string, reviewIssues: string[]) {
  const map = new Map<string, ProposedChange>();
  const proposed = Array.isArray(parsed?.proposedChanges) ? parsed.proposedChanges : [];
  proposed.forEach((change: any) => {
    const target = String(change?.target || "").trim();
    if (!target) return;
    const evidence = change?.evidence && typeof change.evidence === "object" ? change.evidence : {};
    const quote = String(evidence.quote || "").trim();
    map.set(target, {
      target,
      action: change?.action === "append_row" || change?.action === "append_value" ? change.action : "fill_field",
      value: change?.value,
      evidence: {
        quote: quote || "No source quote returned by model.",
        location: evidence.location ? String(evidence.location) : undefined,
        reason: evidence.reason ? String(evidence.reason) : undefined,
      },
      sourceDocument: String(change?.sourceDocument || fileName),
      rowGroup: change?.rowGroup ? String(change.rowGroup) : undefined,
    });
    if (!quote) reviewIssues.push(`${target}: model did not return a source quote.`);
  });
  return map;
}

function clinicalRowGroup(tableKey: string, row: Record<string, any>, rowIndex: number) {
  const pick = (...keys: string[]) =>
    keys.map((key) => String(row[key] || "").trim()).filter(Boolean).join("|");
  if (tableKey === "biopsyTable") return pick("biopsy_date", "biopsy_type", "biopsy_parameter", "histological_type", "cell_type") || `${tableKey}-${rowIndex}`;
  if (tableKey === "immunohistochemistryTable") return pick("ihc_date", "ihc_specimen", "ihc_marker", "ihc_anatomical_site") || `${tableKey}-${rowIndex}`;
  if (tableKey === "imagingTable") return pick("imaging_date", "imaging_type", "anatomical_site", "mass_location", "imaging_parameter") || `${tableKey}-${rowIndex}`;
  if (tableKey === "tumorMarkersTable") return pick("marker_date", "marker_name", "marker_value") || `${tableKey}-${rowIndex}`;
  if (tableKey === "bloodTable") return pick("blood_date", "blood_type", "blood_purpose") || `${tableKey}-${rowIndex}`;
  if (tableKey === "geneticTable") return pick("date", "test_name", "gene", "variant") || `${tableKey}-${rowIndex}`;
  if (tableKey === "contrastTable") return pick("date", "study_type", "body_part") || `${tableKey}-${rowIndex}`;
  if (tableKey === "clinicalStagingTable") return pick("staging_date", "staging_system", "staging_type") || `${tableKey}-${rowIndex}`;
  if (tableKey === "tumorCharacteristicsTable") return pick("diagnosis_date", "specimen_type", "tumour_sites", "diagnostic_modality_parameter") || `${tableKey}-${rowIndex}`;
  return pick("date", "assessment_date", "surgery_date", "staging_date", "biopsy_date", "imaging_date") || `${tableKey}-${rowIndex}`;
}

export function validateDocumentData(parsed: any, sectionKey: string, fileName: string, sourceText = "") {
  const reviewIssues: string[] = Array.isArray(parsed?.reviewIssues)
    ? parsed.reviewIssues.map((item: any) => String(item)).filter(Boolean)
    : [];
  const { topLevel, tableRows } = buildFieldMap();
  const raw = unwrapData(parsed);
  const evidenceMap = evidenceByTarget(parsed, fileName, reviewIssues);
  const validated: Record<string, any> = {};
  const proposedChanges: ProposedChange[] = [];
  const suggestedElsewhere: SuggestedElsewhere[] = [];

  const addChange = (target: string, action: ProposedChange["action"], value: unknown, rowGroup?: string) => {
    const source = evidenceMap.get(target) || evidenceMap.get(target.replace(/\[\d+\]/, "")) || evidenceMap.get(target.split(".")[0]);
    const change: ProposedChange = {
      target,
      action,
      value,
      evidence: source?.evidence || {
        quote: "No source quote returned by model.",
        reason: "Generated from validated AI form data.",
      },
      sourceDocument: source?.sourceDocument || fileName,
      rowGroup: source?.rowGroup || rowGroup,
    };
    proposedChanges.push(change);
    return true;
  };

  const targetSection = sectionKey ? MANIFEST.sections[sectionKey] : undefined;
  const targetTableKey = targetSection?.tableKey || "";
  const addSuggestedElsewhere = (key: string, value: unknown, reason: string, candidateTarget?: string) => {
    suggestedElsewhere.push({
      sourceKey: key,
      value,
      candidateTarget,
      reason,
      sourceDocument: fileName,
    });
  };

  for (const [key, value] of Object.entries(raw)) {
    if (BLOCKED_FORM_KEYS.has(key)) {
      reviewIssues.push(`${key}: blocked system field.`);
      continue;
    }

    const topRef = topLevel.get(key);
    if (sectionKey && topRef && topRef.sectionKey !== sectionKey) {
      addSuggestedElsewhere(key, value, `Belongs to ${topRef.sectionLabel}, not target section ${targetSection?.label || sectionKey}.`, topRef.sectionKey);
      reviewIssues.push(`${key}: suggested for ${topRef.sectionLabel} instead of target section.`);
      continue;
    }
    if (topRef?.field.isArray) {
      if (!Array.isArray(value)) {
        reviewIssues.push(`${key}: expected rows array.`);
        continue;
      }
      const rowMap = tableRows.get(key) || new Map<string, FieldRef>();
      const rows = value
        .map((row: any, rowIndex) => {
          if (!row || typeof row !== "object" || Array.isArray(row)) {
            reviewIssues.push(`${key}[${rowIndex}]: skipped non-object row.`);
            return null;
          }
          const normalizedRow: Record<string, any> = {};
          const rowGroup = String(row.rowGroup || row._rowGroup || row.source_group || clinicalRowGroup(key, row, rowIndex));
          for (const [rowFieldKey, rowValue] of Object.entries(row)) {
            if (["rowGroup", "_rowGroup", "source_group"].includes(rowFieldKey)) continue;
            const rowRef = rowMap.get(rowFieldKey);
            if (!rowRef) {
              reviewIssues.push(`${key}[${rowIndex}].${rowFieldKey}: skipped unknown row field.`);
              continue;
            }
            const coerced = coerceFieldValue(rowValue, rowRef.field, reviewIssues, `${key}.${rowFieldKey}`);
            if (coerced !== undefined && coerced !== "") normalizedRow[rowFieldKey] = coerced;
          }
          if (Object.keys(normalizedRow).length === 0) return null;
          if (!addChange(`${key}[${rowIndex}]`, "append_row", normalizedRow, rowGroup)) return null;
          return normalizedRow;
        })
        .filter(Boolean);
      if (rows.length) validated[key] = rows;
      continue;
    }

    if (topRef) {
      if (topRef.sectionKey === "documentExtractions") continue;
      const coerced = key === "oncology_types"
        ? valuesFromUnknown(value)
            .map((item) => coerceOption(item, Object.values(OncologyCategory)))
            .filter(Boolean)
        : coerceFieldValue(value, topRef.field, reviewIssues, key);
      if (Array.isArray(coerced) ? coerced.length > 0 : coerced !== undefined && coerced !== "") {
        if (addChange(key, Array.isArray(coerced) ? "append_value" : "fill_field", coerced)) {
          validated[key] = coerced;
        }
      }
      continue;
    }

    const targetRowMap = targetTableKey ? tableRows.get(targetTableKey) : undefined;
    const rowRef = targetRowMap?.get(key);
    if (targetTableKey && rowRef) {
      const coerced = coerceFieldValue(value, rowRef.field, reviewIssues, `${targetTableKey}.${key}`);
      if (coerced !== undefined && coerced !== "") {
        validated[targetTableKey] = Array.isArray(validated[targetTableKey]) ? validated[targetTableKey] : [{}];
        validated[targetTableKey][0][key] = coerced;
      }
      continue;
    }

    addSuggestedElsewhere(key, value, sectionKey ? `Not part of target section ${sectionKey}.` : "No exact manifest field exists.");
    reviewIssues.push(`${key}: skipped unknown form field; saved as suggested elsewhere.`);
  }

  if (targetTableKey && Array.isArray(validated[targetTableKey]) && validated[targetTableKey]?.[0]) {
    if (!addChange(`${targetTableKey}[0]`, "append_row", validated[targetTableKey][0], clinicalRowGroup(targetTableKey, validated[targetTableKey][0], 0))) {
      delete validated[targetTableKey];
    }
  }

  return {
    data: validated,
    reviewIssues: Array.from(new Set<string>(reviewIssues)),
    proposedChanges,
    suggestedElsewhere,
  };
}

export async function runDocumentFill(payload: DocumentFillPayload) {
  const { base64, mimeFromDataUrl } = stripDataUrl(String(payload.fileContent || ""));
  const fileName = String(payload.fileName || "clinical-document");
  const mimeType = normalizeMimeType(String(payload.mimeType || mimeFromDataUrl || "application/octet-stream"), fileName);
  const sectionKey = payload.sectionKey && MANIFEST.sections[payload.sectionKey]
    ? payload.sectionKey
    : "";
  const sectionTarget = String(payload.sectionTarget || MANIFEST.sections[sectionKey]?.label || "Whole Patient Form");

  if (!base64) {
    const error = new Error("No document content was provided.");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const byteLength = Buffer.byteLength(base64, "base64");
  if (byteLength > MAX_DOCUMENT_BYTES) {
    const error = new Error("Document is larger than 10 MB.");
    (error as Error & { status?: number }).status = 413;
    throw error;
  }
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    const error = new Error("Unsupported document type. Use PDF, image, text, CSV, or JSON. Office files need a parser before AI filling.");
    (error as Error & { status?: number }).status = 415;
    throw error;
  }

  const schema = buildTargetSchema(sectionKey);
  const plainText = textFromPlainPayload(mimeType, base64);
  const systemInstruction = [
    "You are a clinical document understanding and patient-form filling agent.",
    "Read the document title if availble and the document content together. Use the document title as context only; never invent values from the name alone.",
    "Return only JSON for fields that are supported by the document evidence.",
    "For select/radio fields, use exactly one listed option. For multi-select/checklist fields, return arrays or comma-separated values that match listed options.",
    "For repeatable clinical facts, add table rows instead of collapsing multiple facts into one field.",
    "If a useful fact has no exact field, place it in unmapped_medical_information or supplementaryDetailsTable when those fields are in the target schema.",
    "Existing form data is preserved by the app. Your job is to provide new form-ready facts from this document.",
  ].join("\n");

  const prompt = [
    `Document name: ${fileName}`,
    `MIME type: ${mimeType}`,
    `Target form area: ${sectionTarget}${sectionKey ? ` (${sectionKey})` : ""}`,
    "",
    "Return this JSON shape:",
    `{"data":{...form fields...},"proposedChanges":[{"target":"fieldKey or tableKey[index]","action":"fill_field|append_value|append_row","value":"same value as data target","evidence":{"quote":"short exact source quote","location":"page/section/table if known","reason":"why this target is correct"},"sourceDocument":"${fileName}","rowGroup":"date/specimen/modality/site anchor if row"}],"reviewIssues":["unclear or unsupported items"],"summary":"one short clinical summary of what was understood"}`,
    "",
    "Use only these target form sections and exact field keys:",
    JSON.stringify(schema),
    "",
    "Important filling rules:",
    "- Use YYYY-MM-DD for dates",
    "- Keep units inside the relevant value/unit fields when available.",
    "- Put each past medical history, past surgical history, drug history,family history,other risk factors, examination findings, investigations, other blood reports findings, tumour markers, genetic tests results, biopsy, imaging result, tumour sites, tumor size, tumour features,adjuvant therapy details treatment, surgery, follow-up, or outcome event into its own row.",
    plainText ? `\nDocument text:\n${plainText}` : "",
  ].filter(Boolean).join("\n");

  const parts: any[] = [{ text: prompt }];
  if (!plainText) {
    parts.push({ inlineData: { mimeType, data: base64 } });
  }

  const text = await runGemini([{ role: "user", parts }], systemInstruction, "application/json", {
    models: rotateModels(DOCUMENT_FILL_MODELS, Number(payload.modelStartIndex || 0)),
    apiVersions: ["v1beta"],
    enableDiscovery: false,
    fallbackModels: [],
    timeoutMs: 52_000,
    perAttemptTimeoutMs: 14_000,
  });
  const parsed = extractJsonObject(text);
  const validated = validateDocumentData(parsed, sectionKey, fileName, plainText);
  const data = validated.data;
  const { fieldsFilled, rowsAdded } = countData(data);

  return {
    data,
    proposedChanges: validated.proposedChanges,
    suggestedElsewhere: validated.suggestedElsewhere,
    agentReport: {
      mode: "document-understanding",
      fieldsFilled,
      rowsAdded,
      reviewIssues: validated.reviewIssues,
      summary: String(parsed?.summary || `${fileName} understood and mapped to the patient form.`),
      targetSection: sectionTarget,
      proposedChanges: validated.proposedChanges,
      suggestedElsewhere: validated.suggestedElsewhere,
    } satisfies DocumentFillReport,
  };
}
