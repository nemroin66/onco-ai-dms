export type Severity = 'normal' | 'borderline' | 'abnormal' | 'critical';

export interface FieldInterpretation {
  text: string;
  severity: Severity;
}

export const formatFileSize = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const humanizeBackupKey = (key: string) => (
  key
    .replace(/Table$/, "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

export const formatBackupMiniValue = (value: any): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined && item !== null && String(typeof item === "object" ? JSON.stringify(item) : item).trim() !== "")
      .map((item) => formatBackupMiniValue(item))
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, childValue]) => childValue !== undefined && childValue !== null && formatBackupMiniValue(childValue))
      .map(([childKey, childValue]) => `${humanizeBackupKey(childKey)}: ${formatBackupMiniValue(childValue)}`)
      .join("; ");
  }
  return String(value);
};

export const parseBackupMiniSummary = (raw: string) => {
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const fields = parsed?.data && typeof parsed.data === "object"
    ? Object.entries(parsed.data)
        .filter(([, value]) => formatBackupMiniValue(value))
        .slice(0, 12)
        .map(([key, value]) => ({
          label: humanizeBackupKey(key),
          value: formatBackupMiniValue(value).slice(0, 220),
        }))
    : [];

  const changes = Array.isArray(parsed?.proposedChanges)
    ? parsed.proposedChanges.slice(0, 8).map((change: any) => ({
        target: humanizeBackupKey(String(change?.target || "Review")),
        action: humanizeBackupKey(String(change?.action || "Fill")),
        evidence: String(change?.evidence?.quote || ""),
      }))
    : [];

  const suggestions = Array.isArray(parsed?.suggestedElsewhere)
    ? parsed.suggestedElsewhere.slice(0, 6).map((suggestion: any) => ({
        target: humanizeBackupKey(String(suggestion?.candidateTarget || suggestion?.sourceKey || "Suggested Field")),
        detail: formatBackupMiniValue(suggestion?.detail ?? suggestion?.value ?? "").slice(0, 220),
        reason: String(suggestion?.reason || ""),
      }))
    : [];

  const reviewIssues = Array.isArray(parsed?.reviewIssues) ? parsed.reviewIssues.map(String).slice(0, 6) : [];
  return { fields, changes, suggestions, reviewIssues };
};

export function severityBorder(sev: Severity): string {
  const map: Record<Severity, string> = {
    normal: 'border-emerald-400 dark:border-emerald-500',
    borderline: 'border-amber-400 dark:border-amber-500',
    abnormal: 'border-orange-400 dark:border-orange-500',
    critical: 'border-rose-400 dark:border-rose-500',
  };
  return map[sev];
}

export function severityBadge(sev: Severity): string {
  const map: Record<Severity, string> = {
    normal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    borderline: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    abnormal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    critical: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  };
  return map[sev];
}

const LAB_RANGES: Record<string, { low: number; high: number; borderlineLow: number; borderlineHigh: number; criticalLow: number; criticalHigh: number }> = {
  lab_hb: { low: 12, high: 17.5, borderlineLow: 10, borderlineHigh: 18.5, criticalLow: 7, criticalHigh: 20 },
  lab_wbc: { low: 4, high: 11, borderlineLow: 3, borderlineHigh: 15, criticalLow: 1, criticalHigh: 30 },
  lab_platelets: { low: 150, high: 400, borderlineLow: 100, borderlineHigh: 500, criticalLow: 50, criticalHigh: 700 },
  lab_creatinine: { low: 60, high: 110, borderlineLow: 45, borderlineHigh: 150, criticalLow: 30, criticalHigh: 300 },
  lab_egfr: { low: 90, high: 150, borderlineLow: 60, borderlineHigh: 999, criticalLow: 30, criticalHigh: 999 },
  lab_albumin: { low: 35, high: 50, borderlineLow: 30, borderlineHigh: 55, criticalLow: 20, criticalHigh: 60 },
  lab_inr: { low: 0.8, high: 1.2, borderlineLow: 0.5, borderlineHigh: 1.5, criticalLow: 0.3, criticalHigh: 3 },
  lab_aptt: { low: 25, high: 35, borderlineLow: 20, borderlineHigh: 45, criticalLow: 15, criticalHigh: 60 },
  lab_alt: { low: 10, high: 40, borderlineLow: 5, borderlineHigh: 80, criticalLow: 3, criticalHigh: 200 },
  lab_ast: { low: 10, high: 40, borderlineLow: 5, borderlineHigh: 80, criticalLow: 3, criticalHigh: 200 },
  lab_bilirubin: { low: 3, high: 21, borderlineLow: 1, borderlineHigh: 35, criticalLow: 0.5, criticalHigh: 100 },
  lab_crp: { low: 0, high: 5, borderlineLow: 0, borderlineHigh: 20, criticalLow: 0, criticalHigh: 100 },
  lab_troponin: { low: 0, high: 0.04, borderlineLow: 0, borderlineHigh: 0.1, criticalLow: 0, criticalHigh: 1 },
  lab_bnp: { low: 0, high: 100, borderlineLow: 0, borderlineHigh: 300, criticalLow: 0, criticalHigh: 1000 },
};

