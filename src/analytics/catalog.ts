import MANIFEST, { type ManifestField } from "../formManifest.js";
import type { AnalyticsField } from "./types.js";

const blockedPattern = /(name|initial|nic|tp|bht|clinic|ward|hospital|location|occupation|notes?|detail|finding|summary|complaint|history|management|link|file|document|raw|unmapped|cause_of_death)/i;
const numericNames = new Set([
  "age", "bmi", "bsa", "height", "weight", "charlson_index", "functional_adl_score",
  "functional_iadl_score", "diagnosis_delay_days", "stroma_percentage", "ki67_percentage",
  "tumor_necrosis_percentage", "hospital_stay_days", "icu_stay_days", "days_diag_to_therapy",
  "qol_score", "tumor_size_length", "tumor_size_width", "tumor_size_depth", "breslow_thickness",
  "gleason_score", "gleason_grade_group", "clavien_dindo_grade",
]);
const safeTextNames = new Set([
  "status", "gender", "marital_status", "education_status", "ethnicity", "geographic_accessibility",
  "oncology", "overall_stage", "tnm_stage", "ecog_status", "smoking", "alcohol",
  "final_diagnosis", "provisional_diagnosis", "survival_status", "recurrence_status",
  "overall_response", "response_evaluation_criteria", "therapy_type", "treatment_adherence",
  "recovery_status", "discharge_status", "discharge_destination", "clinical_trial_enrollment",
]);

function titleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dataTypeFor(name: string, field: ManifestField): AnalyticsField["dataType"] | null {
  if (field.type === "date") return "date";
  if (field.type === "number" || numericNames.has(name)) return "numeric";
  if (field.type === "select" || field.type === "radio" || field.type === "multi-select") return "categorical";
  if (safeTextNames.has(name)) return "categorical";
  return null;
}

function addField(
  fields: AnalyticsField[],
  section: string,
  name: string,
  field: ManifestField,
  prefix = "",
  eventRoot?: string,
) {
  const path = prefix ? `${prefix}.${name}` : name;
  if (field.isArray && field.itemFields) {
    const root = prefix ? `${prefix}.${name}` : name;
    for (const [childName, child] of Object.entries(field.itemFields)) {
      if (!child.isArray) addField(fields, section, childName, child, root, root);
    }
    return;
  }

  const dataType = dataTypeFor(name, field);
  if (!dataType || blockedPattern.test(name)) return;
  fields.push({
    path,
    label: eventRoot
      ? `${titleCase(section)} · ${titleCase(eventRoot.split(".").pop() || eventRoot)} · ${titleCase(name)}`
      : `${titleCase(section)} · ${titleCase(name)}`,
    section,
    dataType,
    repeated: Boolean(eventRoot),
    eventRoot,
    allowedAsDimension: dataType !== "numeric" || safeTextNames.has(name),
    allowedAsMeasure: dataType === "numeric",
    options: field.options,
  });
}

export function buildAnalyticsCatalog(): AnalyticsField[] {
  const fields: AnalyticsField[] = [{
    path: "patient.count",
    label: "Patient Count",
    section: "Calculated",
    dataType: "numeric",
    repeated: false,
    allowedAsDimension: false,
    allowedAsMeasure: true,
  }];

  for (const section of Object.values(MANIFEST.sections)) {
    for (const [name, field] of Object.entries(section.fields)) {
      addField(fields, section.label, name, field);
    }
  }

  return fields.sort((a, b) => a.label.localeCompare(b.label));
}

export const analyticsCatalog = buildAnalyticsCatalog();
export const analyticsFieldMap = new Map(analyticsCatalog.map((field) => [field.path, field]));
