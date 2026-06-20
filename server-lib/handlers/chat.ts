import type { VercelRequest, VercelResponse } from "@vercel/node";
import { runGemini } from "../gemini.js";
import { getFirestoreDoc } from "../firebase.js";
import { vercelUser } from "../auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query, patientId } = req.body || {};
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Query is required" });
  }

  // Prompt injection guardrails
  if (query.length > 2000) {
    return res.status(400).json({ error: "Query exceeds maximum length of 2000 characters." });
  }
  // Only allow printable ASCII and common Unicode (prevent control char injection)
  const cleaned = query.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  if (cleaned !== query) {
    return res.status(400).json({ error: "Query contains invalid control characters." });
  }

  let patient: Record<string, any> = {};
  if (patientId && typeof patientId === "string") {
    const fetched = await getFirestoreDoc("patients", patientId);
    if (fetched) {
      const user = vercelUser(req);
      if (fetched.createdBy && fetched.createdBy !== user.uid && user.role === "user") {
        return res.status(403).json({ error: "Access denied to this patient's records." });
      }
      if (fetched.consent_ai_processing === false) {
        return res.status(403).json({ error: "Patient has not consented to AI data processing." });
      }
      patient = fetched;
    }
  }

  const pick = (v: any) => (v === undefined || v === null || v === "" ? "—" : String(v));
  const list = (arr: any[], map: (r: any) => string, max = 8) =>
    Array.isArray(arr) && arr.length
      ? arr.slice(0, max).map(map).filter(Boolean).join("\n")
      : "—";

  const demographics = [
    `Name: ${pick(patient.first_name)} ${pick(patient.last_name)}`,
    `Title: ${pick(patient.title)}`,
    `DOB: ${pick(patient.dob)}  Age: ${pick(patient.age)}  Sex: ${pick(patient.gender)}`,
    `NIC: ${pick(patient.nic)}  TP/Clinic: ${pick(patient.tp)}`,
    `Oncology: ${pick(patient.oncology)}${Array.isArray(patient.oncology_types) && patient.oncology_types.length ? "  (" + patient.oncology_types.join(", ") + ")" : ""}`,
    `Oncology other: ${pick(patient.oncology_other)}`,
  ].join("\n");

  const diagnosis = [
    `Provisional: ${pick(patient.provisional_diagnosis)}`,
    `Final: ${pick(patient.final_diagnosis)}`,
    `Overall stage: ${pick(patient.overall_stage)}`,
    `TNM: ${pick(patient.tnm_stage)}`,
  ].join("\n");

  const blood = list(patient.bloodTable, (r: any) =>
    `  - ${pick(r.blood_type)} ${pick(r.blood_purpose)}${r.blood_date ? " (" + r.blood_date + ")" : ""}: ${pick(r.blood_findings)}${r.blood_notes ? "  // " + r.blood_notes : ""}`);

  const tumorMarkers = list(patient.tumorMarkersTable, (r: any) =>
    `  - ${pick(r.marker_name)} = ${pick(r.marker_value)} ${pick(r.marker_unit)}${r.marker_date ? " (" + r.marker_date + ")" : ""}`);

  const imaging = list(patient.imagingTable, (r: any) => {
    const mass = [r.mass_present, r.mass_size, r.mass_location, r.calcifications].filter(Boolean).join(" / ");
    const ext = [r.lymph_nodes, r.metastasis, r.ascites, r.pv_status, r.sma_status].filter(Boolean).join(" | ");
    return `  - ${pick(r.imaging_type)} ${pick(r.imaging_purpose)} target ${pick(r.imaging_parameter)}: ${pick(r.imaging_findings)}${mass ? " | mass " + mass : ""}${ext ? " | " + ext : ""}`;
  });

  const biopsy = list(patient.biopsyTable, (r: any) => {
    const ext = [r.cell_type, r.margin_status, r.lvi, r.perineural_invasion, r.lymph_nodes, r.metastasis].filter(Boolean).join(", ");
    return `  - ${pick(r.biopsy_type)} ${pick(r.biopsy_purpose)} site ${pick(r.biopsy_parameter)}: ${pick(r.biopsy_findings)}  // ${ext}`;
  });

  const ihc = list(patient.immunohistochemistryTable, (r: any) =>
    `  - ${pick(r.ihc_marker)} [${pick(r.ihc_panel)}]: ${pick(r.ihc_result)} ${pick(r.ihc_intensity)} ${pick(r.ihc_percentage)} score=${pick(r.ihc_score)} pattern=${pick(r.ihc_pattern)} interp=${pick(r.ihc_interpretation)}`);

  const surgery = list(patient.surgeryTable, (r: any) => {
    const drains = [r.drain_status, r.drain_volume].filter(Boolean).join(" ");
    return `  - ${pick(r.surgery_name)} ${pick(r.surgery_date)} site ${pick(r.surgery_site)} approach ${pick(r.surgery_approach)}: ${pick(r.surgery_findings)}${drains ? "  drains: " + drains : ""}`;
  });

  const complications = list(patient.complicationTable, (r: any) =>
    `  - ${pick(r.complication)} @ ${pick(r.post_op_duration)}: ${pick(r.management)}${r.notes ? "  notes: " + r.notes : ""}`);

  const monitoring = list(patient.monitoringTable, (r: any) =>
    `  - ${pick(r.monitor_param)} ${pick(r.monitor_duration)}: ${pick(r.monitor_findings)}${r.monitor_notes ? "  notes: " + r.monitor_notes : ""}`);

  const icu = list(patient.icuTable, (r: any) =>
    `  - admitted ${pick(r.icu_date)}, stay ${pick(r.icu_stay)}d, exit ${pick(r.icu_exit)}: ${pick(r.icu_mgmt)}${r.icu_notes ? "  notes: " + r.icu_notes : ""}`);

  const ward = list(patient.wardTable, (r: any) =>
    `  - entered ${pick(r.ward_entry)}, stay ${pick(r.ward_stay)}d, exit ${pick(r.ward_exit)}: ${pick(r.ward_mgmt)}${r.ward_notes ? "  notes: " + r.ward_notes : ""}`);

  const chemo = list(patient.neoChemoTable, (r: any) =>
    `  - [Neo] ${pick(r.neo_chemo_drug)} ${pick(r.neo_chemo_dose)} ${pick(r.neo_chemo_freq)} ${pick(r.neo_chemo_route)} x${pick(r.neo_chemo_cycles)}  effects: ${pick(r.neo_chemo_effects)}`);

  const adjChemo = list(patient.adjChemoTable, (r: any) =>
    `  - [Adj] ${pick(r.neo_chemo_drug)} ${pick(r.neo_chemo_dose)} ${pick(r.neo_chemo_freq)} ${pick(r.neo_chemo_route)} x${pick(r.neo_chemo_cycles)}  effects: ${pick(r.neo_chemo_effects)}`);

  const radio = list(patient.neoRadioTable, (r: any) =>
    `  - [Neo] ${pick(r.neo_radio_comp)} ${pick(r.neo_radio_dose)}Gy ${pick(r.neo_radio_route)} x${pick(r.neo_radio_cycles)}  effects: ${pick(r.neo_radio_effects)}`);

  const adjRadio = list(patient.adjRadioTable, (r: any) =>
    `  - [Adj] ${pick(r.neo_radio_comp)} ${pick(r.neo_radio_dose)}Gy ${pick(r.neo_radio_route)} x${pick(r.neo_radio_cycles)}  effects: ${pick(r.neo_radio_effects)}`);

  const supplementary = list(patient.supplementaryDetailsTable, (r: any) =>
    `  - [${pick(r.detail_heading)}${r.detail_subheading ? " / " + r.detail_subheading : ""}] ${pick(r.detail_label)} = ${pick(r.detail_value)} ${pick(r.detail_unit)}${r.detail_date ? " (" + r.detail_date + ")" : ""}${r.detail_priority ? " [" + r.detail_priority + "]" : ""}`);

  const problems = list(patient.problemTable, (r: any) =>
    `  - ${pick(r.problem)}  plan: ${pick(r.management_plan)}`);

  const userPrompt = `PATIENT MEDICAL RECORD (structured summary):

== Demographics ==
${demographics}

== Diagnosis & Staging ==
${diagnosis}

== Comorbidities & History ==
${pick(patient.comorbidity)}
${pick(patient.allergy_food)} ${pick(patient.allergy_drugs)} ${pick(patient.allergy_plasters)} ${pick(patient.allergy_other)}
${pick(patient.smoking)} ${pick(patient.smoking_amount)}
${pick(patient.alcohol)} ${pick(patient.alcohol_amount)}

== Blood / Labs ==
${blood}

== Tumor Markers ==
${tumorMarkers}

== Imaging ==
${imaging}

== Biopsy / Histopathology ==
${biopsy}

== Immunohistochemistry (IHC) ==
${ihc}

== Surgical Procedures ==
${surgery}

== Post-op Complications ==
${complications}

== Post-op Monitoring ==
${monitoring}

== ICU (status: ${pick(patient.icu_done)}) ==
${icu}

== Ward ==
${ward}

== Chemotherapy ==
Neo-adjuvant (status: ${pick(patient.neo_chemo_status)}):
${chemo}
Adjuvant (status: ${pick(patient.adj_chemo_status)}):
${adjChemo}

== Radiotherapy ==
Neo-adjuvant (status: ${pick(patient.neo_radio_status)}):
${radio}
Adjuvant (status: ${pick(patient.adj_radio_status)}):
${adjRadio}

== Supplementary Details ==
${supplementary}

== Active Problems / Plan ==
${problems}

== Care Notes ==
Follow-up: ${pick(patient.follow_up_notes)}
General: ${pick(patient.general_notes)}

== Clinician question ==
${cleaned}

== Answer requirements ==
- Ground every claim in the patient's record above. If data is missing, say "not on file" rather than guessing.
- When you reference a guideline, name the source and year (e.g. "NCCN 2024 breast cancer guidelines", "ESMO 2023", "ASCO 2022").
- **OUTPUT FORMAT (use markdown exactly as shown):**
  - Start with RED FLAGS section if any: "#" + "# RED FLAGS" then bullet points
  - Use "#" + "# Section Title" for major sections (Assessment, Management, Investigations, Therapy, Follow-up)
  - Use "#" + "## Subsection" for sub-sections
  - Bold key terms with "**term**"
  - Use bullet lists with "- " for scannable points
  - End with "#" + "# Suggested Follow-Up Questions" and numbered list "1. Question"
- Highlight RED FLAGS (e.g. rising tumor markers, new symptoms, treatment-stopping toxicity) at the top.
- At the end, list 2-4 SUGGESTED FOLLOW-UP QUESTIONS the clinician could ask next.
- Do NOT present autonomous treatment orders. Frame all suggestions as clinician-decision support.

== Output Example ==
#"# RED FLAGS
- **Rising CEA**: 12.4 \u2192 28.7 ng/mL over 3 months \u2014 suggests progression
- **New liver lesion** on imaging not previously documented

#"# Assessment
**Stage IV colorectal cancer** with liver metastases. ECOG 1.

#"## Key Findings
- **Tumor markers**: CEA rising (12.4 \u2192 28.7 ng/mL)
- **Imaging**: 3 new liver lesions, largest 3.2 cm segment VII
- **Biopsy**: Adenocarcinoma, RAS wild-type (on file)

#"# Management
- **NCCN 2024**: FOLFOX + bevacizumab preferred first-line for RAS wild-type
- **ESMO 2023**: Consider liver-directed therapy if oligometastatic
- **Action**: MDT discussion for potential resection/ablation

## Suggested Follow-Up Questions
1. Should we obtain liquid biopsy for RAS status confirmation?
2. Is patient a candidate for clinical trial?
3. Should we refer for hepatic MDT evaluation?`;

  const systemInstruction = `You are a clinician-facing oncology AI co-pilot. You answer questions about a specific patient by combining the patient's record with current standard oncological guidelines (NCCN, ESMO, ASCO, ASTRO, AJCC 8th ed., etc.). Always cite guideline source + year. Be concise, scannable, and safety-first: if data is missing, prompt for it; if findings conflict, call it out. Never claim you have prescribed or treated the patient.`;

  try {
    const text = await runGemini(userPrompt, systemInstruction, undefined);
    // Sanitize AI output — strip raw HTML tags to prevent XSS
    const sanitized = text.replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/javascript\s*:/gi, "disabled:");
    return res.json({ reply: sanitized, text: sanitized });
  } catch (error: any) {
    console.error("[/api/chat] Gemini error:", error?.message || error);
    if (error?.stack) console.error(error.stack);
    return res.status(502).json({ error: "AI chat failed." });
  }
}