export function interpretLabValue(field: string, value: string): FieldInterpretation | null {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  const r = LAB_RANGES[field];
  if (!r) return null;
  if (field === 'lab_egfr') {
    if (num >= r.low) return { text: 'Normal', severity: 'normal' };
    if (num >= r.borderlineLow) return { text: 'Mild ↓', severity: 'borderline' };
    if (num >= r.criticalLow) return { text: 'Moderate ↓', severity: 'abnormal' };
    return { text: 'Severe ↓', severity: 'critical' };
  }
  if (num >= r.low && num <= r.high) return { text: 'Normal', severity: 'normal' };
  if (num < r.criticalLow || num > r.criticalHigh) return { text: 'Critical', severity: 'critical' };
  if (num < r.borderlineLow || num > r.borderlineHigh) {
    const dir = num < r.low ? '↓' : '↑';
    return { text: `Abnormal ${dir}`, severity: 'abnormal' };
  }
  const dir = num < r.low ? '↓' : '↑';
  return { text: `Borderline ${dir}`, severity: 'borderline' };
}

export function interpretCategoricalSeverity(_field: string, value: string): FieldInterpretation | null {
  if (!value) return null;
  const low = ['normal', 'none', 'no', 'negative', 'well', 'controlled', 'low', 'absent', 'cleared', 'immunocompetent'];
  const warn = ['mild', 'borderline', 'intermediate', 'prediabetes', 'risk', 'injury', 'stage 1', 'g3a', 'g3b'];
  const abn = ['moderate', 'abnormal', 'high', 'failure', 'stage 2', 'stage 3', 'stage 4', 'decompensated', 'positive'];
  const crit = ['severe', 'critical', 'failure', 'stage 5', 'esrd', 'nephrotic', 'uncontrolled', 'cachectic'];
  const v = value.toLowerCase();
  if (crit.some(k => v.includes(k))) return { text: 'Critical', severity: 'critical' };
  if (abn.some(k => v.includes(k))) return { text: 'Abnormal', severity: 'abnormal' };
  if (warn.some(k => v.includes(k))) return { text: 'Borderline', severity: 'borderline' };
  if (low.some(k => v.includes(k))) return { text: 'Normal', severity: 'normal' };
  return null;
}

export function interpretLiverKidney(field: string, value: string): FieldInterpretation | null {
  if (!value) return null;
  const v = value.toLowerCase();
  const statusRanges: Record<string, { crit: string[]; abn: string[]; warn: string[] }> = {
    liver_assessment_status: {
      crit: ['decompensated', 'active', 'cirrhosis'],
      abn: ['compensated', 'alcohol'],
      warn: ['nafld', 'fatty', 'hepatitis b', 'hepatitis c', 'carrier'],
    },
    kidney_assessment_status: {
      crit: ['failure', 'polycystic'],
      abn: ['acute', 'chronic', 'nephropathy'],
      warn: ['solitary'],
    },
    liver_child_pugh_grade: { crit: ['c'], abn: ['b'], warn: [] },
    liver_albi_grade: { crit: ['3'], abn: ['2'], warn: [] },
    liver_fibrosis_stage: { crit: ['f4'], abn: ['f3'], warn: ['f2'] },
    kidney_ckd_stage: { crit: ['stage 5'], abn: ['stage 4', 'stage 3b'], warn: ['stage 3a', 'stage 2'] },
    kidney_egfr_category: { crit: ['g5'], abn: ['g4', 'g3b'], warn: ['g3a', 'g2'] },
    kidney_rifle_stage: { crit: ['esrd', 'failure'], abn: ['injury', 'loss'], warn: ['risk'] },
    kidney_akin_stage: { crit: ['stage 3'], abn: ['stage 2'], warn: ['stage 1'] },
    kidney_kdigo_stage: { crit: ['stage 3'], abn: ['stage 2'], warn: ['stage 1'] },
  };
  const range = statusRanges[field];
  if (!range) return null;
  if (range.crit.some(k => v.includes(k))) return { text: 'Critical', severity: 'critical' };
  if (range.abn.some(k => v.includes(k))) return { text: 'Abnormal', severity: 'abnormal' };
  if (range.warn.some(k => v.includes(k))) return { text: 'Borderline', severity: 'borderline' };
  if (v.includes('normal') || v.includes('none') || v.includes('stage 1')) return { text: 'Normal', severity: 'normal' };
  return null;
}

export function interpretNumericValue(value: string, low: number, high: number, borderlineLow: number, borderlineHigh: number, criticalLow: number, criticalHigh: number, unit: string = ''): FieldInterpretation | null {
  if (!value || value.trim() === '') return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  if (num >= low && num <= high) return { text: `Normal${unit ? ' ' + unit : ''}`, severity: 'normal' };
  if (num < criticalLow || num > criticalHigh) return { text: `Critical${unit ? ' ' + unit : ''}`, severity: 'critical' };
  if (num < borderlineLow || num > borderlineHigh) {
    const dir = num < low ? '↓' : '↑';
    return { text: `Abnormal ${dir}${unit ? ' ' + unit : ''}`, severity: 'abnormal' };
  }
  const dir = num < low ? '↓' : '↑';
  return { text: `Borderline ${dir}${unit ? ' ' + unit : ''}`, severity: 'borderline' };
}

export const SELECT_SEVERITY: Record<string, Record<string, Severity>> = {
  surgical_candidacy: {
    "Candidate — planned": 'normal',
    "Already resected": 'normal',
    "Candidate — deferred": 'borderline',
    "Under evaluation": 'borderline',
    "Borderline candidate": 'abnormal',
    "Not a candidate": 'critical',
  },
  asa_class: {
    "ASA I — Normal healthy": 'normal',
    "ASA II — Mild systemic disease": 'borderline',
    "ASA III — Severe systemic disease": 'abnormal',
    "ASA IV — Severe life-threatening disease": 'critical',
    "ASA V — Moribund, not expected to survive": 'critical',
    "ASA VI — Brain-dead organ donor": 'critical',
  },
  margin_status_expectation: {
    "R0 — Negative margins expected": 'normal',
    "R1 — Microscopic positive margin possible": 'abnormal',
    "R2 — Macroscopic residual expected": 'critical',
    "Unsure / Depends on intra-op findings": 'borderline',
  },
  cardiac_clearance: {
    "Cleared for surgery": 'normal',
    "Cleared with precautions": 'borderline',
    "Deferred — further workup needed": 'abnormal',
    "Not cleared": 'critical',
    "Not applicable": 'normal',
  },
  pulmonary_clearance: {
    "Cleared for surgery": 'normal',
    "Cleared with precautions": 'borderline',
    "Deferred — further workup": 'abnormal',
    "Not cleared": 'critical',
    "Not applicable": 'normal',
  },
  cardiac_risk_stratification: {
    "Low risk (RCRI 0)": 'normal',
    "Intermediate risk (RCRI 1-2)": 'borderline',
    "High risk (RCRI ≥ 3)": 'abnormal',
    "Indeterminate / Further testing needed": 'borderline',
  },
  pulmonary_risk_stratification: {
    "Low risk": 'normal',
    "Intermediate risk": 'borderline',
    "High risk": 'abnormal',
    "Indeterminate": 'borderline',
  },
  neoadj_chemo_response: {
    "Complete response (CR)": 'normal',
    "Pathologic CR (pCR)": 'normal',
    "Major pathologic response (MPR)": 'normal',
    "Partial response (PR)": 'borderline',
    "Stable disease (SD)": 'borderline',
    "Progressive disease (PD)": 'critical',
    "Not yet evaluated": 'borderline',
  },
  neoadj_radio_response: {
    "Complete response (CR)": 'normal',
    "Pathologic CR (pCR)": 'normal',
    "Partial response (PR)": 'borderline',
    "Stable disease (SD)": 'borderline',
    "Progressive disease (PD)": 'critical',
    "Not yet evaluated": 'borderline',
  },
};

export function interpretSelect(field: string, value: string): FieldInterpretation | null {
  if (!value) return null;
  const map = SELECT_SEVERITY[field];
  if (!map) return null;
  const sev = map[value];
  if (!sev) return null;
  const labels: Record<Severity, string> = {
    normal: 'Normal',
    borderline: 'Borderline',
    abnormal: 'Abnormal',
    critical: 'Critical',
  };
  return { text: labels[sev], severity: sev };
}

export function selectBorder(value: string, severityMap: Record<string, Severity> | undefined): string {
  if (!value || !severityMap) return 'border-slate-200 dark:border-slate-700';
  const sev = severityMap[value];
  return sev ? severityBorder(sev) : 'border-slate-200 dark:border-slate-700';
}

export const ANATOMICAL_SUBSITES: Record<string, string[]> = {
  Breast: ["Upper outer quadrant", "Upper inner quadrant", "Lower outer quadrant", "Lower inner quadrant", "Central portion", "Nipple and areola", "Axillary tail", "Overlapping lesion", "Breast NOS", "Other"],
  Lung: ["Right upper lobe", "Right middle lobe", "Right lower lobe", "Left upper lobe", "Lingula", "Left lower lobe", "Main bronchus", "Overlapping lesion", "Lung NOS", "Other"],
  Colorectal: ["Caecum", "Appendix", "Ascending colon", "Hepatic flexure", "Transverse colon", "Descending colon", "Sigmoid colon", "Rectosigmoid junction", "Rectum", "Anal canal", "Other"],
  Prostate: ["Peripheral zone", "Transition zone", "Central zone", "Anterior fibromuscular stroma", "Prostate NOS", "Other"],
  Cervix: ["Endocervix", "Exocervix", "Transformation zone", "Overlapping lesion", "Cervix NOS", "Other"],
  Ovary: ["Right ovary", "Left ovary", "Bilateral ovaries", "Ovary NOS", "Other"],
  Endometrium: ["Fundus", "Anterior wall", "Posterior wall", "Lateral wall", "Lower uterine segment", "Overlapping lesion", "Corpus uteri NOS", "Other"],
  "Head and Neck": ["Lip", "Oral cavity", "Tongue", "Floor of mouth", "Oropharynx", "Nasopharynx", "Hypopharynx", "Larynx", "Salivary gland", "Nasal cavity / Sinus", "Other"],
  Oesophagus: ["Cervical", "Upper thoracic", "Middle thoracic", "Lower thoracic", "Gastro-oesophageal junction", "Oesophagus NOS", "Other"],
  Stomach: ["Cardia", "Fundus", "Body", "Antrum", "Pylorus", "Lesser curvature", "Greater curvature", "Overlapping lesion", "Stomach NOS", "Other"],
  Liver: ["Right lobe", "Left lobe", "Caudate lobe", "Intrahepatic bile duct", "Overlapping lesion", "Liver NOS", "Other"],
  Pancreas: ["Head", "Uncinate process", "Neck", "Body", "Tail", "Pancreatic duct", "Overlapping lesion", "Pancreas NOS", "Other"],
  Kidney: ["Right kidney", "Left kidney", "Upper pole", "Middle pole", "Lower pole", "Renal pelvis", "Kidney NOS", "Other"],
  Bladder: ["Trigone", "Dome", "Anterior wall", "Posterior wall", "Lateral wall", "Bladder neck", "Ureteric orifice", "Overlapping lesion", "Bladder NOS", "Other"],
  "Brain / CNS": ["Frontal lobe", "Temporal lobe", "Parietal lobe", "Occipital lobe", "Cerebellum", "Brain stem", "Ventricle", "Spinal cord", "Meninges", "CNS NOS", "Other"],
  Skin: ["Head and neck", "Trunk", "Upper limb", "Lower limb", "Scalp", "Face", "External ear", "Skin NOS", "Other"],
  "Bone / Soft Tissue": ["Head and neck", "Upper limb", "Lower limb", "Thorax", "Abdomen", "Pelvis", "Spine", "Retroperitoneum", "Bone / soft tissue NOS", "Other"],
  Haematological: ["Bone marrow", "Peripheral blood", "Lymph node", "Spleen", "Thymus", "Extranodal site", "Multiple sites", "Other"],
  Other: ["Other"],
};

export const HISTOLOGY_TYPES: Record<string, string[]> = {
  Breast: ["Invasive carcinoma of no special type", "Invasive lobular carcinoma", "Ductal carcinoma in situ", "Lobular carcinoma in situ", "Mucinous carcinoma", "Tubular carcinoma", "Medullary carcinoma", "Metaplastic carcinoma", "Paget disease", "Other"],
  Lung: ["Adenocarcinoma", "Squamous cell carcinoma", "Small cell carcinoma", "Large cell carcinoma", "Large cell neuroendocrine carcinoma", "Carcinoid tumour", "Adenosquamous carcinoma", "Other"],
  Colorectal: ["Adenocarcinoma", "Mucinous adenocarcinoma", "Signet ring cell carcinoma", "Squamous cell carcinoma", "Neuroendocrine tumour", "Gastrointestinal stromal tumour", "Other"],
  Prostate: ["Acinar adenocarcinoma", "Ductal adenocarcinoma", "Small cell neuroendocrine carcinoma", "Transitional cell carcinoma", "Squamous cell carcinoma", "Other"],
  Cervix: ["Squamous cell carcinoma", "Adenocarcinoma", "Adenosquamous carcinoma", "Neuroendocrine carcinoma", "Clear cell carcinoma", "Other"],
  Ovary: ["High-grade serous carcinoma", "Low-grade serous carcinoma", "Mucinous carcinoma", "Endometrioid carcinoma", "Clear cell carcinoma", "Germ cell tumour", "Sex cord-stromal tumour", "Other"],
  Endometrium: ["Endometrioid carcinoma", "Serous carcinoma", "Clear cell carcinoma", "Carcinosarcoma", "Undifferentiated carcinoma", "Mixed carcinoma", "Other"],
  "Head and Neck": ["Squamous cell carcinoma", "Adenocarcinoma", "Mucoepidermoid carcinoma", "Adenoid cystic carcinoma", "Nasopharyngeal carcinoma", "Salivary duct carcinoma", "Other"],
  Oesophagus: ["Squamous cell carcinoma", "Adenocarcinoma", "Adenosquamous carcinoma", "Small cell carcinoma", "Other"],
  Stomach: ["Tubular adenocarcinoma", "Papillary adenocarcinoma", "Mucinous adenocarcinoma", "Poorly cohesive / signet ring carcinoma", "Gastrointestinal stromal tumour", "Neuroendocrine tumour", "Lymphoma", "Other"],
  Liver: ["Hepatocellular carcinoma", "Intrahepatic cholangiocarcinoma", "Combined hepatocellular-cholangiocarcinoma", "Hepatoblastoma", "Other"],
  Pancreas: ["Ductal adenocarcinoma", "Acinar cell carcinoma", "Neuroendocrine tumour", "Solid pseudopapillary neoplasm", "Mucinous cystic neoplasm", "Intraductal papillary mucinous neoplasm", "Other"],
  Kidney: ["Clear cell renal cell carcinoma", "Papillary renal cell carcinoma", "Chromophobe renal cell carcinoma", "Collecting duct carcinoma", "Renal medullary carcinoma", "Wilms tumour", "Urothelial carcinoma", "Other"],
  Bladder: ["Urothelial carcinoma", "Squamous cell carcinoma", "Adenocarcinoma", "Small cell neuroendocrine carcinoma", "Sarcomatoid carcinoma", "Other"],
  "Brain / CNS": ["Glioblastoma", "Astrocytoma", "Oligodendroglioma", "Ependymoma", "Meningioma", "Medulloblastoma", "Schwannoma", "CNS lymphoma", "Other"],
  Skin: ["Basal cell carcinoma", "Squamous cell carcinoma", "Melanoma", "Merkel cell carcinoma", "Adnexal carcinoma", "Other"],
  "Bone / Soft Tissue": ["Osteosarcoma", "Chondrosarcoma", "Ewing sarcoma", "Liposarcoma", "Leiomyosarcoma", "Rhabdomyosarcoma", "Synovial sarcoma", "Undifferentiated pleomorphic sarcoma", "Other"],
  Haematological: ["Acute myeloid leukaemia", "Acute lymphoblastic leukaemia", "Chronic myeloid leukaemia", "Chronic lymphocytic leukaemia", "Hodgkin lymphoma", "Diffuse large B-cell lymphoma", "Follicular lymphoma", "Multiple myeloma", "Myeloproliferative neoplasm", "Other"],
  Other: ["Adenocarcinoma", "Squamous cell carcinoma", "Neuroendocrine tumour", "Sarcoma", "Lymphoma", "Other"],
};

export const getHistologyTypes = (site: string, subsite: string) => {
  if (site === "Colorectal" && subsite === "Anal canal") {
    return ["Squamous cell carcinoma", "Adenocarcinoma", "Basaloid carcinoma", "Neuroendocrine carcinoma", "Melanoma", "Other"];
  }
  if (site === "Kidney" && subsite === "Renal pelvis") {
    return ["Urothelial carcinoma", "Squamous cell carcinoma", "Adenocarcinoma", "Other"];
  }
  if (site === "Head and Neck" && subsite === "Salivary gland") {
    return ["Mucoepidermoid carcinoma", "Adenoid cystic carcinoma", "Acinic cell carcinoma", "Salivary duct carcinoma", "Carcinoma ex pleomorphic adenoma", "Other"];
  }
  return HISTOLOGY_TYPES[site] || HISTOLOGY_TYPES.Other;
};
