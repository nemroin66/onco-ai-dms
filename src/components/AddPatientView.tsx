/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ApiError, apiFetch } from "../lib/api-client";
import {
  ShieldCheck,
  Sparkles,
  Upload,
  Folder,
  FileText,
  Trash,
  Save,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  CheckCircle,
  File,
  Download,
  ExternalLink,
  RefreshCw,
  Pill,
  Radio,
  Users,
  Wine,
  Stethoscope,
  ClipboardList,
  ClipboardCheck,
  FileCheck2,
  Scissors,
  Activity,
  Home,
  IdCard,
  Dna,
  Building2,
  Scan,
  FlaskConical,
  CirclePlus,
  FileStack,
  Syringe,
  Ruler,
  Clock,
  Layers,
} from "lucide-react";
import {
  PatientRecord,
  OncologyCategory,
  PatientStatus,
  ExamFindingsEntry,
  ExamFindingsGroup,
  AnthropometricEntry,
  OtherAnthropometricEntry,
  OtherAnthropometricGroup,
  DiskFile
} from "../types";
import { confirmDialog, notify } from "./AppDialog";
import AnimatedButton from "./AnimatedButton";
import { getSectionFieldKeys } from "../formManifest";
import MANIFEST from "../formManifest";
import {
  coerceControlledChoice,
  normalizeChecklist,
  normalizeSystemicInquiry,
} from "../utils/extractionChoiceMapping";
import {
  buildAcceptedAiFillData,
  buildAcceptedSuggestedData,
  buildAcceptedSuggestedRows,
  defaultAcceptedAiChangeIds,
  defaultAcceptedSuggestionIds,
} from "../utils/aiFillReview";
import { coerceOncologyTypes } from "../utils/oncologyChoiceMapping";
import {
  ADL_CHOICES,
  CHARLSON_CHOICES,
  CHARLSON_CONDITIONS,
  ECOG_OPTIONS,
  IADL_CHOICES,
  SYSTEM_SYMPTOMS,
  TUMOUR_SITE_CATEGORIES,
} from "../formChoices";


interface AddPatientViewProps {
  key?: string;
  initialPatientData?: PatientRecord | null;
  onSavePatient: (record: PatientRecord) => Promise<PatientRecord>;
  onNavigateHome: () => void;
  allExistingFiles?: DiskFile[];
  onUploadFile?: (file: { name: string; mimeType: string; size: number; patientId: string; contentBase64: string; extracted: boolean }) => Promise<any>;
  totalPatientsCount: number;
  onDirtyChange?: (dirty: boolean) => void;
}

const AI_DOCUMENT_ACCEPT = ".pdf,.csv,.json,.txt,.jpg,.jpeg,.png,.tif,.tiff,.bmp,.webp,image/jpeg,image/png,image/tiff,image/bmp,image/webp,text/plain,text/csv,application/json";
const DRIVE_DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.tif,.tiff,.bmp,.webp,image/jpeg,image/png,image/tiff,image/bmp,image/webp,application/pdf";
const AI_EXTRACTION_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.1-pro-preview"];

type AiBatchQueueStatus = "pending" | "extracting" | "retry-waiting" | "merged" | "drive-uploaded" | "failed" | "paused";

type AiBatchQueueItem = {
  id: string;
  name: string;
  size: number;
  status: AiBatchQueueStatus;
  progress: number;
  stage: string;
  attempts: number;
  model?: string;
  error?: string;
};

type ProcessAttachmentOptions = {
  queueItemId?: string;
  batchIndex?: number;
  batchTotal?: number;
  preserveIndicators?: boolean;
};

type ProcessAttachmentResult = {
  ok: boolean;
  paused?: boolean;
  driveUploaded?: boolean;
  message?: string;
};

const formatFileSize = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

type SubTableProps = {
  title: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
  addLabel: string;
  tableKey: string;
  headers: string[];
  keys: string[];
  placeholders: string[];
  emptyTemplate: Record<string, string>;
  rows: Record<string, any>[];
  onAddRow: (e: React.MouseEvent) => void;
  onRemoveRow: (index: number) => void;
  onTableChange: (index: number, field: string, value: any) => void;
};

const ANATOMICAL_SUBSITES: Record<string, string[]> = {
  Breast: ["Upper outer quadrant", "Upper inner quadrant", "Lower outer quadrant", "Lower inner quadrant", "Central portion", "Nipple and areola", "Axillary tail", "Overlapping lesion", "Breast NOS", "Other"],
  Lung: ["Right upper lobe", "Right middle lobe", "Right lower lobe", "Left upper lobe", "Lingula", "Left lower lobe", "Main bronchus", "Overlapping lesion", "Lung NOS", "Other"],
  Colorectal: ["Caecum", "Appendix", "Ascending colon", "Hepatic flexure", "Transverse colon", "Splenic flexure", "Descending colon", "Sigmoid colon", "Rectosigmoid junction", "Rectum", "Anal canal", "Other"],
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

const HISTOLOGY_TYPES: Record<string, string[]> = {
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

type Severity = 'normal' | 'borderline' | 'abnormal' | 'critical';

interface FieldInterpretation {
  text: string;
  severity: Severity;
}

function severityBorder(sev: Severity): string {
  const map: Record<Severity, string> = {
    normal: 'border-emerald-400 dark:border-emerald-500',
    borderline: 'border-amber-400 dark:border-amber-500',
    abnormal: 'border-orange-400 dark:border-orange-500',
    critical: 'border-rose-400 dark:border-rose-500',
  };
  return map[sev];
}

function severityBadge(sev: Severity): string {
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

function interpretLabValue(field: string, value: string): FieldInterpretation | null {
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

function interpretCategoricalSeverity(_field: string, value: string): FieldInterpretation | null {
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

function interpretLiverKidney(field: string, value: string): FieldInterpretation | null {
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
    liver_child_pugh_grade: {
      crit: ['c'],
      abn: ['b'],
      warn: [],
    },
    liver_albi_grade: {
      crit: ['3'],
      abn: ['2'],
      warn: [],
    },
    liver_fibrosis_stage: {
      crit: ['f4'],
      abn: ['f3'],
      warn: ['f2'],
    },
    kidney_ckd_stage: {
      crit: ['stage 5'],
      abn: ['stage 4', 'stage 3b'],
      warn: ['stage 3a', 'stage 2'],
    },
    kidney_egfr_category: {
      crit: ['g5'],
      abn: ['g4', 'g3b'],
      warn: ['g3a', 'g2'],
    },
    kidney_rifle_stage: {
      crit: ['esrd', 'failure'],
      abn: ['injury', 'loss'],
      warn: ['risk'],
    },
    kidney_akin_stage: {
      crit: ['stage 3'],
      abn: ['stage 2'],
      warn: ['stage 1'],
    },
    kidney_kdigo_stage: {
      crit: ['stage 3'],
      abn: ['stage 2'],
      warn: ['stage 1'],
    },
  };
  const range = statusRanges[field];
  if (!range) return null;
  if (range.crit.some(k => v.includes(k))) return { text: 'Critical', severity: 'critical' };
  if (range.abn.some(k => v.includes(k))) return { text: 'Abnormal', severity: 'abnormal' };
  if (range.warn.some(k => v.includes(k))) return { text: 'Borderline', severity: 'borderline' };
  if (v.includes('normal') || v.includes('none') || v.includes('stage 1')) return { text: 'Normal', severity: 'normal' };
  return null;
}

function interpretNumericValue(value: string, low: number, high: number, borderlineLow: number, borderlineHigh: number, criticalLow: number, criticalHigh: number, unit: string = ''): FieldInterpretation | null {
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

const SELECT_SEVERITY: Record<string, Record<string, Severity>> = {
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

function interpretSelect(field: string, value: string): FieldInterpretation | null {
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

function selectBorder(value: string, severityMap: Record<string, Severity> | undefined): string {
  if (!value || !severityMap) return 'border-slate-200 dark:border-slate-700';
  const sev = severityMap[value];
  return sev ? severityBorder(sev) : 'border-slate-200 dark:border-slate-700';
}

const getHistologyTypes = (site: string, subsite: string) => {
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

const SubTable = ({ title, accent, icon: Icon, addLabel, tableKey, headers, keys, placeholders, emptyTemplate, rows, onAddRow, onRemoveRow, onTableChange }: SubTableProps) => (
  <div data-table-key={tableKey}>
    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 p-2.5 pl-3 rounded-xl">
      <div className="flex items-center gap-3">
        <span className="h-6 w-6 rounded-md bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
          <Icon className="h-3 w-3" />
        </span>
        <span className="h-subsection">
          {title}
        </span>
      </div>
      <button
        type="button"
        onClick={onAddRow}
        className="text-[11.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
      >
        <CirclePlus className="h-3.5 w-3.5" />
        <span>{addLabel}</span>
      </button>
    </div>
    <div className="mt-2 overflow-x-auto border border-natural-border/50 dark:border-slate-700 rounded-xl">
      <table className="w-full text-left">
        <thead>
          <tr className="h-table-col">
            {headers.map((h, i) => (
              <th key={i} className="p-2 whitespace-nowrap">{h}</th>
            ))}
            <th className="p-2 text-right">Delete</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
              {keys.map((k, j) => (
                <td key={j} className="p-2">
                  <input
                    type="text"
                    value={row[k] ?? ""}
                    onChange={(e) => onTableChange(idx, k, e.target.value)}
                    placeholder={placeholders[j]}
                    className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </td>
              ))}
              <td className="p-2 text-right">
                <button type="button" onClick={() => onRemoveRow(idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20 transition">
                  <Trash className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length + 1} className="text-center py-4 text-slate-400 text-[11.5px]">
                No {title.toLowerCase()} entries yet — click "{addLabel}" to begin.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

export default function AddPatientView({
  initialPatientData,
  onSavePatient,
  onNavigateHome,
  allExistingFiles = [],
  onUploadFile,
  totalPatientsCount,
  onDirtyChange
}: AddPatientViewProps) {

  const isDirtyRef = React.useRef(false);

  // Mark form dirty on any state change, reset after save
  const markDirty = React.useCallback(() => {
    if (!isDirtyRef.current) {
      isDirtyRef.current = true;
      onDirtyChange?.(true);
    }
  }, [onDirtyChange]);

  const resetDirty = React.useCallback(() => {
    isDirtyRef.current = false;
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  // Confirm before leaving with unsaved changes
  const handleNavigateHome = React.useCallback(async () => {
    const lastNameEl = lastNameRef.current ?? document.querySelector<HTMLInputElement>('input[name="last_name"]');
    const hasLastName = lastNameEl?.value?.trim() ? true : false;
    const isNewEmpty = !initialPatientData && !hasLastName;
    if (isDirtyRef.current && !isNewEmpty) {
      const leave = await confirmDialog("You have unsaved changes. Are you sure you want to leave without saving?", "Unsaved Changes", "warning", "Leave", "Stay");
      if (!leave) return;
    }
    onNavigateHome();
  }, [onNavigateHome]);

  // Consent checkpoint
  const [consentTaken, setConsentTaken] = useState(initialPatientData ? true : false);

  // Auto-ID generation for new patients
  const autoId = initialPatientData?.auto_id || `onco-${String(totalPatientsCount + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (!initialPatientData) {
      setFormState(prev => ({ ...prev, auto_id: autoId }));
    }
  }, [autoId, initialPatientData]);

  const [countryCode, setCountryCode] = useState("+94");
  const [phoneNumber, setPhoneNumber] = useState("");

  // Accordion Section States — all expanded by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    patientIdentifiers: true,
    demographics: true,
    oncology: true,
    hospital: true,
    history: true,
    clinicalAssessment: true,
    anthropometric: true,
    examination: true,
    provisionalDiagnosis: true,
    definitiveDiagnosis: true,
    investigations: true,
    tumorCharacteristics: true,
    clinicalStaging: true,
    histologyGrading: true,
    adjuvantTherapy: true,
    preOperativeAssessment: true,
    definitiveSurgery: true,
    treatmentOutcome: true,
    afterSurgicalTherapies: true,
    followUpPrognosis: true,
    oncologicalOutcome: true,
    supplementary: true,
    documentExtractions: true,
    treatments: true,
    surgicalProcedures: true,
    care: true,
    extraParams: true,
    drive: true
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Tumor Characteristics per-row collapsible panes
  const [tumorPanes, setTumorPanes] = useState<Record<string, boolean>>({});
  const toggleTumorPane = (key: string) => {
    setTumorPanes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const scrollToSection = (section: string, label: string) => {
    if (!openSections[section]) {
      setOpenSections(prev => ({ ...prev, [section]: true }));
    }
    setTimeout(() => {
      const headings = document.querySelectorAll<HTMLElement>("h3.h-section, h3[class*='h-section']");
      for (const h3 of headings) {
        if (h3.textContent?.trim().startsWith(label)) {
          const sectionDiv = h3.closest(".minimal-card") || h3.parentElement;
          sectionDiv?.scrollIntoView({ behavior: "smooth", block: "start" });
          break;
        }
      }
    }, 150);
  };

  const SECTION_NAV: { key: string; label: string }[] = [
    { key: "patientIdentifiers", label: "Patient Identifiers" },
    { key: "demographics", label: "Demographics" },
    { key: "oncology", label: "Oncology Types" },
    { key: "hospital", label: "Hospital Info" },
    { key: "history", label: "Clinical History" },
    { key: "clinicalAssessment", label: "Clinical Assessment" },
    { key: "anthropometric", label: "Anthropometric Measures" },
    { key: "examination", label: "Examination Findings" },
    { key: "provisionalDiagnosis", label: "Provisional Diagnosis" },
    { key: "definitiveDiagnosis", label: "Definitive Diagnosis" },
    { key: "investigations", label: "Medical Investigations" },
    { key: "tumorCharacteristics", label: "Tumour Characteristics" },
    { key: "clinicalStaging", label: "Clinical Staging" },
    { key: "histologyGrading", label: "Histology Grading" },
    { key: "adjuvantTherapy", label: "Adjuvant Therapy" },
    { key: "preOperativeAssessment", label: "Pre-Operative Assessment" },
    { key: "definitiveSurgery", label: "Surgery Details" },
    { key: "treatmentOutcome", label: "Surgical Outcome" },
    { key: "afterSurgicalTherapies", label: "After Surgical Therapies" },
    { key: "followUpPrognosis", label: "Follow-up &" },
    { key: "oncologicalOutcome", label: "Oncological Outcome" },
    { key: "extraParams", label: "AI Added Extra" },
    { key: "supplementary", label: "Supplementary /" },
  ];

  // AI document-fill drag state
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractStage, setExtractStage] = useState("");
  const [lastExtractionSummary, setLastExtractionSummary] = useState("");
  const [lastAgentReport, setLastAgentReport] = useState<any>(null);
  const [aiBatchQueue, setAiBatchQueue] = useState<AiBatchQueueItem[]>([]);
  const [aiBatchProgress, setAiBatchProgress] = useState({ current: 0, total: 0 });
  const [isAiBatchPaused, setIsAiBatchPaused] = useState(false);
  const [isVaultUploading, setIsVaultUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStage, setSaveStage] = useState("");
  const [vaultProgress, setVaultProgress] = useState(0);
  const [vaultStage, setVaultStage] = useState("");
  const [activeUploadSection, setActiveUploadSection] = useState<string | null>(null);
  const [sectionUploadAccept, setSectionUploadAccept] = useState(AI_DOCUMENT_ACCEPT);
  const [extractedFields, setExtractedFields] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vaultFileInputRef = useRef<HTMLInputElement>(null);
  const sectionFileInputRef = useRef<HTMLInputElement>(null);
  const sectionUploadContextRef = useRef<{ section: string; label: string; useAi: boolean } | null>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  // Batch rapid field changes into single setFormState per frame
  const pendingChangesRef = useRef<Record<string, any>>({});
  const syncRafRef = useRef<number>(0);
  const scheduleFormSync = useCallback(() => {
    cancelAnimationFrame(syncRafRef.current);
    syncRafRef.current = requestAnimationFrame(() => {
      const changes = pendingChangesRef.current;
      if (Object.keys(changes).length > 0) {
        pendingChangesRef.current = {};
        setFormState(prev => ({ ...prev, ...changes }));
      }
    });
  }, []);

  const flashShake = (node: HTMLElement | null | undefined) => {
    if (!node) return;
    node.classList.remove("input-shake");
    void node.offsetWidth;
    node.classList.add("input-shake");
    setTimeout(() => node.classList.remove("input-shake"), 540);
  };
  const [oncologySearch, setOncologySearch] = useState("");

  // Form patient record state (wrapped setter tracks dirtiness)
  const [formState, _setFormState] = useState<Partial<PatientRecord>>({
    id: "",
    oncology: OncologyCategory.OTHER,
    oncology_types: [],
    oncology_other: "",
    date: new Date().toISOString().split("T")[0],
    auto_id: "",
    tp: "",
    nic: "",
    title: "Mr.",
    initials: "",
    first_name: "",
    last_name: "",
    bht: "",
    clinic: "",
    dob: "",
    age: "",
    gender: "Male",
    living_area: "",
    hospital: "",
    hospital_location: "",
    hospital_type: "",
    ward_no: "",
    marital_status: "Single",
    education_status: "",
    ethnicity: "",
    occupation: "",
    geographic_accessibility: "",
    status: "active" as PatientStatus,
    presenting_complaints: "",
    presentingComplaintsTable: [{ date: "", complaint: "", notes: "" }],
    pastMedicalTable: [{ date: "", comorbidity: "", notes: "" }],
    pastSurgicalTable: [{ date: "", surgery: "", complication: "", notes: "" }],
    priorChemoTable: [{ date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }],
    priorRadioTable: [{ date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }],
    priorImmunoTable: [{ date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }],
    priorHormoneTable: [{ date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }],
    priorTargetedTable: [{ date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }],
    charlson_index: "",
    charlson_conditions: "",
    comorbidity: "",
    hospital_admissions: "",
    ecog_status: "",
    functional_adl_score: "",
    functional_adl_items: "",
    functional_iadl_score: "",
    functional_iadl_items: "",
    past_surgical_history: "",
    drugTable: [{ drug_name: "", dose: "", frequency: "", route: "", duration: "", notes: "" }],
    allergy_food: "",
    allergy_drugs: "",
    allergy_plasters: "",
    allergy_other: "",
    familyTable: [{ comorbidity: "", relationship: "", family_notes: "" }],
    smoking: "Non-consumer",
    smoking_amount: "",
    alcohol: "Non-consumer",
    alcohol_amount: "",
    riskTable: [{ risk_factor: "", risk_notes: "" }],
    systemicInquiry: [],
    bmi: "",
    bsa: "",
    height: "",
    weight: "",
    exam_findings: "",
    systemic_exam: "",
    examFindingsTable: [{ date: "", entries: [{ organ_system: "", findings: "", notes: "" }] }],
    anthropometricTable: [{ date: "", height: "", weight: "", bmi: "", bsa: "" }],
    otherAnthropometricTable: [{ date: "", entries: [{ measure: "", value: "", unit: "" }] }],
    provisional_diagnosis: "",
    bloodTable: [{ blood_type: "", blood_purpose: "", blood_date: "", blood_findings: "", blood_notes: "" }],
    tumorMarkersTable: [{ marker_name: "", marker_value: "", marker_unit: "", marker_date: "", marker_purpose: "", marker_ref_range: "", marker_notes: "" }],
    imagingTable: [{ imaging_type: "", imaging_purpose: "", imaging_date: "", imaging_parameter: "", imaging_findings: "", mass_present: "", mass_size: "", mass_location: "", calcifications: "", lymph_nodes: "", metastasis: "", ascites: "", pv_status: "", sma_status: "" }],
    endoscopyTable: [{ endo_type: "", endo_purpose: "", endo_date: "", endo_parameter: "", endo_findings: "" }],
    otherInvTable: [{ otherinv_type: "", otherinv_purpose: "", otherinv_date: "", otherinv_parameter: "", otherinv_findings: "" }],
    geneticTable: [{ test_name: "", gene: "", variant: "", result: "", method: "", date: "", purpose: "", notes: "" }],
    contrastTable: [{ study_type: "", contrast_agent: "", body_part: "", findings: "", date: "", purpose: "", notes: "" }],
    biopsyTable: [{ biopsy_type: "", biopsy_purpose: "", biopsy_date: "", biopsy_parameter: "", biopsy_findings: "", biopsy_stage: "", lvi: "", perineural_invasion: "", margin_status: "", cell_type: "", metastasis: "", lymph_nodes: "" }],
    immunohistochemistryTable: [{ ihc_specimen: "", ihc_panel: "", ihc_marker: "", ihc_result: "", ihc_intensity: "", ihc_percentage: "", ihc_score: "", ihc_pattern: "", ihc_method: "", ihc_date: "", ihc_purpose: "", ihc_lab: "", ihc_pathologist: "", ihc_interpretation: "", ihc_notes: "" }],
    supplementaryDetailsTable: [{ detail_heading: "", detail_subheading: "", detail_label: "", detail_value: "", detail_unit: "", detail_date: "", detail_priority: "medium", detail_category: "", detail_source: "", detail_notes: "" }],
    stagingTable: [{ staging_system: "", staging_notes: "" }],
    clinicalStagingTable: [{ staging_system: "", staging_type: "", staging_date: "", staging_notes: "", clinical_t: "", clinical_n: "", clinical_m: "", pathological_t: "", pathological_n: "", pathological_m: "", clinical_stage_group: "", pathological_stage_group: "", figo_stage: "", ann_arbor_stage: "", ann_arbor_modifier: "", lugano_stage: "", lugano_modifier: "", binet_stage: "", rai_stage: "", child_pugh_grade: "", child_pugh_points: "", bclc_stage: "", dukes_stage: "", iss_stage: "", riss_stage: "", gleason_score: "", gleason_grade_group: "", inss_stage: "", inrg_stage: "", nwts_stage: "", masaoka_stage: "", who_cns_grade: "", chang_stage: "", iblp_stage: "", hklc_stage: "", clark_level: "", breslow_thickness: "" }],
    histologyGradingTable: [{ grading_system: "", grading_date: "", grading_notes: "", histological_grade: "", histological_grade_description: "", differentiation: "", nuclear_grade: "", mitotic_count: "", mitotic_score: "", ki67_percentage: "", lymphovascular_invasion: "", perineural_invasion: "", tumor_budding: "", necrosis: "", cellularity: "", nottingham_score: "", nottingham_grade: "", nottingham_tubule_score: "", nottingham_nuclear_score: "", nottingham_mitotic_score: "", fuhrman_grade: "", isup_grade: "", who_isup_grade: "", gleason_primary: "", gleason_secondary: "", gleason_score: "", gleason_grade_group: "", figo_grade: "", who_cns_grade: "", lepidic_pattern: "", acinar_pattern: "", papillary_pattern: "", micropapillary_pattern: "", solid_pattern: "", tumor_differentiation: "", mucinous_component: "", signet_ring_cells: "", medullary_features: "", sarcoma_grade: "", mitoses_per_10hpf: "", tumor_necrosis_percentage: "" }],
    adjuvantTherapyTable: [{ therapy_type: "", date_of_commencement: "", regimen: "", cycles_dose: "", details: "", notes: "" }],
    preOperativeAssessmentTable: [{ surgery_name: "", assessment_date: "", lab_hb: "", lab_wbc: "", lab_platelets: "", lab_creatinine: "", lab_egfr: "", lab_albumin: "", lab_inr: "", lab_aptt: "", lab_alt: "", lab_ast: "", lab_bilirubin: "", lab_crp: "", lab_troponin: "", lab_bnp: "", lab_blood_group: "", lab_other: "", additional_labs: [{ test_name: "", result: "", unit: "", reference_range: "" }], additional_imaging: [{ imaging_type: "", imaging_date: "", imaging_findings: "" }], baseline_imaging_type: "", baseline_imaging_date: "", baseline_imaging_findings: "", surgical_candidacy: "", surgical_candidacy_notes: "", asa_class: "", asa_notes: "", margin_status_expectation: "", margin_notes: "", expected_resection_extent: "", expected_resection_notes: "", expected_lymphadenectomy: "", expected_lymph_node_levels: "", expected_lymph_node_count: "", cardiac_assessment_status: "", cardiac_ecg_findings: "", cardiac_echo_findings: "", cardiac_risk_stratification: "", cardiac_clearance: "", cardiac_notes: "", rcri_high_risk_surgery: "", rcri_ischemic_heart_disease: "", rcri_heart_failure: "", rcri_cerebrovascular_disease: "", rcri_insulin_diabetes: "", rcri_renal_dysfunction: "", rcri_score_auto: "", cardiac_risk_manual: "", pulmonary_assessment_status: "", pulmonary_pft_findings: "", pulmonary_imaging_findings: "", pulmonary_risk_stratification: "", pulmonary_clearance: "", pulmonary_notes: "", pulm_age_risk: "", pulm_spo2_risk: "", pulm_upper_surgery: "", pulm_copd: "", pulm_smoking: "", pulm_emergency: "", pulm_risk_score_auto: "", pulmonary_risk_manual: "", liver_assessment_status: "", liver_child_pugh_score: "", liver_child_pugh_grade: "", liver_meld_score: "", liver_meld_na_score: "", liver_albi_grade: "", liver_fibrosis_stage: "", liver_steatosis: "", liver_portal_hypertension: "", liver_notes: "", cp_bilirubin: "", cp_albumin: "", cp_inr: "", cp_ascites: "", cp_encephalopathy: "", cp_score_auto: "", cp_grade_auto: "", child_pugh_manual: "", kidney_assessment_status: "", kidney_ckd_stage: "", kidney_egfr_category: "", kidney_rifle_stage: "", kidney_akin_stage: "", kidney_kdigo_stage: "", kidney_urine_acr: "", kidney_proteinuria: "", kidney_notes: "", metabolic_diabetes_status: "", metabolic_hba1c: "", metabolic_nutritional_status: "", metabolic_risk_stratification: "", metabolic_notes: "", met_waist_cm: "", met_bp_systolic: "", met_bp_diastolic: "", met_hdl: "", met_triglycerides: "", met_fasting_glucose: "", met_components_count: "", metabolic_risk_manual: "", immunological_status: "", immunological_neutrophil_count: "", immunological_lymphocyte_count: "", immunological_hiv_status: "", immunological_steroid_use: "", immunological_other_immunosuppression: "", immunological_notes: "", possum_physiological_score: "", possum_operative_severity: "", possum_predicted_morbidity: "", possum_predicted_mortality: "", possum_notes: "", possum_age_score: "", possum_cardiac_signs: "", possum_respiratory_signs: "", possum_sbp: "", possum_pulse_rate: "", possum_gcs_score: "", possum_urea_val: "", possum_na_val: "", possum_k_val: "", possum_hb_val: "", possum_wbc_val: "", possum_ecg_abnormal: "", possum_operative_multiple: "", possum_blood_loss_ml: "", possum_peritoneal_soiling: "", possum_malignancy_present: "", possum_urgency: "", possum_phys_score_auto: "", possum_op_score_auto: "", possum_pred_morbidity_auto: "", possum_pred_mortality_auto: "", possum_phys_manual: "", possum_op_manual: "", neoadj_chemo_received: "", neoadj_chemo_regimen: "", neoadj_chemo_cycles: "", neoadj_chemo_completion_date: "", neoadj_chemo_response: "", neoadj_chemo_response_details: "", neoadj_target_count: "", neoadj_target_sum_before: "", neoadj_target_sum_after: "", neoadj_pct_change_auto: "", neoadj_chemo_manual: "", neoadj_radio_received: "", neoadj_radio_regimen: "", neoadj_radio_dose: "", neoadj_radio_completion_date: "", neoadj_radio_response: "", neoadj_radio_response_details: "", neoadj_radio_manual: "", organ_resistance_testing: "", organ_resistance_results: "", organ_resistance_notes: "", mdt_date: "", mdt_participants: "", mdt_recommendation: "", mdt_decision: "", mdt_notes: "" }],
    overall_stage: "",
    tnm_stage: "",
    final_diagnosis: "",
    definitiveDiagnosisTable: [{ date: "", diagnosis: "", notes: "" }],
    diagnosis_delay_days: "",
    tumorCharacteristicsTable: [{ tumour_sites: "", laterality: "", primary_count: "", tumor_size_length: "", tumor_size_width: "", tumor_size_depth: "", tumor_size_unit: "mm", macroscopic_features: "", specimen_type: "", diagnostic_modality_parameter: "", diagnostic_modality: "", sampling_confirmation: "", histological_type_parameter: "", histological_type: "", histological_grade: "", histological_info: "", cell_morphology_parameter: "", cell_morphology: "", tumor_differentiation_status: "", microscopic_size: "", microscopic_features: "", lvi: "", perineural_invasion: "", margin_status: "", mitotic_rate: "", tumor_infiltrating_lymphocytes: "", stroma_percentage: "", tumor_associated_macrophages: "", nodal_metastasis_details: "", distant_metastasis_details: "", synchronous_malignancy: "", metachronous_malignancy: "", diagnosis_date: "", pathological_interpretation: "", pathology_reporting_status: "", pathology_reporting_date: "", risk_stratification: "", genomic_risk_score: "", biology_summary: "", molecular_markers_parameter: "", molecular_markers: "", molecular_markers_entries: [], immunohistochemistry_parameter: "", immunohistochemistry: "", immunohistochemistry_entries: [], genomic_testing_parameter: "", genomic_testing: "", genomic_testing_entries: [], gene_expression_profile_parameter: "", gene_expression_profile: "", gene_expression_profile_entries: [], viral_status_parameter: "", viral_status: "" }],
    definitiveSurgeryTable: [{ surgery_name: "", surgery_date: "", surgeon_name: "", surgeon_specialty: "", surgeon_volume: "", hospital_name: "", surgery_type: "", surgery_intent: "", surgery_phase: "", surgery_timing: "", preop_diagnosis: "", indication_for_surgery: "", anesthesia_type: "", operative_duration_min: "", incision_to_closure: "", estimated_blood_loss_ml: "", intraop_fluids_ml: "", intraop_blood_transfusion: "", intraop_complications: "", intraop_findings: "", specimen_description: "", intraop_imaging: "", intraop_imaging_list: [{ imaging_type: "", imaging_findings: "" }], surgery_approach: "", surgery_site: "", procedure_details: "", resection_status: "", margin_status: "", closest_margin_mm: "", lymph_node_dissection: "", lymph_node_harvested: "", lymph_node_positive: "", organ_resection_details: "", multi_visceral_resection: "", sentinel_node_biopsy: "", sentinel_node_biopsy_results: "", neoadj_effect_details: "", en_bloc_resection: "", depth_of_invasion: "", resected_specimen_size: "", conversion_to_open: "", reconstruction_type: "", reconstruction_details: "", postop_diagnosis: "", recovery_status: "", discharge_date: "", discharge_status: "", readmission_30d: "", readmission_reason: "", pathology_specimen_id: "", pathology_link: "", surgery_notes: "" }],
    treatmentOutcomeTable: [{ assessment_date: "", response_evaluation_criteria: "", overall_response: "", target_lesion_response: "", non_target_lesion_response: "", new_lesions: "", progression_date: "", recurrence_status: "", recurrence_date: "", recurrence_location: "", survival_status: "", survival_date: "", cause_of_death: "", ecog_status: "", tumor_markers_followup: "", imaging_followup: "", outcome_notes: "", hospital_entry_date: "", hospital_exit_date: "", hospital_stay_days: "", icu_admission: "", icu_admit_date: "", icu_exit_date: "", icu_stay_days: "", return_to_or_30d: "", transfusion_needed: "", transfusion_type: "", transfusion_amount: "", wound_infection: "", anastomotic_leak: "", thromboembolic_events: "", cardiac_complication: "", cardiac_complication_details: "", pulmonary_complication: "", pulmonary_complication_details: "", acute_kidney_injury: "", hepatic_dysfunction: "", anastomotic_stricture: "", lymphoedema: "", seroma_hematoma: "", nerve_injury: "", fistula_formation: "", sepsis_development: "", mortality_90d: "", mortality_1y: "", mortality_30d: "", unplanned_readmission: "", discharge_destination: "", clavien_dindo_grade: "", clavien_dindo_criteria: "", severe_complication_rate_criteria: "", icu_management_details: "", ward_management_details: "", postop_monitoring: [{ postop_day: "", date: "", parameters: [{ parameter: "", finding: "" }] }], postop_complications: [{ complication_name: "", occurrence_date: "", days_postop: "" }], reference_surgery_date: "" }],
    afterSurgicalTherapiesTable: [{ therapy_type: "", start_date: "", end_date: "", regimen: "", cycles_dose: "", details: "", notes: "", diagnosis_date_ref: "", first_therapy_date: "", days_diag_to_therapy: "", chemo_dose_intensity: "", chemo_toxicity_grade: "", radiation_dose_modifications: "", treatment_adherence: "", treatment_related_mortality: "", late_toxicity: "" }],
    followUpPrognosisTable: [{ second_cancer_development: "", second_cancer_details: "", cancer_specific_survival: "", conditional_survival_details: "", qol_assessment_done: "", qol_score_system: "", qol_parameters: "", qol_score: "", functional_recovery: "", genetic_review_done: "", genetic_review_details: "", clinical_trial_enrollment: "", clinical_trial_details: "", readmission_30d: "", readmission_90d: "", follow_up_notes: "" }],
    oncologicalOutcomeTable: [{ assessment_date: "", response_evaluation_criteria: "", overall_response: "", target_lesion_response: "", non_target_lesion_response: "", new_lesions: "", progression_date: "", recurrence_status: "", recurrence_date: "", recurrence_location: "", survival_status: "", survival_date: "", cause_of_death: "", ecog_status: "", tumor_markers_followup: "", imaging_followup: "", outcome_notes: "" }],
    tumor_tumour_sites: "",
    tumor_histological_type_parameter: "",
    tumor_histological_type: "",
    tumor_histological_grade: "",
    tumor_diagnosis_date: "",
    tumor_diagnostic_modality_parameter: "",
    tumor_diagnostic_modality: "",
    tumor_laterality: "",
    tumor_primary_count: "",
    tumor_synchronous_malignancy: "",
    tumor_metachronous_malignancy: "",
    tumor_molecular_markers_parameter: "",
    tumor_molecular_markers: "",
    tumor_immunohistochemistry_parameter: "",
    tumor_immunohistochemistry: "",
    tumor_genomic_testing_parameter: "",
    tumor_genomic_testing: "",
    tumor_gene_expression_profile_parameter: "",
    tumor_gene_expression_profile: "",
    tumor_viral_status_parameter: "",
    tumor_viral_status: "",
    tumor_cell_morphology_parameter: "",
    tumor_cell_morphology: "",
    tumor_biology_summary: "",
    tumor_sampling_confirmation: "",
    problemTable: [{ problem: "", management_plan: "" }],
    commonDrugsTable: [{ common_drug: "", common_dose: "", common_frequency: "", common_drug_notes: "" }],
    neo_chemo_status: "",
    neoChemoTable: [{ neo_chemo_drug: "", neo_chemo_dose: "", neo_chemo_freq: "", neo_chemo_route: "", neo_chemo_cycles: "", neo_chemo_effects: "", neo_chemo_notes: "" }],
    adj_chemo_status: "",
    adjChemoTable: [{ neo_chemo_drug: "", neo_chemo_dose: "", neo_chemo_freq: "", neo_chemo_route: "", neo_chemo_cycles: "", neo_chemo_effects: "", neo_chemo_notes: "" }],
    neo_radio_status: "",
    neoRadioTable: [{ neo_radio_comp: "", neo_radio_dose: "", neo_radio_freq: "", neo_radio_route: "", neo_radio_cycles: "", neo_radio_effects: "", neo_radio_notes: "" }],
    adj_radio_status: "",
    adjRadioTable: [{ neo_radio_comp: "", neo_radio_dose: "", neo_radio_freq: "", neo_radio_route: "", neo_radio_cycles: "", neo_radio_effects: "", neo_radio_notes: "" }],
    surgeryTable: [{ surgery_name: "", surgery_date: "", surgery_site: "", surgery_approach: "", surgery_findings: "", drain_status: "", drain_volume: "", surgery_notes: "" }],
    complicationTable: [{ complication: "", post_op_duration: "", management: "", notes: "" }],
    monitoringTable: [{ monitor_param: "", monitor_duration: "", monitor_findings: "", monitor_notes: "" }],
    icu_done: "Not done",
    icuTable: [{ icu_date: "", icu_stay: "", icu_mgmt: "", icu_exit: "", icu_notes: "" }],
    wardTable: [{ ward_entry: "", ward_stay: "", ward_mgmt: "", ward_exit: "", ward_notes: "" }],
    follow_up_notes: "",
    general_notes: "",
    unmapped_medical_information: [],
    document_extraction_backups: [],
    source_file_summaries: [],
    extraction_safety_note: ""
  });
  const formStateLatestRef = React.useRef<Partial<PatientRecord>>(formState);
  // Wrap setFormState to mark form dirty on any change
  const setFormStateRef = React.useRef(_setFormState);
  setFormStateRef.current = _setFormState;
  const setFormState: typeof _setFormState = React.useCallback((updater: any) => {
    markDirty();
    if (typeof updater === "function") {
      setFormStateRef.current((prev: Partial<PatientRecord>) => {
        const next = updater(prev);
        formStateLatestRef.current = next;
        return next;
      });
    } else {
      formStateLatestRef.current = updater;
      setFormStateRef.current(updater);
    }
  }, [markDirty]);

  useEffect(() => {
    formStateLatestRef.current = formState;
  }, [formState]);

  const selectedOncologyTypes = Array.from(
    new Set([...(formState.oncology_types || []), formState.oncology].filter(Boolean) as string[])
  ).filter((cat) => Object.values(OncologyCategory).includes(cat as OncologyCategory));

  // Load initial data during audits or edits
  useEffect(() => {
    if (initialPatientData) {
      const tp = initialPatientData.tp || "";
      const phoneMatch = tp.match(/^(\+\d{1,4})?[\s-]*(.+)$/);
      setCountryCode(phoneMatch?.[1] || "+94");
      setPhoneNumber(phoneMatch?.[2] || tp.replace(/^\+\d{1,4}[\s-]*/, ""));
      setFormState(initialPatientData);
      setConsentTaken(true);
    }
  }, [initialPatientData]);

  // Auto-calculate time from first complaint to diagnosis
  // Use serialized dates as dep to avoid array-reference cascade
  const complaintDateStr = JSON.stringify((formState.presentingComplaintsTable || []).map(r => r.date).filter(Boolean).sort());
  const diagDateStr = JSON.stringify((formState.definitiveDiagnosisTable || []).map(r => r.date).filter(Boolean).sort());
  useEffect(() => {
    const complaintDates = JSON.parse(complaintDateStr) as string[];
    const diagDates = JSON.parse(diagDateStr) as string[];
    if (complaintDates.length > 0 && diagDates.length > 0) {
      const d1 = new Date(complaintDates[0]);
      const d2 = new Date(diagDates[0]);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        setFormState(prev => ({ ...prev, diagnosis_delay_days: String(diff) }));
      }
    }
  }, [complaintDateStr, diagDateStr]);

  // Virtual files for this patient
  const patientFiles = formState.id
    ? allExistingFiles.filter(f => f.patientId === formState.id)
    : [];

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    pendingChangesRef.current[name] = value;
    scheduleFormSync();
  }, [scheduleFormSync]);

  const toggleOncologyType = (cat: OncologyCategory) => {
    setFormState((prev) => {
      const current = new Set([...(prev.oncology_types || []), prev.oncology].filter(Boolean) as string[]);
      if (current.has(cat)) {
        current.delete(cat);
      } else {
        current.add(cat);
      }
      const oncologyTypes = Array.from(current).filter((item) => item !== OncologyCategory.OTHER || current.has(OncologyCategory.OTHER));
      return {
        ...prev,
        oncology_types: oncologyTypes,
        oncology: (oncologyTypes.find((item) => item !== OncologyCategory.OTHER) || oncologyTypes[0] || OncologyCategory.OTHER) as OncologyCategory,
        oncology_other: oncologyTypes.includes(OncologyCategory.OTHER) ? prev.oncology_other || oncologySearch : prev.oncology_other,
      };
    });
  };

  const tableTemplates: Record<string, Record<string, any>> = {
    drugTable: { drug_name: "", dose: "", frequency: "", duration: "", notes: "" },
    familyTable: { comorbidity: "", relationship: "", family_notes: "" },
    riskTable: { risk_factor: "", risk_notes: "" },
    priorChemoTable: { date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" },
    priorRadioTable: { date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" },
    priorImmunoTable: { date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" },
    priorHormoneTable: { date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" },
    priorTargetedTable: { date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" },
    presentingComplaintsTable: { date: "", complaint: "", notes: "" },
    pastMedicalTable: { date: "", comorbidity: "", notes: "" },
    pastSurgicalTable: { date: "", surgery: "", complication: "", notes: "" },
    anthropometricTable: { date: "", height: "", weight: "", bmi: "", bsa: "" },
    examFindingsTable: { date: "", entries: [{ organ_system: "", findings: "", notes: "" }] },
    otherAnthropometricTable: { date: "", measure: "", value: "", unit: "" },
    bloodTable: { blood_type: "", blood_purpose: "", blood_date: "", blood_findings: "", blood_notes: "" } as any,
    tumorMarkersTable: { marker_name: "", marker_value: "", marker_unit: "", marker_date: "", marker_purpose: "", marker_ref_range: "", marker_notes: "" },
    imagingTable: { imaging_type: "", imaging_purpose: "", imaging_date: "", imaging_parameter: "", imaging_findings: "", mass_present: "", mass_size: "", mass_location: "", calcifications: "", lymph_nodes: "", metastasis: "", ascites: "", pv_status: "", sma_status: "" },
    endoscopyTable: { endo_type: "", endo_purpose: "", endo_date: "", endo_parameter: "", endo_findings: "" },
    otherInvTable: { otherinv_type: "", otherinv_purpose: "", otherinv_date: "", otherinv_parameter: "", otherinv_findings: "" },
    geneticTable: { test_name: "", gene: "", variant: "", result: "", method: "", date: "", purpose: "", notes: "" },
    contrastTable: { study_type: "", contrast_agent: "", body_part: "", findings: "", date: "", purpose: "", notes: "" },
    biopsyTable: { biopsy_type: "", biopsy_purpose: "", biopsy_date: "", biopsy_parameter: "", biopsy_findings: "", biopsy_stage: "", lvi: "", perineural_invasion: "", margin_status: "", cell_type: "", metastasis: "", lymph_nodes: "" },
    immunohistochemistryTable: { ihc_specimen: "", ihc_panel: "", ihc_marker: "", ihc_result: "", ihc_intensity: "", ihc_percentage: "", ihc_score: "", ihc_pattern: "", ihc_method: "", ihc_date: "", ihc_purpose: "", ihc_lab: "", ihc_pathologist: "", ihc_interpretation: "", ihc_notes: "" },
    supplementaryDetailsTable: { detail_heading: "", detail_subheading: "", detail_label: "", detail_value: "", detail_unit: "", detail_date: "", detail_priority: "medium", detail_category: "", detail_source: "", detail_notes: "" },
    definitiveDiagnosisTable: { date: "", diagnosis: "", notes: "" },
    stagingTable: { staging_system: "", staging_notes: "" },
    clinicalStagingTable: { staging_system: "", staging_type: "", staging_date: "", staging_notes: "", clinical_t: "", clinical_n: "", clinical_m: "", pathological_t: "", pathological_n: "", pathological_m: "", clinical_stage_group: "", pathological_stage_group: "", figo_stage: "", ann_arbor_stage: "", ann_arbor_modifier: "", lugano_stage: "", lugano_modifier: "", binet_stage: "", rai_stage: "", child_pugh_grade: "", child_pugh_points: "", bclc_stage: "", dukes_stage: "", iss_stage: "", riss_stage: "", gleason_score: "", gleason_grade_group: "", inss_stage: "", inrg_stage: "", nwts_stage: "", masaoka_stage: "", who_cns_grade: "", chang_stage: "", iblp_stage: "", hklc_stage: "", clark_level: "", breslow_thickness: "" },
    histologyGradingTable: { grading_system: "", grading_date: "", grading_notes: "", histological_grade: "", histological_grade_description: "", differentiation: "", nuclear_grade: "", mitotic_count: "", mitotic_score: "", ki67_percentage: "", lymphovascular_invasion: "", perineural_invasion: "", tumor_budding: "", necrosis: "", cellularity: "", nottingham_score: "", nottingham_grade: "", nottingham_tubule_score: "", nottingham_nuclear_score: "", nottingham_mitotic_score: "", fuhrman_grade: "", isup_grade: "", who_isup_grade: "", gleason_primary: "", gleason_secondary: "", gleason_score: "", gleason_grade_group: "", figo_grade: "", who_cns_grade: "", lepidic_pattern: "", acinar_pattern: "", papillary_pattern: "", micropapillary_pattern: "", solid_pattern: "", tumor_differentiation: "", mucinous_component: "", signet_ring_cells: "", medullary_features: "", sarcoma_grade: "", mitoses_per_10hpf: "", tumor_necrosis_percentage: "" },
    adjuvantTherapyTable: { therapy_type: "", date_of_commencement: "", regimen: "", cycles_dose: "", details: "", notes: "" },
    preOperativeAssessmentTable: { surgery_name: "", assessment_date: "", lab_hb: "", lab_wbc: "", lab_platelets: "", lab_creatinine: "", lab_egfr: "", lab_albumin: "", lab_inr: "", lab_aptt: "", lab_alt: "", lab_ast: "", lab_bilirubin: "", lab_crp: "", lab_troponin: "", lab_bnp: "", lab_blood_group: "", lab_other: "",       additional_labs: [{ test_name: "", result: "", unit: "", reference_range: "" }],
      additional_imaging: [{ imaging_type: "", imaging_date: "", imaging_findings: "" }], baseline_imaging_type: "", baseline_imaging_date: "", baseline_imaging_findings: "", surgical_candidacy: "", surgical_candidacy_notes: "", asa_class: "", asa_notes: "", margin_status_expectation: "", margin_notes: "", expected_resection_extent: "", expected_resection_notes: "", expected_lymphadenectomy: "", expected_lymph_node_levels: "", expected_lymph_node_count: "", cardiac_assessment_status: "", cardiac_ecg_findings: "", cardiac_echo_findings: "", cardiac_risk_stratification: "", cardiac_clearance: "", cardiac_notes: "", rcri_high_risk_surgery: "", rcri_ischemic_heart_disease: "", rcri_heart_failure: "", rcri_cerebrovascular_disease: "", rcri_insulin_diabetes: "", rcri_renal_dysfunction: "", rcri_score_auto: "", cardiac_risk_manual: "", pulmonary_assessment_status: "", pulmonary_pft_findings: "", pulmonary_imaging_findings: "", pulmonary_risk_stratification: "", pulmonary_clearance: "", pulmonary_notes: "", pulm_age_risk: "", pulm_spo2_risk: "", pulm_upper_surgery: "", pulm_copd: "", pulm_smoking: "", pulm_emergency: "", pulm_risk_score_auto: "", pulmonary_risk_manual: "", liver_assessment_status: "", liver_child_pugh_score: "", liver_child_pugh_grade: "", liver_meld_score: "", liver_meld_na_score: "", liver_albi_grade: "", liver_fibrosis_stage: "", liver_steatosis: "", liver_portal_hypertension: "", liver_notes: "", cp_bilirubin: "", cp_albumin: "", cp_inr: "", cp_ascites: "", cp_encephalopathy: "", cp_score_auto: "", cp_grade_auto: "", child_pugh_manual: "", kidney_assessment_status: "", kidney_ckd_stage: "", kidney_egfr_category: "", kidney_rifle_stage: "", kidney_akin_stage: "", kidney_kdigo_stage: "", kidney_urine_acr: "", kidney_proteinuria: "", kidney_notes: "", metabolic_diabetes_status: "", metabolic_hba1c: "", metabolic_nutritional_status: "", metabolic_risk_stratification: "", metabolic_notes: "", met_waist_cm: "", met_bp_systolic: "", met_bp_diastolic: "", met_hdl: "", met_triglycerides: "", met_fasting_glucose: "", met_components_count: "", metabolic_risk_manual: "", immunological_status: "", immunological_neutrophil_count: "", immunological_lymphocyte_count: "", immunological_hiv_status: "", immunological_steroid_use: "", immunological_other_immunosuppression: "", immunological_notes: "", possum_physiological_score: "", possum_operative_severity: "", possum_predicted_morbidity: "", possum_predicted_mortality: "", possum_notes: "", possum_age_score: "", possum_cardiac_signs: "", possum_respiratory_signs: "", possum_sbp: "", possum_pulse_rate: "", possum_gcs_score: "", possum_urea_val: "", possum_na_val: "", possum_k_val: "", possum_hb_val: "", possum_wbc_val: "", possum_ecg_abnormal: "", possum_operative_multiple: "", possum_blood_loss_ml: "", possum_peritoneal_soiling: "", possum_malignancy_present: "", possum_urgency: "", possum_phys_score_auto: "", possum_op_score_auto: "", possum_pred_morbidity_auto: "", possum_pred_mortality_auto: "", possum_phys_manual: "", possum_op_manual: "", neoadj_chemo_received: "", neoadj_chemo_regimen: "", neoadj_chemo_cycles: "", neoadj_chemo_completion_date: "", neoadj_chemo_response: "", neoadj_chemo_response_details: "", neoadj_target_count: "", neoadj_target_sum_before: "", neoadj_target_sum_after: "", neoadj_pct_change_auto: "", neoadj_chemo_manual: "", neoadj_radio_received: "", neoadj_radio_regimen: "", neoadj_radio_dose: "", neoadj_radio_completion_date: "", neoadj_radio_response: "", neoadj_radio_response_details: "", neoadj_radio_manual: "", organ_resistance_testing: "", organ_resistance_results: "", organ_resistance_notes: "", mdt_date: "", mdt_participants: "", mdt_recommendation: "", mdt_decision: "", mdt_notes: "" },
    definitiveSurgeryTable: { surgery_name: "", surgery_date: "", surgeon_name: "", surgeon_specialty: "", surgeon_volume: "", hospital_name: "", surgery_type: "", surgery_intent: "", surgery_phase: "", surgery_timing: "", preop_diagnosis: "", indication_for_surgery: "", anesthesia_type: "", operative_duration_min: "", incision_to_closure: "", estimated_blood_loss_ml: "", intraop_fluids_ml: "", intraop_blood_transfusion: "", intraop_complications: "", intraop_findings: "", specimen_description: "", intraop_imaging: "", intraop_imaging_list: [{ imaging_type: "", imaging_findings: "" }], surgery_approach: "", surgery_site: "", procedure_details: "", resection_status: "", margin_status: "", closest_margin_mm: "", lymph_node_dissection: "", lymph_node_harvested: "", lymph_node_positive: "", organ_resection_details: "", multi_visceral_resection: "", sentinel_node_biopsy: "", sentinel_node_biopsy_results: "", neoadj_effect_details: "", en_bloc_resection: "", depth_of_invasion: "", resected_specimen_size: "", conversion_to_open: "", reconstruction_type: "", reconstruction_details: "", postop_diagnosis: "", recovery_status: "", discharge_date: "", discharge_status: "", readmission_30d: "", readmission_reason: "", pathology_specimen_id: "", pathology_link: "", surgery_notes: "" },
     treatmentOutcomeTable: { assessment_date: "", response_evaluation_criteria: "", overall_response: "", target_lesion_response: "", non_target_lesion_response: "", new_lesions: "", progression_date: "", recurrence_status: "", recurrence_date: "", recurrence_location: "", survival_status: "", survival_date: "", cause_of_death: "", ecog_status: "", tumor_markers_followup: "", imaging_followup: "", outcome_notes: "", hospital_entry_date: "", hospital_exit_date: "", hospital_stay_days: "", icu_admission: "", icu_admit_date: "", icu_exit_date: "", icu_stay_days: "", return_to_or_30d: "", transfusion_needed: "", transfusion_type: "", transfusion_amount: "", wound_infection: "", anastomotic_leak: "", thromboembolic_events: "", cardiac_complication: "", cardiac_complication_details: "", pulmonary_complication: "", pulmonary_complication_details: "", acute_kidney_injury: "", hepatic_dysfunction: "", anastomotic_stricture: "", lymphoedema: "", seroma_hematoma: "", nerve_injury: "", fistula_formation: "", sepsis_development: "", mortality_90d: "", mortality_1y: "", mortality_30d: "", unplanned_readmission: "", discharge_destination: "", clavien_dindo_grade: "", clavien_dindo_criteria: "", severe_complication_rate_criteria: "", icu_management_details: "", ward_management_details: "", postop_monitoring: [{ postop_day: "", date: "", parameters: [{ parameter: "", finding: "" }] }], postop_complications: [{ complication_name: "", occurrence_date: "", days_postop: "" }], reference_surgery_date: "" },
    afterSurgicalTherapiesTable: { therapy_type: "", start_date: "", end_date: "", regimen: "", cycles_dose: "", details: "", notes: "", diagnosis_date_ref: "", first_therapy_date: "", days_diag_to_therapy: "", chemo_dose_intensity: "", chemo_toxicity_grade: "", radiation_dose_modifications: "", treatment_adherence: "", treatment_related_mortality: "", late_toxicity: "" },
    followUpPrognosisTable: { second_cancer_development: "", second_cancer_details: "", cancer_specific_survival: "", conditional_survival_details: "", qol_assessment_done: "", qol_score_system: "", qol_parameters: "", qol_score: "", functional_recovery: "", genetic_review_done: "", genetic_review_details: "", clinical_trial_enrollment: "", clinical_trial_details: "", readmission_30d: "", readmission_90d: "", follow_up_notes: "" },
    oncologicalOutcomeTable: { assessment_date: "", response_evaluation_criteria: "", overall_response: "", target_lesion_response: "", non_target_lesion_response: "", new_lesions: "", progression_date: "", recurrence_status: "", recurrence_date: "", recurrence_location: "", survival_status: "", survival_date: "", cause_of_death: "", ecog_status: "", tumor_markers_followup: "", imaging_followup: "", outcome_notes: "" },
    tumorCharacteristicsTable: {
      tumour_sites: "",
      laterality: "", primary_count: "",
      tumor_size_length: "", tumor_size_width: "", tumor_size_depth: "", tumor_size_unit: "mm",
      macroscopic_features: "", specimen_type: "",
      diagnostic_modality_parameter: "", diagnostic_modality: "", sampling_confirmation: "",
      histological_type_parameter: "", histological_type: "", histological_grade: "", histological_info: "",
      cell_morphology_parameter: "", cell_morphology: "",
      tumor_differentiation_status: "", microscopic_size: "", microscopic_features: "",
      lvi: "", perineural_invasion: "", margin_status: "",
      mitotic_rate: "", tumor_infiltrating_lymphocytes: "", stroma_percentage: "", tumor_associated_macrophages: "",
      nodal_metastasis_details: "", distant_metastasis_details: "",
      synchronous_malignancy: "", metachronous_malignancy: "",
      diagnosis_date: "", pathological_interpretation: "", pathology_reporting_status: "", pathology_reporting_date: "",
      risk_stratification: "", genomic_risk_score: "", biology_summary: "",
      molecular_markers_parameter: "", molecular_markers: "", molecular_markers_entries: [],
      immunohistochemistry_parameter: "", immunohistochemistry: "", immunohistochemistry_entries: [],
      genomic_testing_parameter: "", genomic_testing: "", genomic_testing_entries: [],
      gene_expression_profile_parameter: "", gene_expression_profile: "", gene_expression_profile_entries: [],
      viral_status_parameter: "", viral_status: "",
    },
    problemTable: { problem: "", management_plan: "" },
    commonDrugsTable: { common_drug: "", common_dose: "", common_frequency: "", common_drug_notes: "" },
    neoChemoTable: { neo_chemo_drug: "", neo_chemo_dose: "", neo_chemo_freq: "", neo_chemo_route: "", neo_chemo_cycles: "", neo_chemo_effects: "", neo_chemo_notes: "" },
    adjChemoTable: { neo_chemo_drug: "", neo_chemo_dose: "", neo_chemo_freq: "", neo_chemo_route: "", neo_chemo_cycles: "", neo_chemo_effects: "", neo_chemo_notes: "" },
    neoRadioTable: { neo_radio_comp: "", neo_radio_dose: "", neo_radio_freq: "", neo_radio_route: "", neo_radio_cycles: "", neo_radio_effects: "", neo_radio_notes: "" },
    adjRadioTable: { neo_radio_comp: "", neo_radio_dose: "", neo_radio_freq: "", neo_radio_route: "", neo_radio_cycles: "", neo_radio_effects: "", neo_radio_notes: "" },
    surgeryTable: { surgery_name: "", surgery_date: "", surgery_site: "", surgery_approach: "", surgery_findings: "", drain_status: "", drain_volume: "", surgery_notes: "" },
    complicationTable: { complication: "", post_op_duration: "", management: "", notes: "" },
    monitoringTable: { monitor_param: "", monitor_duration: "", monitor_findings: "", monitor_notes: "" },
    icuTable: { icu_date: "", icu_stay: "", icu_mgmt: "", icu_exit: "", icu_notes: "" },
    wardTable: { ward_entry: "", ward_stay: "", ward_mgmt: "", ward_exit: "", ward_notes: "" },
    unmapped_medical_information: { source_section: "", detail: "", medical_importance: "medium" },
    source_file_summaries: { file_name: "", document_type: "", clinically_relevant_summary: "", unclear_or_unreadable_parts: "" },
    document_extraction_backups: { document_name: "", extraction_date: "", extraction_time: "", raw_extracted_data: "", file_reference: "" },
    systemicInquiry: { system: "", symptoms: [] } as any,
  };

  /** Remove table rows where all values are empty — used before save/upload */
  const stripBlankTableRows = (record: any): any => {
    const clean = { ...record };
    for (const key of Object.keys(tableTemplates)) {
      if (Array.isArray(clean[key])) {
        clean[key] = clean[key].filter((row: any) => {
          if (typeof row !== "object" || row === null) return false;
          return Object.values(row).some(v => v !== undefined && v !== null && String(v).trim() !== "");
        });
      }
    }
    return clean;
  };

  const tableAliases: Record<string, string> = {
    medications: "drugTable",
    medicationTable: "drugTable",
    drugs: "drugTable",
    otherAnthropometricTable: "otherAnthropometricTable",
    other_anthropometric: "otherAnthropometricTable",
    anthropometricTable: "anthropometricTable",
    anthropometric: "anthropometricTable",
    blood_results: "bloodTable",
    labs: "bloodTable",
    tumor_markers: "tumorMarkersTable",
    markers: "tumorMarkersTable",
    laboratory_results: "bloodTable",
    imaging: "imagingTable",
    scans: "imagingTable",
    pathology: "biopsyTable",
    biopsies: "biopsyTable",
    ihc: "immunohistochemistryTable",
    immunohistochemistry: "immunohistochemistryTable",
    immunostains: "immunohistochemistryTable",
    staining: "immunohistochemistryTable",
    supplementary: "supplementaryDetailsTable",
    supplementary_details: "supplementaryDetailsTable",
    supplementary_details_table: "supplementaryDetailsTable",
    additional_details: "supplementaryDetailsTable",
    extra_details: "supplementaryDetailsTable",
    dynamic_details: "supplementaryDetailsTable",
    staging: "stagingTable",
    clinical_staging: "clinicalStagingTable",
    clinical_stage: "clinicalStagingTable",
    histology_grading: "histologyGradingTable",
    histological_grading: "histologyGradingTable",
    adjuvant_therapy: "adjuvantTherapyTable",
    adjuvant_therapy_table: "adjuvantTherapyTable",
    pre_operative_assessment: "preOperativeAssessmentTable",
    preoperative_assessment: "preOperativeAssessmentTable",
    pre_op_assessment: "preOperativeAssessmentTable",
    definitive_surgery: "definitiveSurgeryTable",
    surgery_details: "definitiveSurgeryTable",
    definitive_surgery_table: "definitiveSurgeryTable",
    treatment_outcome: "treatmentOutcomeTable",
    surgical_outcome: "treatmentOutcomeTable",
    treatment_outcome_table: "treatmentOutcomeTable",
    after_surgical_therapies: "afterSurgicalTherapiesTable",
    post_surgical_therapies: "afterSurgicalTherapiesTable",
    after_surgery_therapies: "afterSurgicalTherapiesTable",
    follow_up_prognosis: "followUpPrognosisTable",
    followup_prognosis: "followUpPrognosisTable",
    follow_up: "followUpPrognosisTable",
    oncological_outcome: "oncologicalOutcomeTable",
    oncology_outcome: "oncologicalOutcomeTable",
    problems: "problemTable",
    management_plans: "problemTable",
    supportive_medications: "commonDrugsTable",
    chemotherapy: "neoChemoTable",
    chemo: "neoChemoTable",
    neo_chemo: "neoChemoTable",
    neo_chemotherapy: "neoChemoTable",
    neoadjuvant_chemo: "neoChemoTable",
    neoadjuvant_chemotherapy: "neoChemoTable",
    adj_chemo: "adjChemoTable",
    adj_chemotherapy: "adjChemoTable",
    adjuvant_chemo: "adjChemoTable",
    adjuvant_chemotherapy: "adjChemoTable",
    radiotherapy: "neoRadioTable",
    radiation: "neoRadioTable",
    neo_radio: "neoRadioTable",
    neo_radiotherapy: "neoRadioTable",
    neoadjuvant_radiation: "neoRadioTable",
    neoadjuvant_radiotherapy: "neoRadioTable",
    adj_radio: "adjRadioTable",
    adj_radiotherapy: "adjRadioTable",
    adjuvant_radiation: "adjRadioTable",
    adjuvant_radiotherapy: "adjRadioTable",
    surgeries: "surgeryTable",
    complications: "complicationTable",
    monitoring: "monitoringTable",
    examination: "examFindingsTable",
    exam: "examFindingsTable",
    physical_exam: "examFindingsTable",
    physical_examination: "examFindingsTable",
    systemic_examination: "examFindingsTable",
    systemic_exam_table: "examFindingsTable",
    cvs: "examFindingsTable",
    rs: "examFindingsTable",
    pa: "examFindingsTable",
    cns: "examFindingsTable",
    icu: "icuTable",
    ward: "wardTable",
    unmapped: "unmapped_medical_information",
    tumor_characteristics: "tumorCharacteristicsTable",
    tumour_characteristics: "tumorCharacteristicsTable",
    presenting_complaints: "presentingComplaintsTable",
    definitive_diagnosis: "definitiveDiagnosisTable",
    source_file_summaries: "source_file_summaries",
    source_summaries: "source_file_summaries",
  };

  const fieldAliases: Record<string, keyof PatientRecord> = {
    TP: "tp",
    telephone: "tp",
    telephone_number: "tp",
    phone: "tp",
    phone_number: "tp",
    mobile: "tp",
    mobile_number: "tp",
    contact: "tp",
    contact_number: "tp",
    tel: "tp",
    living: "living_area",
    living_address: "living_area",
    address: "living_area",
    home_address: "living_area",
    residential_address: "living_area",
    residence: "living_area",
    location: "living_area",
    area: "living_area",
    town: "living_area",
    village: "living_area",
    oncology_type: "oncology_types",
    cancer_type: "oncology_types",
    cancer_types: "oncology_types",
    tumor_type: "oncology_types",
    tumor_types: "oncology_types",
    tumour_type: "oncology_types",
    tumour_types: "oncology_types",
    primary_site: "oncology_types",
    primary_sites: "oncology_types",
    ecog: "ecog_status",
    ecog_ps: "ecog_status",
    "ecog performance status": "ecog_status",
    performance_status: "ecog_status",
    bmi: "bmi",
    height: "height",
    weight: "weight",
    bsa: "bsa",
    smoking: "smoking",
    smoking_history: "smoking",
    alcohol: "alcohol",
    alcohol_history: "alcohol",
    provisional_diagnosis: "provisional_diagnosis",
    final_diagnosis: "final_diagnosis",
    overall_stage: "overall_stage",
    tnm: "tnm_stage",
    tnm_stage: "tnm_stage",
    marital: "marital_status",
    marital_status: "marital_status",
    education: "education_status",
    education_status: "education_status",
    ethnicity: "ethnicity",
    occupation: "occupation",
    hospital: "hospital",
    ward: "ward_no",
    ward_no: "ward_no",
    geographic: "geographic_accessibility",
    geographic_accessibility: "geographic_accessibility",
    hospital_type: "hospital_type",
    hospital_location: "hospital_location",
  };

  const sectionByExtractedKey: Record<string, string> = {
    title: "patientIdentifiers",
    initials: "patientIdentifiers",
    first_name: "patientIdentifiers",
    last_name: "patientIdentifiers",
    nic: "patientIdentifiers",
    bht: "patientIdentifiers",
    clinic: "patientIdentifiers",
    auto_id: "patientIdentifiers",
    dob: "demographics",
    age: "demographics",
    gender: "demographics",
    status: "demographics",
    marital_status: "demographics",
    education_status: "demographics",
    ethnicity: "demographics",
    geographic_accessibility: "demographics",
    living_area: "demographics",
    occupation: "demographics",
    oncology: "oncology",
    oncology_types: "oncology",
    oncology_other: "oncology",
    oncology_type: "oncology",
    cancer_type: "oncology",
    cancer_types: "oncology",
    tumor_type: "oncology",
    tumor_types: "oncology",
    tumour_type: "oncology",
    tumour_types: "oncology",
    primary_site: "oncology",
    primary_sites: "oncology",
    hospital: "hospital",
    hospital_location: "hospital",
    hospital_type: "hospital",
    ward_no: "hospital",
    presenting_complaints: "history",
    presentingComplaintsTable: "history",
    comorbidity: "history",
    hospital_admissions: "history",
    past_surgical_history: "history",
    smoking: "history",
    smoking_amount: "history",
    alcohol: "history",
    alcohol_amount: "history",
    allergy_food: "history",
    allergy_drugs: "history",
    allergy_plasters: "history",
    allergy_other: "history",
    drugTable: "history",
    familyTable: "history",
    riskTable: "history",
    priorChemoTable: "history",
    priorRadioTable: "history",
    priorImmunoTable: "history",
    priorHormoneTable: "history",
    priorTargetedTable: "history",
    charlson_index: "history",
    charlson_conditions: "history",
    ecog_status: "clinicalAssessment",
    functional_adl_score: "clinicalAssessment",
    functional_adl_items: "clinicalAssessment",
    functional_iadl_score: "clinicalAssessment",
    functional_iadl_items: "clinicalAssessment",
    systemicInquiry: "clinicalAssessment",
    anthropometricTable: "anthropometric",
    otherAnthropometricTable: "anthropometric",
    bmi: "anthropometric",
    bsa: "anthropometric",
    height: "anthropometric",
    weight: "anthropometric",
    examFindingsTable: "examination",
    exam_findings: "examination",
    systemic_exam: "examination",
    provisional_diagnosis: "provisionalDiagnosis",
    definitiveDiagnosisTable: "definitiveDiagnosis",
    final_diagnosis: "definitiveDiagnosis",
    diagnosis_delay_days: "definitiveDiagnosis",
    bloodTable: "investigations",
    tumorMarkersTable: "investigations",
    imagingTable: "investigations",
    endoscopyTable: "investigations",
    otherInvTable: "investigations",
    geneticTable: "investigations",
    contrastTable: "investigations",
    biopsyTable: "investigations",
    immunohistochemistryTable: "investigations",
    overall_stage: "investigations",
    tnm_stage: "investigations",
    stagingTable: "investigations",
    tumorCharacteristicsTable: "tumorCharacteristics",
    tumor_tumour_sites: "tumorCharacteristics",
    tumor_histological_type_parameter: "tumorCharacteristics",
    tumor_histological_type: "tumorCharacteristics",
    tumor_histological_grade: "tumorCharacteristics",
    tumor_diagnosis_date: "tumorCharacteristics",
    tumor_diagnostic_modality_parameter: "tumorCharacteristics",
    tumor_diagnostic_modality: "tumorCharacteristics",
    tumor_laterality: "tumorCharacteristics",
    tumor_primary_count: "tumorCharacteristics",
    tumor_synchronous_malignancy: "tumorCharacteristics",
    tumor_metachronous_malignancy: "tumorCharacteristics",
    tumor_molecular_markers_parameter: "tumorCharacteristics",
    tumor_molecular_markers: "tumorCharacteristics",
    tumor_immunohistochemistry_parameter: "tumorCharacteristics",
    tumor_immunohistochemistry: "tumorCharacteristics",
    tumor_genomic_testing_parameter: "tumorCharacteristics",
    tumor_genomic_testing: "tumorCharacteristics",
    tumor_gene_expression_profile_parameter: "tumorCharacteristics",
    tumor_gene_expression_profile: "tumorCharacteristics",
    tumor_viral_status_parameter: "tumorCharacteristics",
    tumor_viral_status: "tumorCharacteristics",
    tumor_cell_morphology_parameter: "tumorCharacteristics",
    tumor_cell_morphology: "tumorCharacteristics",
    tumor_biology_summary: "tumorCharacteristics",
    tumor_sampling_confirmation: "tumorCharacteristics",
    tumor_size_length: "tumorCharacteristics",
    tumor_size_width: "tumorCharacteristics",
    tumor_size_depth: "tumorCharacteristics",
    tumor_size_unit: "tumorCharacteristics",
    nodal_metastasis_details: "tumorCharacteristics",
    distant_metastasis_details: "tumorCharacteristics",
    tumor_differentiation_status: "tumorCharacteristics",
    pathological_interpretation: "tumorCharacteristics",
    pathology_reporting_status: "tumorCharacteristics",
    pathology_reporting_date: "tumorCharacteristics",
    risk_stratification: "tumorCharacteristics",
    genomic_risk_score: "tumorCharacteristics",
    mitotic_rate: "tumorCharacteristics",
    tumor_infiltrating_lymphocytes: "tumorCharacteristics",
    tumor_macroscopic_features: "tumorCharacteristics",
    tumor_specimen_type: "tumorCharacteristics",
    tumor_histological_info: "tumorCharacteristics",
    tumor_microscopic_size: "tumorCharacteristics",
    tumor_microscopic_features: "tumorCharacteristics",
    tumor_lvi: "tumorCharacteristics",
    tumor_perineural_invasion: "tumorCharacteristics",
    tumor_margin_status: "tumorCharacteristics",
    clinicalStagingTable: "clinicalStaging",
    histologyGradingTable: "histologyGrading",
    grading_system: "histologyGrading",
    histological_grade: "histologyGrading",
    histological_grade_description: "histologyGrading",
    differentiation: "histologyGrading",
    nuclear_grade: "histologyGrading",
    mitotic_count: "histologyGrading",
    ki67_percentage: "histologyGrading",
    nottingham_score: "histologyGrading",
    gleason_score: "histologyGrading",
    adjuvantTherapyTable: "adjuvantTherapy",
    preOperativeAssessmentTable: "preOperativeAssessment",
    definitiveSurgeryTable: "definitiveSurgery",
    treatmentOutcomeTable: "treatmentOutcome",
    afterSurgicalTherapiesTable: "afterSurgicalTherapies",
    followUpPrognosisTable: "followUpPrognosis",
    oncologicalOutcomeTable: "oncologicalOutcome",
    neoChemoTable: "treatments",
    adjChemoTable: "treatments",
    neoRadioTable: "treatments",
    adjRadioTable: "treatments",
    neo_chemo_status: "treatments",
    adj_chemo_status: "treatments",
    neo_radio_status: "treatments",
    adj_radio_status: "treatments",
    surgeryTable: "surgicalProcedures",
    complicationTable: "surgicalProcedures",
    monitoringTable: "surgicalProcedures",
    icu_done: "surgicalProcedures",
    icuTable: "surgicalProcedures",
    wardTable: "surgicalProcedures",
    problemTable: "care",
    commonDrugsTable: "care",
    follow_up_notes: "care",
    general_notes: "care",
    unmapped_medical_information: "extraParams",
    supplementaryDetailsTable: "supplementary",
    source_file_summaries: "supplementary",
    document_extraction_backups: "documentExtractions",
  };

  const systemSymptoms = SYSTEM_SYMPTOMS;

  const toggleSystemicSystem = (system: string) => {
    setFormState(prev => {
      const existing = prev.systemicInquiry.find(s => s.system === system);
      if (existing) {
        return { ...prev, systemicInquiry: prev.systemicInquiry.filter(s => s.system !== system) };
      }
      return { ...prev, systemicInquiry: [...prev.systemicInquiry, { system, symptoms: [] }] };
    });
  };

  const toggleSystemicSymptom = (system: string, symptom: string) => {
    setFormState(prev => ({
      ...prev,
      systemicInquiry: prev.systemicInquiry.map(s =>
        s.system === system
          ? { ...s, symptoms: s.symptoms.includes(symptom) ? s.symptoms.filter(x => x !== symptom) : [...s.symptoms, symptom] }
          : s
      )
    }));
  };

  const findTopLevelManifestField = (key: string) => {
    for (const section of Object.values(MANIFEST.sections)) {
      if (section.fields[key]) return section.fields[key];
    }
    return undefined;
  };

  const findTableManifestField = (tableKey: string, field: string) => {
    const tableField = findTopLevelManifestField(tableKey);
    return tableField?.itemFields?.[field];
  };

  const adlChoices = ADL_CHOICES;
  const iadlChoices = IADL_CHOICES;
  const charlsonChoices = CHARLSON_CHOICES;

  const normalizeExtractedRow = (tableKey: string, row: any) => {
    const template = tableTemplates[tableKey];
    if (!template || typeof row !== "object" || row === null || Array.isArray(row)) return row;

    if (tableKey === "examFindingsTable" && Array.isArray(row.entries)) {
      return {
        date: row.date || "",
        entries: row.entries.map((entry: any) => ({
          organ_system: coerceControlledChoice(entry?.organ_system, findTableManifestField(tableKey, "entries")?.itemFields?.organ_system),
          findings: entry?.findings || "",
          notes: entry?.notes || "",
        })),
      };
    }
    if (tableKey === "otherAnthropometricTable" && Array.isArray(row.entries)) {
      return {
        date: row.date || "",
        entries: row.entries.map((entry: any) => ({
          measure: coerceControlledChoice(entry?.measure, findTableManifestField(tableKey, "entries")?.itemFields?.measure),
          value: entry?.value ?? "",
          unit: coerceControlledChoice(entry?.unit, findTableManifestField(tableKey, "entries")?.itemFields?.unit),
        })),
      };
    }

    const normalized: Record<string, any> = { ...template };
    if (row._aiRowGroup || row.rowGroup || row.source_group) {
      normalized._aiRowGroup = row._aiRowGroup || row.rowGroup || row.source_group;
    }
    const extraPairs: string[] = [];
    Object.entries(row).forEach(([field, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (["_aiRowGroup", "rowGroup", "source_group"].includes(field)) return;
      if (field in template) {
        normalized[field] = coerceControlledChoice(value, findTableManifestField(tableKey, field));
      } else {
        extraPairs.push(`${field}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
      }
    });

    if (extraPairs.length > 0) {
      const noteField = Object.keys(template).find((field) => field.endsWith("_notes") || field === "notes" || field.includes("findings"));
      if (noteField) {
        normalized[noteField] = [normalized[noteField], extraPairs.join("; ")].filter(Boolean).join("; ");
      }
    }
    return normalized;
  };

  const FORM_STATE_KEYS = new Set([
    "id","date","auto_id","tp","nic","title","initials","first_name","last_name","bht","clinic",
    "dob","age","gender","living_area","hospital","hospital_location","hospital_type","ward_no",
    "marital_status","education_status","ethnicity","occupation","geographic_accessibility","status",
    "oncology","oncology_types","oncology_other",
    "presenting_complaints","comorbidity","hospital_admissions","past_surgical_history",
    "ecog_status","functional_adl_score","functional_adl_items","functional_iadl_score","functional_iadl_items",
    "charlson_index","charlson_conditions",
    "smoking","smoking_amount","alcohol","alcohol_amount",
    "allergy_food","allergy_drugs","allergy_plasters","allergy_other",
    "bmi","bsa","height","weight",
    "exam_findings","systemic_exam",
    "provisional_diagnosis","final_diagnosis","diagnosis_delay_days","overall_stage","tnm_stage",
    "neo_chemo_status","adj_chemo_status","neo_radio_status","adj_radio_status",
    "icu_done","follow_up_notes","general_notes","extraction_safety_note",
    "presentingComplaintsTable","pastMedicalTable","pastSurgicalTable","priorChemoTable","priorRadioTable",
    "priorImmunoTable","priorHormoneTable","priorTargetedTable","drugTable","familyTable","riskTable",
    "systemicInquiry","examFindingsTable","anthropometricTable","otherAnthropometricTable",
    "bloodTable","tumorMarkersTable","imagingTable","endoscopyTable","otherInvTable",
    "geneticTable","contrastTable","biopsyTable","immunohistochemistryTable","stagingTable",
    "supplementaryDetailsTable","tumorCharacteristicsTable","definitiveDiagnosisTable",
    "clinicalStagingTable","histologyGradingTable","adjuvantTherapyTable","preOperativeAssessmentTable",
    "definitiveSurgeryTable","treatmentOutcomeTable","afterSurgicalTherapiesTable",
    "followUpPrognosisTable","oncologicalOutcomeTable","problemTable","commonDrugsTable",
    "neoChemoTable","adjChemoTable","neoRadioTable","adjRadioTable","surgeryTable",
    "complicationTable","monitoringTable","icuTable","wardTable",
    "unmapped_medical_information","source_file_summaries","document_extraction_backups",
  ]);

  const tumorTableManifest = MANIFEST.sections.tumorCharacteristics
    ?.fields.tumorCharacteristicsTable;
  const tumorTableFields = tumorTableManifest?.itemFields || {};

  const hasMeaningfulValue = (value: any): boolean => {
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.some(hasMeaningfulValue);
    if (typeof value === "object") return Object.values(value).some(hasMeaningfulValue);
    return String(value).trim() !== "";
  };

  const appendUniqueText = (existing: any, addition: any) => {
    const current = String(existing || "").trim();
    const next = String(addition || "").trim();
    if (!next) return current;
    if (!current) return next;
    if (current.toLowerCase().includes(next.toLowerCase())) return current;
    return `${current}, ${next}`;
  };

  const appendUnmappedAiDetail = (
    merged: Record<string, any>,
    sourceSection: string,
    detail: any,
    medicalImportance: "low" | "medium" | "high" = "medium"
  ) => {
    const normalizedDetail = typeof detail === "object" ? JSON.stringify(detail) : String(detail || "").trim();
    if (!normalizedDetail) return;
    const existingUnmapped = Array.isArray(merged.unmapped_medical_information)
      ? merged.unmapped_medical_information
      : [];
    const exists = existingUnmapped.some((row: any) =>
      String(row?.source_section || "") === sourceSection &&
      String(row?.detail || "") === normalizedDetail
    );
    if (!exists) {
      merged.unmapped_medical_information = [
        ...existingUnmapped,
        { source_section: sourceSection, detail: normalizedDetail, medical_importance: medicalImportance },
      ];
    }
  };

  const setScalarIfEmpty = (
    merged: Record<string, any>,
    key: string,
    value: any,
    preserveSource = key
  ) => {
    if (!hasMeaningfulValue(value)) return false;
    if (!hasMeaningfulValue(merged[key])) {
      merged[key] = value;
      return true;
    }
    if (String(merged[key]).trim() !== String(value).trim()) {
      appendUnmappedAiDetail(merged, preserveSource, `Existing kept: ${merged[key]} | AI new: ${value}`);
    }
    return false;
  };

  const routeTumorKey = (merged: Record<string, any>, key: string, val: any) => {
    const directField = tumorTableFields[key] ? key : "";
    const prefixedField = key.startsWith("tumor_") && tumorTableFields[key.slice("tumor_".length)]
      ? key.slice("tumor_".length)
      : "";
    const field = directField || prefixedField;
    if (!field) return false;
    if (val === undefined || val === null || val === "") return true;
    if (!Array.isArray(merged.tumorCharacteristicsTable)) merged.tumorCharacteristicsTable = [];
    if (merged.tumorCharacteristicsTable.length === 0) {
      merged.tumorCharacteristicsTable.push({ ...tableTemplates.tumorCharacteristicsTable });
    }
    const normalized = coerceControlledChoice(val, tumorTableFields[field]);
    if (normalized !== undefined && normalized !== null && normalized !== "") {
      let targetRow = (merged.tumorCharacteristicsTable as Record<string, any>[]).find(
        (row) => !hasMeaningfulValue(row[field])
      );
      if (!targetRow) {
        targetRow = { ...tableTemplates.tumorCharacteristicsTable };
        (merged.tumorCharacteristicsTable as Record<string, any>[]).push(targetRow);
      }
      targetRow[field] = normalized;
    }
    return true;
  };

  const mergeAiExtractionIntoForm = (prev: Partial<PatientRecord>, extractedData: any, sectionTarget?: { section: string; label: string }) => {
    const merged: Record<string, any> = { ...prev };
    const openedSections = new Set<string>();

    if (sectionTarget?.section) {
      const allowedKeys = new Set(getSectionFieldKeys(sectionTarget.section));
      const beforeKeys = Object.keys(extractedData || {});
      const spilloverEntries = Object.entries(extractedData || {}).filter(([key]) => !allowedKeys.has(key));
      spilloverEntries.forEach(([key, value]) => {
        appendUnmappedAiDetail(
          merged,
          `Outside ${sectionTarget.label}`,
          `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`,
          "medium"
        );
      });
      extractedData = Object.fromEntries(
        Object.entries(extractedData || {}).filter(([key]) => allowedKeys.has(key))
      );
      const afterKeys = Object.keys(extractedData);
      console.log(`[SectionExtract] target=${sectionTarget.section} label=${sectionTarget.label}`, {
        beforeKeys, afterKeys, filteredOut: beforeKeys.filter(k => !allowedKeys.has(k))
      });
    }

    const knownOncologyTypes = Object.values(OncologyCategory);
    const coerceOncologyList = (value: any) =>
      coerceOncologyTypes(value, knownOncologyTypes);

    const isFormAware = sectionTarget?.section
      ? true
      : Object.keys(extractedData || {}).some(k => FORM_STATE_KEYS.has(k));

    const ENTRIES_KEYS = new Set(["molecular_markers_entries", "immunohistochemistry_entries", "genomic_testing_entries", "gene_expression_profile_entries"]);

    const signatureValue = (value: any) => {
      if (value && typeof value === "object") return JSON.stringify(value);
      return String(value).trim().toLowerCase();
    };
    const clinicalRowAnchor = (tableKey: string, row: Record<string, any>) => {
      const explicitGroup = signatureValue(row._aiRowGroup || row.rowGroup || row.source_group);
      if (explicitGroup) return `${tableKey}:${explicitGroup}`;
      const pick = (...keys: string[]) =>
        keys.map((key) => signatureValue(row[key])).filter(Boolean).join("|");
      const anchor =
        tableKey === "biopsyTable" ? pick("biopsy_date", "biopsy_type", "biopsy_parameter", "histological_type", "cell_type") :
        tableKey === "immunohistochemistryTable" ? pick("ihc_date", "ihc_specimen", "ihc_marker", "ihc_anatomical_site") :
        tableKey === "imagingTable" ? pick("imaging_date", "imaging_type", "anatomical_site", "mass_location", "imaging_parameter") :
        tableKey === "tumorMarkersTable" ? pick("marker_date", "marker_name", "marker_value") :
        tableKey === "bloodTable" ? pick("blood_date", "blood_type", "blood_purpose") :
        tableKey === "geneticTable" ? pick("date", "test_name", "gene", "variant") :
        tableKey === "contrastTable" ? pick("date", "study_type", "body_part") :
        tableKey === "clinicalStagingTable" ? pick("staging_date", "staging_system", "staging_type") :
        tableKey === "tumorCharacteristicsTable" ? pick("diagnosis_date", "specimen_type", "tumour_sites", "diagnostic_modality_parameter") :
        pick("date", "assessment_date", "surgery_date", "staging_date", "biopsy_date", "imaging_date");
      return anchor ? `${tableKey}:${anchor}` : "";
    };
    const rowSignature = (tableKey: string, row: Record<string, any>) =>
      clinicalRowAnchor(tableKey, row) ||
      Object.entries(row).filter(([k, v]) => !ENTRIES_KEYS.has(k) && v !== undefined && v !== null && String(v).trim() !== "")
        .map(([k, v]) => `${k}=${signatureValue(v)}`).sort().join("|");
    const existingSignatures = new Map<string, Set<string>>();
    Object.keys(tableTemplates).forEach((k) => {
      const arr = Array.isArray(merged[k]) ? (merged[k] as Record<string, any>[]) : [];
      existingSignatures.set(k, new Set(arr.map((row) => rowSignature(k, row))));
    });

    const mergeEntryArrays = (existingRow: any, incomingRow: any) => {
      ENTRIES_KEYS.forEach((ek) => {
        const incoming = Array.isArray(incomingRow[ek]) ? incomingRow[ek] : [];
        if (incoming.length === 0) return;
        if (!Array.isArray(existingRow[ek])) existingRow[ek] = [];
        const existingParams = new Set(existingRow[ek].map((e: any) => e.parameter));
        incoming.forEach((entry: any) => {
          if (entry.parameter && !existingParams.has(entry.parameter)) {
            existingRow[ek].push(entry);
            existingParams.add(entry.parameter);
          }
        });
      });
    };
    const mergeBlankFields = (existingRow: any, incomingRow: any) => {
      Object.entries(incomingRow).forEach(([field, val]) => {
        if (ENTRIES_KEYS.has(field)) return;
        if (val === undefined || val === null || val === "") return;
        if (!hasMeaningfulValue(existingRow[field])) existingRow[field] = val;
      });
    };

    const mergeArrayTable = (key: string, rows: any[]) => {
      const allRows = Array.isArray(merged[key]) ? (merged[key] as Record<string, any>[]) : [];
      // Separate non-empty and blank rows
      const nonEmptyRows: Record<string, any>[] = [];
      const blankRows: Record<string, any>[] = [];
      for (const row of allRows) {
        if (rowSignature(key, row)) {
          nonEmptyRows.push(row);
        } else {
          blankRows.push(row);
        }
      }
      const sigs = existingSignatures.get(key) || new Set<string>();
      const newOnes: Record<string, any>[] = [];
      // Track filled blank rows to avoid double-use
      const filledBlankIndices = new Set<number>();
      rows.forEach((row) => {
        const normalized = normalizeExtractedRow(key, row);
        if (!normalized || typeof normalized !== "object") return;
        const sig = rowSignature(key, normalized);
        if (sigs.has(sig)) {
          const existingRow = nonEmptyRows.find((er) => rowSignature(key, er) === sig);
          if (existingRow) {
            mergeBlankFields(existingRow, normalized);
            mergeEntryArrays(existingRow, normalized);
          }
          return;
        }
        // Try to fill a blank row first
        const blankIdx = blankRows.findIndex((_, i) => !filledBlankIndices.has(i));
        if (blankIdx !== -1) {
          // Fill blank row with extracted data — never overwrite non-empty fields
          const blankRow = blankRows[blankIdx];
          Object.entries(normalized).forEach(([field, val]) => {
            if (val !== undefined && val !== null && val !== "" &&
                (blankRow[field] === undefined || blankRow[field] === null || String(blankRow[field]).trim() === "")) {
              blankRow[field] = val;
            }
          });
          filledBlankIndices.add(blankIdx);
          nonEmptyRows.push(blankRow);
          sigs.add(rowSignature(key, blankRow));
          return;
        }
        sigs.add(sig); newOnes.push(normalized);
      });
      if (newOnes.length > 0 || filledBlankIndices.size > 0) {
        // Keep remaining blank rows (if any) so user can still type in them
        const remainingBlanks = blankRows.filter((_, i) => !filledBlankIndices.has(i));
        merged[key] = [...nonEmptyRows, ...remainingBlanks, ...newOnes];
        if (sectionByExtractedKey[key]) openedSections.add(sectionByExtractedKey[key]);
      }
    };

    if (isFormAware) {
      Object.entries(extractedData || {}).forEach(([key, val]) => {
        if (key === "oncology_types") {
          const { selected, otherValues } = coerceOncologyList(val);
          if (selected.length > 0) {
            const existingTypes = Array.isArray(merged.oncology_types) ? merged.oncology_types : [];
            merged.oncology_types = Array.from(new Set([...existingTypes, ...selected]));
            if (!hasMeaningfulValue(merged.oncology)) {
              merged.oncology = (merged.oncology_types.find((item: string) => item !== OncologyCategory.OTHER) || merged.oncology_types[0] || OncologyCategory.OTHER) as OncologyCategory;
            }
            if (otherValues.length > 0) {
              merged.oncology_other = appendUniqueText(merged.oncology_other, otherValues.join(", "));
            }
            openedSections.add("demographics");
          }
          return;
        }
        if (["oncology", "oncology_type", "cancer_type", "tumor_type", "tumour_type", "primary_site"].includes(key)) {
          const { selected, otherValues } = coerceOncologyList(val);
          if (selected.length > 0) {
            const existingTypes = Array.isArray(merged.oncology_types) ? merged.oncology_types : [];
            merged.oncology_types = Array.from(new Set([...existingTypes, ...selected]));
            if (!hasMeaningfulValue(merged.oncology)) {
              merged.oncology = (merged.oncology_types.find((item: string) => item !== OncologyCategory.OTHER) || merged.oncology_types[0] || OncologyCategory.OTHER) as OncologyCategory;
            }
            if (otherValues.length > 0) {
              merged.oncology_other = appendUniqueText(merged.oncology_other, otherValues.join(", "));
            }
            openedSections.add("demographics");
          }
          return;
        }
        if (routeTumorKey(merged, key, val)) {
          openedSections.add("tumorCharacteristics");
          return;
        }
        if (sectionTarget?.section) {
          const sec = MANIFEST.sections[sectionTarget.section];
          const tKey = sec?.tableKey;
          if (sec && sec.fields[tKey]?.itemFields && key in sec.fields[tKey].itemFields!) {
            console.log(`[genericRoute] routing bare key ${key} -> appended ${tKey}.${key} row =`, val);
            if (val !== undefined && val !== null && val !== "") {
              if (!Array.isArray(merged[tKey])) merged[tKey] = [];
              const targetRow = { ...tableTemplates[tKey] };
              const normalized = coerceControlledChoice(val, sec.fields[tKey].itemFields?.[key]);
              if (normalized !== undefined && normalized !== null && normalized !== "") {
                targetRow[key] = normalized;
                (merged[tKey] as Record<string, any>[]).push(targetRow);
              }
            }
            openedSections.add(sectionTarget.section);
            return;
          }
        }
        if (key === "supplementaryDetailsTable" && Array.isArray(val)) {
          val.forEach((entry: any) => {
            const label = String(entry.detail_label || entry.label || "").trim().toLowerCase().replace(/\s+/g, "_");
            const value = entry.detail_value ?? entry.value ?? "";
            if (label && FORM_STATE_KEYS.has(label)) {
              setScalarIfEmpty(merged, label, value, "supplementaryDetailsTable");
              const sectionKey = sectionByExtractedKey[label];
              if (sectionKey) openedSections.add(sectionKey);
            } else {
              appendUnmappedAiDetail(
                merged,
                "supplementaryDetailsTable",
                entry.detail_label ? `${entry.detail_label}: ${entry.detail_value}` : entry,
                "low"
              );
            }
          });
          return;
        }
        if (!FORM_STATE_KEYS.has(key)) {
          appendUnmappedAiDetail(merged, key, val);
          return;
        }
        if (val === undefined || val === null || val === "") return;
        if (key === "systemicInquiry") {
          const normalized = normalizeSystemicInquiry(val, systemSymptoms);
          if (normalized.length > 0) {
            const existing = Array.isArray(merged.systemicInquiry) ? merged.systemicInquiry : [];
            const bySystem = new Map(existing.map((entry: any) => [entry.system, {
              system: entry.system || "",
              symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : [],
            }]));
            normalized.forEach((entry: any) => {
              const current = bySystem.get(entry.system) || { system: entry.system, symptoms: [] };
              current.symptoms = Array.from(new Set([...(current.symptoms || []), ...(entry.symptoms || [])]));
              bySystem.set(entry.system, current);
            });
            merged.systemicInquiry = Array.from(bySystem.values());
          }
          openedSections.add("clinicalAssessment");
          return;
        }
        if (key === "functional_adl_items") {
          merged.functional_adl_items = normalizeChecklist([merged.functional_adl_items, val].filter(Boolean).join(", "), adlChoices);
          merged.functional_adl_score = String(merged.functional_adl_items.split(",").filter(Boolean).length);
          openedSections.add("clinicalAssessment");
          return;
        }
        if (key === "functional_iadl_items") {
          merged.functional_iadl_items = normalizeChecklist([merged.functional_iadl_items, val].filter(Boolean).join(", "), iadlChoices);
          merged.functional_iadl_score = String(merged.functional_iadl_items.split(",").filter(Boolean).length);
          openedSections.add("clinicalAssessment");
          return;
        }
        if (key === "charlson_conditions") {
          merged.charlson_conditions = normalizeChecklist([merged.charlson_conditions, val].filter(Boolean).join(", "), charlsonChoices);
          openedSections.add("clinicalAssessment");
          return;
        }
        if (Array.isArray(val) && tableTemplates[key]) {
          mergeArrayTable(key, val);
          return;
        }
        const normalized = coerceControlledChoice(val, findTopLevelManifestField(key));
        if (normalized !== undefined && normalized !== null && normalized !== "") {
          setScalarIfEmpty(merged, key, normalized);
        }
        const sectionKey = sectionByExtractedKey[key];
        if (sectionKey) openedSections.add(sectionKey);
      });
    } else {
      const normalizedData: Record<string, any> = {};
      const normalizeHeading = (h: string) =>
        (h || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s\/]/g, "");
      const headingAlias = (h: string) => {
        const n = normalizeHeading(h);
        const map: Record<string, string> = {
          "genetics": "Genetic Testing", "genomic testing": "Genetic Testing", "genomic": "Genetic Testing",
          "ps": "Performance Status", "ecog": "Performance Status", "functional status": "Performance Status",
          "vital signs": "Vitals", "vital": "Vitals",
          "habits": "Lifestyle", "social history": "Lifestyle",
          "stage notes": "Staging Details", "path notes": "Pathology Details",
          "co morbidities": "Comorbidities", "past medical history": "Comorbidities",
          "side effects": "Adverse Event Logs", "adverse events": "Adverse Event Logs",
          "discharge meds": "Discharge Medications", "meds on discharge": "Discharge Medications",
          "follow up": "Follow-up Schedule", "followup": "Follow-up Schedule",
          "immunizations": "Vaccinations", "obgyn history": "Pregnancy / Reproductive History",
          "drug allergies": "Allergies", "plan of care": "Care Plan",
          "pros": "Patient-Reported Outcomes", "patient symptoms": "Patient-Reported Outcomes",
          "dc summary": "Discharge Summary", "bone density": "Bone Health",
          "kidney function": "Renal Function", "coag profile": "Coagulation",
          "id": "Infectious Disease", "infection history": "Infectious Disease",
          "psych": "Psychosocial", "social": "Psychosocial",
        };
        return map[n] || (h || "").trim();
      };
      const labelAlias = (l: string) => {
        const n = (l || "").trim().toLowerCase().replace(/\s+/g, " ");
        const map: Record<string, string> = {
          "ecog ps": "ECOG", "ecog performance status": "ECOG", "kps": "Karnofsky",
          "ejection fraction": "LVEF", "body mass index": "BMI",
          "blood pressure": "BP", "heart rate": "HR", "pulse rate": "HR",
          "oxygen saturation": "SpO2", "variant allele frequency": "VAF", "figo stage": "FIGO",
        };
        return map[n] || (l || "").trim();
      };
      Object.entries(extractedData || {}).forEach(([rawKey, value]) => {
        const key = tableAliases[rawKey] || fieldAliases[rawKey] || rawKey;
        normalizedData[key] = value;
      });
      Object.entries(normalizedData).forEach(([key, val]) => {
        if (key === "systemicInquiry") {
          const normalized = normalizeSystemicInquiry(val, systemSymptoms);
          if (normalized.length > 0) {
            const existing = Array.isArray(merged.systemicInquiry) ? merged.systemicInquiry : [];
            const bySystem = new Map(existing.map((entry: any) => [entry.system, {
              system: entry.system || "",
              symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : [],
            }]));
            normalized.forEach((entry: any) => {
              const current = bySystem.get(entry.system) || { system: entry.system, symptoms: [] };
              current.symptoms = Array.from(new Set([...(current.symptoms || []), ...(entry.symptoms || [])]));
              bySystem.set(entry.system, current);
            });
            merged.systemicInquiry = Array.from(bySystem.values());
          }
          openedSections.add("clinicalAssessment");
          return;
        }
        if (key === "functional_adl_items") {
          merged.functional_adl_items = normalizeChecklist([merged.functional_adl_items, val].filter(Boolean).join(", "), adlChoices);
          merged.functional_adl_score = String(merged.functional_adl_items.split(",").filter(Boolean).length);
          openedSections.add("clinicalAssessment");
          return;
        }
        if (key === "functional_iadl_items") {
          merged.functional_iadl_items = normalizeChecklist([merged.functional_iadl_items, val].filter(Boolean).join(", "), iadlChoices);
          merged.functional_iadl_score = String(merged.functional_iadl_items.split(",").filter(Boolean).length);
          openedSections.add("clinicalAssessment");
          return;
        }
        if (key === "charlson_conditions") {
          merged.charlson_conditions = normalizeChecklist([merged.charlson_conditions, val].filter(Boolean).join(", "), charlsonChoices);
          openedSections.add("clinicalAssessment");
          return;
        }
        if (Array.isArray(val)) {
          if (val.length === 0) return;
          if (key === "oncology_types") {
            const { selected, otherValues } = coerceOncologyList(val);
            if (selected.length > 0) {
              const existingTypes = Array.isArray(merged.oncology_types) ? merged.oncology_types : [];
              merged.oncology_types = Array.from(new Set([...existingTypes, ...selected]));
              if (!hasMeaningfulValue(merged.oncology)) {
                merged.oncology = (merged.oncology_types.find((item: string) => item !== OncologyCategory.OTHER) || merged.oncology_types[0] || OncologyCategory.OTHER) as OncologyCategory;
              }
              if (otherValues.length > 0) merged.oncology_other = appendUniqueText(merged.oncology_other, otherValues.join(", "));
              openedSections.add("demographics");
            }
          } else if (tableTemplates[key]) {
            mergeArrayTable(key, val);
          } else {
            appendUnmappedAiDetail(merged, key, val);
            openedSections.add("care");
          }
        } else if (val !== undefined && val !== null && val !== "") {
          if (["oncology", "oncology_types", "oncology_type", "cancer_type", "tumor_type", "tumour_type", "primary_site"].includes(key)) {
            const { selected, otherValues } = coerceOncologyList(val);
            if (selected.length > 0) {
              const existingTypes = Array.isArray(merged.oncology_types) ? merged.oncology_types : [];
              merged.oncology_types = Array.from(new Set([...existingTypes, ...selected]));
              if (!hasMeaningfulValue(merged.oncology)) {
                merged.oncology = (merged.oncology_types.find((item: string) => item !== OncologyCategory.OTHER) || merged.oncology_types[0] || OncologyCategory.OTHER) as OncologyCategory;
              }
              if (otherValues.length > 0) merged.oncology_other = appendUniqueText(merged.oncology_other, otherValues.join(", "));
              openedSections.add("demographics");
            }
            return;
          }
          if (val === "" || (typeof val === "string" && val.trim() === "")) {
            if (sectionByExtractedKey[key]) openedSections.add(sectionByExtractedKey[key]);
            return;
          }
          const normalized = coerceControlledChoice(val, findTopLevelManifestField(key));
          if (normalized !== undefined && normalized !== null && normalized !== "") {
            setScalarIfEmpty(merged, key, normalized);
          }
          if (sectionByExtractedKey[key]) openedSections.add(sectionByExtractedKey[key]);
        }
      });

      if (Array.isArray(merged.otherAnthropometricTable) && merged.otherAnthropometricTable.length > 0) {
        const firstEntry = merged.otherAnthropometricTable[0];
        if (firstEntry && "measure" in firstEntry && !("entries" in firstEntry)) {
          const groups: Record<string, { date: string; entries: OtherAnthropometricEntry[] }> = {};
          (merged.otherAnthropometricTable as any[]).forEach((entry: any) => {
            const d = entry.date || "";
            if (!groups[d]) groups[d] = { date: d, entries: [] };
            groups[d].entries.push({ measure: entry.measure || "", value: entry.value || "", unit: entry.unit || "" });
          });
          merged.otherAnthropometricTable = Object.values(groups);
        }
      }

      if (Array.isArray(merged.examFindingsTable) && merged.examFindingsTable.length > 0) {
        const firstEntry = merged.examFindingsTable[0];
        if (firstEntry && "organ_system" in firstEntry && !("entries" in firstEntry)) {
          const groups: Record<string, { date: string; entries: ExamFindingsEntry[] }> = {};
          (merged.examFindingsTable as any[]).forEach((entry: any) => {
          const d = entry.date || "";
          if (!groups[d]) groups[d] = { date: d, entries: [] };
          groups[d].entries.push({ organ_system: entry.organ_system || "", findings: entry.findings || "", notes: entry.notes || "" });
        });
        merged.examFindingsTable = Object.values(groups);
      }
    }

    if (Array.isArray(merged.systemicInquiry)) {
      merged.systemicInquiry = merged.systemicInquiry.map((entry: any) => ({
        system: entry.system || "",
        symptoms: Array.isArray(entry.symptoms) ? entry.symptoms : entry.symptoms ? entry.symptoms.split(/[,;]\s*/).filter(Boolean) : [],
      }));
    }
    }

    const calcStageFromTnm = (t: string, n: string, m: string) => {
      if (!t || !n || !m) return "";
      const mClean = String(m || "").replace(/^[cp]M/, "M");
      if (["M1","M1a","M1b","M1c"].includes(mClean)) return "IV";
      if (t === "Tis") return "0";
      if (t.startsWith("T4") || t === "T4") return n !== "N0" && n !== "NX" ? "IIIB" : "IIIA";
      if (t.startsWith("T3") || t === "T3") return n !== "N0" && n !== "NX" ? "IIIB" : "IIB";
      if (t.startsWith("T2") || t === "T2") return n !== "N0" && n !== "NX" ? "IIA" : "IB";
      if (t.startsWith("T1") || t === "T1") return n !== "N0" && n !== "NX" ? "IIA" : "IA";
      return "";
    };

    if (merged.dob && !merged.age) {
      const birth = new Date(String(merged.dob));
      if (!isNaN(birth.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        merged.age = String(age);
      }
    }

    const h = parseFloat(String(merged.height || ""));
    const w = parseFloat(String(merged.weight || ""));
    if (h > 0 && w > 0) {
      if (!merged.bmi) merged.bmi = (w / ((h / 100) * (h / 100))).toFixed(1);
      if (!merged.bsa) merged.bsa = Math.sqrt((h * w) / 3600).toFixed(2);
    }

    if (Array.isArray(merged.anthropometricTable)) {
      merged.anthropometricTable.forEach((row: any) => {
        const rh = parseFloat(String(row.height || ""));
        const rw = parseFloat(String(row.weight || ""));
        if (rh > 0 && rw > 0) {
          if (!row.bmi) row.bmi = (rw / ((rh / 100) * (rh / 100))).toFixed(1);
          if (!row.bsa) row.bsa = Math.sqrt((rh * rw) / 3600).toFixed(2);
        }
      });
      const latest = merged.anthropometricTable[merged.anthropometricTable.length - 1];
      if (latest) {
        if (latest.height && !merged.height) merged.height = latest.height;
        if (latest.weight && !merged.weight) merged.weight = latest.weight;
        if (latest.bmi && !merged.bmi) merged.bmi = latest.bmi;
        if (latest.bsa && !merged.bsa) merged.bsa = latest.bsa;
      }
    } else if (merged.height || merged.weight) {
      merged.anthropometricTable = [{ date: "", height: merged.height || "", weight: merged.weight || "", bmi: merged.bmi || "", bsa: merged.bsa || "" }];
    }

    if (Array.isArray(merged.clinicalStagingTable)) {
      merged.clinicalStagingTable.forEach((row: any) => {
        if (!row.clinical_stage_group && row.clinical_t && row.clinical_n && row.clinical_m) {
          const stage = calcStageFromTnm(row.clinical_t, row.clinical_n, row.clinical_m);
          if (stage) row.clinical_stage_group = stage;
        }
      });
    }

    console.log(`[SectionExtract] merge done`, {
      sectionTarget: sectionTarget?.section,
      extractedKeys: Object.keys(extractedData || {}),
      mergedTumorTable: Array.isArray(merged.tumorCharacteristicsTable) ? merged.tumorCharacteristicsTable : "not array",
      openedSections: Array.from(openedSections)
    });

    return { merged: merged as Partial<PatientRecord>, openedSections: Array.from(openedSections) };
  };

  // Helper file converters
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Drag and Drop triggers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const ensurePatientSavedBeforeUpload = async () => {
    if (formStateLatestRef.current.id) return formStateLatestRef.current.id;
    setExtractProgress(12);
    setExtractStage("Saving patient record before upload");
    try {
      const cleanRecord = stripBlankTableRows(formStateLatestRef.current);
      const saved = await onSavePatient(cleanRecord as PatientRecord);
      setFormState(prev => ({ ...prev, id: saved.id }));
      return saved.id;
    } catch (error: any) {
      const msg = error?.message || "Unknown error";
      await notify(`Could not auto-save patient: ${msg}`, "Upload Blocked", "warning");
      return "";
    }
  };

  const createAiBatchItems = (files: File[]): AiBatchQueueItem[] => (
    files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
      name: file.name,
      size: file.size,
      status: "pending",
      progress: 0,
      stage: "Waiting for AI extraction",
      attempts: 0,
    }))
  );

  const updateAiBatchItem = (id: string | undefined, patch: Partial<AiBatchQueueItem>) => {
    if (!id) return;
    setAiBatchQueue(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const pausePendingAiBatchItems = (message: string) => {
    setAiBatchQueue(current => current.map(item => (
      item.status === "pending"
        ? { ...item, status: "paused", stage: "Paused before extraction", error: message }
        : item
    )));
  };

  const isQuotaPauseAiExtractionError = (error: any) => {
    const code = error instanceof ApiError ? String(error.body?.code || "") : "";
    const message = String(error?.message || error?.body?.error || error || "");
    return /FREE_QUOTA_EXHAUSTED|MODEL_FREE_TIER_UNAVAILABLE/i.test(code)
      || /limit:\s*0|no usable free-tier quota|free quota exhausted/i.test(message);
  };

  const resetUploadIndicatorsSoon = () => {
    setTimeout(() => {
      setIsExtracting(false);
      setExtractProgress(0);
      setExtractStage("");
      setIsVaultUploading(false);
      setVaultProgress(0);
      setVaultStage("");
      setActiveUploadSection(null);
    }, 1800);
  };

  const processAiExtractionBatch = async (files: FileList | File[]) => {
    const selectedFiles = Array.from(files).filter(Boolean);
    if (selectedFiles.length === 0) return;
    if (isExtracting || isVaultUploading) {
      await notify("Another file is currently being processed. Please wait for it to finish.", "Upload In Progress", "warning");
      return;
    }

    const queueItems = createAiBatchItems(selectedFiles);
    setAiBatchQueue(queueItems);
    setAiBatchProgress({ current: 0, total: selectedFiles.length });
    setIsAiBatchPaused(false);
    setLastExtractionSummary("");

    let driveUploaded = 0;
    let mergedOnly = 0;
    let failed = 0;
    let batchPaused = false;

    try {
      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index];
        const queueItem = queueItems[index];
        setAiBatchProgress({ current: index + 1, total: selectedFiles.length });
        const result = await processAttachment(file, false, undefined, {
          queueItemId: queueItem.id,
          batchIndex: index + 1,
          batchTotal: selectedFiles.length,
          preserveIndicators: true,
        });

        if (result.paused) {
          batchPaused = true;
          setIsAiBatchPaused(true);
          pausePendingAiBatchItems(result.message || "Gemini free-tier quota is unavailable.");
          setLastExtractionSummary(`AI extraction paused at image ${index + 1} of ${selectedFiles.length}. ${result.message || "Check Gemini quota and resume by uploading the remaining images later."}`);
          break;
        }

        if (result.ok && result.driveUploaded) {
          driveUploaded += 1;
        } else if (result.ok) {
          mergedOnly += 1;
        } else {
          failed += 1;
        }
      }
    } finally {
      resetUploadIndicatorsSoon();
    }

    if (!batchPaused) {
      setLastExtractionSummary(`Batch complete: ${driveUploaded} image(s) extracted and saved to Drive, ${mergedOnly} image(s) merged without Drive upload, ${failed} failed.`);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!consentTaken) {
      await notify("Please check and confirm patient informed consent before uploading folders or files.", "Consent Required", "warning");
      return;
    }
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processAiExtractionBatch(files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!consentTaken) {
      await notify("Please check and confirm patient informed consent before uploading folders or files.", "Consent Required", "warning");
      return;
    }
    const files = e.target.files;
    if (files && files.length > 0) {
      await processAiExtractionBatch(files);
    }
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const waitForAiRetry = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const isRetryableAiExtractionError = (error: any) => {
    const message = String(error?.message || error || "");
    const isUnavailableModel = /not found for API version|not supported for generateContent|MODEL_UNAVAILABLE/i.test(message);
    if (error instanceof ApiError) {
      return isUnavailableModel || error.status === 0 || error.status === 404 || error.status === 504 || error.status >= 500 || error.body?.retryable === true;
    }
    return isUnavailableModel || /timeout|timed out|network|failed to fetch/i.test(message);
  };

  const getAiRetryDelay = (error: any, attempt: number) => {
    const serverDelay = error instanceof ApiError ? Number(error.body?.retryAfterMs || 0) : 0;
    if (Number.isFinite(serverDelay) && serverDelay > 0) return serverDelay + 1_000;
    return Math.min(30_000, 5_000 + attempt * 2_500);
  };

  const runAiDocumentFillUntilComplete = async (
    file: File,
    base64: string,
    uploadPatientId: string,
    sectionTarget?: { section: string; label: string },
    options: ProcessAttachmentOptions = {}
  ) => {
    let attempt = 0;

    while (true) {
      const modelIndex = attempt % AI_EXTRACTION_MODELS.length;
      const modelName = AI_EXTRACTION_MODELS[modelIndex];
      const attemptStage = attempt === 0
        ? `Sending document to AI form-fill agent (${modelName})`
        : `Retry ${attempt + 1}: trying fallback AI model (${modelName})`;
      setExtractProgress(Math.min(62, 24 + attempt * 4));
      setExtractStage(attemptStage);
      updateAiBatchItem(options.queueItemId, {
        status: "extracting",
        progress: Math.min(62, 24 + attempt * 4),
        stage: options.batchTotal ? `Image ${options.batchIndex} of ${options.batchTotal}: ${attemptStage}` : attemptStage,
        attempts: attempt + 1,
        model: modelName,
        error: undefined,
      });

      try {
        const response = await apiFetch("/api/document-fill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          timeout: 0,
          retries: 0,
          body: JSON.stringify({
            fileContent: base64,
            mimeType: file.type || "application/octet-stream",
            fileName: file.name,
            patientId: uploadPatientId || undefined,
            sectionTarget: sectionTarget?.label || undefined,
            sectionKey: sectionTarget?.section || undefined,
            extractionAttempt: attempt,
            modelStartIndex: modelIndex,
          })
        });

        const extractionResponse = await response.json();
        if (extractionResponse?.error) {
          throw new Error(extractionResponse.error);
        }
        return extractionResponse;
      } catch (error: any) {
        if (isQuotaPauseAiExtractionError(error)) {
          throw error;
        }
        if (!isRetryableAiExtractionError(error)) {
          throw error;
        }

        const waitMs = getAiRetryDelay(error, attempt);
        const waitSeconds = Math.ceil(waitMs / 1000);
        console.warn("AI document understanding timed out; retrying with fallback model.", error);
        setExtractProgress(Math.min(78, 34 + attempt * 4));
        setExtractStage(`AI model or free-tier quota is temporarily unavailable. Waiting ${waitSeconds}s, then continuing.`);
        updateAiBatchItem(options.queueItemId, {
          status: "retry-waiting",
          progress: Math.min(78, 34 + attempt * 4),
          stage: `Waiting ${waitSeconds}s for Gemini retry allowance, then continuing with fallback model.`,
          attempts: attempt + 1,
          model: modelName,
          error: error?.message || "Temporary AI extraction failure.",
        });
        await waitForAiRetry(waitMs);
        attempt += 1;
      }
    }
  };

  // AI document understanding or regular file upload processor
  const processAttachment = async (
    file: File,
    isPureMedia = false,
    sectionTarget?: { section: string; label: string },
    options: ProcessAttachmentOptions = {}
  ): Promise<ProcessAttachmentResult> => {
    if (isPureMedia) {
      setIsVaultUploading(true);
      setVaultProgress(12);
      setVaultStage("Preparing secure Drive upload");
    } else {
      setIsExtracting(true);
      setExtractProgress(8);
      setExtractStage("Reading clinical document");
      updateAiBatchItem(options.queueItemId, {
        status: "extracting",
        progress: 8,
        stage: options.batchTotal ? `Image ${options.batchIndex} of ${options.batchTotal}: reading clinical document` : "Reading clinical document",
        error: undefined,
      });
    }
    if (sectionTarget?.section) {
      setActiveUploadSection(sectionTarget.section);
    }
    try {
      const base64 = await convertToBase64(file);
      let uploadPatientId = formStateLatestRef.current.id || "";
      if (!uploadPatientId) {
        const savedId = await ensurePatientSavedBeforeUpload();
        if (!savedId) {
          updateAiBatchItem(options.queueItemId, {
            status: "failed",
            progress: 0,
            stage: "Patient save failed before extraction",
            error: "Could not save patient record before upload.",
          });
          return { ok: false, message: "Could not save patient record before upload." };
        }
        uploadPatientId = savedId;
      }
      if (isPureMedia) {
        setVaultProgress(38);
        setVaultStage("Encoding media for patient vault");
      } else {
        setExtractProgress(24);
        setExtractStage("Sending document to AI form-fill agent");
        updateAiBatchItem(options.queueItemId, {
          status: "extracting",
          progress: 24,
          stage: options.batchTotal ? `Image ${options.batchIndex} of ${options.batchTotal}: sending to AI form-fill agent` : "Sending document to AI form-fill agent",
        });
      }

      let extractedData: any = {};
      let driveFile: any = null;
      let agentReport: any = null;
      if (!isPureMedia) {
        try {
          // Trigger AI document understanding and keep retrying transient timeouts before any Drive upload.
          const extractionResponse = await runAiDocumentFillUntilComplete(file, base64, uploadPatientId, sectionTarget, options);
          setExtractProgress(68);
          setExtractStage("Mapping understood clinical facts to form fields");
          updateAiBatchItem(options.queueItemId, {
            status: "extracting",
            progress: 68,
            stage: "Mapping understood clinical facts to form fields",
          });
          const {
            driveFile: extractedDriveFile,
            agentReport: extractedAgentReport,
            proposedChanges: responseProposedChanges,
            suggestedElsewhere: responseSuggestedElsewhere,
            data: agentData,
            ...legacyExtraction
          } = extractionResponse;
          driveFile = extractedDriveFile;
          const proposedChanges = responseProposedChanges || extractedAgentReport?.proposedChanges || [];
          const suggestedElsewhere = responseSuggestedElsewhere || extractedAgentReport?.suggestedElsewhere || [];
          agentReport = extractedAgentReport
            ? { ...extractedAgentReport, proposedChanges, suggestedElsewhere }
            : { proposedChanges, suggestedElsewhere };
          extractedData = agentData && typeof agentData === "object" ? agentData : legacyExtraction;
          setLastAgentReport(agentReport);

          const acceptedChangeIds = defaultAcceptedAiChangeIds(proposedChanges);
          const acceptedSuggestionIds = defaultAcceptedSuggestionIds(suggestedElsewhere);
          const acceptedData = proposedChanges.length > 0
            ? buildAcceptedAiFillData(proposedChanges, acceptedChangeIds)
            : extractedData;
          const acceptedSuggestedData = buildAcceptedSuggestedData(suggestedElsewhere, acceptedSuggestionIds);
          const acceptedSuggestedRows = buildAcceptedSuggestedRows(suggestedElsewhere, acceptedSuggestionIds);
          const sparklesKeys: string[] = [];
          const sparkleFilter = sectionTarget?.section ? new Set(getSectionFieldKeys(sectionTarget.section)) : null;
          Object.keys({ ...acceptedData, ...acceptedSuggestedData }).forEach((key) => {
            const value = acceptedData[key] ?? acceptedSuggestedData[key];
            if (value !== undefined && value !== null && value !== "") {
              if (!sparkleFilter || sparkleFilter.has(key)) sparklesKeys.push(key);
            }
          });

          setFormState(prev => {
            const primaryMerge = mergeAiExtractionIntoForm(prev, acceptedData, sectionTarget);
            const suggestedMerge = Object.keys(acceptedSuggestedData).length > 0
              ? mergeAiExtractionIntoForm(primaryMerge.merged, acceptedSuggestedData)
              : primaryMerge;
            const merged: Record<string, any> = { ...suggestedMerge.merged };
            const openedSections = Array.from(new Set([...primaryMerge.openedSections, ...suggestedMerge.openedSections]));
            acceptedSuggestedRows.forEach((suggestion: any) => {
              appendUnmappedAiDetail(
                merged,
                suggestion.source_section || "Suggested elsewhere",
                suggestion.detail,
                "medium"
              );
            });
            const now = new Date();
            const backupEntry = {
              document_name: file.name,
              extraction_date: now.toISOString().split("T")[0],
              extraction_time: now.toTimeString().split(" ")[0],
              raw_extracted_data: JSON.stringify({
                data: acceptedData,
                proposedChanges,
                suggestedElsewhere,
                acceptedSuggestionIds: Array.from(acceptedSuggestionIds),
                reviewIssues: agentReport?.reviewIssues || [],
              }),
              file_reference: driveFile?.webViewLink || "",
            };
            const existing = Array.isArray(merged.document_extraction_backups) ? merged.document_extraction_backups : [];
            merged.document_extraction_backups = [...existing, backupEntry];
            if (openedSections.length > 0) {
              setOpenSections(current => ({
                ...current,
                ...Object.fromEntries(openedSections.map(section => [section, true])),
              }));
            }
            if (sectionTarget?.section) {
              setOpenSections(current => ({ ...current, [sectionTarget.section]: true }));
            }
            return merged;
          });

          setExtractedFields(new Set(sparklesKeys));
          setExtractProgress(92);
          setExtractStage("AI filled the form");
          updateAiBatchItem(options.queueItemId, {
            status: "merged",
            progress: 92,
            stage: "AI extraction merged into the form",
            error: undefined,
          });
          setLastExtractionSummary(agentReport
            ? `${agentReport.fieldsFilled || 0} field group(s) and ${agentReport.rowsAdded || 0} row(s) filled from ${file.name}. Existing filled data was preserved.`
            : `${sparklesKeys.length} field group${sparklesKeys.length === 1 ? "" : "s"} filled from ${file.name}. Existing filled data was preserved.`
          );
        } catch (error: any) {
          console.error("AI document understanding failed:", error);
          setExtractStage("AI extraction stopped before Drive upload");
          const isQuotaStop = isQuotaPauseAiExtractionError(error);
          updateAiBatchItem(options.queueItemId, {
            status: isQuotaStop ? "paused" : "failed",
            progress: isQuotaStop ? Math.max(1, extractProgress) : 0,
            stage: isQuotaStop ? "Paused by Gemini free-tier quota" : "AI extraction failed before Drive upload",
            error: error?.message || "AI extraction failed.",
          });
          await notify(
            error?.message || "AI could not complete extraction. The source document was not uploaded to Drive because AI filling did not finish.",
            isQuotaStop ? "Gemini Free Quota Exhausted" : "AI Fill Failed",
            "danger"
          );
          return {
            ok: false,
            paused: isQuotaStop,
            message: error?.message || "AI extraction failed.",
          };
        }
      }

      // Store media in the patient custom subfolder in Google Drive.
      // Format: Google Drive / Patients_Vault / [LastName_Initials]
      // Skip if already uploaded during AI document processing (driveFile present in response)
      const alreadyUploaded = !isPureMedia && driveFile;
      let sourceSavedToDrive = Boolean(alreadyUploaded);
      if (alreadyUploaded) {
        updateAiBatchItem(options.queueItemId, {
          status: "drive-uploaded",
          progress: 100,
          stage: "AI extraction complete and source image saved to Drive",
          error: undefined,
        });
      }
      if (onUploadFile && uploadPatientId && !alreadyUploaded) {
        try {
          if (isPureMedia) {
            setVaultProgress(72);
            setVaultStage("Uploading to Google Drive folder");
          } else {
            setExtractProgress(96);
            setExtractStage("Saving AI-processed source file to Drive");
            updateAiBatchItem(options.queueItemId, {
              status: "merged",
              progress: 96,
              stage: "Saving AI-processed source file to Drive",
            });
          }
          await onUploadFile({
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            patientId: uploadPatientId,
            contentBase64: base64,
            extracted: !isPureMedia
          });
          if (isPureMedia) {
            setVaultProgress(100);
            setVaultStage("Upload complete");
          } else {
            sourceSavedToDrive = true;
            updateAiBatchItem(options.queueItemId, {
              status: "drive-uploaded",
              progress: 100,
              stage: "AI extraction complete and source image saved to Drive",
              error: undefined,
            });
          }
        } catch (error) {
          console.error("Drive upload failed after AI fill:", error);
          updateAiBatchItem(options.queueItemId, {
            status: "failed",
            progress: 96,
            stage: "Form filled, but Drive upload failed",
            error: error instanceof Error ? error.message : "Drive upload failed after AI fill.",
          });
          await notify("AI form filling completed, but the file could not be saved to Google Drive. Save the patient record first, then upload media again from the patient dossier.", "Drive Upload Failed", "warning");
          return {
            ok: true,
            driveUploaded: false,
            message: "AI form filling completed, but Drive upload failed.",
          };
        }
      }
      if (!isPureMedia) {
        setExtractProgress(100);
        setExtractStage("AI form filling complete");
      } else if (!uploadPatientId) {
        await notify("Save the patient record first, then upload media to the patient-specific Google Drive folder.", "Save Patient First", "warning");
      }
      return {
        ok: true,
        driveUploaded: !isPureMedia && sourceSavedToDrive,
      };

    } catch (e) {
      console.error("File processing failed:", e);
      updateAiBatchItem(options.queueItemId, {
        status: "failed",
        progress: 0,
        stage: "File processing failed before AI form filling",
        error: e instanceof Error ? e.message : "File processing failed.",
      });
      await notify("File processing failed before AI form filling. Please try a smaller file or a supported clinical document.", "File Processing Failed", "danger");
      return {
        ok: false,
        message: e instanceof Error ? e.message : "File processing failed.",
      };
    } finally {
      if (!options.preserveIndicators) {
        resetUploadIndicatorsSoon();
      }
    }
  };

  const startSectionUpload = async (section: string, label: string, useAi: boolean) => {
    if (!consentTaken) {
      await notify("Please confirm patient informed consent before uploading files.", "Consent Required", "warning");
      flashShake(consentRef.current);
      return;
    }
    if (isExtracting || isVaultUploading) {
      await notify("Another file is currently being processed. Please wait for it to finish.", "Upload In Progress", "warning");
      return;
    }
    sectionUploadContextRef.current = { section, label, useAi };
    setSectionUploadAccept(useAi ? AI_DOCUMENT_ACCEPT : DRIVE_DOCUMENT_ACCEPT);
    setActiveUploadSection(section);
    sectionFileInputRef.current?.click();
  };

  const SectionUploadActions = ({ section, label }: { section: string; label: string }) => {
    const isAiExtracting = isExtracting && activeUploadSection === section;
    const isVaultUploadingSection = isVaultUploading && activeUploadSection === section;
    const isUploadingThisSection = isAiExtracting || isVaultUploadingSection;
    const progress = isAiExtracting ? extractProgress : vaultProgress;
    const stage = isAiExtracting ? extractStage : vaultStage;
    const tone = isAiExtracting ? "ai" : "drive";
    return (
      <span className="ml-auto mr-2 inline-flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
        {isUploadingThisSection ? (
          <div className="flex items-center gap-2 px-1.5 py-0.5 rounded-lg bg-natural-accent/5 dark:bg-slate-800/80 border border-natural-border/40 dark:border-slate-700">
            <RefreshCw className={`h-3 w-3 animate-spin ${tone === "ai" ? "text-natural-accent" : "text-natural-brown"}`} />
            <span className={`text-[11.5px] font-bold ${tone === "ai" ? "text-natural-accent" : "text-natural-brown"}`}>{Math.max(0, Math.min(100, progress))}%</span>
            <div className="w-12 h-1.5 rounded-full bg-natural-hover dark:bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${tone === "ai" ? "bg-natural-accent" : "bg-natural-brown"}`}
                style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
              />
            </div>
            {stage && <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate max-w-[80px] hidden md:inline">{stage}</span>}
          </div>
        ) : (
          <>
            <span
              role="button"
              tabIndex={0}
              aria-disabled={isExtracting || isVaultUploading}
              onClick={() => { if (!isExtracting && !isVaultUploading) void startSectionUpload(section, label, true); }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !isExtracting && !isVaultUploading) {
                  event.preventDefault();
                  event.stopPropagation();
                  void startSectionUpload(section, label, true);
                }
              }}
              className="btn-clr-ai inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-bold disabled:opacity-50"
              title={`Understand a document and fill ${label}`}
            >
              <Sparkles className="h-3 w-3" />
              <span className="hidden lg:inline">AI Fill</span>
            </span>
            <span
              role="button"
              tabIndex={0}
              aria-disabled={isExtracting || isVaultUploading}
              onClick={() => { if (!isExtracting && !isVaultUploading) void startSectionUpload(section, label, false); }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !isExtracting && !isVaultUploading) {
                  event.preventDefault();
                  event.stopPropagation();
                  void startSectionUpload(section, label, false);
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-natural-border bg-theme-surface/70 px-2 py-1 text-[11.5px] font-bold text-slate-600 dark:text-slate-300 hover:bg-natural-hover dark:hover:bg-slate-800 disabled:opacity-50"
              title={`Upload a source file for ${label} without AI filling`}
            >
              <Upload className="h-3 w-3" />
              <span className="hidden xl:inline">Upload Only</span>
            </span>
          </>
        )}
      </span>
    );
  };

  // Save Record
  // Reset save progress when we enter saving
  const resetSaveProgress = useCallback(() => {
    setSaveProgress(0);
    setSaveStage("");
    setSaveSuccess(false);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentTaken) {
      flashShake(consentRef.current);
      await notify("You must verify patient informed consent is taken.", "Verification Checkpoint", "warning");
      return;
    }

    // Validate required fields
    const initialsFromDOM = (document.querySelector<HTMLInputElement>('input[name="initials"]')?.value ?? "").trim();
    if (!initialsFromDOM) {
      await notify("Initials are required.", "Validation Error", "warning");
      setIsSaving(false);
      return;
    }

    // Read values directly from DOM — avoids stale React closure bugs
    const firstNameFromDOM = firstNameRef.current?.value ?? (document.querySelector<HTMLInputElement>('input[name="first_name"]')?.value ?? "");
    const lastNameFromDOM = lastNameRef.current?.value ?? (document.querySelector<HTMLInputElement>('input[name="last_name"]')?.value ?? "");

    resetSaveProgress();
    setIsSaving(true);
    setSaveStage("Validating record...");
    setSaveProgress(10);
    try {
      const cc = countryCode.trim() || "+94";
      const pn = phoneNumber.trim();
      const tp = pn ? `${cc} ${pn}` : cc;
      setSaveStage("Encrypting & uploading...");
      setSaveProgress(40);

      // Strip blank rows from all tables before saving
      const cleanRecord = stripBlankTableRows(formState);

      await onSavePatient({ ...cleanRecord, first_name: firstNameFromDOM, last_name: lastNameFromDOM, tp } as PatientRecord);
      setSaveProgress(90);
      setSaveStage("Finalizing...");
      // Brief delay so user sees progress fill
      await new Promise(r => setTimeout(r, 200));
      setSaveProgress(100);
      setSaveStage("Saved!");
      setSaveSuccess(true);
      await notify("Patient clinical record saved in secure Firestore repository.", "Record Saved", "success");
      resetDirty();
      setTimeout(() => onNavigateHome(), 700);
    } catch (err) {
      setSaveStage("Save failed");
      await notify("Error saving record: Code 500 Network Timeout.", "Save Failed", "danger");
    } finally {
      setIsSaving(false);
    }
  };

  // Array Table Item dynamic row modifiers
  const addRow = <K extends keyof PatientRecord>(tableKey: K, emptyObj: any, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setFormState(prev => {
      const currentList = Array.isArray(prev[tableKey]) ? [...prev[tableKey] as any] : [];
      return {
        ...prev,
        [tableKey]: [...currentList, emptyObj]
      };
    });
    requestAnimationFrame(() => {
      const container = document.querySelector(`[data-table-key="${String(tableKey)}"]`);
      if (container) {
        const lastRow = container.querySelector('tbody tr:last-child');
        lastRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  };

  const removeRow = <K extends keyof PatientRecord>(tableKey: K, index: number) => {
    setFormState(prev => {
      const currentList = Array.isArray(prev[tableKey]) ? [...prev[tableKey] as any] : [];
      currentList.splice(index, 1);
      return {
        ...prev,
        [tableKey]: currentList
      };
    });
  };

  const handleTableChange = <K extends keyof PatientRecord>(tableKey: K, index: number, field: string, val: any) => {
    setFormState(prev => {
      const currentList = Array.isArray(prev[tableKey]) ? [...prev[tableKey] as any] : [];
      currentList[index] = { ...currentList[index], [field]: val };
      return {
        ...prev,
        [tableKey]: currentList
      };
    });
  };

  const addTumorFinding = (
    siteIndex: number,
    field: "molecular_markers_entries" | "immunohistochemistry_entries" | "genomic_testing_entries" | "gene_expression_profile_entries"
  ) => {
    setFormState(prev => {
      const sites = [...(prev.tumorCharacteristicsTable || [])];
      const site = { ...sites[siteIndex] };
      site[field] = [...(site[field] || []), { parameter: "", finding: "", source: "Manual" }];
      sites[siteIndex] = site;
      return { ...prev, tumorCharacteristicsTable: sites };
    });
  };

  const updateTumorFinding = (
    siteIndex: number,
    field: "molecular_markers_entries" | "immunohistochemistry_entries" | "genomic_testing_entries" | "gene_expression_profile_entries",
    findingIndex: number,
    key: "parameter" | "finding" | "source",
    value: string
  ) => {
    setFormState(prev => {
      const sites = [...(prev.tumorCharacteristicsTable || [])];
      const site = { ...sites[siteIndex] };
      const entries = [...(site[field] || [])];
      entries[findingIndex] = { ...entries[findingIndex], [key]: value };
      site[field] = entries;
      sites[siteIndex] = site;
      return { ...prev, tumorCharacteristicsTable: sites };
    });
  };

  const removeTumorFinding = (
    siteIndex: number,
    field: "molecular_markers_entries" | "immunohistochemistry_entries" | "genomic_testing_entries" | "gene_expression_profile_entries",
    findingIndex: number
  ) => {
    setFormState(prev => {
      const sites = [...(prev.tumorCharacteristicsTable || [])];
      const site = { ...sites[siteIndex] };
      site[field] = (site[field] || []).filter((_, index) => index !== findingIndex);
      sites[siteIndex] = site;
      return { ...prev, tumorCharacteristicsTable: sites };
    });
  };

  const addOtherGroup = (date: string) => {
    setFormState(prev => ({
      ...prev,
      otherAnthropometricTable: [...prev.otherAnthropometricTable, { date, entries: [{ measure: "", value: "", unit: "" }] }]
    }));
  };

  const removeOtherGroup = (groupIdx: number) => {
    setFormState(prev => {
      const groups = [...prev.otherAnthropometricTable];
      groups.splice(groupIdx, 1);
      return { ...prev, otherAnthropometricTable: groups };
    });
  };

  const addOtherEntry = (groupIdx: number) => {
    setFormState(prev => {
      const groups = [...prev.otherAnthropometricTable];
      groups[groupIdx] = { ...groups[groupIdx], entries: [...groups[groupIdx].entries, { measure: "", value: "", unit: "" }] };
      return { ...prev, otherAnthropometricTable: groups };
    });
  };

  const removeOtherEntry = (groupIdx: number, entryIdx: number) => {
    setFormState(prev => {
      const groups = [...prev.otherAnthropometricTable];
      const entries = [...groups[groupIdx].entries];
      entries.splice(entryIdx, 1);
      groups[groupIdx] = { ...groups[groupIdx], entries };
      return { ...prev, otherAnthropometricTable: groups };
    });
  };

  const handleOtherGroupChange = (groupIdx: number, val: string) => {
    setFormState(prev => {
      const groups = [...prev.otherAnthropometricTable];
      groups[groupIdx] = { ...groups[groupIdx], date: val };
      return { ...prev, otherAnthropometricTable: groups };
    });
  };

  const handleOtherEntryChange = (groupIdx: number, entryIdx: number, field: string, val: any) => {
    setFormState(prev => {
      const groups = [...prev.otherAnthropometricTable];
      const entries = [...groups[groupIdx].entries];
      entries[entryIdx] = { ...entries[entryIdx], [field]: val };
      groups[groupIdx] = { ...groups[groupIdx], entries };
      return { ...prev, otherAnthropometricTable: groups };
    });
  };

  const addExamGroup = (date: string) => {
    setFormState(prev => ({
      ...prev,
      examFindingsTable: [...prev.examFindingsTable, { date, entries: [{ organ_system: "", findings: "", notes: "" }] }]
    }));
  };

  const removeExamGroup = (groupIdx: number) => {
    setFormState(prev => {
      const groups = [...prev.examFindingsTable];
      groups.splice(groupIdx, 1);
      return { ...prev, examFindingsTable: groups };
    });
  };

  const addExamEntry = (groupIdx: number) => {
    setFormState(prev => {
      const groups = [...prev.examFindingsTable];
      groups[groupIdx] = { ...groups[groupIdx], entries: [...groups[groupIdx].entries, { organ_system: "", findings: "", notes: "" }] };
      return { ...prev, examFindingsTable: groups };
    });
  };

  const removeExamEntry = (groupIdx: number, entryIdx: number) => {
    setFormState(prev => {
      const groups = [...prev.examFindingsTable];
      const entries = [...groups[groupIdx].entries];
      entries.splice(entryIdx, 1);
      groups[groupIdx] = { ...groups[groupIdx], entries };
      return { ...prev, examFindingsTable: groups };
    });
  };

  const handleExamGroupChange = (groupIdx: number, val: string) => {
    setFormState(prev => {
      const groups = [...prev.examFindingsTable];
      groups[groupIdx] = { ...groups[groupIdx], date: val };
      return { ...prev, examFindingsTable: groups };
    });
  };

  const handleExamEntryChange = (groupIdx: number, entryIdx: number, field: string, val: any) => {
    setFormState(prev => {
      const groups = [...prev.examFindingsTable];
      const entries = [...groups[groupIdx].entries];
      entries[entryIdx] = { ...entries[entryIdx], [field]: val };
      groups[groupIdx] = { ...groups[groupIdx], entries };
      return { ...prev, examFindingsTable: groups };
    });
  };

  const aiBatchStatusStyles: Record<AiBatchQueueStatus, string> = {
    pending: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    extracting: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
    "retry-waiting": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
    merged: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
    "drive-uploaded": "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800",
    failed: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800",
    paused: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800",
  };

  const aiBatchStatusLabel: Record<AiBatchQueueStatus, string> = {
    pending: "Pending",
    extracting: "Extracting",
    "retry-waiting": "Retry waiting",
    merged: "Merged",
    "drive-uploaded": "Drive uploaded",
    failed: "Failed",
    paused: "Paused",
  };

  const aiBatchCompletedCount = aiBatchQueue.filter(item => ["merged", "drive-uploaded", "failed", "paused"].includes(item.status)).length;

  const StageProgressBar = ({ value, label, tone = "ai" }: { value: number; label: string; tone?: "ai" | "drive" }) => (
    <div className="mt-4 rounded-2xl border border-natural-border/70 dark:border-slate-700 bg-theme-surface/55 dark:bg-slate-900/55 p-3 shadow-inner">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full ${tone === "ai" ? "bg-natural-accent" : "bg-natural-brown"} animate-pulse`} />
          <span className="text-[11.5px] font-bold text-slate-700 dark:text-slate-250 truncate">{label}</span>
        </div>
        <span className="text-[11.5px] font-bold text-slate-500 dark:text-slate-300">{Math.max(0, Math.min(100, value))}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-natural-hover dark:bg-slate-800 overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${tone === "ai" ? "bg-natural-accent" : "bg-natural-brown"}`}
          style={{ width: `${Math.max(5, Math.min(100, value))}%` }}
        />
        <div className="theme-progress-shimmer absolute inset-0 animate-progress-shimmer" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 page-fade-in">

      {/* Page Title & Back */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-natural-accent/25 bg-natural-accent/10 text-natural-accent dark:text-natural-gold dark:bg-natural-accent/15 flex items-center justify-center flex-shrink-0">
            <FileText className="h-5.5 w-5.5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-theme-on-accent ">
              {formState.id ? "Edit Patient Record" : "Add Patient Record Registry"}
            </h2>
          </div>
        </div>
        <button
          onClick={handleNavigateHome}
          className="text-xs font-semibold bg-slate-50 border border-natural-border hover:bg-natural-sidebar/90 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-300 py-2 px-3 rounded-xl transition duration-150 cursor-pointer self-start sm:self-center"
        >
          Back to Home Page
        </button>
      </div>

      {/* Informed Consent Gateway */}
      <div className={`p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-500 ${
        consentTaken
          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-2 border-emerald-400/50 dark:border-emerald-600/50 shadow-lg shadow-emerald-200/30 dark:shadow-emerald-900/20"
          : "minimal-card"
      }`}>
        <div className="flex gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all duration-500 ${
            consentTaken
              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
              : "bg-natural-brown/10 dark:bg-natural-brown/20 text-natural-brown border-natural-brown/30"
          }`}>
            <ShieldCheck className={`h-6 w-6 transition-all duration-500 ${consentTaken ? "text-emerald-500" : "animate-pulse"}`} />
          </div>
          <div>
            <h3 className={`font-bold text-sm transition-colors duration-500 ${consentTaken ? "text-emerald-800 dark:text-emerald-200" : "text-slate-800 dark:text-theme-on-accent"}`}>
              Regulatory Patient Informed Consent Checkpoint
            </h3>
            <p className={`text-xs mt-0.5 leading-relaxed transition-colors duration-500 ${consentTaken ? "text-emerald-600/70 dark:text-emerald-300/70" : "text-slate-655 dark:text-slate-200"}`}>
              Medical procedures compel consent prior to recording history or mapping tumors. Ensure paper-written authorization is active for this patient.
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-2 p-2.5 rounded-xl border self-stretch md:self-center justify-center transition-all duration-500 ${
          consentTaken
            ? "bg-emerald-100/70 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700"
            : "bg-natural-card/70 dark:bg-slate-850 border-natural-border/40 dark:border-slate-700"
        }`}>
          <input
            ref={consentRef}
            type="checkbox"
            id="checkbox-consent"
            checked={consentTaken}
            onChange={(e) => setConsentTaken(e.currentTarget.checked)}
            className="h-4.5 w-4.5 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer hover-scale"
          />
          <label htmlFor="checkbox-consent" className={`text-xs font-bold cursor-pointer selection:bg-transparent transition-colors duration-500 ${
            consentTaken ? "text-emerald-700 dark:text-emerald-200" : "text-slate-750 dark:text-slate-300"
          }`}>
            Informed Consent Taken
          </label>
        </div>
      </div>

      {/* AI document understanding point (locked unless consent checkbox is ticked) */}
      <div className={`relative ${!consentTaken ? "opacity-45 cursor-not-allowed select-none" : ""}`}>
        {!consentTaken && (
          <div className="absolute inset-0 z-10 bg-slate-100/10 dark:bg-slate-900/10 rounded-2xl flex items-center justify-center">
            <div className="bg-slate-900/90 text-theme-on-accent py-2 px-4 rounded-xl flex items-center gap-2 text-xs font-bold">
              <AlertTriangle className="h-4 w-4 text-natural-brown" />
              <span>Confirm Informed Consent above to unlock Document Uploads & AI Fill</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* AI Drag Drop upload box */}
          <div className="lg:col-span-2 minimal-card rounded-2xl p-5">
            <div className="flex items-center justify-between border-b border-natural-border/40 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-natural-accent dark:text-natural-gold animate-spin" />
                <h3 className="h-section">AI Document Understanding & Form Fill</h3>
              </div>
              <span className="text-[11.5px] font-semibold bg-natural-accent/10 dark:bg-slate-900 border border-natural-accent/20 text-natural-accent-dark dark:text-natural-hover py-0.5 px-2 rounded-md">
                AI Agent Active
              </span>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150
                ${isDragOver
                  ? "border-natural-accent bg-natural-accent/10 dark:bg-natural-accent/20"
                  : "border-natural-border hover:border-natural-accent dark:border-slate-700 dark:hover:border-natural-accent hover:bg-natural-card/25 dark:hover:bg-slate-850/40"
                }
              `}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
                accept={AI_DOCUMENT_ACCEPT}
              />

	              {isExtracting ? (
	                <div className="space-y-3 animate-pulse">
                  <div className="flex justify-center text-natural-accent">
                    <RefreshCw className="h-10 w-10 animate-spin" />
                  </div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">AI Form-Fill Agent Running...</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mx-auto">
                    Analyzing clinical tables, blood reports, endoscopy parameters and biopsy tissues under ASCO compliance guides.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="h-12 w-12 bg-natural-accent/10 dark:bg-slate-950/50 rounded-2xl flex items-center justify-center text-natural-accent mx-auto">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-255 text-sm">
                      Drag-and-drop clinical files here
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      Supports clinical PDF, images, TXT, CSV, and JSON reports for AI form fill.
                    </p>
                  </div>
                  <button className="bg-slate-55 border border-natural-border hover:bg-natural-sidebar/80 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-300 text-xs font-semibold py-1.5 px-3 rounded-lg transition select-none cursor-pointer">
                    Browse Files
                  </button>
	                </div>
	              )}
	            </div>

            {isExtracting && (
              <StageProgressBar value={extractProgress} label={extractStage || "AI form filling running"} tone="ai" />
            )}
            {aiBatchQueue.length > 0 && (
              <div className="mt-4 rounded-2xl border border-natural-border/70 dark:border-slate-700 bg-theme-surface/70 dark:bg-slate-900/60 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-natural-border/40 dark:border-slate-700 pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <FileStack className="h-4 w-4 text-natural-accent" />
                    <div>
                      <p className="text-[11.5px] font-bold text-slate-800 dark:text-slate-100">AI extraction batch queue</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {aiBatchProgress.total > 0
                          ? `Image ${Math.max(1, aiBatchProgress.current)} of ${aiBatchProgress.total} - ${aiBatchCompletedCount} completed`
                          : `${aiBatchCompletedCount} completed`}
                      </p>
                    </div>
                  </div>
                  <span className={`self-start sm:self-center rounded-full border px-2 py-1 text-[10px] font-bold ${
                    isAiBatchPaused
                      ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                  }`}>
                    {isAiBatchPaused ? "Paused by quota" : "Sequential processing"}
                  </span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {aiBatchQueue.map((item, index) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/25 p-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {item.status === "extracting" || item.status === "retry-waiting" ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin text-natural-accent flex-shrink-0" />
                            ) : item.status === "drive-uploaded" || item.status === "merged" ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300 flex-shrink-0" />
                            ) : item.status === "failed" || item.status === "paused" ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300 flex-shrink-0" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            )}
                            <p className="truncate text-[11.5px] font-bold text-slate-800 dark:text-slate-100">
                              {index + 1}. {item.name}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {formatFileSize(item.size)}{item.model ? ` - ${item.model}` : ""}{item.attempts > 0 ? ` - attempt ${item.attempts}` : ""}
                          </p>
                        </div>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold whitespace-nowrap ${aiBatchStatusStyles[item.status]}`}>
                          {aiBatchStatusLabel[item.status]}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.status === "failed" ? "bg-red-500" : item.status === "retry-waiting" ? "bg-amber-500" : "bg-natural-accent"}`}
                          style={{ width: `${Math.max(4, Math.min(100, item.progress))}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-600 dark:text-slate-300 line-clamp-2">
                        {item.stage}
                      </p>
                      {item.error && (
                        <p className="mt-1 text-[9px] text-red-600 dark:text-red-300 line-clamp-2">
                          {item.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!isExtracting && lastExtractionSummary && (
              <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/25 px-3 py-2 flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11.5px] font-bold text-emerald-800 dark:text-emerald-200">Last AI form fill completed</p>
                  <p className="text-[11.5px] text-emerald-700 dark:text-emerald-300 mt-0.5">{lastExtractionSummary}</p>
                  {lastAgentReport && (
                    <p className="text-[9px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                      Document-fill agent: {lastAgentReport.fieldsFilled || 0} field group(s), {lastAgentReport.rowsAdded || 0} row(s) filled into the form.
                    </p>
                  )}
                  {Array.isArray(lastAgentReport?.proposedChanges) && lastAgentReport.proposedChanges.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {lastAgentReport.proposedChanges.slice(0, 5).map((change: any, idx: number) => (
                        <div key={`${change.target || "change"}-${idx}`} className="rounded-lg bg-white/70 dark:bg-slate-950/30 border border-emerald-200/70 dark:border-emerald-800/70 px-2 py-1">
                          <p className="text-[9px] font-semibold text-emerald-900 dark:text-emerald-100 truncate">
                            {change.action || "fill"} {"->"} {change.target || "review"}
                          </p>
                          <p className="text-[9px] text-emerald-800/80 dark:text-emerald-200/80 line-clamp-2">
                            {change.evidence?.quote || "No evidence quote returned."}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Google Drive file repository for this patient — sticky top bar */}
          <div className="sticky top-0 z-20 minimal-card rounded-2xl p-4 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex justify-between items-center border-b border-natural-border/45 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-natural-brown" />
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Drive Vault</h3>
                </div>
                <span className="text-[9px] font-bold bg-slate-50 dark:bg-slate-900 border border-natural-border/45 dark:border-slate-800 text-slate-700 dark:text-slate-200 py-0.5 px-2 rounded-md">
                  {patientFiles.length} file{patientFiles.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 mb-2">
                {patientFiles.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 dark:text-slate-400 border border-dashed border-natural-border dark:border-slate-700 rounded-xl">
                    <File className="h-6 w-6 mx-auto text-natural-border/80 mb-1" />
                    <p className="text-[10px]">No files uploaded yet.</p>
                  </div>
                ) : (
                  patientFiles.map((file) => {
                    const fileUrl = file.webViewLink || (file.driveFileId ? `https://drive.google.com/file/d/${file.driveFileId}/view` : null);
                    return (
                      <div
                        key={file.id}
                        onClick={() => fileUrl && window.open(fileUrl, "_blank", "noopener")}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-[10.5px] group transition-colors ${
                          fileUrl
                            ? "border-natural-border/50 dark:border-slate-800 hover:border-natural-accent dark:hover:border-natural-accent bg-slate-55 dark:bg-slate-900/30 hover:bg-natural-accent/5 dark:hover:bg-natural-accent/10 cursor-pointer"
                            : "border-natural-border/50 dark:border-slate-800 bg-slate-55 dark:bg-slate-900/30"
                        }`}
                        title={fileUrl ? "Click to view file" : file.name}
                      >
                        <FileText className="h-3.5 w-3.5 text-natural-accent flex-shrink-0" />
                        <span className="truncate flex-1 font-semibold text-slate-700 dark:text-slate-305">{file.name}</span>
                        {file.extracted ? (
                          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[8px] px-1 py-0.5 rounded flex-shrink-0 leading-none">
                            AI
                          </span>
                        ) : (
                          <span className="bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 text-[8px] px-1 py-0.5 rounded flex-shrink-0 leading-none">
                            Direct
                          </span>
                        )}
                        {fileUrl && (
                          <ExternalLink className="h-3 w-3 text-slate-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex gap-2 text-[11px]">
              <input
                type="file"
                ref={vaultFileInputRef}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await processAttachment(file, true);
                  e.target.value = "";
                }}
                className="hidden"
                accept={DRIVE_DOCUMENT_ACCEPT}
              />
              <button
                type="button"
                onClick={() => vaultFileInputRef.current?.click()}
                disabled={isVaultUploading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold text-[10.5px] py-2 rounded-xl transition-all cursor-pointer"
              >
                {isVaultUploading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <span>{isVaultUploading ? "Uploading..." : "Upload File"}</span>
              </button>
            </div>
            {isVaultUploading && (
              <StageProgressBar value={vaultProgress} label={vaultStage || "Uploading..."} tone="drive" />
            )}
          </div>

        </div>
      </div>

      {/* Main Clinical Record Fields Form Editor */}
      <form onSubmit={handleSave} className="space-y-6">
        <input
          ref={sectionFileInputRef}
          type="file"
          className="hidden"
          accept={sectionUploadAccept}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            const context = sectionUploadContextRef.current;
            event.target.value = "";
            if (!file || !context) return;
            setOpenSections(current => ({ ...current, [context.section]: true }));
            await processAttachment(file, !context.useAi, { section: context.section, label: context.label });
            sectionUploadContextRef.current = null;
          }}
        />

        {/* Collapsible Section: Document AI Fill Backups */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("documentExtractions")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.documentExtractions ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-purple-500/10 dark:bg-purple-400/20 text-purple-700 dark:text-purple-200 flex items-center justify-center"><FileStack className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Document AI Fill Backups</h3>
            </div>
            <span className={`transition-transform text-slate-500 ${openSections.documentExtractions ? "rotate-180" : ""}`}>▼</span>
          </button>
          {openSections.documentExtractions && (
            <div className="p-5 space-y-5">
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Each AI document fill is backed up here with the document name, date, and full form-ready JSON. These records are never overwritten — every AI run appends a new entry. Review and manually transfer any values that were not auto-filled into the form above.
              </p>
              <div className="space-y-3">
                {(formState.document_extraction_backups || []).map((entry: any, idx: number) => (
                  <div key={idx} className="border border-slate-200 dark:border-slate-700/85 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <label className="block text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Document</label>
                        <input type="text" value={entry.document_name} onChange={(e) => handleTableChange("document_extraction_backups", idx, "document_name", e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                      </div>
                      <div className="w-40">
                        <label className="block text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Date</label>
                        <input type="date" value={entry.extraction_date} onChange={(e) => handleTableChange("document_extraction_backups", idx, "extraction_date", e.target.value)} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                      </div>
                      {entry.file_reference ? (
                        <div className="shrink-0 pt-5">
                          <a href={entry.file_reference} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium">
                            <FileText className="h-3 w-3" /> View File
                          </a>
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">AI Form Data (JSON)</label>
                      <textarea value={entry.raw_extracted_data} onChange={(e) => handleTableChange("document_extraction_backups", idx, "raw_extracted_data", e.target.value)} rows={3} className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px] font-mono" />
                    </div>
                  </div>
                ))}
                {(!formState.document_extraction_backups || formState.document_extraction_backups.length === 0) && (
                  <p className="text-center py-6 text-slate-400 text-[11.5px]">No AI fill backups yet. Run AI Fill to populate this section.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Table of Contents */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/10">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-5 w-5 rounded-md bg-indigo-500/10 dark:bg-indigo-400/20 text-indigo-700 dark:text-indigo-200 flex items-center justify-center"><FileText className="h-3 w-3" /></span>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Quick Navigation</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SECTION_NAV.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => scrollToSection(key, label)}
                  className={`text-[11.5px] font-medium px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                    openSections[key]
                      ? "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-200"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Collapsible Section A: Patient Identifiers */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("patientIdentifiers")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.patientIdentifiers ? 'border-b border-natural-border' : ''} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-blue-500/10 dark:bg-blue-400/20 text-blue-700 dark:text-blue-200 flex items-center justify-center"><IdCard className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Patient Identifiers</h3>
              <SectionUploadActions section="patientIdentifiers" label="Patient Identifiers" />
            </div>
            {openSections.patientIdentifiers ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.patientIdentifiers && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-slate-700 dark:text-slate-350">

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Auto Generated ID</label>
                <div className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 font-mono font-bold">
                  {formState.auto_id || autoId}
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Title</label>
                <select
                  name="title"
                  value={formState.title}
                  onChange={handleInputChange}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
                >
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Miss.">Miss.</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Prof.">Prof.</option>
                  <option value="Rev.">Rev.</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-800 dark:text-slate-300">Initials *</label>
                <input
                  type="text"
                  name="initials"
                  value={formState.initials}
                  onChange={handleInputChange}
                  placeholder="e.g. J. D."
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("initials") ? "ai-extracted-glow" : ""}`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-800 dark:text-slate-300">First Name *</label>
                <input
                  ref={firstNameRef}
                  type="text"
                  name="first_name"
                  value={formState.first_name}
                  onChange={handleInputChange}
                  placeholder="First name e.g. John"
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("first_name") ? "ai-extracted-glow" : ""}`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-slate-800 dark:text-slate-300">Last Name *</label>
                <input
                  ref={lastNameRef}
                  type="text"
                  name="last_name"
                  value={formState.last_name}
                  onChange={handleInputChange}
                  placeholder="Last name e.g. Doe"
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("last_name") ? "ai-extracted-glow" : ""}`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-800 dark:text-slate-300">NIC Card Number (NIC)</label>
                <input
                  type="text"
                  name="nic"
                  value={formState.nic}
                  onChange={handleInputChange}
                  placeholder="Identity card reference"
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("nic") ? "ai-extracted-glow" : ""}`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-800 dark:text-slate-300">Country Code</label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
                >
                  <option value="+93">+93 Afghanistan</option>
                  <option value="+355">+355 Albania</option>
                  <option value="+213">+213 Algeria</option>
                  <option value="+1-684">+1-684 American Samoa</option>
                  <option value="+376">+376 Andorra</option>
                  <option value="+244">+244 Angola</option>
                  <option value="+1-264">+1-264 Anguilla</option>
                  <option value="+1-268">+1-268 Antigua &amp; Barbuda</option>
                  <option value="+54">+54 Argentina</option>
                  <option value="+374">+374 Armenia</option>
                  <option value="+297">+297 Aruba</option>
                  <option value="+61">+61 Australia</option>
                  <option value="+43">+43 Austria</option>
                  <option value="+994">+994 Azerbaijan</option>
                  <option value="+1-242">+1-242 Bahamas</option>
                  <option value="+973">+973 Bahrain</option>
                  <option value="+880">+880 Bangladesh</option>
                  <option value="+1-246">+1-246 Barbados</option>
                  <option value="+375">+375 Belarus</option>
                  <option value="+32">+32 Belgium</option>
                  <option value="+501">+501 Belize</option>
                  <option value="+229">+229 Benin</option>
                  <option value="+1-441">+1-441 Bermuda</option>
                  <option value="+975">+975 Bhutan</option>
                  <option value="+591">+591 Bolivia</option>
                  <option value="+387">+387 Bosnia &amp; Herzegovina</option>
                  <option value="+267">+267 Botswana</option>
                  <option value="+55">+55 Brazil</option>
                  <option value="+1-284">+1-284 British Virgin Islands</option>
                  <option value="+673">+673 Brunei</option>
                  <option value="+359">+359 Bulgaria</option>
                  <option value="+226">+226 Burkina Faso</option>
                  <option value="+257">+257 Burundi</option>
                  <option value="+855">+855 Cambodia</option>
                  <option value="+237">+237 Cameroon</option>
                  <option value="+1">+1 Canada</option>
                  <option value="+238">+238 Cape Verde</option>
                  <option value="+1-345">+1-345 Cayman Islands</option>
                  <option value="+236">+236 Central African Republic</option>
                  <option value="+235">+235 Chad</option>
                  <option value="+56">+56 Chile</option>
                  <option value="+86">+86 China</option>
                  <option value="+57">+57 Colombia</option>
                  <option value="+269">+269 Comoros</option>
                  <option value="+243">+243 Congo - Kinshasa</option>
                  <option value="+242">+242 Congo - Brazzaville</option>
                  <option value="+682">+682 Cook Islands</option>
                  <option value="+506">+506 Costa Rica</option>
                  <option value="+385">+385 Croatia</option>
                  <option value="+53">+53 Cuba</option>
                  <option value="+357">+357 Cyprus</option>
                  <option value="+420">+420 Czech Republic</option>
                  <option value="+45">+45 Denmark</option>
                  <option value="+253">+253 Djibouti</option>
                  <option value="+1-767">+1-767 Dominica</option>
                  <option value="+1-809">+1-809 Dominican Republic</option>
                  <option value="+670">+670 East Timor</option>
                  <option value="+593">+593 Ecuador</option>
                  <option value="+20">+20 Egypt</option>
                  <option value="+503">+503 El Salvador</option>
                  <option value="+240">+240 Equatorial Guinea</option>
                  <option value="+291">+291 Eritrea</option>
                  <option value="+372">+372 Estonia</option>
                  <option value="+251">+251 Ethiopia</option>
                  <option value="+500">+500 Falkland Islands</option>
                  <option value="+298">+298 Faroe Islands</option>
                  <option value="+679">+679 Fiji</option>
                  <option value="+358">+358 Finland</option>
                  <option value="+33">+33 France</option>
                  <option value="+689">+689 French Polynesia</option>
                  <option value="+241">+241 Gabon</option>
                  <option value="+220">+220 Gambia</option>
                  <option value="+995">+995 Georgia</option>
                  <option value="+49">+49 Germany</option>
                  <option value="+233">+233 Ghana</option>
                  <option value="+350">+350 Gibraltar</option>
                  <option value="+30">+30 Greece</option>
                  <option value="+299">+299 Greenland</option>
                  <option value="+1-473">+1-473 Grenada</option>
                  <option value="+1-671">+1-671 Guam</option>
                  <option value="+502">+502 Guatemala</option>
                  <option value="+224">+224 Guinea</option>
                  <option value="+245">+245 Guinea-Bissau</option>
                  <option value="+592">+592 Guyana</option>
                  <option value="+509">+509 Haiti</option>
                  <option value="+504">+504 Honduras</option>
                  <option value="+852">+852 Hong Kong</option>
                  <option value="+36">+36 Hungary</option>
                  <option value="+354">+354 Iceland</option>
                  <option value="+91">+91 India</option>
                  <option value="+62">+62 Indonesia</option>
                  <option value="+98">+98 Iran</option>
                  <option value="+964">+964 Iraq</option>
                  <option value="+353">+353 Ireland</option>
                  <option value="+972">+972 Israel</option>
                  <option value="+39">+39 Italy</option>
                  <option value="+225">+225 Ivory Coast</option>
                  <option value="+1-876">+1-876 Jamaica</option>
                  <option value="+81">+81 Japan</option>
                  <option value="+962">+962 Jordan</option>
                  <option value="+7">+7 Kazakhstan</option>
                  <option value="+254">+254 Kenya</option>
                  <option value="+686">+686 Kiribati</option>
                  <option value="+965">+965 Kuwait</option>
                  <option value="+996">+996 Kyrgyzstan</option>
                  <option value="+856">+856 Laos</option>
                  <option value="+371">+371 Latvia</option>
                  <option value="+961">+961 Lebanon</option>
                  <option value="+266">+266 Lesotho</option>
                  <option value="+231">+231 Liberia</option>
                  <option value="+218">+218 Libya</option>
                  <option value="+423">+423 Liechtenstein</option>
                  <option value="+370">+370 Lithuania</option>
                  <option value="+352">+352 Luxembourg</option>
                  <option value="+853">+853 Macau</option>
                  <option value="+389">+389 Macedonia</option>
                  <option value="+261">+261 Madagascar</option>
                  <option value="+265">+265 Malawi</option>
                  <option value="+60">+60 Malaysia</option>
                  <option value="+960">+960 Maldives</option>
                  <option value="+223">+223 Mali</option>
                  <option value="+356">+356 Malta</option>
                  <option value="+692">+692 Marshall Islands</option>
                  <option value="+222">+222 Mauritania</option>
                  <option value="+230">+230 Mauritius</option>
                  <option value="+262">+262 Mayotte</option>
                  <option value="+52">+52 Mexico</option>
                  <option value="+691">+691 Micronesia</option>
                  <option value="+373">+373 Moldova</option>
                  <option value="+377">+377 Monaco</option>
                  <option value="+976">+976 Mongolia</option>
                  <option value="+382">+382 Montenegro</option>
                  <option value="+1-664">+1-664 Montserrat</option>
                  <option value="+212">+212 Morocco</option>
                  <option value="+258">+258 Mozambique</option>
                  <option value="+95">+95 Myanmar</option>
                  <option value="+264">+264 Namibia</option>
                  <option value="+674">+674 Nauru</option>
                  <option value="+977">+977 Nepal</option>
                  <option value="+31">+31 Netherlands</option>
                  <option value="+687">+687 New Caledonia</option>
                  <option value="+64">+64 New Zealand</option>
                  <option value="+505">+505 Nicaragua</option>
                  <option value="+227">+227 Niger</option>
                  <option value="+234">+234 Nigeria</option>
                  <option value="+683">+683 Niue</option>
                  <option value="+1-670">+1-670 Northern Mariana Islands</option>
                  <option value="+47">+47 Norway</option>
                  <option value="+968">+968 Oman</option>
                  <option value="+92">+92 Pakistan</option>
                  <option value="+680">+680 Palau</option>
                  <option value="+970">+970 Palestine</option>
                  <option value="+507">+507 Panama</option>
                  <option value="+675">+675 Papua New Guinea</option>
                  <option value="+595">+595 Paraguay</option>
                  <option value="+51">+51 Peru</option>
                  <option value="+63">+63 Philippines</option>
                  <option value="+48">+48 Poland</option>
                  <option value="+351">+351 Portugal</option>
                  <option value="+1-787">+1-787 Puerto Rico</option>
                  <option value="+974">+974 Qatar</option>
                  <option value="+40">+40 Romania</option>
                  <option value="+7">+7 Russia</option>
                  <option value="+250">+250 Rwanda</option>
                  <option value="+590">+590 Saint Barthélemy</option>
                  <option value="+290">+290 Saint Helena</option>
                  <option value="+1-869">+1-869 Saint Kitts &amp; Nevis</option>
                  <option value="+1-758">+1-758 Saint Lucia</option>
                  <option value="+590">+590 Saint Martin</option>
                  <option value="+508">+508 Saint Pierre &amp; Miquelon</option>
                  <option value="+1-784">+1-784 Saint Vincent &amp; Grenadines</option>
                  <option value="+685">+685 Samoa</option>
                  <option value="+378">+378 San Marino</option>
                  <option value="+239">+239 Sao Tome &amp; Principe</option>
                  <option value="+966">+966 Saudi Arabia</option>
                  <option value="+221">+221 Senegal</option>
                  <option value="+381">+381 Serbia</option>
                  <option value="+248">+248 Seychelles</option>
                  <option value="+232">+232 Sierra Leone</option>
                  <option value="+65">+65 Singapore</option>
                  <option value="+421">+421 Slovakia</option>
                  <option value="+386">+386 Slovenia</option>
                  <option value="+677">+677 Solomon Islands</option>
                  <option value="+252">+252 Somalia</option>
                  <option value="+27">+27 South Africa</option>
                  <option value="+82">+82 South Korea</option>
                  <option value="+211">+211 South Sudan</option>
                  <option value="+34">+34 Spain</option>
                  <option value="+94">+94 Sri Lanka</option>
                  <option value="+249">+249 Sudan</option>
                  <option value="+597">+597 Suriname</option>
                  <option value="+268">+268 Swaziland</option>
                  <option value="+46">+46 Sweden</option>
                  <option value="+41">+41 Switzerland</option>
                  <option value="+963">+963 Syria</option>
                  <option value="+886">+886 Taiwan</option>
                  <option value="+992">+992 Tajikistan</option>
                  <option value="+255">+255 Tanzania</option>
                  <option value="+66">+66 Thailand</option>
                  <option value="+228">+228 Togo</option>
                  <option value="+690">+690 Tokelau</option>
                  <option value="+676">+676 Tonga</option>
                  <option value="+1-868">+1-868 Trinidad &amp; Tobago</option>
                  <option value="+216">+216 Tunisia</option>
                  <option value="+90">+90 Turkey</option>
                  <option value="+993">+993 Turkmenistan</option>
                  <option value="+1-649">+1-649 Turks &amp; Caicos Islands</option>
                  <option value="+688">+688 Tuvalu</option>
                  <option value="+256">+256 Uganda</option>
                  <option value="+380">+380 Ukraine</option>
                  <option value="+971">+971 United Arab Emirates</option>
                  <option value="+44">+44 United Kingdom</option>
                  <option value="+1">+1 United States</option>
                  <option value="+598">+598 Uruguay</option>
                  <option value="+998">+998 Uzbekistan</option>
                  <option value="+678">+678 Vanuatu</option>
                  <option value="+379">+379 Vatican City</option>
                  <option value="+58">+58 Venezuela</option>
                  <option value="+84">+84 Vietnam</option>
                  <option value="+1-340">+1-340 Virgin Islands (US)</option>
                  <option value="+681">+681 Wallis &amp; Futuna</option>
                  <option value="+212">+212 Western Sahara</option>
                  <option value="+967">+967 Yemen</option>
                  <option value="+260">+260 Zambia</option>
                  <option value="+263">+263 Zimbabwe</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-800 dark:text-slate-300">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 77 123 4567"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Clinic Code</label>
                <input
                  type="text"
                  name="clinic"
                  value={formState.clinic}
                  onChange={handleInputChange}
                  placeholder="Oncology Clinic code"
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("clinic") ? "ai-extracted-glow" : ""}`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">BHT / Bed Ref Book</label>
                <input
                  type="text"
                  name="bht"
                  value={formState.bht}
                  onChange={handleInputChange}
                  placeholder="Bed Head Ticket reference"
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("bht") ? "ai-extracted-glow" : ""}`}
                />
              </div>

            </div>
          )}
        </div>

        {/* Collapsible Section 1: Demographics */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("demographics")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.demographics ? 'border-b border-natural-border' : ''} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-slate-500/10 dark:bg-slate-400/20 text-slate-700 dark:text-slate-200 flex items-center justify-center"><Users className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Demographics</h3>
              <SectionUploadActions section="demographics" label="Demographics" />
            </div>
            {openSections.demographics ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.demographics && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-slate-700 dark:text-slate-350">

              {/* Age, DOB, Gender */}
              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  value={formState.dob}
                  onChange={(e) => {
                    handleInputChange(e);
                    const dob = e.target.value;
                    if (dob) {
                      const birth = new Date(dob);
                      const today = new Date();
                      let age = today.getFullYear() - birth.getFullYear();
                      const m = today.getMonth() - birth.getMonth();
                      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                      setFormState(prev => ({ ...prev, age: String(age) }));
                    } else {
                      setFormState(prev => ({ ...prev, age: "" }));
                    }
                  }}
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("dob") ? "ai-extracted-glow" : ""}`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Calculated Age</label>
                <input
                  type="number"
                  name="age"
                  value={formState.age}
                  readOnly
                  placeholder="e.g. 45"
                  className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Gender</label>
                <select
                  name="gender"
                  value={formState.gender}
                  onChange={handleInputChange}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Active Status</label>
                <select
                  name="status"
                  value={formState.status}
                  onChange={handleInputChange}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="under_treatment">Under Treatment</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="discharged">Discharged</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Marital Status</label>
                <select
                  name="marital_status"
                  value={formState.marital_status}
                  onChange={handleInputChange}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
                >
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Separated">Separated</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Education Status</label>
                <select
                  name="education_status"
                  value={formState.education_status}
                  onChange={handleInputChange}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
                >
                  <option value="">Select education level</option>
                  <option value="No formal education">No formal education</option>
                  <option value="Primary school">Primary school</option>
                  <option value="Secondary school">Secondary school</option>
                  <option value="High school / GED">High school / GED</option>
                  <option value="Vocational / Technical">Vocational / Technical</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Bachelor's degree">Bachelor's degree</option>
                  <option value="Master's degree">Master's degree</option>
                  <option value="Doctorate / PhD">Doctorate / PhD</option>
                  <option value="Professional degree">Professional degree (MD, JD, etc.)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Ethnicity / Race</label>
                <select
                  name="ethnicity"
                  value={formState.ethnicity}
                  onChange={handleInputChange}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
                >
                  <option value="">Select ethnicity</option>
                  <option value="Sinhalese">Sinhalese</option>
                  <option value="Sri Lankan Tamil">Sri Lankan Tamil</option>
                  <option value="Indian Tamil">Indian Tamil</option>
                  <option value="Sri Lankan Moor">Sri Lankan Moor</option>
                  <option value="Malay">Malay</option>
                  <option value="Burgher">Burgher</option>
                  <option value="Chinese">Chinese</option>
                  <option value="South Asian">South Asian (other)</option>
                  <option value="East Asian">East Asian</option>
                  <option value="Southeast Asian">Southeast Asian</option>
                  <option value="Middle Eastern">Middle Eastern</option>
                  <option value="African">African / Black</option>
                  <option value="Caucasian / White">Caucasian / White</option>
                  <option value="Hispanic / Latino">Hispanic / Latino</option>
                  <option value="Mixed / Multiracial">Mixed / Multiracial</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Geographic Accessibility</label>
                <select
                  name="geographic_accessibility"
                  value={formState.geographic_accessibility}
                  onChange={handleInputChange}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
                >
                  <option value="">Select accessibility</option>
                  <option value="Urban">Urban</option>
                  <option value="Semi-urban">Semi-urban</option>
                  <option value="Rural">Rural</option>
                  <option value="Remote">Remote</option>
                  <option value="Not applicable">Not applicable</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Living Area / Town</label>
                <input
                  type="text"
                  name="living_area"
                  value={formState.living_area}
                  onChange={handleInputChange}
                  placeholder="e.g. Kandana"
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("living_area") ? "ai-extracted-glow" : ""}`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  value={formState.occupation}
                  onChange={handleInputChange}
                  placeholder="e.g. Teacher, Farmer, Business"
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("occupation") ? "ai-extracted-glow" : ""}`}
                />
              </div>

            </div>
          )}
        </div>

        {/* Collapsible Section: Oncology Types */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("oncology")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.oncology ? 'border-b border-natural-border' : ''} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-natural-accent/10 dark:bg-natural-accent/20 text-natural-accent flex items-center justify-center"><Dna className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Oncology Types</h3>
              <SectionUploadActions section="oncology" label="Oncology Types" />
            </div>
            {openSections.oncology ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.oncology && (
            <div className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-350">

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block font-semibold mb-1.5 text-natural-accent">Oncology Types</label>
                <div className="p-4 bg-theme-surface dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">

                  {/* Search filter input */}
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Type here to search oncology category..."
                      value={oncologySearch}
                      onChange={(e) => setOncologySearch(e.target.value)}
                      className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-natural-accent focus:ring-1 focus:ring-natural-accent outline-none placeholder-slate-400"
                    />
                    {oncologySearch && (
                      <button
                        type="button"
                        onClick={() => setOncologySearch("")}
                        className="text-xs px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-755 text-slate-500 rounded-xl transition-all"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Tick Box grid selection list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                    {Object.values(OncologyCategory)
                      .filter((cat) => cat.toLowerCase().includes(oncologySearch.toLowerCase()))
                      .map((cat) => {
                        const isChecked = selectedOncologyTypes.includes(cat);
                        return (
                          <label
                            key={cat}
                            className={`flex items-center gap-2.5 p-2 px-3 border rounded-xl select-none cursor-pointer transition-all ${
                              isChecked
                                ? "bg-natural-accent/10 border-natural-accent text-natural-accent-dark dark:text-natural-gold dark:border-natural-accent"
                                : "bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-900/40 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleOncologyType(cat)}
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-natural-accent focus:ring-natural-accent accent-natural-accent"
                              id={`oncology-checkbox-${cat}`}
                            />
                            <span className="text-xs font-semibold leading-tight">{cat}</span>
                          </label>
                        );
                      })}

                    {Object.values(OncologyCategory).filter((cat) => cat.toLowerCase().includes(oncologySearch.toLowerCase())).length === 0 && (
                      <div className="col-span-full py-4 text-center text-xs text-slate-400">
                        No oncology category matches "{oncologySearch}"
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Other Specific Tumors / AI Typed Category</label>
                <input
                  type="text"
                  name="oncology_other"
                  value={formState.oncology_other}
                  onChange={handleInputChange}
                  placeholder="If Other is selected, type tumor category here"
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("oncology_other") ? "ai-extracted-glow" : ""}`}
                />
                {selectedOncologyTypes.length > 0 && (
                  <p className="mt-1.5 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
                    Selected: {selectedOncologyTypes.join(", ")}
                  </p>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Collapsible Section: Hospital Information */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("hospital")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.hospital ? 'border-b border-natural-border' : ''} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-cyan-500/10 dark:bg-cyan-400/20 text-cyan-700 dark:text-cyan-200 flex items-center justify-center"><Building2 className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Hospital Information</h3>
              <SectionUploadActions section="hospital" label="Hospital Information" />
            </div>
            {openSections.hospital ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.hospital && (
            <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-slate-700 dark:text-slate-350">

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400 font-bold">Hospital Name</label>
                <input
                  type="text"
                  name="hospital"
                  value={formState.hospital}
                  onChange={handleInputChange}
                  placeholder="e.g. National Hospital Colombo"
                  className={`w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl ${extractedFields.has("hospital") ? "ai-extracted-glow" : ""}`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Hospital Location</label>
                <input
                  type="text"
                  name="hospital_location"
                  value={formState.hospital_location}
                  onChange={handleInputChange}
                  placeholder="e.g. Colombo, Kandy, Jaffna"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 dark:text-slate-400">Hospital Type</label>
                <select
                  name="hospital_type"
                  value={formState.hospital_type}
                  onChange={handleInputChange}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 rounded-button cursor-pointer"
                >
                  <option value="">Select hospital type</option>
                  <option value="National Hospital">National Hospital</option>
                  <option value="Teaching Hospital">Teaching Hospital</option>
                  <option value="Provincial Hospital">Provincial Hospital</option>
                  <option value="District Hospital">District Hospital</option>
                  <option value="Base Hospital">Base Hospital</option>
                  <option value="Government">Government</option>
                  <option value="Semi-government">Semi-government</option>
                  <option value="Private">Private</option>
                </select>
              </div>

            </div>
          )}
        </div>

        {/* Collapsible Section 2: Clinical Presentation */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("history")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.history ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-indigo-500/10 dark:bg-indigo-400/20 text-indigo-700 dark:text-indigo-200 flex items-center justify-center"><Stethoscope className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Clinical History</h3>
              <SectionUploadActions section="history" label="Clinical History" />
            </div>
            {openSections.history ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.history && (
            <div className="p-5 space-y-5 text-xs text-slate-700 dark:text-slate-350">

              <SubTable
                title="Past Medical History"
                accent=""
                icon={ClipboardList}
                addLabel="Add Entry"
                tableKey="pastMedicalTable"
                headers={["Date", "Comorbidity", "Notes"]}
                keys={["date", "comorbidity", "notes"]}
                placeholders={["e.g. 2020-03", "Hypertension, Diabetes", "Duration, treatment..."]}
                emptyTemplate={{ date: "", comorbidity: "", notes: "" }}
                rows={formState.pastMedicalTable || []}
                onAddRow={(e) => addRow("pastMedicalTable", { date: "", comorbidity: "", notes: "" }, e)}
                onRemoveRow={(idx) => removeRow("pastMedicalTable", idx)}
                onTableChange={(idx, field, val) => handleTableChange("pastMedicalTable", idx, field, val)}
              />

              <SubTable
                title="Past Surgical History"
                accent=""
                icon={Scissors}
                addLabel="Add Surgery"
                tableKey="pastSurgicalTable"
                headers={["Date", "Surgery", "Complication", "Notes"]}
                keys={["date", "surgery", "complication", "notes"]}
                placeholders={["e.g. 2021-06", "Appendectomy", "None", "Uneventful recovery"]}
                emptyTemplate={{ date: "", surgery: "", complication: "", notes: "" }}
                rows={formState.pastSurgicalTable || []}
                onAddRow={(e) => addRow("pastSurgicalTable", { date: "", surgery: "", complication: "", notes: "" }, e)}
                onRemoveRow={(idx) => removeRow("pastSurgicalTable", idx)}
                onTableChange={(idx, field, val) => handleTableChange("pastSurgicalTable", idx, field, val)}
              />

              <SubTable
                title="Prior Chemotherapy"
                accent=""
                icon={FlaskConical}
                addLabel="Add Entry"
                tableKey="priorChemoTable"
                headers={["Date", "Agent", "Dose", "Frequency", "Duration", "Cancer Type", "Adverse Effects", "Notes"]}
                keys={["date", "agent", "dose", "frequency", "duration", "cancer_type", "adverse_effects", "notes"]}
                placeholders={["e.g. 2023-01", "Cisplatin", "75 mg/m²", "q3w", "6 cycles", "Lung cancer", "Nausea, neuropathy", "Well tolerated"]}
                emptyTemplate={{ date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }}
                rows={formState.priorChemoTable || []}
                onAddRow={(e) => addRow("priorChemoTable", { date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }, e)}
                onRemoveRow={(idx) => removeRow("priorChemoTable", idx)}
                onTableChange={(idx, field, val) => handleTableChange("priorChemoTable", idx, field, val)}
              />

              <SubTable
                title="Prior Radiotherapy"
                accent=""
                icon={Radio}
                addLabel="Add Entry"
                tableKey="priorRadioTable"
                headers={["Date", "Agent/Field", "Dose", "Frequency", "Duration", "Cancer Type", "Adverse Effects", "Notes"]}
                keys={["date", "agent", "dose", "frequency", "duration", "cancer_type", "adverse_effects", "notes"]}
                placeholders={["e.g. 2023-03", "Thorax IMRT", "50.4 Gy / 28 fx", "Daily", "5.5 weeks", "Breast cancer", "Dermatitis, fatigue", "Completed as planned"]}
                emptyTemplate={{ date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }}
                rows={formState.priorRadioTable || []}
                onAddRow={(e) => addRow("priorRadioTable", { date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }, e)}
                onRemoveRow={(idx) => removeRow("priorRadioTable", idx)}
                onTableChange={(idx, field, val) => handleTableChange("priorRadioTable", idx, field, val)}
              />

              <SubTable
                title="Prior Immunotherapy"
                accent=""
                icon={ShieldCheck}
                addLabel="Add Entry"
                tableKey="priorImmunoTable"
                headers={["Date", "Agent", "Dose", "Frequency", "Duration", "Cancer Type", "Adverse Effects", "Notes"]}
                keys={["date", "agent", "dose", "frequency", "duration", "cancer_type", "adverse_effects", "notes"]}
                placeholders={["e.g. 2024-01", "Pembrolizumab", "200 mg", "q3w", "12 months", "Melanoma", "Immune colitis", "Stopped due to toxicity"]}
                emptyTemplate={{ date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }}
                rows={formState.priorImmunoTable || []}
                onAddRow={(e) => addRow("priorImmunoTable", { date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }, e)}
                onRemoveRow={(idx) => removeRow("priorImmunoTable", idx)}
                onTableChange={(idx, field, val) => handleTableChange("priorImmunoTable", idx, field, val)}
              />

              <SubTable
                title="Prior Hormonal Therapy"
                accent=""
                icon={Activity}
                addLabel="Add Entry"
                tableKey="priorHormoneTable"
                headers={["Date", "Agent", "Dose", "Frequency", "Duration", "Cancer Type", "Adverse Effects", "Notes"]}
                keys={["date", "agent", "dose", "frequency", "duration", "cancer_type", "adverse_effects", "notes"]}
                placeholders={["e.g. 2022-06", "Tamoxifen", "20 mg", "Daily", "5 years", "Breast cancer", "Hot flashes", "Ongoing"]}
                emptyTemplate={{ date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }}
                rows={formState.priorHormoneTable || []}
                onAddRow={(e) => addRow("priorHormoneTable", { date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }, e)}
                onRemoveRow={(idx) => removeRow("priorHormoneTable", idx)}
                onTableChange={(idx, field, val) => handleTableChange("priorHormoneTable", idx, field, val)}
              />

              <SubTable
                title="Prior Targeted Therapy"
                accent=""
                icon={Dna}
                addLabel="Add Entry"
                tableKey="priorTargetedTable"
                headers={["Date", "Agent", "Dose", "Frequency", "Duration", "Cancer Type", "Adverse Effects", "Notes"]}
                keys={["date", "agent", "dose", "frequency", "duration", "cancer_type", "adverse_effects", "notes"]}
                placeholders={["e.g. 2024-03", "Trastuzumab", "6 mg/kg", "q3w", "18 cycles", "HER2+ breast", "Cardiotoxicity", "ECHO monitoring"]}
                emptyTemplate={{ date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }}
                rows={formState.priorTargetedTable || []}
                onAddRow={(e) => addRow("priorTargetedTable", { date: "", agent: "", dose: "", frequency: "", duration: "", cancer_type: "", adverse_effects: "", notes: "" }, e)}
                onRemoveRow={(idx) => removeRow("priorTargetedTable", idx)}
                onTableChange={(idx, field, val) => handleTableChange("priorTargetedTable", idx, field, val)}
              />

              {/* Drug History */}
              <SubTable
                title="Drug History"
                accent=""
                icon={Pill}
                addLabel="Add Drug"
                tableKey="drugTable"
                headers={["Drug Name", "Dose", "Frequency", "Route", "Duration", "Notes"]}
                keys={["drug_name", "dose", "frequency", "route", "duration", "notes"]}
                placeholders={["e.g. Metformin", "500 mg", "BD", "Oral / IV / IM", "2 years", "Optional notes"]}
                emptyTemplate={{ drug_name: "", dose: "", frequency: "", route: "", duration: "", notes: "" }}
                rows={formState.drugTable || []}
                onAddRow={(e) => addRow("drugTable", { drug_name: "", dose: "", frequency: "", route: "", duration: "", notes: "" }, e)}
                onRemoveRow={(idx) => removeRow("drugTable", idx)}
                onTableChange={(idx, field, val) => handleTableChange("drugTable", idx, field, val)}
              />

              {/* Family History */}
              <SubTable
                title="Family History"
                accent=""
                icon={Users}
                addLabel="Add Family Member"
                tableKey="familyTable"
                headers={["Comorbidity", "Relationship", "Notes"]}
                keys={["comorbidity", "relationship", "family_notes"]}
                placeholders={["e.g. Breast cancer, Diabetes", "Mother / Father / Sibling", "Age of onset, outcome..."]}
                emptyTemplate={{ comorbidity: "", relationship: "", family_notes: "" }}
                rows={formState.familyTable || []}
                onAddRow={(e) => addRow("familyTable", { comorbidity: "", relationship: "", family_notes: "" }, e)}
                onRemoveRow={(idx) => removeRow("familyTable", idx)}
                onTableChange={(idx, field, val) => handleTableChange("familyTable", idx, field, val)}
              />

              {/* Social History */}
              <div>
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 p-2.5 pl-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="h-6 w-6 rounded-md bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
                      <Wine className="h-3 w-3" />
                    </span>
                    <span className="h-subsection">
                      Social History
                    </span>
                  </div>
                </div>
                <div className="mt-2 overflow-x-auto border border-natural-border/50 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Substance</th>
                        <th className="p-2.5">Status (Consumer type)</th>
                        <th className="p-2.5">Amounts / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-2 font-semibold text-slate-700 dark:text-slate-200">Smoking</td>
                        <td className="p-2">
                          <select name="smoking" value={formState.smoking} onChange={handleInputChange} className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer focus:border-blue-500">
                            <option value="Non-consumer">Non-consumer</option>
                            <option value="Current consumer">Current consumer</option>
                            <option value="Ex consumer">Ex consumer</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input type="text" name="smoking_amount" value={formState.smoking_amount} onChange={handleInputChange} placeholder="e.g. 10 pack-years" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${formState.smoking_amount ? "ai-priority-text" : ""}`} />
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-2 font-semibold text-slate-700 dark:text-slate-200">Alcohol</td>
                        <td className="p-2">
                          <select name="alcohol" value={formState.alcohol} onChange={handleInputChange} className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer focus:border-blue-500">
                            <option value="Non-consumer">Non-consumer</option>
                            <option value="Current consumer">Current consumer</option>
                            <option value="Ex consumer">Ex consumer</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input type="text" name="alcohol_amount" value={formState.alcohol_amount} onChange={handleInputChange} placeholder="e.g. 6 units / week" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${formState.alcohol_amount ? "ai-priority-text" : ""}`} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Other Risk Factors */}
              <SubTable
                title="Other Risk Factors"
                accent=""
                icon={AlertTriangle}
                addLabel="Add Risk Factor"
                tableKey="riskTable"
                headers={["Risk Factor Name", "Notes"]}
                keys={["risk_factor", "risk_notes"]}
                placeholders={["e.g. Occupational exposure, HPV, Obesity", "Optional notes / duration / severity"]}
                emptyTemplate={{ risk_factor: "", risk_notes: "" }}
                rows={formState.riskTable || []}
                onAddRow={(e) => addRow("riskTable", { risk_factor: "", risk_notes: "" }, e)}
                onRemoveRow={(idx) => removeRow("riskTable", idx)}
                onTableChange={(idx, field, val) => handleTableChange("riskTable", idx, field, val)}
              />

              {/* Allergies Block */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t border-natural-border/40 dark:border-slate-800/80 pt-4">
                <div>
                  <label className="block font-semibold mb-1">Food Allergies</label>
                  <input type="text" name="allergy_food" value={formState.allergy_food} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl" />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-red-600">Drug Allergies</label>
                  <input type="text" name="allergy_drugs" value={formState.allergy_drugs} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Plasters Allergies</label>
                  <input type="text" name="allergy_plasters" value={formState.allergy_plasters} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Other Allergies</label>
                  <input type="text" name="allergy_other" value={formState.allergy_other} onChange={handleInputChange} className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl" />
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Independent Clinical Assessment */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("clinicalAssessment")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.clinicalAssessment ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-indigo-500/10 dark:bg-indigo-400/20 text-indigo-700 dark:text-indigo-200 flex items-center justify-center"><Activity className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Clinical Assessment</h3>
              <SectionUploadActions section="clinicalAssessment" label="Clinical Assessment" />
            </div>
            {openSections.clinicalAssessment ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.clinicalAssessment && (
            <div className="p-5 space-y-5 text-xs text-slate-700 dark:text-slate-350">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <SubTable
                  title="Presenting Complaints"
                  accent=""
                  icon={FileText}
                  addLabel="Add Complaint"
                  tableKey="presentingComplaintsTable"
                  headers={["Date", "Complaint", "Notes"]}
                  keys={["date", "complaint", "notes"]}
                  placeholders={["e.g. 2024-01", "Chest pain, weight loss", "Duration, severity, context..."]}
                   emptyTemplate={{ date: "", complaint: "", notes: "" }}
                   rows={formState.presentingComplaintsTable || []}
                   onAddRow={(e) => addRow("presentingComplaintsTable", { date: "", complaint: "", notes: "" }, e)}
                   onRemoveRow={(idx) => removeRow("presentingComplaintsTable", idx)}
                   onTableChange={(idx, field, val) => handleTableChange("presentingComplaintsTable", idx, field, val)}
                 />
              </div>
              </div>

              {/* Systemic Inquiry */}
              <div className="border border-natural-border/50 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 border-b border-natural-border/30 dark:border-slate-700/50">
                  <ClipboardList className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
                  <span className="h-subsection">Systemic Inquiry</span>
                  <span className="text-[11.5px] text-slate-400 dark:text-slate-500 ml-1">({formState.systemicInquiry.length} system{formState.systemicInquiry.length !== 1 ? "s" : ""})</span>
                  {formState.systemicInquiry.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFormState(prev => ({ ...prev, systemicInquiry: [] }))}
                      className="ml-auto text-[11.5px] text-rose-500 hover:text-rose-700 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-[11.5px] text-slate-400 dark:text-slate-500">Review of systems — tap a system to expand and tick symptoms present.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(systemSymptoms).map((system) => {
                      const selected = formState.systemicInquiry.find(s => s.system === system);
                      return (
                        <div key={system} className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => toggleSystemicSystem(system)}
                            className={`text-[11.5px] px-2.5 py-1 rounded-lg border transition-all text-left ${
                              selected
                                ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-200"
                                : "bg-theme-surface dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                            }`}
                          >
                            {system}
                          </button>
                          {selected && (
                            <div className="mt-1.5 p-2 bg-slate-50 dark:bg-slate-900/50 border border-indigo-200 dark:border-indigo-800/50 rounded-lg w-56">
                              <div className="flex items-center gap-0.5 flex-wrap">
                                {systemSymptoms[system].map((symptom) => {
                                  const checked = selected.symptoms.includes(symptom);
                                  return (
                                    <label
                                      key={symptom}
                                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer text-[11.5px] transition-all ${
                                        checked
                                          ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200"
                                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSystemicSymptom(system, symptom)}
                                        className="h-3 w-3 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      {symptom}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ECOG Performance Status */}
              <div className="border border-natural-border/50 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 border-b border-natural-border/30 dark:border-slate-700/50">
                  <Activity className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" />
                  <span className="h-subsection">ECOG Performance Status</span>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                    {ECOG_OPTIONS.map(opt => {
                      const selected = formState.ecog_status === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-[11.5px] select-none ${
                            selected
                              ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-200"
                              : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <input
                            type="radio"
                            name="ecog_status"
                            value={opt.value}
                            checked={selected}
                            onChange={() => setFormState(prev => ({ ...prev, ecog_status: opt.value }))}
                            className="h-3.5 w-3.5 border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Functional Assessment: ADL + IADL */}
              <div className="border border-slate-200 dark:border-slate-700/85 rounded-xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-900/30 p-3 border-b border-slate-200 dark:border-slate-700/85">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
                        <Activity className="h-3 w-3" />
                      </span>
                      <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Functional Assessment (ADL / IADL)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded-lg text-[11.5px] font-bold text-theme-on-accent" style={{ backgroundColor: (() => { const s = parseInt(formState.functional_adl_score || "0"); return s >= 6 ? "var(--theme-positive-500)" : s >= 4 ? "var(--theme-warning-500)" : "var(--theme-danger-500)"; })() }}>
                        ADL: {formState.functional_adl_score || "0"}/6
                      </span>
                      <span className="px-2 py-1 rounded-lg text-[11.5px] font-bold text-theme-on-accent" style={{ backgroundColor: (() => { const s = parseInt(formState.functional_iadl_score || "0"); return s >= 6 ? "var(--theme-positive-500)" : s >= 4 ? "var(--theme-warning-500)" : "var(--theme-danger-500)"; })() }}>
                        IADL: {formState.functional_iadl_score || "0"}/8
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ADL */}
                  <div>
                    <div className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300 mb-2">Activities of Daily Living (Katz Index)</div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {[
                        { label: "Bathing", key: "adl_bathing" },
                        { label: "Dressing", key: "adl_dressing" },
                        { label: "Toileting", key: "adl_toileting" },
                        { label: "Transferring", key: "adl_transferring" },
                        { label: "Continence", key: "adl_continence" },
                        { label: "Feeding", key: "adl_feeding" },
                      ].map(item => {
                        const selected = (formState.functional_adl_items || "").split(",").filter(Boolean).includes(item.key);
                        return (
                          <label
                            key={item.key}
                            className={`flex items-center gap-1.5 p-1.5 px-2 rounded-lg border cursor-pointer transition-all text-[11.5px] select-none ${
                              selected
                                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                const current = new Set((formState.functional_adl_items || "").split(",").filter(Boolean));
                                if (current.has(item.key)) current.delete(item.key); else current.add(item.key);
                                const newStr = Array.from(current).join(",");
                                const score = Array.from(current).length;
                                setFormState(prev => ({ ...prev, functional_adl_items: newStr, functional_adl_score: String(score) }));
                              }}
                              className="h-3 w-3 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="flex-1">{item.label}</span>
                            <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${selected ? "bg-theme-surface/40 dark:bg-theme-surface/10 text-emerald-600 dark:text-emerald-300" : "text-slate-400"}`}>+1</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {/* IADL */}
                  <div>
                    <div className="text-[11.5px] font-bold text-slate-700 dark:text-slate-300 mb-2">Instrumental Activities of Daily Living (Lawton Scale)</div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {[
                        { label: "Telephone use", key: "iadl_telephone" },
                        { label: "Shopping", key: "iadl_shopping" },
                        { label: "Food preparation", key: "iadl_food" },
                        { label: "Housekeeping", key: "iadl_housekeeping" },
                        { label: "Laundry", key: "iadl_laundry" },
                        { label: "Transportation", key: "iadl_transport" },
                        { label: "Medications", key: "iadl_medications" },
                        { label: "Finances", key: "iadl_finances" },
                      ].map(item => {
                        const selected = (formState.functional_iadl_items || "").split(",").filter(Boolean).includes(item.key);
                        return (
                          <label
                            key={item.key}
                            className={`flex items-center gap-1.5 p-1.5 px-2 rounded-lg border cursor-pointer transition-all text-[11.5px] select-none ${
                              selected
                                ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                const current = new Set((formState.functional_iadl_items || "").split(",").filter(Boolean));
                                if (current.has(item.key)) current.delete(item.key); else current.add(item.key);
                                const newStr = Array.from(current).join(",");
                                const score = Array.from(current).length;
                                setFormState(prev => ({ ...prev, functional_iadl_items: newStr, functional_iadl_score: String(score) }));
                              }}
                              className="h-3 w-3 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="flex-1">{item.label}</span>
                            <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${selected ? "bg-theme-surface/40 dark:bg-theme-surface/10 text-blue-600 dark:text-blue-300" : "text-slate-400"}`}>+1</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Charlson Comorbidity Index Calculator */}
              <div className="border border-slate-200 dark:border-slate-700/85 rounded-xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-900/30 p-3 border-b border-slate-200 dark:border-slate-700/85">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
                        <Activity className="h-3 w-3" />
                      </span>
                      <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Charlson Comorbidity Index (CCI)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Age:</span>
                      <input
                        type="number"
                        value={formState.age || ""}
                        readOnly
                        className="w-16 p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] text-center text-slate-500 dark:text-slate-400 cursor-not-allowed"
                      />
                      <span className="px-2 py-1 rounded-lg text-xs font-bold text-theme-on-accent" style={{ backgroundColor: (() => { const score = parseInt(formState.charlson_index || "0"); return score >= 5 ? "var(--theme-danger-500)" : score >= 2 ? "var(--theme-warning-600)" : score >= 1 ? "var(--theme-warning-500)" : "var(--theme-positive-500)"; })() }}>
                        Score: {formState.charlson_index || "0"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5 mb-3">
                    {(() => {
                      const conditions = CHARLSON_CONDITIONS;
                      const selected = (formState.charlson_conditions || "").split(",").filter(Boolean);
                      const toggle = (key: string) => {
                        const current = new Set(selected);
                        if (current.has(key)) current.delete(key); else current.add(key);
                        const newSelected = Array.from(current);
                        const newStr = newSelected.join(",");
                        const score = newSelected.reduce((sum, k) => {
                          const found = conditions.find(c => c.key === k);
                          return sum + (found ? found.weight : 0);
                        }, 0);
                        const ageAdj = Math.max(0, Math.floor(((parseInt(String(formState.age || "0")) - 40) / 10)));
                        const total = score + ageAdj;
                        setFormState(prev => ({ ...prev, charlson_conditions: newStr, charlson_index: String(total) }));
                      };
                      return conditions.map(c => {
                        const isChecked = selected.includes(c.key);
                        const color = c.weight === 6 ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" : c.weight >= 2 ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300" : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300";
                        return (
                          <label key={c.key} className={`flex items-center gap-1.5 p-1.5 px-2 rounded-lg border cursor-pointer transition-all text-[11.5px] select-none ${isChecked ? color : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
                            <input type="checkbox" checked={isChecked} onChange={() => toggle(c.key)} className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                            <span className="flex-1">{c.label}</span>
                            <span className={`font-bold text-[9px] px-1 py-0.5 rounded ${isChecked ? "bg-theme-surface/40 dark:bg-theme-surface/10" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>+{c.weight}</span>
                          </label>
                        );
                      });
                })()}
                  </div>
                  <div className="flex items-center justify-between text-[11.5px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2">
                    <span>Age adjustment: +1 per decade over 40 (current: <strong>+{Math.max(0, Math.floor(((parseInt(String(formState.age || "0")) - 40) / 10)))}</strong>)</span>
                    <span>Max adjusted score: 37</span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Collapsible Section 2.6: Anthropometric Measures */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("anthropometric")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.anthropometric ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 flex items-center justify-center"><Ruler className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Anthropometric Measures</h3>
              <SectionUploadActions section="anthropometric" label="Anthropometric Measures" />
            </div>
            {openSections.anthropometric ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.anthropometric && (
            <div className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-350">
              <div className="flex items-start gap-2 text-[11.5px] text-slate-500 dark:text-slate-400 bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/40 rounded-lg p-2.5">
                <Ruler className="h-3.5 w-3.5 text-teal-600 dark:text-teal-300 mt-0.5 flex-shrink-0" />
                <span>
                  Record serial height and weight measurements with dates. BMI and BSA are calculated automatically per row.
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 p-2.5 pl-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="h-6 w-6 rounded-md bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
                    <Ruler className="h-3 w-3" />
                  </span>
                  <span className="h-subsection">
                    Height & Weight Records
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addRow("anthropometricTable", { date: "", height: "", weight: "", bmi: "", bsa: "" })}
                  className="text-[11.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <CirclePlus className="h-3.5 w-3.5" />
                  <span>Add Measurement</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-natural-border/50 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="h-table-col">
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Height (cm)</th>
                      <th className="p-2.5">Weight (kg)</th>
                      <th className="p-2.5">BMI (kg/m²)</th>
                      <th className="p-2.5">BSA (m²)</th>
                      <th className="p-2.5 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                    {(formState.anthropometricTable || []).map((row: AnthropometricEntry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => handleTableChange("anthropometricTable", idx, "date", e.target.value)}
                            className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={row.height}
                            onChange={(e) => {
                              const h = parseFloat(e.target.value);
                              const w = parseFloat(row.weight);
                              handleTableChange("anthropometricTable", idx, "height", e.target.value);
                              if (h > 0 && w > 0) {
                                const bmi = w / ((h / 100) * (h / 100));
                                const bsa = Math.sqrt((h * w) / 3600);
                                handleTableChange("anthropometricTable", idx, "bmi", bmi.toFixed(1));
                                handleTableChange("anthropometricTable", idx, "bsa", bsa.toFixed(2));
                              }
                            }}
                            placeholder="e.g. 170"
                            className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={row.weight}
                            onChange={(e) => {
                              const h = parseFloat(row.height);
                              const w = parseFloat(e.target.value);
                              handleTableChange("anthropometricTable", idx, "weight", e.target.value);
                              if (h > 0 && w > 0) {
                                const bmi = w / ((h / 100) * (h / 100));
                                const bsa = Math.sqrt((h * w) / 3600);
                                handleTableChange("anthropometricTable", idx, "bmi", bmi.toFixed(1));
                                handleTableChange("anthropometricTable", idx, "bsa", bsa.toFixed(2));
                              }
                            }}
                            placeholder="e.g. 70"
                            className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.bmi}
                            readOnly
                            className="w-full p-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400 cursor-default"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.bsa}
                            readOnly
                            className="w-full p-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400 cursor-default"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <button type="button" onClick={() => removeRow("anthropometricTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20 transition">
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!formState.anthropometricTable || formState.anthropometricTable.length === 0) && (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-slate-400 text-[11.5px]">No measurements recorded yet — click "Add Measurement" to begin.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 p-2.5 pl-3 rounded-xl mt-4">
                <div className="flex items-center gap-3">
                  <span className="h-6 w-6 rounded-md bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
                    <Ruler className="h-3 w-3" />
                  </span>
                  <span className="h-subsection">
                    Other Anthropometric Measures
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addOtherGroup("")}
                  className="text-[11.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <CirclePlus className="h-3.5 w-3.5" />
                  <span>Add Date Group</span>
                </button>
              </div>

              {(!formState.otherAnthropometricTable || formState.otherAnthropometricTable.length === 0) ? (
                <div className="text-center py-6 text-slate-400 text-[11.5px] border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                  No date groups yet — click "Add Date Group" to begin.
                </div>
              ) : (
                <div className="space-y-4">
                  {(formState.otherAnthropometricTable || []).map((group: OtherAnthropometricGroup, gIdx: number) => (
                    <div key={gIdx} className="border border-natural-border/50 dark:border-slate-700 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 border-b border-natural-border/30 dark:border-slate-700/50">
                        <input
                          type="date"
                          value={group.date}
                          onChange={(e) => handleOtherGroupChange(gIdx, e.target.value)}
                          className="p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                        <span className="text-[11.5px] text-slate-400 dark:text-slate-500 ml-1">
                          {group.entries.length} measure{group.entries.length !== 1 ? "s" : ""}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => addOtherEntry(gIdx)}
                            className="text-[11.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <CirclePlus className="h-3 w-3" />
                            <span>Add Measure</span>
                          </button>
                          <button type="button" onClick={() => removeOtherGroup(gIdx)} className="text-rose-500 hover:text-rose-700 p-1 rounded bg-rose-50 dark:bg-rose-950/20 transition">
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="h-table-col">
                            <th className="p-2.5">Measure</th>
                            <th className="p-2.5">Value</th>
                            <th className="p-2.5">Unit</th>
                            <th className="p-2.5 text-right">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                          {group.entries.map((entry: OtherAnthropometricEntry, eIdx: number) => (
                            <tr key={eIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-2">
                                <select
                                  value={entry.measure}
                                  onChange={(e) => handleOtherEntryChange(gIdx, eIdx, "measure", e.target.value)}
                                  className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer focus:border-blue-500"
                                >
                                  <option value="">Select measure...</option>
                                  <option value="Waist circumference">Waist circumference</option>
                                  <option value="Hip circumference">Hip circumference</option>
                                  <option value="Mid-upper arm circumference (MUAC)">Mid-upper arm circumference (MUAC)</option>
                                  <option value="Head circumference">Head circumference</option>
                                  <option value="Neck circumference">Neck circumference</option>
                                  <option value="Chest circumference">Chest circumference</option>
                                  <option value="Thigh circumference">Thigh circumference</option>
                                  <option value="Calf circumference">Calf circumference</option>
                                  <option value="Skinfold thickness (triceps)">Skinfold thickness (triceps)</option>
                                  <option value="Skinfold thickness (subscapular)">Skinfold thickness (subscapular)</option>
                                  <option value="Skinfold thickness (suprailiac)">Skinfold thickness (suprailiac)</option>
                                  <option value="Arm span">Arm span</option>
                                  <option value="Sitting height">Sitting height</option>
                                  <option value="Waist-to-hip ratio">Waist-to-hip ratio</option>
                                </select>
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={entry.value}
                                  onChange={(e) => handleOtherEntryChange(gIdx, eIdx, "value", e.target.value)}
                                  placeholder="e.g. 85"
                                  className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={entry.unit}
                                  onChange={(e) => handleOtherEntryChange(gIdx, eIdx, "unit", e.target.value)}
                                  className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer focus:border-blue-500"
                                >
                                  <option value="">Select unit...</option>
                                  <option value="cm">cm</option>
                                  <option value="mm">mm</option>
                                  <option value="kg">kg</option>
                                  <option value="m">m</option>
                                  <option value="in">in</option>
                                  <option value="ft">ft</option>
                                </select>
                              </td>
                              <td className="p-2 text-right">
                                <button type="button" onClick={() => removeOtherEntry(gIdx, eIdx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20 transition">
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {group.entries.length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-4 text-slate-400 text-[11.5px]">No measures in this group — click "Add Measure" above.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Collapsible Section 2.5: Examination Findings */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("examination")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.examination ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-lg bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 flex items-center justify-center"><Scan className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Examination Findings</h3>
              <SectionUploadActions section="examination" label="Examination Findings" />
            </div>
            {openSections.examination ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.examination && (
            <div className="p-5 space-y-3 text-xs text-slate-700 dark:text-slate-350">
              <div className="flex items-start gap-2 text-[11.5px] text-slate-500 dark:text-slate-400 bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/40 rounded-lg p-2.5">
                <Stethoscope className="h-3.5 w-3.5 text-teal-600 dark:text-teal-300 mt-0.5 flex-shrink-0" />
                <span>
                  Record per-system clinical exam findings grouped by date. <strong>Add a date group, then add organ system rows</strong> — multiple systems can share the same date. Findings can be populated by AI Fill or entered manually.
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 p-2.5 pl-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="h-6 w-6 rounded-md bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
                    <Stethoscope className="h-3 w-3" />
                  </span>
                  <span className="h-subsection">
                    Date-Based Examination Findings
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addExamGroup("")}
                  className="text-[11.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <CirclePlus className="h-3.5 w-3.5" />
                  <span>Add Date Group</span>
                </button>
              </div>

              {(!formState.examFindingsTable || formState.examFindingsTable.length === 0) ? (
                <div className="text-center py-6 text-slate-400 text-[11.5px] border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                  No date groups yet — click "Add Date Group" to begin.
                </div>
              ) : (
                <div className="space-y-4">
                  {(formState.examFindingsTable || []).map((group: ExamFindingsGroup, gIdx: number) => (
                    <div key={gIdx} className="border border-natural-border/50 dark:border-slate-700 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 border-b border-natural-border/30 dark:border-slate-700/50">
                        <input
                          type="date"
                          value={group.date}
                          onChange={(e) => handleExamGroupChange(gIdx, e.target.value)}
                          className="p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                        <span className="text-[11.5px] text-slate-400 dark:text-slate-500 ml-1">
                          {group.entries.length} finding{group.entries.length !== 1 ? "s" : ""}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => addExamEntry(gIdx)}
                            className="text-[11.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <CirclePlus className="h-3 w-3" />
                            <span>Add Finding</span>
                          </button>
                          <button type="button" onClick={() => removeExamGroup(gIdx)} className="text-rose-500 hover:text-rose-700 p-1 rounded bg-rose-50 dark:bg-rose-950/20 transition">
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="h-table-col">
                            <th className="p-2.5">Organ System</th>
                            <th className="p-2.5">Findings</th>
                            <th className="p-2.5">Notes</th>
                            <th className="p-2.5 text-right">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                          {group.entries.map((entry: ExamFindingsEntry, eIdx: number) => (
                            <tr key={eIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="p-2">
                                <select
                                  value={entry.organ_system}
                                  onChange={(e) => handleExamEntryChange(gIdx, eIdx, "organ_system", e.target.value)}
                                  className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs cursor-pointer focus:border-blue-500 font-semibold ${entry.organ_system ? "ai-priority-text" : ""}`}
                                >
                                  <option value="">Select organ system...</option>
                                  <option value="General Appearance">General Appearance</option>
                                  <option value="ECOG / Performance Status">ECOG / Performance Status</option>
                                  <option value="BP">BP</option>
                                  <option value="Pulse (Rate & Rhythm)">Pulse (Rate & Rhythm)</option>
                                  <option value="SpO2">SpO2</option>
                                  <option value="Temperature">Temperature</option>
                                  <option value="Respiratory Rate">Respiratory Rate</option>
                                  <option value="Head & Neck">Head & Neck</option>
                                  <option value="Eyes / Ophthalmic">Eyes / Ophthalmic</option>
                                  <option value="Ears">Ears</option>
                                  <option value="Nose & Sinuses">Nose & Sinuses</option>
                                  <option value="Oral Cavity & Throat">Oral Cavity & Throat</option>
                                  <option value="Lymph Nodes">Lymph Nodes</option>
                                  <option value="RS (Respiratory)">RS (Respiratory)</option>
                                  <option value="Breast Exam">Breast Exam</option>
                                  <option value="CVS (Cardiovascular)">CVS (Cardiovascular)</option>
                                  <option value="Peripheral Vascular">Peripheral Vascular</option>
                                  <option value="Varicose Veins">Varicose Veins</option>
                                  <option value="P/A (Per Abdomen)">P/A (Per Abdomen)</option>
                                  <option value="Groin & Hernia">Groin & Hernia</option>
                                  <option value="Rectal / DRE">Rectal / DRE</option>
                                  <option value="CNS (Neurological)">CNS (Neurological)</option>
                                  <option value="Cranial Nerves">Cranial Nerves</option>
                                  <option value="Cerebellar Examination">Cerebellar Examination</option>
                                  <option value="Sensory Examination">Sensory Examination</option>
                                  <option value="Upper Limbs">Upper Limbs</option>
                                  <option value="Lower Limbs">Lower Limbs</option>
                                  <option value="Radial Nerve">Radial Nerve</option>
                                  <option value="Median Nerve">Median Nerve</option>
                                  <option value="Axillary Nerve">Axillary Nerve</option>
                                  <option value="Carpal Tunnel">Carpal Tunnel</option>
                                  <option value="Sciatic Nerve">Sciatic Nerve</option>
                                  <option value="Common Peroneal Nerve">Common Peroneal Nerve</option>
                                  <option value="MSK (Musculoskeletal)">MSK (Musculoskeletal)</option>
                                  <option value="Knee">Knee</option>
                                  <option value="Hip">Hip</option>
                                  <option value="Spine">Spine</option>
                                  <option value="TMJ">TMJ</option>
                                  <option value="Skin">Skin</option>
                                  <option value="Local / Lesion Exam">Local / Lesion Exam</option>
                                  <option value="Lumps & Bumps">Lumps & Bumps</option>
                                </select>
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={entry.findings}
                                  onChange={(e) => handleExamEntryChange(gIdx, eIdx, "findings", e.target.value)}
                                  placeholder="e.g. S1 S2 normal, no murmurs"
                                  className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${entry.findings ? "ai-priority-text" : ""}`}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={entry.notes}
                                  onChange={(e) => handleExamEntryChange(gIdx, eIdx, "notes", e.target.value)}
                                  placeholder="Optional — severity, follow-up, etc."
                                  className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                />
                              </td>
                              <td className="p-2 text-right">
                                <button type="button" onClick={() => removeExamEntry(gIdx, eIdx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20 transition">
                                  <Trash className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {group.entries.length === 0 && (
                            <tr>
                              <td colSpan={4} className="text-center py-4 text-slate-400 text-[11.5px]">No findings in this group — click "Add Finding" above.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Section 2.6: Provisional Diagnosis */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("provisionalDiagnosis")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.provisionalDiagnosis ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center"><ClipboardList className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Provisional Diagnosis</h3>
              <SectionUploadActions section="provisionalDiagnosis" label="Provisional Diagnosis" />
            </div>
            {openSections.provisionalDiagnosis ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.provisionalDiagnosis && (
            <div className="p-5 space-y-3 text-xs text-slate-700 dark:text-slate-350">
              <div className="flex items-start gap-2 text-[11.5px] text-slate-500 dark:text-slate-400 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-lg p-2.5">
                <ClipboardList className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" />
                <span>
                  Working diagnosis at first clinical encounter — based on history + examination BEFORE confirmatory investigations. This field is editable and overridden by the Definitive Diagnosis once histology/IHC confirms.
                </span>
              </div>
              <textarea
                name="provisional_diagnosis"
                value={formState.provisional_diagnosis}
                onChange={handleInputChange}
                rows={3}
                placeholder="e.g. Suspicious right breast mass — likely invasive ductal carcinoma, cT2 cN0 cM0, Stage IIA"
                className={`w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl leading-relaxed ${extractedFields.has("provisional_diagnosis") ? "ai-extracted-glow" : ""}`}
              />
            </div>
          )}
        </div>

        {/* Collapsible Section 2.7: Definitive Diagnosis */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("definitiveDiagnosis")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.definitiveDiagnosis ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center"><FileCheck2 className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Definitive Diagnosis</h3>
              <SectionUploadActions section="definitiveDiagnosis" label="Definitive Diagnosis" />
            </div>
            {openSections.definitiveDiagnosis ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.definitiveDiagnosis && (
            <div className="p-5 space-y-3 text-xs text-slate-700 dark:text-slate-350">
              <div className="flex items-start gap-2 text-[11.5px] text-slate-500 dark:text-slate-400 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-lg p-2.5">
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300 mt-0.5 flex-shrink-0" />
                <span>
                  Final, histology/IHC-confirmed diagnosis. Include grade, stage, and molecular subtype where relevant. The staging fields (overall stage, TNM) live in the Investigations section.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">Diagnosis delay (from first complaint):</span>
                <input
                  type="text"
                  value={formState.diagnosis_delay_days ? `${formState.diagnosis_delay_days} days` : "-"}
                  readOnly
                  className="w-28 p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 text-center cursor-default"
                />
              </div>
              {(() => {
                // Compute global time-from-first-complaint summary
                const complaintDates = (formState.presentingComplaintsTable || [])
                  .map(r => r.date).filter(Boolean).sort();
                const firstComplaintDate = complaintDates.length > 0 ? complaintDates[0] : null;
                const diagDates = (formState.definitiveDiagnosisTable || [])
                  .map(r => r.date).filter(Boolean).sort();
                const firstDiagDate = diagDates.length > 0 ? diagDates[0] : null;
                const calcDaysDiff = (diagDate: string) => {
                  if (!firstComplaintDate || !diagDate) return null;
                  const d1 = new Date(firstComplaintDate);
                  const d2 = new Date(diagDate);
                  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
                  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
                };
                const formatDuration = (days: number) => {
                  if (days < 0) return `${Math.abs(days)} days before`;
                  if (days === 0) return "Same day";
                  if (days < 30) return `${days} days`;
                  const months = Math.floor(days / 30);
                  const remDays = days % 30;
                  if (months < 12) return `${months}m ${remDays}d`;
                  const years = Math.floor(months / 12);
                  const remMonths = months % 12;
                  return `${years}y ${remMonths}m ${remDays}d`;
                };
                const totalDiff = firstComplaintDate && firstDiagDate ? calcDaysDiff(firstDiagDate) : null;
                return (
                  <>
                    {totalDiff !== null && (
                      <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-[11.5px] ${
                        totalDiff <= 0 ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300" :
                        totalDiff <= 30 ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300" :
                        totalDiff <= 180 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" :
                        "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                      }`}>
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="font-semibold">Time from first complaint to diagnosis:</span>
                        <span className="font-bold">{formatDuration(totalDiff)}</span>
                        <span className="text-[11.5px] opacity-70">(first complaint: {firstComplaintDate} → first diagnosis: {firstDiagDate})</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-slate-500 dark:text-slate-400">
                      {firstComplaintDate && <span>First complaint: <strong>{firstComplaintDate}</strong></span>}
                      {firstDiagDate && <span>First diagnosis: <strong>{firstDiagDate}</strong></span>}
                    </div>
                    {(() => {
                const diagnosisRows = formState.definitiveDiagnosisTable || [];
                const headers = ["Date", "Diagnosis", "Time from 1st Complaint", "Notes"];
                const keys: ("date" | "diagnosis" | "notes")[] = ["date", "diagnosis", "notes"];
                const placeholders = ["e.g. 2024-06", "Invasive ductal carcinoma, breast, Grade 2, ER+/PR+/HER2-", "Stage, molecular subtype, biomarkers..."];
                return (
                  <div data-table-key="definitiveDiagnosisTable">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 p-2.5 pl-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-md bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 flex-shrink-0">
                          <FileCheck2 className="h-3 w-3" />
                        </span>
                        <span className="h-subsection">Diagnosis Records</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => addRow("definitiveDiagnosisTable", { date: "", diagnosis: "", notes: "" }, e)}
                        className="text-[11.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <CirclePlus className="h-3.5 w-3.5" />
                        <span>Add Diagnosis</span>
                      </button>
                    </div>
                    <div className="mt-2 overflow-x-auto border border-natural-border/50 dark:border-slate-700 rounded-xl">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="h-table-col">
                            {headers.map((h, i) => (
                              <th key={i} className="p-2 whitespace-nowrap">{h}</th>
                            ))}
                            <th className="p-2 text-right">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                          {diagnosisRows.map((row, idx) => {
                            const diffDays = calcDaysDiff(row.date);
                            return (
                              <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                {keys.map((k: string, j) => (
                                  <td key={j} className="p-2">
                                    <input
                                      type="text"
                                      value={row[k] ?? ""}
                                      onChange={(e) => handleTableChange("definitiveDiagnosisTable", idx, k, e.target.value)}
                                      placeholder={placeholders[j]}
                                      className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                                    />
                                  </td>
                                ))}
                                <td className="p-2">
                                  {diffDays !== null ? (
                                    <span className={`text-[11.5px] font-bold px-1.5 py-0.5 rounded ${
                                      diffDays <= 0 ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" :
                                      diffDays <= 30 ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" :
                                      diffDays <= 180 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" :
                                      "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300"
                                    }`}>
                                      {formatDuration(diffDays)}
                                    </span>
                                  ) : (
                                    <span className="text-[11.5px] text-slate-400 italic">—</span>
                                  )}
                                </td>
                                <td className="p-2 text-right">
                                  <button type="button" onClick={() => removeRow("definitiveDiagnosisTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20 transition">
                                    <Trash className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {diagnosisRows.length === 0 && (
                            <tr>
                              <td colSpan={5} className="text-center py-4 text-slate-400 text-[11.5px]">
                                No diagnosis records yet — click "Add Diagnosis" to begin.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {firstComplaintDate && (
                      <div className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400 text-right">
                        First complaint date: <strong>{firstComplaintDate}</strong>
                      </div>
                    )}
                  </div>
                );
              })()}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* Collapsible Section 3: Diagnostic Investigations (Blood, Imaging, Biopsy Tables) */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("investigations")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.investigations ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-blue-500/10 dark:bg-blue-400/20 text-blue-700 dark:text-blue-200 flex items-center justify-center"><FlaskConical className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Medical Investigations & Laboratory Audits</h3>
              <SectionUploadActions section="investigations" label="Medical Investigations and Laboratory Audits" />
            </div>
            {openSections.investigations ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.investigations && (
            <div className="p-5 space-y-8 text-xs text-slate-700 dark:text-slate-350">

              {/* Dynamic Blood Table with drop-down parameters */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="h-subsection">Other Investigations</h4>
                  <button
                    type="button"
                    onClick={() => addRow("bloodTable", { blood_type: "", blood_purpose: "", blood_date: "", blood_findings: "", blood_notes: "" })}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline"
                  >
                    <CirclePlus className="h-3.5 w-3.5" />
                    <span>Add Blood test row</span>
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/85 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Maturity / Marker Parameter</th>
                        <th className="p-2.5">Date Done</th>
                        <th className="p-2.5">Purpose Directive</th>
                        <th className="p-2.5">Clinical Findings / Metrics</th>
                        <th className="p-2.5">Notes</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      {formState.bloodTable?.map((row, idx) => (
                        <tr key={idx} className={row.blood_findings ? "ai-priority-row" : ""}>
                          <td className="p-2">
                            <input type="text" value={row.blood_type} onChange={(e) => handleTableChange("bloodTable", idx, "blood_type", e.target.value)} placeholder="e.g. Hemoglobin (Hb)" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.blood_type ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="date" value={row.blood_date} onChange={(e) => handleTableChange("bloodTable", idx, "blood_date", e.target.value)} className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.blood_date ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.blood_purpose} onChange={(e) => handleTableChange("bloodTable", idx, "blood_purpose", e.target.value)} placeholder="e.g. Diagnosis" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.blood_purpose ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.blood_findings} onChange={(e) => handleTableChange("bloodTable", idx, "blood_findings", e.target.value)} placeholder="e.g. Hb 12.5 g/dL" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.blood_findings ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.blood_notes} onChange={(e) => handleTableChange("bloodTable", idx, "blood_notes", e.target.value)} placeholder="General comments" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.blood_notes ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={() => removeRow("bloodTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formState.bloodTable || formState.bloodTable.length === 0) && (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-slate-400 text-[11.5px]">No lab metrics recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tumor Markers Table (CEA, AFP, CA 19-9, CA 125, PSA, etc.) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="h-subsection">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mr-2 align-middle" />Tumor Markers (CEA, AFP, CA 19-9, CA 125, PSA, LDH…)
                  </h4>
                  <button
                    type="button"
                    onClick={() => addRow("tumorMarkersTable", { marker_name: "", marker_value: "", marker_unit: "", marker_date: "", marker_purpose: "", marker_ref_range: "", marker_notes: "" })}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline"
                  >
                    <CirclePlus className="h-3.5 w-3.5" />
                    <span>Add Tumor Marker Row</span>
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/85 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Marker</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Purpose</th>
                        <th className="p-2.5">Value</th>
                        <th className="p-2.5">Unit</th>
                        <th className="p-2.5">Reference Range</th>
                        <th className="p-2.5">Notes</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      {formState.tumorMarkersTable?.map((row, idx) => (
                        <tr key={idx} className={row.marker_value ? "ai-priority-row" : ""}>
                          <td className="p-2">
                            <input type="text" value={row.marker_name} onChange={(e) => handleTableChange("tumorMarkersTable", idx, "marker_name", e.target.value)} placeholder="e.g. CEA" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.marker_name ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="date" value={row.marker_date} onChange={(e) => handleTableChange("tumorMarkersTable", idx, "marker_date", e.target.value)} className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.marker_date ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.marker_purpose} onChange={(e) => handleTableChange("tumorMarkersTable", idx, "marker_purpose", e.target.value)} placeholder="Diagnosis / Follow up / Prognosis" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.marker_purpose ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.marker_value} onChange={(e) => handleTableChange("tumorMarkersTable", idx, "marker_value", e.target.value)} placeholder="e.g. 4.8" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold ${row.marker_value ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.marker_unit} onChange={(e) => handleTableChange("tumorMarkersTable", idx, "marker_unit", e.target.value)} placeholder="ng/mL" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.marker_unit ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.marker_ref_range} onChange={(e) => handleTableChange("tumorMarkersTable", idx, "marker_ref_range", e.target.value)} placeholder="< 5.0" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.marker_ref_range ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.marker_notes} onChange={(e) => handleTableChange("tumorMarkersTable", idx, "marker_notes", e.target.value)} placeholder="Trend / context" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.marker_notes ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={() => removeRow("tumorMarkersTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formState.tumorMarkersTable || formState.tumorMarkersTable.length === 0) && (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-slate-400 text-[11.5px]">No tumor markers recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Imaging Findings Table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="h-subsection">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mr-2 align-middle" />Imaging
                  </h4>
                  <button
                    type="button"
                    onClick={() => addRow("imagingTable", { imaging_type: "CT Chest/Abdomen", imaging_purpose: "Diagnosis", imaging_date: "", imaging_parameter: "", imaging_findings: "", mass_present: "", mass_size: "", mass_location: "", calcifications: "", lymph_nodes: "", metastasis: "", ascites: "", pv_status: "", sma_status: "" })}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline"
                  >
                    <CirclePlus className="h-3.5 w-3.5" />
                    <span>Add Imaging Study</span>
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/85 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Study Modality</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Clinical Purpose</th>
                        <th className="p-2.5">Target Parameter / Site</th>
                        <th className="p-2.5">Impression & Findings</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      {formState.imagingTable?.map((row, idx) => (
                        <>
                          <tr key={idx} className={row.imaging_findings ? "ai-priority-row" : ""}>
                            <td className="p-2">
                              <input type="text" value={row.imaging_type} onChange={(e) => handleTableChange("imagingTable", idx, "imaging_type", e.target.value)} placeholder="e.g. CT Chest/Abdomen" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.imaging_type ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="date" value={row.imaging_date} onChange={(e) => handleTableChange("imagingTable", idx, "imaging_date", e.target.value)} className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.imaging_date ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.imaging_purpose} onChange={(e) => handleTableChange("imagingTable", idx, "imaging_purpose", e.target.value)} placeholder="e.g. Diagnosis" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.imaging_purpose ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.imaging_parameter} onChange={(e) => handleTableChange("imagingTable", idx, "imaging_parameter", e.target.value)} placeholder="e.g. Left hepatic margins" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.imaging_parameter ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.imaging_findings} onChange={(e) => handleTableChange("imagingTable", idx, "imaging_findings", e.target.value)} placeholder="CT reports details..." className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.imaging_findings ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2 text-right align-top">
                              <button type="button" onClick={() => removeRow("imagingTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                          <tr className="bg-blue-50/30 dark:bg-blue-950/10">
                            <td colSpan={6} className="p-2.5">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11.5px]">
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Mass Present</span>
                                  <input type="text" value={row.mass_present} onChange={(e) => handleTableChange("imagingTable", idx, "mass_present", e.target.value)} placeholder="yes / no / indeterminate" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.mass_present ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Mass Size</span>
                                  <input type="text" value={row.mass_size} onChange={(e) => handleTableChange("imagingTable", idx, "mass_size", e.target.value)} placeholder="e.g. 3.2 x 2.8 cm" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.mass_size ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Mass Location</span>
                                  <input type="text" value={row.mass_location} onChange={(e) => handleTableChange("imagingTable", idx, "mass_location", e.target.value)} placeholder="anatomical site" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.mass_location ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Calcifications</span>
                                  <input type="text" value={row.calcifications} onChange={(e) => handleTableChange("imagingTable", idx, "calcifications", e.target.value)} placeholder="present / absent / pattern" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.calcifications ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Lymph Nodes</span>
                                  <input type="text" value={row.lymph_nodes} onChange={(e) => handleTableChange("imagingTable", idx, "lymph_nodes", e.target.value)} placeholder="status, size, station" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.lymph_nodes ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Metastasis</span>
                                  <input type="text" value={row.metastasis} onChange={(e) => handleTableChange("imagingTable", idx, "metastasis", e.target.value)} placeholder="sites, e.g. liver, lung" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.metastasis ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Ascites</span>
                                  <input type="text" value={row.ascites} onChange={(e) => handleTableChange("imagingTable", idx, "ascites", e.target.value)} placeholder="present / absent / volume" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.ascites ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Portal Vein / SMA</span>
                                  <input type="text" value={row.pv_status} onChange={(e) => handleTableChange("imagingTable", idx, "pv_status", e.target.value)} placeholder="PV: patent / involved" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.pv_status ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5 md:col-span-3">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">SMA Status</span>
                                  <input type="text" value={row.sma_status} onChange={(e) => handleTableChange("imagingTable", idx, "sma_status", e.target.value)} placeholder="encasement / involvement / clear" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.sma_status ? "ai-priority-text" : ""}`} />
                                </label>
                              </div>
                            </td>
                          </tr>
                        </>
                      ))}
                      {(!formState.imagingTable || formState.imagingTable.length === 0) && (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-slate-400 text-[11.5px]">No imaging scans registered yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Biopsy Histology / Pathology Staging */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="h-subsection">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mr-2 align-middle" />Biopsy & Histopathology
                  </h4>
                  <button
                    type="button"
                    onClick={() => addRow("biopsyTable", { biopsy_type: "True-cut Biopsy", biopsy_purpose: "confirmation", biopsy_date: "", biopsy_parameter: "", biopsy_findings: "", biopsy_stage: "", lvi: "", perineural_invasion: "", margin_status: "", cell_type: "", metastasis: "", lymph_nodes: "" })}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline"
                  >
                    <CirclePlus className="h-3.5 w-3.5" />
                    <span>Add Biopsy entry</span>
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/85 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Biopsy Methodology</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Purpose</th>
                        <th className="p-2.5">Anatomical Site</th>
                        <th className="p-2.5">Tumor Grade / Findings</th>
                        <th className="p-2.5">Histology subtype / Stage</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      {formState.biopsyTable?.map((row, idx) => (
                        <>
                          <tr key={idx} className={row.biopsy_findings ? "ai-priority-row" : ""}>
                            <td className="p-2">
                              <input type="text" value={row.biopsy_type} onChange={(e) => handleTableChange("biopsyTable", idx, "biopsy_type", e.target.value)} placeholder="e.g. Core Needle" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.biopsy_type ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="date" value={row.biopsy_date} onChange={(e) => handleTableChange("biopsyTable", idx, "biopsy_date", e.target.value)} className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.biopsy_date ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.biopsy_purpose} onChange={(e) => handleTableChange("biopsyTable", idx, "biopsy_purpose", e.target.value)} placeholder="Diagnosis / Confirmation / Grading" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.biopsy_purpose ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.biopsy_parameter} onChange={(e) => handleTableChange("biopsyTable", idx, "biopsy_parameter", e.target.value)} placeholder="e.g. Left breast tissue margins" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.biopsy_parameter ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.biopsy_findings} onChange={(e) => handleTableChange("biopsyTable", idx, "biopsy_findings", e.target.value)} placeholder="Invasive Ductal Carcinoma Grade II" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.biopsy_findings ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.biopsy_stage} onChange={(e) => handleTableChange("biopsyTable", idx, "biopsy_stage", e.target.value)} placeholder="ER+/PR+ Her2 negative" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.biopsy_stage ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2 text-right align-top">
                              <button type="button" onClick={() => removeRow("biopsyTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                          <tr className="bg-blue-50/30 dark:bg-blue-950/10">
                            <td colSpan={7} className="p-2.5">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11.5px]">
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Cell Type</span>
                                  <input type="text" value={row.cell_type} onChange={(e) => handleTableChange("biopsyTable", idx, "cell_type", e.target.value)} placeholder="e.g. Adenocarcinoma" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.cell_type ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Margin Status</span>
                                  <input type="text" value={row.margin_status} onChange={(e) => handleTableChange("biopsyTable", idx, "margin_status", e.target.value)} placeholder="clear / involved / close" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.margin_status ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">LVI</span>
                                  <input type="text" value={row.lvi} onChange={(e) => handleTableChange("biopsyTable", idx, "lvi", e.target.value)} placeholder="present / absent" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.lvi ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Perineural Invasion</span>
                                  <input type="text" value={row.perineural_invasion} onChange={(e) => handleTableChange("biopsyTable", idx, "perineural_invasion", e.target.value)} placeholder="present / absent" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.perineural_invasion ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Metastasis</span>
                                  <input type="text" value={row.metastasis} onChange={(e) => handleTableChange("biopsyTable", idx, "metastasis", e.target.value)} placeholder="sites, e.g. liver" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.metastasis ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Lymph Nodes</span>
                                  <input type="text" value={row.lymph_nodes} onChange={(e) => handleTableChange("biopsyTable", idx, "lymph_nodes", e.target.value)} placeholder="positive/total, station" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.lymph_nodes ? "ai-priority-text" : ""}`} />
                                </label>
                              </div>
                            </td>
                          </tr>
                        </>
                      ))}
                      {(!formState.biopsyTable || formState.biopsyTable.length === 0) && (
                        <tr>
                          <td colSpan={7} className="text-center py-4 text-slate-400 text-[11.5px]">No biopsy reports logged yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Immunohistochemistry (IHC) Stains Table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="h-subsection">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mr-2 align-middle" />IHC
                  </h4>
                  <button
                    type="button"
                    onClick={() => addRow("immunohistochemistryTable", { ihc_specimen: "", ihc_panel: "", ihc_marker: "", ihc_result: "", ihc_intensity: "", ihc_percentage: "", ihc_score: "", ihc_pattern: "", ihc_method: "IHC", ihc_date: "", ihc_purpose: "", ihc_lab: "", ihc_pathologist: "", ihc_interpretation: "", ihc_notes: "" })}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline"
                  >
                    <CirclePlus className="h-3.5 w-3.5" />
                    <span>Add IHC Stain</span>
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/85 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Marker (Stain)</th>
                        <th className="p-2.5">Result</th>
                        <th className="p-2.5">Intensity</th>
                        <th className="p-2.5">% Cells</th>
                        <th className="p-2.5">Score</th>
                        <th className="p-2.5">Pattern</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      {formState.immunohistochemistryTable?.map((row, idx) => (
                        <>
                          <tr key={idx} className={row.ihc_marker || row.ihc_interpretation ? "ai-priority-row" : ""}>
                            <td className="p-2">
                              <input list="ihc-marker-list" type="text" value={row.ihc_marker} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_marker", e.target.value)} placeholder="e.g. ER / PR / HER2 / Ki-67 / PD-L1" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold ${row.ihc_marker ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.ihc_result} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_result", e.target.value)} placeholder="e.g. Positive / Negative" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.ihc_result ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.ihc_intensity} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_intensity", e.target.value)} placeholder="e.g. 3+ / Strong" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.ihc_intensity ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.ihc_percentage} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_percentage", e.target.value)} placeholder="e.g. 80%" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold ${row.ihc_percentage ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.ihc_score} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_score", e.target.value)} placeholder="Allred / H-score / CPS / FISH" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold ${row.ihc_score ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2">
                              <input type="text" value={row.ihc_pattern} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_pattern", e.target.value)} placeholder="membranous / nuclear" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.ihc_pattern ? "ai-priority-text" : ""}`} />
                            </td>
                            <td className="p-2 text-right align-top">
                              <button type="button" onClick={() => removeRow("immunohistochemistryTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                          <tr className="bg-blue-50/30 dark:bg-blue-950/10">
                            <td colSpan={7} className="p-2.5">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11.5px]">
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Panel</span>
                                  <input list="ihc-panel-list" type="text" value={row.ihc_panel} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_panel", e.target.value)} placeholder="e.g. Breast panel" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.ihc_panel ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Method</span>
                                  <input list="ihc-method-list" type="text" value={row.ihc_method} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_method", e.target.value)} placeholder="IHC / FISH / NGS" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.ihc_method ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Purpose</span>
                                  <input type="text" value={row.ihc_purpose} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_purpose", e.target.value)} placeholder="Diagnosis / Subtyping / Prognosis" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.ihc_purpose ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Date</span>
                                  <input type="date" value={row.ihc_date} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_date", e.target.value)} className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.ihc_date ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Specimen / Block</span>
                                  <input type="text" value={row.ihc_specimen} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_specimen", e.target.value)} placeholder="e.g. Cell block, Core biopsy" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.ihc_specimen ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5 md:col-span-2">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-600 mr-1 align-middle" />Interpretation
                                  </span>
                                  <input type="text" value={row.ihc_interpretation} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_interpretation", e.target.value)} placeholder="e.g. Luminal A-like / TNBC / dMMR-MSI-high" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] font-bold ${row.ihc_interpretation ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Lab / Hospital</span>
                                  <input type="text" value={row.ihc_lab} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_lab", e.target.value)} placeholder="Lab name" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.ihc_lab ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Pathologist</span>
                                  <input type="text" value={row.ihc_pathologist} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_pathologist", e.target.value)} placeholder="Dr. …" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.ihc_pathologist ? "ai-priority-text" : ""}`} />
                                </label>
                                <label className="flex flex-col gap-0.5 md:col-span-4">
                                  <span className="font-semibold text-slate-500 dark:text-slate-400">Notes (clone, controls, etc.)</span>
                                  <input type="text" value={row.ihc_notes} onChange={(e) => handleTableChange("immunohistochemistryTable", idx, "ihc_notes", e.target.value)} placeholder="Clone, dilution, controls, additional context" className={`w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px] ${row.ihc_notes ? "ai-priority-text" : ""}`} />
                                </label>
                              </div>
                            </td>
                          </tr>
                        </>
                      ))}
                      {(!formState.immunohistochemistryTable || formState.immunohistochemistryTable.length === 0) && (
                        <tr>
                          <td colSpan={7} className="text-center py-4 text-slate-400 text-[11.5px]">No IHC stains logged yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <datalist id="ihc-marker-list">
                  <option value="ER (Estrogen Receptor)" />
                  <option value="PR (Progesterone Receptor)" />
                  <option value="HER2/neu" />
                  <option value="Ki-67 / MIB-1" />
                  <option value="EGFR" />
                  <option value="PD-L1 (22C3)" />
                  <option value="PD-L1 (SP142)" />
                  <option value="PD-L1 (SP263)" />
                  <option value="PD-L1 (28-8)" />
                  <option value="MLH1" />
                  <option value="MSH2" />
                  <option value="MSH6" />
                  <option value="PMS2" />
                  <option value="CD20" />
                  <option value="CD3" />
                  <option value="CD5" />
                  <option value="CD10" />
                  <option value="CD15" />
                  <option value="CD30" />
                  <option value="CD45 / LCA" />
                  <option value="CD79a" />
                  <option value="BCL2" />
                  <option value="BCL6" />
                  <option value="MUM1 / IRF4" />
                  <option value="CD117 / c-KIT" />
                  <option value="DOG1" />
                  <option value="CD34" />
                  <option value="S100" />
                  <option value="SOX10" />
                  <option value="HMB45" />
                  <option value="Melan-A / MART-1" />
                  <option value="TTF-1" />
                  <option value="Napsin A" />
                  <option value="p40" />
                  <option value="p63" />
                  <option value="CK5/6" />
                  <option value="CK7" />
                  <option value="CK20" />
                  <option value="CDX2" />
                  <option value="GATA3" />
                  <option value="GCDFP-15" />
                  <option value="PSA" />
                  <option value="PSAP" />
                  <option value="NKX3.1" />
                  <option value="PAX8" />
                  <option value="WT1" />
                  <option value="CA-IX" />
                  <option value="HepPar-1" />
                  <option value="Glypican-3" />
                  <option value="AFP" />
                  <option value="Calretinin" />
                  <option value="D2-40 / Podoplanin" />
                  <option value="EMA" />
                  <option value="Synaptophysin" />
                  <option value="Chromogranin A" />
                  <option value="CD56 / NCAM" />
                  <option value="NSE" />
                  <option value="GFAP" />
                  <option value="IDH1 R132H" />
                  <option value="ATRX" />
                  <option value="p53" />
                  <option value="1p/19q" />
                  <option value="MGMT" />
                  <option value="Beta-catenin" />
                  <option value="E-cadherin" />
                  <option value="ALK (D5F3)" />
                  <option value="ROS1" />
                  <option value="BRAF V600E" />
                  <option value="PD-1" />
                  <option value="CD8" />
                  <option value="FOXP3" />
                  <option value="INI-1 / SMARCB1" />
                  <option value="BRG1 / SMARCA4" />
                  <option value="Pan-CK (AE1/AE3)" />
                </datalist>
                <datalist id="ihc-panel-list">
                  <option value="Breast panel" />
                  <option value="Lymphoma panel" />
                  <option value="MMR / MSI panel" />
                  <option value="PD-L1 panel" />
                  <option value="GI panel" />
                  <option value="GIST panel" />
                  <option value="Melanoma panel" />
                  <option value="Neuroendocrine panel" />
                  <option value="Glioma panel" />
                  <option value="Lung panel" />
                  <option value="Gynecologic panel" />
                  <option value="Prostate panel" />
                  <option value="HCC panel" />
                  <option value="Mesothelioma panel" />
                </datalist>
                <datalist id="ihc-method-list">
                  <option value="IHC" />
                  <option value="FISH" />
                  <option value="CISH" />
                  <option value="SISH" />
                  <option value="NGS" />
                  <option value="PCR" />
                </datalist>
              </div>

              {/* Genetic / Molecular Testing Table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="h-subsection">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mr-2 align-middle" />Genetic / Molecular Testing
                  </h4>
                  <button
                    type="button"
                    onClick={() => addRow("geneticTable", { test_name: "", gene: "", variant: "", result: "", method: "", date: "", purpose: "", notes: "" })}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline"
                  >
                    <CirclePlus className="h-3.5 w-3.5" />
                    <span>Add Genetic Test</span>
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/85 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Test Name</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Purpose</th>
                        <th className="p-2.5">Gene</th>
                        <th className="p-2.5">Variant / Alteration</th>
                        <th className="p-2.5">Result</th>
                        <th className="p-2.5">Method</th>
                        <th className="p-2.5">Notes</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      {formState.geneticTable?.map((row, idx) => (
                        <tr key={idx} className={row.test_name || row.gene ? "ai-priority-row" : ""}>
                          <td className="p-2">
                            <input type="text" value={row.test_name} onChange={(e) => handleTableChange("geneticTable", idx, "test_name", e.target.value)} placeholder="e.g. NGS Panel / BRCA1/2" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold ${row.test_name ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="date" value={row.date} onChange={(e) => handleTableChange("geneticTable", idx, "date", e.target.value)} className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.date ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.purpose} onChange={(e) => handleTableChange("geneticTable", idx, "purpose", e.target.value)} placeholder="Diagnosis / Therapy Selection / Risk" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.purpose ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.gene} onChange={(e) => handleTableChange("geneticTable", idx, "gene", e.target.value)} placeholder="e.g. EGFR / KRAS / BRCA1" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.gene ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.variant} onChange={(e) => handleTableChange("geneticTable", idx, "variant", e.target.value)} placeholder="e.g. Exon 19 del / G12C" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.variant ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.result} onChange={(e) => handleTableChange("geneticTable", idx, "result", e.target.value)} placeholder="e.g. Positive / Detected" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.result ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.method} onChange={(e) => handleTableChange("geneticTable", idx, "method", e.target.value)} placeholder="NGS / PCR / FISH" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.method ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.notes} onChange={(e) => handleTableChange("geneticTable", idx, "notes", e.target.value)} placeholder="Optional notes" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.notes ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={() => removeRow("geneticTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formState.geneticTable || formState.geneticTable.length === 0) && (
                        <tr>
                          <td colSpan={9} className="text-center py-4 text-slate-400 text-[11.5px]">No genetic tests logged yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Endoscopy table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="h-subsection">Endoscopy Parameters Table</h4>
                  <button
                    type="button"
                    onClick={() => addRow("endoscopyTable", { endo_type: "Colonoscopy", endo_purpose: "Diagnosis", endo_date: "", endo_parameter: "", endo_findings: "" })}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline"
                  >
                    <CirclePlus className="h-3.5 w-3.5" />
                    <span>Add Endoscopy study</span>
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/85 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Endoscopy Target Type</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Clinical Purpose</th>
                        <th className="p-2.5">Visual Parameters</th>
                        <th className="p-2.5">Mucosal Findings</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      {formState.endoscopyTable?.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-2">
                            <input type="text" value={row.endo_type} onChange={(e) => handleTableChange("endoscopyTable", idx, "endo_type", e.target.value)} placeholder="e.g. colonoscopy/bronchoscopy" className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </td>
                          <td className="p-2">
                            <input type="date" value={row.endo_date} onChange={(e) => handleTableChange("endoscopyTable", idx, "endo_date", e.target.value)} className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.endo_purpose} onChange={(e) => handleTableChange("endoscopyTable", idx, "endo_purpose", e.target.value)} className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.endo_parameter} onChange={(e) => handleTableChange("endoscopyTable", idx, "endo_parameter", e.target.value)} placeholder="e.g. gastric folds" className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.endo_findings} onChange={(e) => handleTableChange("endoscopyTable", idx, "endo_findings", e.target.value)} placeholder="Strictures or ulcerative masses..." className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={() => removeRow("endoscopyTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formState.endoscopyTable || formState.endoscopyTable.length === 0) && (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-slate-400 text-[11.5px]">No endoscopy findings logged.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Contrast Studies Table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="h-subsection">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mr-2 align-middle" />Contrast Studies
                  </h4>
                  <button
                    type="button"
                    onClick={() => addRow("contrastTable", { study_type: "", contrast_agent: "", body_part: "", findings: "", date: "", purpose: "", notes: "" })}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline"
                  >
                    <CirclePlus className="h-3.5 w-3.5" />
                    <span>Add Contrast Study</span>
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/85 rounded-xl">
                  <table className="w-full text-left">
                     <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Study Type</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Purpose</th>
                        <th className="p-2.5">Contrast Agent</th>
                        <th className="p-2.5">Body Part</th>
                        <th className="p-2.5">Findings</th>
                        <th className="p-2.5">Notes</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      {formState.contrastTable?.map((row, idx) => (
                        <tr key={idx} className={row.study_type || row.findings ? "ai-priority-row" : ""}>
                          <td className="p-2">
                            <input type="text" value={row.study_type} onChange={(e) => handleTableChange("contrastTable", idx, "study_type", e.target.value)} placeholder="e.g. CT Angio / IVP" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.study_type ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="date" value={row.date} onChange={(e) => handleTableChange("contrastTable", idx, "date", e.target.value)} className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.date ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.purpose} onChange={(e) => handleTableChange("contrastTable", idx, "purpose", e.target.value)} placeholder="Diagnosis / Staging / Follow up" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.purpose ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.contrast_agent} onChange={(e) => handleTableChange("contrastTable", idx, "contrast_agent", e.target.value)} placeholder="e.g. Iodinated / Gadolinium" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.contrast_agent ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.findings} onChange={(e) => handleTableChange("contrastTable", idx, "findings", e.target.value)} placeholder="e.g. Enhancing mass / Normal" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.findings ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.notes} onChange={(e) => handleTableChange("contrastTable", idx, "notes", e.target.value)} placeholder="Optional notes" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.notes ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={() => removeRow("contrastTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formState.contrastTable || formState.contrastTable.length === 0) && (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-slate-400 text-[11.5px]">No contrast studies logged yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Other Investigations Table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="h-subsection">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mr-2 align-middle" />Miscellaneous Investigations
                  </h4>
                  <button
                    type="button"
                    onClick={() => addRow("otherInvTable", { otherinv_type: "", otherinv_purpose: "", otherinv_date: "", otherinv_parameter: "", otherinv_findings: "" })}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline"
                  >
                    <CirclePlus className="h-3.5 w-3.5" />
                    <span>Add Other Investigation</span>
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/85 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Investigation Type</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Purpose</th>
                        <th className="p-2.5">Parameter</th>
                        <th className="p-2.5">Findings</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      {formState.otherInvTable?.map((row, idx) => (
                        <tr key={idx} className={row.otherinv_type || row.otherinv_findings ? "ai-priority-row" : ""}>
                          <td className="p-2">
                            <input type="text" value={row.otherinv_type} onChange={(e) => handleTableChange("otherInvTable", idx, "otherinv_type", e.target.value)} placeholder="e.g. ECG / PFT / EEG" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.otherinv_type ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="date" value={row.otherinv_date} onChange={(e) => handleTableChange("otherInvTable", idx, "otherinv_date", e.target.value)} className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.otherinv_date ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.otherinv_purpose} onChange={(e) => handleTableChange("otherInvTable", idx, "otherinv_purpose", e.target.value)} placeholder="Diagnosis / Monitoring / Follow up" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.otherinv_purpose ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="date" value={row.otherinv_date} onChange={(e) => handleTableChange("otherInvTable", idx, "otherinv_date", e.target.value)} className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.otherinv_date ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.otherinv_parameter} onChange={(e) => handleTableChange("otherInvTable", idx, "otherinv_parameter", e.target.value)} placeholder="e.g. FEV1/FVC ratio" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.otherinv_parameter ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.otherinv_findings} onChange={(e) => handleTableChange("otherInvTable", idx, "otherinv_findings", e.target.value)} placeholder="e.g. Normal / Abnormal" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.otherinv_findings ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2 text-right">
                            <button type="button" onClick={() => removeRow("otherInvTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formState.otherInvTable || formState.otherInvTable.length === 0) && (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-slate-400 text-[11.5px]">No other investigations logged yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tumor overall TNM Stage details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 dark:border-slate-700 pt-4 bg-slate-50 dark:bg-slate-900/10 p-4 rounded-xl">
                <div>
                  <label className="block font-semibold mb-1 text-blue-600 dark:text-blue-400">TNM Stages Designation</label>
                  <input
                    type="text"
                    name="tnm_stage"
                    value={formState.tnm_stage}
                    onChange={handleInputChange}
                    placeholder="e.g. T2 N1 M0"
                    className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900/60 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-indigo-600 dark:text-indigo-400">Overall Tumor Stage</label>
                  <input type="text" name="overall_stage" value={formState.overall_stage || ""} onChange={handleInputChange} placeholder="e.g. Stage IIB / T2N1M0" className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold" />
                </div>
                <div>
                  <label className="block font-semibold mb-1 dark:text-slate-400">Provisional Diagnosis summary</label>
                  <input
                    type="text"
                    name="provisional_diagnosis"
                    value={formState.provisional_diagnosis}
                    onChange={handleInputChange}
                    placeholder="e.g. Malignant Neoplasm of lung"
                    className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Tumour Characteristics */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("tumorCharacteristics")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.tumorCharacteristics ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-violet-500/10 dark:bg-violet-400/20 text-violet-700 dark:text-violet-200 flex items-center justify-center">
                <Dna className="h-3.5 w-3.5" />
              </span>
              <h3 className="h-section">Tumour Characteristics</h3>
              <SectionUploadActions section="tumorCharacteristics" label="Tumour Characteristics" />
            </div>
            {openSections.tumorCharacteristics ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.tumorCharacteristics && (
            <div className="p-5 text-xs text-slate-700 dark:text-slate-350 space-y-5">
              <div className="flex justify-between items-center">
                <p className="text-[11.5px] text-slate-500">Add one complete characteristics group for each primary cancer site.</p>
                <button type="button" onClick={() => addRow("tumorCharacteristicsTable", tableTemplates.tumorCharacteristicsTable)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-violet-600 hover:underline">
                  <CirclePlus className="h-3.5 w-3.5" /> Add Primary Cancer Site
                </button>
              </div>

              {(formState.tumorCharacteristicsTable || []).map((row, idx) => (
                <div key={idx} className="rounded-2xl border-2 border-violet-200 dark:border-violet-800 overflow-hidden">
                  <div className="flex justify-between items-center p-3 bg-violet-50 dark:bg-violet-950/30">
                    <h4 className="font-bold text-violet-800 dark:text-violet-200">
                      Tumour Sites {idx + 1}{row.tumour_sites ? `: ${row.tumour_sites}` : ""}
                    </h4>
                    <button type="button" onClick={() => removeRow("tumorCharacteristicsTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block font-semibold mb-1">Tumour Site</label>
                      <select
                        value={row.tumour_sites && !Object.values(TUMOUR_SITE_CATEGORIES).flat().includes(row.tumour_sites) ? "__custom__" : row.tumour_sites}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleTableChange("tumorCharacteristicsTable", idx, "tumour_sites", val === "__custom__" ? "" : val);
                          handleTableChange("tumorCharacteristicsTable", idx, "histological_type_parameter", "");
                          handleTableChange("tumorCharacteristicsTable", idx, "histological_type", "");
                        }}
                        className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                      >
                        <option value="">Select tumour site…</option>
                        {Object.entries(TUMOUR_SITE_CATEGORIES).map(([category, sites]) => (
                          <optgroup key={category} label={category}>
                            {sites.map(site => (
                              <option key={site} value={site}>{site}</option>
                            ))}
                          </optgroup>
                        ))}
                        <option value="__custom__">Other / Custom…</option>
                      </select>
                      {row.tumour_sites && !Object.values(TUMOUR_SITE_CATEGORIES).flat().includes(row.tumour_sites) && (
                        <input
                          type="text"
                          value={row.tumour_sites}
                          onChange={(e) => {
                            handleTableChange("tumorCharacteristicsTable", idx, "tumour_sites", e.target.value);
                            handleTableChange("tumorCharacteristicsTable", idx, "histological_type_parameter", "");
                            handleTableChange("tumorCharacteristicsTable", idx, "histological_type", "");
                          }}
                          placeholder="Enter custom tumour site"
                          className="w-full mt-2 p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                        />
                      )}
                    </div>

                    {row.tumour_sites && (
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">

                        {/* === MACROSCOPIC PANE === */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <button type="button" onClick={() => toggleTumorPane(`${idx}-macro`)}
                            className="flex items-center justify-between w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors text-left">
                            <span className="flex items-center gap-2 font-semibold text-sm text-slate-700 dark:text-slate-300">
                              <Ruler className="h-4 w-4 text-emerald-600" /> Macroscopic (Gross Pathology)
                            </span>
                            {tumorPanes[`${idx}-macro`] !== false ? <ArrowUp className="h-3.5 w-3.5 text-slate-400" /> : <ArrowDown className="h-3.5 w-3.5 text-slate-400" />}
                          </button>
                          {tumorPanes[`${idx}-macro`] !== false && (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {([
                                ["laterality", "Laterality", ["Right", "Left", "Bilateral", "Midline", "Unilateral NOS", "Not applicable", "Unknown"]],
                                ["primary_count", "Number of Primary Tumors", ["Single primary", "Multifocal", "Multicentric", "Multiple primary tumours", "Unknown"]],
                                ["specimen_type", "Specimen Type", ["Core needle biopsy", "Incisional biopsy", "Excisional biopsy", "Lumpectomy", "Wide local excision", "Segmental resection", "Mastectomy", "Colectomy", "Nephrectomy", "Hysterectomy", "Cystectomy", "Pneumonectomy / Lobectomy", "Lymph node dissection", "Bone marrow trephine", "Cytology / FNAC", "Other"]],
                                ["sampling_confirmation", "Adequate Sampling Confirmation", ["Adequate - complete workup possible", "Limited but diagnostic", "Inadequate / insufficient tissue", "Repeat sampling required", "Not assessed"]],
                              ] as const).map(([name, label, options]) => (
                                <div key={name}>
                                  <label className="block font-semibold mb-1">{label}</label>
                                  <select value={row[name]} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, name, e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                    <option value="">Select</option>
                                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                </div>
                              ))}
                              <div className="md:col-span-2">
                                <label className="block font-semibold mb-1">Macroscopic (Gross) Features</label>
                                <textarea value={row.macroscopic_features} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "macroscopic_features", e.target.value)} placeholder="Gross description — size, shape, colour, consistency, necrosis, cystic changes, encapsulation" rows={2} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-y" />
                              </div>
                              <div className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                                <label className="block font-semibold mb-2">Tumour Size</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {([
                                    ["tumor_size_length", "Length"],
                                    ["tumor_size_width", "Width"],
                                    ["tumor_size_depth", "Depth"],
                                  ] as const).map(([name, label]) => (
                                    <div key={name}>
                                      <label className="block text-[11.5px] font-semibold mb-1">{label}</label>
                                      <input type="number" min="0" step="any" value={row[name]} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, name, e.target.value)} placeholder="0.0" className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                                    </div>
                                  ))}
                                  <div>
                                    <label className="block text-[11.5px] font-semibold mb-1">Unit</label>
                                    <select value={row.tumor_size_unit || "mm"} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "tumor_size_unit", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                      <option value="mm">mm</option>
                                      <option value="cm">cm</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* === MICROSCOPIC PANE === */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <button type="button" onClick={() => toggleTumorPane(`${idx}-micro`)}
                            className="flex items-center justify-between w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors text-left">
                            <span className="flex items-center gap-2 font-semibold text-sm text-slate-700 dark:text-slate-300">
                              <FlaskConical className="h-4 w-4 text-amber-600" /> Microscopic (Histopathology)
                            </span>
                            {tumorPanes[`${idx}-micro`] !== false ? <ArrowUp className="h-3.5 w-3.5 text-slate-400" /> : <ArrowDown className="h-3.5 w-3.5 text-slate-400" />}
                          </button>
                          {tumorPanes[`${idx}-micro`] !== false && (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {([
                                ["Histological Type", "histological_type_parameter", "histological_type", HISTOLOGY_TYPES.Other, "Enter subtype and ICD-O-3 morphology code"],
                                ["Cell Morphology Details", "cell_morphology_parameter", "cell_morphology", ["Conventional", "Papillary", "Mucinous", "Signet Ring Cell", "Clear Cell", "Spindle Cell", "Pleomorphic", "Micropapillary", "Cribriform", "Sarcomatoid", "Other"], "Enter subtype or morphological finding"],
                              ] as const).map(([label, parameter, value, options, placeholder]) => (
                                <div key={parameter} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                                  <label className="block font-semibold mb-1">{label}</label>
                                  <select
                                    value={row[parameter]}
                                    onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, parameter, e.target.value)}
                                    className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                                  >
                                    <option value="">Select parameter</option>
                                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                  {row[parameter] && <input type="text" value={row[value]} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, value, e.target.value)} placeholder={placeholder} className="w-full mt-2 p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />}
                                </div>
                              ))}
                              {([
                                ["histological_grade", "Histological Grade", ["G1 - Well differentiated", "G2 - Moderately differentiated", "G3 - Poorly differentiated", "G4 - Undifferentiated / Anaplastic", "Low grade", "Intermediate grade", "High grade", "Not applicable", "Unknown"]],
                                ["tumor_differentiation_status", "Tumour Differentiation Status", ["Well differentiated", "Moderately differentiated", "Poorly differentiated", "Undifferentiated / anaplastic", "Not applicable", "Unknown"]],
                              ] as const).map(([name, label, options]) => (
                                <div key={name}>
                                  <label className="block font-semibold mb-1">{label}</label>
                                  <select value={row[name]} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, name, e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                    <option value="">Select</option>
                                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                </div>
                              ))}
                              <div>
                                <label className="block font-semibold mb-1">Histological Info</label>
                                <input type="text" value={row.histological_info} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "histological_info", e.target.value)} placeholder="Additional histological details, subtype notes, ICD-O code" className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                              </div>
                              <div>
                                <label className="block font-semibold mb-1">Microscopic Size</label>
                                <input type="text" value={row.microscopic_size} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "microscopic_size", e.target.value)} placeholder="e.g. 2.1 cm (invasive focus)" className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block font-semibold mb-1">Microscopic Features</label>
                                <input type="text" value={row.microscopic_features} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "microscopic_features", e.target.value)} placeholder="Tubule formation, nuclear pleomorphism, growth pattern, stromal reaction" className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                              </div>
                              {([
                                ["lvi", "Lymphovascular Invasion (LVI)", ["Absent", "Present", "Suspected", "Not assessed"]],
                                ["perineural_invasion", "Perineural Invasion (PNI)", ["Absent", "Present", "Suspected", "Not assessed"]],
                                ["margin_status", "Margin Status", ["Negative", "Positive", "Close", "Not assessed"]],
                              ] as const).map(([name, label, options]) => (
                                <div key={name}>
                                  <label className="block font-semibold mb-1">{label}</label>
                                  <select value={row[name]} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, name, e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                    <option value="">Select</option>
                                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                </div>
                              ))}
                              {([
                                ["mitotic_rate", "Mitotic Rate", "e.g. 8 mitoses/10 HPF or 4/mm²"],
                                ["tumor_infiltrating_lymphocytes", "Tumour-Infiltrating Lymphocytes", "Percentage, density, or assessment"],
                                ["stroma_percentage", "Stroma Percentage", "0-100"],
                                ["tumor_associated_macrophages", "Tumour-Associated Macrophages", "Percentage, density, phenotype, or category"],
                              ] as const).map(([name, label, placeholder]) => (
                                <div key={name}>
                                  <label className="block font-semibold mb-1">{label}</label>
                                  <input
                                    type={name === "stroma_percentage" ? "number" : "text"}
                                    min={name === "stroma_percentage" ? "0" : undefined}
                                    max={name === "stroma_percentage" ? "100" : undefined}
                                    step={name === "stroma_percentage" ? "any" : undefined}
                                    value={row[name]}
                                    onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, name, e.target.value)}
                                    placeholder={placeholder}
                                    className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* === OTHER PANE === */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <button type="button" onClick={() => toggleTumorPane(`${idx}-other`)}
                            className="flex items-center justify-between w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors text-left">
                            <span className="flex items-center gap-2 font-semibold text-sm text-slate-700 dark:text-slate-300">
                              <Layers className="h-4 w-4 text-violet-600" /> Other (Staging, Molecular, Reporting)
                            </span>
                            {tumorPanes[`${idx}-other`] ? <ArrowUp className="h-3.5 w-3.5 text-slate-400" /> : <ArrowDown className="h-3.5 w-3.5 text-slate-400" />}
                          </button>
                          {tumorPanes[`${idx}-other`] && (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {([
                                ["Diagnostic Modality", "diagnostic_modality_parameter", "diagnostic_modality", ["Histopathology / Biopsy", "Cytology / FNAC", "Surgical Resection Specimen", "Imaging", "Endoscopy", "Bone Marrow Examination", "Molecular / Genetic Test", "Clinical Diagnosis", "Other"], "Enter method or findings"],
                                ["HPV / Viral Status", "viral_status_parameter", "viral_status", ["HPV", "EBV", "HBV", "HCV", "HHV-8", "HTLV-1", "Other"], "Enter status, type, load, or method"],
                              ] as const).map(([label, parameter, value, options, placeholder]) => (
                                <div key={parameter} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                                  <label className="block font-semibold mb-1">{label}</label>
                                  <select
                                    value={row[parameter]}
                                    onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, parameter, e.target.value)}
                                    className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                                  >
                                    <option value="">Select parameter</option>
                                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                  {row[parameter] && <input type="text" value={row[value]} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, value, e.target.value)} placeholder={placeholder} className="w-full mt-2 p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />}
                                </div>
                              ))}
                              {([
                                { title: "Molecular Markers", field: "molecular_markers_entries", options: ["KRAS", "NRAS", "BRAF", "EGFR", "ALK", "ROS1", "TP53", "BRCA1", "BRCA2", "MMR", "MSI", "TMB", "PIK3CA", "IDH1 / IDH2", "NTRK", "Other"], placeholder: "Variant, detected/not detected, score, or finding" },
                                { title: "Immunohistochemistry (IHC)", field: "immunohistochemistry_entries", options: ["PD-L1", "ER", "PR", "HER2", "Ki-67", "P53", "CK7", "CK20", "TTF-1", "PAX8", "GATA3", "CDX2", "PSA", "Other"], placeholder: "Result, intensity, percentage, CPS/TPS, or score" },
                                { title: "Genomic Testing", field: "genomic_testing_entries", options: ["Targeted NGS Panel", "Whole Exome Sequencing", "Whole Genome Sequencing", "Single-Gene Test", "FISH", "PCR", "Chromosomal / Cytogenetic Test", "Tumour Mutational Burden", "Other"], placeholder: "Test result, mutation, variant, or burden" },
                                { title: "Gene Expression Profiling", field: "gene_expression_profile_entries", options: ["Oncotype DX", "MammaPrint", "Prosigna / PAM50", "EndoPredict", "Intrinsic Subtype", "Risk Classification", "Other"], placeholder: "Score, subtype, or risk classification" },
                              ] as const).map((panel) => (
                                <div key={panel.field} className="md:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                                  <div className="flex items-center justify-between gap-3 mb-2">
                                    <label className="font-semibold">{panel.title}</label>
                                    <button type="button" onClick={() => addTumorFinding(idx, panel.field)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-natural-accent hover:underline">
                                      <CirclePlus className="h-3.5 w-3.5" /> Add Entry
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    {(row[panel.field] || []).map((entry, entryIndex) => (
                                      <div key={entryIndex} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_110px_auto] gap-2 items-center rounded-xl bg-slate-50/60 dark:bg-slate-900/30 p-2">
                                        <select value={entry.parameter} onChange={(e) => updateTumorFinding(idx, panel.field, entryIndex, "parameter", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                          <option value="">Select parameter</option>
                                          {panel.options.map((option) => <option key={option} value={option}>{option}</option>)}
                                        </select>
                                        <input type="text" value={entry.finding} onChange={(e) => updateTumorFinding(idx, panel.field, entryIndex, "finding", e.target.value)} placeholder={panel.placeholder} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                                        <select value={entry.source || "Manual"} onChange={(e) => updateTumorFinding(idx, panel.field, entryIndex, "source", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                          <option value="Manual">Manual</option>
                                          <option value="AI">AI</option>
                                        </select>
                                        <button type="button" onClick={() => removeTumorFinding(idx, panel.field, entryIndex)} className="text-rose-500 hover:text-rose-700 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/20">
                                          <Trash className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                    {(!row[panel.field] || row[panel.field].length === 0) && (
                                      <p className="text-[11.5px] text-slate-400">No entries yet. Add manually or populate through AI Fill.</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {([
                                ["synchronous_malignancy", "Synchronous Malignancy", ["Absent", "Present", "Suspected", "Unknown"]],
                                ["metachronous_malignancy", "Metachronous Malignancy", ["Absent", "Present - prior malignancy", "Present - subsequent malignancy", "Unknown"]],
                                ["risk_stratification", "Risk Stratification", ["Low risk", "Intermediate risk", "High risk", "Very high risk", "Not assessed", "Unknown"]],
                              ] as const).map(([name, label, options]) => (
                                <div key={name}>
                                  <label className="block font-semibold mb-1">{label}</label>
                                  <select value={row[name]} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, name, e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                    <option value="">Select</option>
                                    {options.map((option) => <option key={option} value={option}>{option}</option>)}
                                  </select>
                                </div>
                              ))}
                              <div>
                                <label className="block font-semibold mb-1">Genomic Risk Score</label>
                                <input type="text" value={row.genomic_risk_score} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "genomic_risk_score", e.target.value)} placeholder="Score, assay, scale, and interpretation" className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block font-semibold mb-1">Details of Nodal Metastasis</label>
                                <textarea value={row.nodal_metastasis_details} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "nodal_metastasis_details", e.target.value)} placeholder="Nodes examined/positive, location, size, extranodal extension, or other findings" rows={2} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-y" />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block font-semibold mb-1">Details of Distant Metastasis</label>
                                <textarea value={row.distant_metastasis_details} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "distant_metastasis_details", e.target.value)} placeholder="Site, extent, confirmation method, and relevant findings" rows={2} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-y" />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block font-semibold mb-1">Pathological Interpretation</label>
                                <textarea value={row.pathological_interpretation} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "pathological_interpretation", e.target.value)} placeholder="Integrated pathological diagnosis and interpretation" rows={2} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-y" />
                              </div>
                              <div>
                                <label className="block font-semibold mb-1">Pathology Reporting Status</label>
                                <select value={row.pathology_reporting_status} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "pathology_reporting_status", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                  <option value="">Select</option>
                                  {["Pending", "Preliminary", "Final", "Amended", "Supplementary / addendum", "Not available"].map((option) => <option key={option} value={option}>{option}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block font-semibold mb-1">Pathology Report Date</label>
                                <input type="date" value={row.pathology_reporting_date} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "pathology_reporting_date", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                              </div>
                              <div>
                                <label className="block font-semibold mb-1">Date of Diagnosis</label>
                                <input type="date" value={row.diagnosis_date} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "diagnosis_date", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block font-semibold mb-1">Tumor Biology Summary</label>
                                <textarea value={row.biology_summary} onChange={(e) => handleTableChange("tumorCharacteristicsTable", idx, "biology_summary", e.target.value)} placeholder="Integrate the histology, IHC, molecular, genomic, and viral findings for this tumour site" rows={3} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-y" />
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(!formState.tumorCharacteristicsTable || formState.tumorCharacteristicsTable.length === 0) && (
                <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                  No tumour sites added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clinical Staging */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("clinicalStaging")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.clinicalStaging ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-emerald-500/10 dark:bg-emerald-400/20 text-emerald-700 dark:text-emerald-200 flex items-center justify-center">
                <Activity className="h-3.5 w-3.5" />
              </span>
              <h3 className="h-section">Clinical Staging</h3>
              <SectionUploadActions section="clinicalStaging" label="Clinical Staging" />
            </div>
            {openSections.clinicalStaging ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.clinicalStaging && (
            <div className="p-5 text-xs text-slate-700 dark:text-slate-350 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[11.5px] text-slate-500">Record staging from any standard cancer staging system. Select a system to show the appropriate fields.</p>
                <button type="button" onClick={() => addRow("clinicalStagingTable", tableTemplates.clinicalStagingTable)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-600 hover:underline">
                  <CirclePlus className="h-3.5 w-3.5" /> Add Clinical Stage
                </button>
              </div>

              {(formState.clinicalStagingTable || []).map((row, idx) => {
                const sys = row.staging_system;
                const type = row.staging_type;

                // Determine staging type from system name
                const getType = (s: string) => {
                  const tnmSystems = ["AJCC", "UICC", "TNM", "AJCC 6th Edition", "AJCC 7th Edition", "AJCC 8th Edition", "AJCC 9th Edition"];
                  if (tnmSystems.some(t => s.includes(t))) return "tnm";
                  if (s.includes("FIGO")) return "figo";
                  if (s.includes("Ann Arbor")) return "ann_arbor";
                  if (s.includes("Lugano")) return "lugano";
                  if (s.includes("Binet")) return "binet";
                  if (s.includes("Rai")) return "rai";
                  if (s.includes("Child-Pugh") || s.includes("Child Pugh")) return "child_pugh";
                  if (s.includes("BCLC") || s.includes("HKLC")) return "liver_cancer";
                  if (s.includes("Dukes")) return "dukes";
                  if (s.includes("ISS") || s.includes("R-ISS")) return "myeloma";
                  if (s.includes("Gleason")) return "prostate";
                  if (s.includes("INSS") || s.includes("INRG")) return "neuroblastoma";
                  if (s.includes("NWTS") || s.includes("Wilms")) return "wilms";
                  if (s.includes("Masaoka")) return "thymoma";
                  if (s.includes("WHO CNS") || s.includes("WHO Grade")) return "who_cns";
                  if (s.includes("Chang")) return "chang";
                  if (s.includes("Clark") || s.includes("Breslow")) return "melanoma";
                  return "tnm";
                };

                // Auto-calculate stage group from T,N,M for TNM systems
                const calcStage = (t: string, n: string, m: string) => {
                  if (!t || !n || !m) return row.clinical_stage_group || "";
                  const mClean = m.replace(/^[cp]M/, "M");
                  if (["M1","M1a","M1b","M1c"].includes(mClean)) return "IV";
                  if (t === "Tis") return "0";
                  if (t.startsWith("T4") || t === "T4") return n !== "N0" && n !== "NX" ? "IIIB" : "IIIA";
                  if (t.startsWith("T3") || t === "T3") return n !== "N0" && n !== "NX" ? "IIIB" : "IIB";
                  if (t.startsWith("T2") || t === "T2") return n !== "N0" && n !== "NX" ? "IIA" : "IB";
                  if (t.startsWith("T1") || t === "T1") return n !== "N0" && n !== "NX" ? "IIA" : "IA";
                  return row.clinical_stage_group || "";
                };

                const computedStage = row.clinical_stage_group || (sys && type === "tnm"
                  ? calcStage(row.clinical_t, row.clinical_n, row.clinical_m)
                  : "");

                // Stage descriptions for all systems
                const getStageDescription = (system: string, stage: string): string => {
                  if (!stage) return "";
                  const s = system.toLowerCase();
                  const st = stage.toLowerCase();

                  // Universal TNM descriptions
                  if (s.includes("ajcc") || s.includes("uicc") || s.includes("tnm")) {
                    if (st === "0" || st === "0is") return "Carcinoma in situ — no invasion";
                    if (st.startsWith("ia1")) return "Minimally invasive (stromal invasion ≤3mm)";
                    if (st.startsWith("ia2")) return "Minimally invasive (stromal invasion 3-5mm)";
                    if (st.startsWith("ia")) return "Localized, very early disease";
                    if (st.startsWith("ib1")) return "Localized, small tumor (≤4cm)";
                    if (st.startsWith("ib2")) return "Localized, moderate tumor (>4cm)";
                    if (st.startsWith("ib")) return "Localized disease";
                    if (st.startsWith("ic")) return "Localized disease";
                    if (st.startsWith("i")) return "Localized disease — confined to organ of origin";
                    if (st.startsWith("iia")) return "Locally advanced, early regional involvement";
                    if (st.startsWith("iib")) return "Locally advanced, more extensive regional involvement";
                    if (st.startsWith("iic")) return "Locally advanced, significant regional involvement";
                    if (st.startsWith("ii")) return "Locally advanced — regional spread";
                    if (st.startsWith("iiia")) return "Regional spread, limited extension";
                    if (st.startsWith("iiib")) return "Regional spread, moderate extension";
                    if (st.startsWith("iiic1")) return "Regional spread, extensive (para-aortic nodal involvement)";
                    if (st.startsWith("iiic2")) return "Regional spread, extensive (common iliac nodal involvement)";
                    if (st.startsWith("iiic")) return "Regional spread, extensive nodal involvement";
                    if (st.startsWith("iii")) return "Regional spread — advanced locoregional disease";
                    if (st.startsWith("iva")) return "Distant metastasis, limited dissemination";
                    if (st.startsWith("ivb")) return "Distant metastasis, extensive dissemination";
                    if (st.startsWith("ivc")) return "Distant metastasis, widespread dissemination";
                    if (st.startsWith("iv")) return "Distant metastasis — advanced/metastatic disease";
                    return "";
                  }

                  // FIGO
                  if (s.includes("figo")) {
                    if (st.startsWith("ia1")) return "Confined to cervix/uterus/ovary, microinvasive (≤3mm)";
                    if (st.startsWith("ia2")) return "Confined to cervix/uterus/ovary, microinvasive (3-5mm)";
                    if (st.startsWith("ia")) return "Confined to cervix/uterus/ovary, microinvasive";
                    if (st.startsWith("ib1")) return "Confined to cervix/uterus/ovary, clinical lesion ≤4cm";
                    if (st.startsWith("ib2")) return "Confined to cervix/uterus/ovary, clinical lesion >4cm";
                    if (st.startsWith("ib")) return "Confined to cervix/uterus/ovary, clinical lesion";
                    if (st.startsWith("ic")) return "Confined to organ of origin with microscopic spread";
                    if (st.startsWith("i")) return "Confined to cervix/uterus/ovary";
                    if (st.startsWith("iia")) return "Extends beyond uterus but not to pelvic wall";
                    if (st.startsWith("iib")) return "Extends beyond uterus to parametria/pelvic sidewall";
                    if (st.startsWith("iic")) return "Extends beyond uterus with regional lymph node involvement";
                    if (st.startsWith("ii")) return "Extends beyond uterus — pelvic extension";
                    if (st.startsWith("iiia")) return "Extends to pelvic wall / lower vagina, or peritoneal seeding";
                    if (st.startsWith("iiib")) return "Extends to pelvic wall with hydronephrosis, or peritoneal mets";
                    if (st.startsWith("iiic1")) return "Pelvic lymph node metastasis";
                    if (st.startsWith("iiic2")) return "Para-aortic lymph node metastasis";
                    if (st.startsWith("iiic")) return "Lymph node metastasis";
                    if (st.startsWith("iii")) return "Pelvic extension / lymph node involvement";
                    if (st.startsWith("iva")) return "Bladder / rectal mucosal invasion";
                    if (st.startsWith("ivb")) return "Distant metastasis beyond pelvis";
                    if (st.startsWith("iv")) return "Distant metastasis — advanced disease";
                    return "";
                  }

                  // Ann Arbor
                  if (s.includes("ann arbor")) {
                    if (st.startsWith("i")) return "Single lymph node region or single extralymphatic organ";
                    if (st.startsWith("ii")) return "Two or more lymph node regions on same side of diaphragm";
                    if (st.startsWith("iii")) return "Lymph node regions on both sides of diaphragm";
                    if (st.startsWith("iv")) return "Diffuse or disseminated extranodal involvement";
                    return "";
                  }

                  // Lugano
                  if (s.includes("lugano")) {
                    if (st.includes("limited") && st.includes("i")) return "Single lymph node region (limited)";
                    if (st.includes("limited") && st.includes("ii")) return "Two or more regions, same side of diaphragm (limited)";
                    if (st.includes("advanced") && st.includes("iii")) return "Both sides of diaphragm (advanced)";
                    if (st.includes("advanced") && st.includes("iv")) return "Disseminated extranodal involvement (advanced)";
                    return "";
                  }

                  // Binet
                  if (s.includes("binet")) {
                    if (st === "a") return "< 3 lymphoid areas involved — low risk";
                    if (st === "b") return "≥ 3 lymphoid areas involved — intermediate risk";
                    if (st === "c") return "Anemia (Hb < 10) and/or thrombocytopenia (Plt < 100) — high risk";
                    return "";
                  }

                  // Rai
                  if (s.includes("rai")) {
                    if (st === "0") return "Lymphocytosis only — low risk";
                    if (st === "i") return "Lymphocytosis + lymphadenopathy — intermediate risk";
                    if (st === "ii") return "Lymphocytosis + hepatosplenomegaly — intermediate risk";
                    if (st === "iii") return "Anemia (Hb < 11) — high risk";
                    if (st === "iv") return "Thrombocytopenia (Plt < 100) — high risk";
                    return "";
                  }

                  // Child-Pugh
                  if (s.includes("child")) {
                    if (st.includes("a")) return "5-6 points — well-compensated liver disease (least severe)";
                    if (st.includes("b")) return "7-9 points — significant functional impairment (moderate)";
                    if (st.includes("c")) return "10-15 points — decompensated liver disease (most severe)";
                    return "";
                  }

                  // BCLC / HKLC / Liver
                  if (s.includes("bclc") || s.includes("hklc") || s.includes("iblp")) {
                    if (st.includes("0")) return "Very early stage — single nodule, preserved liver function";
                    if (st.includes("a")) return "Early stage — single/small multinodular, suitable for curative therapy";
                    if (st.includes("b")) return "Intermediate stage — multinodular, preserved liver function";
                    if (st.includes("c")) return "Advanced stage — portal invasion or extrahepatic spread";
                    if (st.includes("d")) return "Terminal stage — end-stage liver function";
                    return "";
                  }

                  // Dukes
                  if (s.includes("dukes")) {
                    if (st === "a") return "Tumor confined to bowel wall — good prognosis";
                    if (st === "b") return "Tumor through bowel wall, no lymph node involvement";
                    if (st === "c1") return "1-3 positive lymph nodes";
                    if (st === "c2") return "4+ positive lymph nodes";
                    if (st === "d") return "Distant metastases";
                    return "";
                  }

                  // ISS / R-ISS (Myeloma)
                  if (s.includes("iss") || s.includes("myeloma")) {
                    if (st.includes("i")) return "β2-M < 3.5 mg/L, Albumin ≥ 3.5 g/dL — favorable prognosis";
                    if (st.includes("ii")) return "Not meeting criteria for ISS I or III — intermediate prognosis";
                    if (st.includes("iii")) return "β2-M ≥ 5.5 mg/L — poor prognosis";
                    return "";
                  }

                  // Gleason / Prostate
                  if (s.includes("gleason") || s.includes("prostate")) {
                    if (st.includes("1")) return "Gleason ≤ 6 — very low/low risk, excellent prognosis";
                    if (st.includes("2")) return "Gleason 3+4=7 — favorable intermediate risk";
                    if (st.includes("3")) return "Gleason 4+3=7 — unfavorable intermediate risk";
                    if (st.includes("4")) return "Gleason 8 — high risk";
                    if (st.includes("5")) return "Gleason 9-10 — very high risk";
                    return "";
                  }

                  // Wilms (NWTS)
                  if (s.includes("nwts") || s.includes("wilms")) {
                    if (st === "1" || st === "i") return "Confined to kidney, completely resected — excellent prognosis";
                    if (st === "2" || st === "ii") return "Beyond kidney but completely resected";
                    if (st === "3" || st === "iii") return "Residual tumor or positive lymph nodes";
                    if (st === "4" || st === "iv") return "Hematogenous metastases";
                    if (st === "5" || st === "v") return "Bilateral Wilms tumor";
                    return "";
                  }

                  // Neuroblastoma INSS
                  if (s.includes("inss")) {
                    if (st === "1") return "Localized, complete resection — excellent prognosis";
                    if (st === "2a") return "Localized, incomplete resection (no ipsilateral nodes)";
                    if (st === "2b") return "Localized, ipsilateral positive nodes";
                    if (st === "3") return "Crosses midline or contralateral nodes";
                    if (st === "4") return "Distant metastases";
                    if (st === "4s") return "Special stage — age < 1yr, limited metastases, favorable";
                    return "";
                  }

                  // INRG
                  if (s.includes("inrg")) {
                    if (st === "l1") return "Localized, no image-defined risk factors";
                    if (st === "l2") return "Localized, with image-defined risk factors";
                    if (st === "m") return "Metastatic";
                    if (st === "ms") return "Metastatic special — age < 18mo, favorable biology";
                    return "";
                  }

                  // Masaoka (Thymoma)
                  if (s.includes("masaoka")) {
                    if (st === "1" || st === "i") return "Encapsulated, no microscopic invasion";
                    if (st === "2a" || st.includes("iia")) return "Microscopic transcapsular invasion";
                    if (st === "2b" || st.includes("iib")) return "Macroscopic invasion into thymus or mediastinal fat";
                    if (st === "3a" || st.includes("iiia")) return "Invasion into pericardium, lung, or pleura";
                    if (st === "3b" || st.includes("iiib")) return "Invasion into great vessels or myocardium";
                    if (st === "4a" || st.includes("iva")) return "Pleural or pericardial dissemination";
                    if (st === "4b" || st.includes("ivb")) return "Lymphogenous or hematogenous metastasis";
                    return "";
                  }

                  // WHO CNS
                  if (s.includes("who cns") || s.includes("who grade")) {
                    if (st === "1") return "Lowest proliferation — often curable with surgery alone";
                    if (st === "2") return "Infiltrating, low mitotic activity — tends to recur";
                    if (st === "3") return "High mitotic activity, anaplasia — aggressive";
                    if (st === "4") return "Highly malignant, necrosis/angiogenesis — most aggressive";
                    return "";
                  }

                  // Chang (Medulloblastoma)
                  if (s.includes("chang")) {
                    if (st.includes("m0")) return "No evidence of metastases";
                    if (st.includes("m1")) return "Tumor cells detected in CSF";
                    if (st.includes("m2")) return "Intracranial seeding beyond primary site";
                    if (st.includes("m3")) return "Spinal seeding";
                    if (st.includes("m4")) return "Extraneural metastases";
                    return "";
                  }

                  // Clark / Breslow (Melanoma)
                  if (s.includes("clark") || s.includes("breslow") || s.includes("melanoma")) {
                    if (st === "1" || st === "i") return "Epidermis only (melanoma in situ)";
                    if (st === "2" || st === "ii") return "Invasion into papillary dermis";
                    if (st === "3" || st === "iii") return "Filling papillary dermis (tumor extends to junction of papillary/reticular dermis)";
                    if (st === "4" || st === "iv") return "Invasion into reticular dermis";
                    if (st === "5" || st === "v") return "Invasion into subcutaneous tissue";
                    return "";
                  }

                  return "";
                };

                const stageDescription = getStageDescription(sys, computedStage);

                // Helper to update a TNM field and auto-compute stage
                const updateTnm = (field: string, value: string) => {
                  const nextRow = { ...row, [field]: value };
                  const t = field === "clinical_t" ? value : nextRow.clinical_t;
                  const n = field === "clinical_n" ? value : nextRow.clinical_n;
                  const m = field === "clinical_m" ? value : nextRow.clinical_m;
                  const stage = calcStage(t, n, m);
                  // Batch both changes
                  const updates: Record<string, string> = { [field]: value };
                  if (stage) updates.clinical_stage_group = stage;
                  Object.entries(updates).forEach(([k, v]) => {
                    handleTableChange("clinicalStagingTable", idx, k, v);
                  });
                };

                // Predefined staging systems grouped by category
                const stagingSystemGroups: { label: string; systems: { name: string; type: string }[] }[] = [
                  {
                    label: "TNM-Based (All Solid Tumors)",
                    systems: [
                      { name: "AJCC 8th Edition", type: "tnm" },
                      { name: "AJCC 7th Edition", type: "tnm" },
                      { name: "AJCC 6th Edition", type: "tnm" },
                      { name: "AJCC 9th Edition", type: "tnm" },
                      { name: "UICC TNM", type: "tnm" },
                    ],
                  },
                  {
                    label: "Gynaecological",
                    systems: [
                      { name: "FIGO (Cervix / Uterus / Ovary / Vulva / Vagina)", type: "figo" },
                    ],
                  },
                  {
                    label: "Haematological / Lymphoma",
                    systems: [
                      { name: "Ann Arbor (Hodgkin / NHL)", type: "ann_arbor" },
                      { name: "Lugano Classification", type: "lugano" },
                      { name: "Binet (CLL)", type: "binet" },
                      { name: "Rai (CLL)", type: "rai" },
                      { name: "ISS / R-ISS (Multiple Myeloma)", type: "myeloma" },
                    ],
                  },
                  {
                    label: "Liver / HPB",
                    systems: [
                      { name: "BCLC (HCC)", type: "liver_cancer" },
                      { name: "Child-Pugh (Cirrhosis)", type: "child_pugh" },
                      { name: "HKLC (Hong Kong Liver Cancer)", type: "liver_cancer" },
                      { name: "IBLP (Primary Liver Cancer - Chinese)", type: "liver_cancer" },
                    ],
                  },
                  {
                    label: "Gastrointestinal",
                    systems: [
                      { name: "Dukes (Colorectal)", type: "dukes" },
                    ],
                  },
                  {
                    label: "Prostate / Genitourinary",
                    systems: [
                      { name: "Gleason Score / Grade Group (Prostate)", type: "prostate" },
                      { name: "NWTS / COG (Wilms Tumor)", type: "wilms" },
                    ],
                  },
                  {
                    label: "Paediatric / CNS",
                    systems: [
                      { name: "INSS (Neuroblastoma)", type: "neuroblastoma" },
                      { name: "INRG (Neuroblastoma)", type: "neuroblastoma" },
                      { name: "Chang (Medulloblastoma)", type: "chang" },
                      { name: "WHO CNS Grade (Brain Tumors)", type: "who_cns" },
                    ],
                  },
                  {
                    label: "Thoracic / Other",
                    systems: [
                      { name: "Masaoka-Koga (Thymoma)", type: "thymoma" },
                      { name: "Clark Level / Breslow Thickness (Melanoma)", type: "melanoma" },
                    ],
                  },
                ];

                return (
                  <div key={idx} className="rounded-xl border border-emerald-200 dark:border-emerald-800 overflow-hidden">
                    <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-950/30">
                      <h4 className="font-bold text-emerald-800 dark:text-emerald-200">
                        Clinical Stage {idx + 1}{computedStage ? `: ${computedStage}` : ""}
                        {stageDescription && <span className="font-normal text-emerald-600 dark:text-emerald-400 ml-2 text-[11.5px]">— {stageDescription}</span>}
                      </h4>
                      <div className="flex items-center gap-2">
                        {computedStage && (
                          <span className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full ${
                            computedStage.startsWith("0") ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                            computedStage.startsWith("I") ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" :
                            computedStage.startsWith("II") ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" :
                            computedStage.startsWith("III") ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" :
                            computedStage.startsWith("IV") ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" :
                            "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}>
                            Overall: {computedStage}
                          </span>
                        )}
                        <button type="button" onClick={() => removeRow("clinicalStagingTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Staging System Selector (grouped optgroups) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold mb-1">Staging System *</label>
                          <select
                            value={sys}
                            onChange={(e) => {
                              const selected = e.target.value;
                              const found = stagingSystemGroups.flatMap(g => g.systems).find(s => s.name === selected);
                              const st = found ? found.type : "tnm";
                              handleTableChange("clinicalStagingTable", idx, "staging_system", selected);
                              handleTableChange("clinicalStagingTable", idx, "staging_type", st);
                            }}
                            className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                          >
                            <option value="">Select cancer staging system</option>
                            {stagingSystemGroups.map((group, gi) => (
                              <optgroup key={gi} label={group.label}>
                                {group.systems.map((s, si) => (
                                  <option key={si} value={s.name}>{s.name}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Staging Date</label>
                          <input type="date" value={row.staging_date} onChange={(e) => handleTableChange("clinicalStagingTable", idx, "staging_date", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                        </div>
                      </div>

                      {/* Dynamic fields based on staging type */}
                      {(type === "tnm" || !type) && sys && (
                        <div className="space-y-3">
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1">TNM Classification</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Clinical T (cT)</label>
                              <select value={row.clinical_t} onChange={(e) => updateTnm("clinical_t", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select cT</option>
                                {["TX", "T0", "Tis", "T1", "T1a", "T1b", "T1c", "T1mi", "T2", "T2a", "T2b", "T3", "T3a", "T3b", "T4", "T4a", "T4b", "T4d"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Clinical N (cN)</label>
                              <select value={row.clinical_n} onChange={(e) => updateTnm("clinical_n", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select cN</option>
                                {["NX", "N0", "N0(i+)", "N0(mol+)", "N1", "N1a", "N1b", "N1c", "N1mi", "N2", "N2a", "N2b", "N2c", "N3", "N3a", "N3b", "N3c"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Clinical M (cM)</label>
                              <select value={row.clinical_m} onChange={(e) => updateTnm("clinical_m", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select cM</option>
                                {["cM0", "cM0(i+)", "cM1", "cM1a", "cM1b", "cM1c", "pM1"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                            <div>
                              <label className="block font-semibold mb-1">Pathological T (pT)</label>
                              <select value={row.pathological_t} onChange={(e) => handleTableChange("clinicalStagingTable", idx, "pathological_t", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select pT</option>
                                {["", "TX", "T0", "Tis", "T1", "T1a", "T1b", "T1c", "T1mi", "T2", "T2a", "T2b", "T3", "T3a", "T3b", "T4", "T4a", "T4b", "T4d"].filter(Boolean).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Pathological N (pN)</label>
                              <select value={row.pathological_n} onChange={(e) => handleTableChange("clinicalStagingTable", idx, "pathological_n", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select pN</option>
                                {["", "NX", "N0", "N0(i+)", "N0(mol+)", "N1", "N1a", "N1b", "N1c", "N1mi", "N2", "N2a", "N2b", "N2c", "N3", "N3a", "N3b", "N3c"].filter(Boolean).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Pathological M (pM)</label>
                              <select value={row.pathological_m} onChange={(e) => handleTableChange("clinicalStagingTable", idx, "pathological_m", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select pM</option>
                                {["", "cM0", "cM0(i+)", "pM1", "pM1a", "pM1b", "pM1c"].filter(Boolean).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {type === "figo" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">FIGO Stage</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">FIGO Stage</label>
                              <select value={row.figo_stage} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "figo_stage", e.target.value);
                                handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value);
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select FIGO stage</option>
                                {["I", "IA", "IA1", "IA2", "IB", "IB1", "IB2", "IC", "II", "IIA", "IIB", "IIC", "III", "IIIA", "IIIB", "IIIC", "IIIC1", "IIIC2", "IV", "IVA", "IVB"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {type === "ann_arbor" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Ann Arbor Stage</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Stage</label>
                              <select value={row.ann_arbor_stage} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "ann_arbor_stage", e.target.value);
                                const mod = row.ann_arbor_modifier || "";
                                handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `${e.target.value}${mod ? ` ${mod}` : ""}` : "");
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select stage</option>
                                {["I", "IE", "II", "IIE", "III", "IIIE", "IIIS", "IIIES", "IV"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Modifier</label>
                              <select value={row.ann_arbor_modifier} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "ann_arbor_modifier", e.target.value);
                                const stage = row.ann_arbor_stage || "";
                                handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", stage ? `${stage}${e.target.value ? ` ${e.target.value}` : ""}` : "");
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">No modifier</option>
                                {["A", "B", "X"].map((opt) => <option key={opt} value={opt}>{opt}{opt === "A" ? " (Asymptomatic)" : opt === "B" ? " (B symptoms)" : " (Bulk)"}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {type === "lugano" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Lugano Classification</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Lugano Stage</label>
                              <select value={row.lugano_stage} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "lugano_stage", e.target.value);
                                handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value);
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select stage</option>
                                {["Limited (I)", "Limited (II)", "Advanced (III)", "Advanced (IV)"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Modifier</label>
                              <select value={row.lugano_modifier} onChange={(e) => handleTableChange("clinicalStagingTable", idx, "lugano_modifier", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">None</option>
                                <option value="A">A (Asymptomatic)</option>
                                <option value="B">B (B symptoms)</option>
                                <option value="Bulk">Bulk disease</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {type === "binet" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Binet Staging (CLL)</h5>
                          <select value={row.binet_stage} onChange={(e) => {
                            handleTableChange("clinicalStagingTable", idx, "binet_stage", e.target.value);
                            handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value);
                          }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                            <option value="">Select Binet stage</option>
                            <option value="A">A (&lt; 3 lymphoid areas, Hb ≥ 10, Plt ≥ 100)</option>
                            <option value="B">B (≥ 3 lymphoid areas, Hb ≥ 10, Plt ≥ 100)</option>
                            <option value="C">C (Hb &lt; 10 and/or Plt &lt; 100)</option>
                          </select>
                        </div>
                      )}

                      {type === "rai" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Rai Staging (CLL)</h5>
                          <select value={row.rai_stage} onChange={(e) => {
                            handleTableChange("clinicalStagingTable", idx, "rai_stage", e.target.value);
                            handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value);
                          }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                            <option value="">Select Rai stage</option>
                            <option value="0">0 (Low risk — lymphocytosis only)</option>
                            <option value="I">I (Intermediate — lymphadenopathy)</option>
                            <option value="II">II (Intermediate — hepatosplenomegaly)</option>
                            <option value="III">III (High — anemia, Hb &lt; 11)</option>
                            <option value="IV">IV (High — thrombocytopenia, Plt &lt; 100)</option>
                          </select>
                        </div>
                      )}

                      {type === "child_pugh" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Child-Pugh Score</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Points (if known)</label>
                              <input type="number" min={5} max={15} value={row.child_pugh_points} onChange={(e) => {
                                const pts = parseInt(e.target.value);
                                handleTableChange("clinicalStagingTable", idx, "child_pugh_points", e.target.value);
                                if (pts >= 5 && pts <= 6) handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", "Child-Pugh A");
                                else if (pts >= 7 && pts <= 9) handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", "Child-Pugh B");
                                else if (pts >= 10 && pts <= 15) handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", "Child-Pugh C");
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Grade</label>
                              <select value={row.child_pugh_grade} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "child_pugh_grade", e.target.value);
                                handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `Child-Pugh ${e.target.value}` : "");
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select grade</option>
                                <option value="A">A (5-6 pts — well-compensated)</option>
                                <option value="B">B (7-9 pts — significant impairment)</option>
                                <option value="C">C (10-15 pts — decompensated)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {type === "liver_cancer" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Liver Cancer Stage</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Stage</label>
                              <select value={row.bclc_stage} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "bclc_stage", e.target.value);
                                const prefix = sys.includes("BCLC") ? "BCLC " : sys.includes("HKLC") ? "HKLC " : "";
                                handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `${prefix}${e.target.value}` : "");
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select stage</option>
                                {["0 (Very early)", "A (Early)", "B (Intermediate)", "C (Advanced)", "D (Terminal)"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {type === "dukes" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Dukes Staging (Colorectal)</h5>
                          <select value={row.dukes_stage} onChange={(e) => {
                            handleTableChange("clinicalStagingTable", idx, "dukes_stage", e.target.value);
                            handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `Dukes ${e.target.value}` : "");
                          }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                            <option value="">Select Dukes stage</option>
                            <option value="A">A (Tumor confined to bowel wall)</option>
                            <option value="B">B (Through bowel wall, nodes negative)</option>
                            <option value="C1">C1 (1-3 positive lymph nodes)</option>
                            <option value="C2">C2 (4+ positive lymph nodes)</option>
                            <option value="D">D (Distant metastases)</option>
                          </select>
                        </div>
                      )}

                      {type === "myeloma" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Myeloma Staging</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">ISS Stage</label>
                              <select value={row.iss_stage} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "iss_stage", e.target.value);
                                handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `ISS ${e.target.value}` : "");
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select ISS</option>
                                <option value="I">I (β2-M &lt; 3.5, Alb ≥ 3.5)</option>
                                <option value="II">II (Not I or III)</option>
                                <option value="III">III (β2-M ≥ 5.5)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">R-ISS Stage</label>
                              <select value={row.riss_stage} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "riss_stage", e.target.value);
                                if (e.target.value) handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", `R-ISS ${e.target.value}`);
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select R-ISS</option>
                                <option value="I">I (ISS I + normal LDH + no high-risk cytogenetics)</option>
                                <option value="II">II (Not I or III)</option>
                                <option value="III">III (ISS III + high LDH or high-risk cytogenetics)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {type === "prostate" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Prostate Cancer Grading</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Gleason Score</label>
                              <select value={row.gleason_score} onChange={(e) => handleTableChange("clinicalStagingTable", idx, "gleason_score", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select score</option>
                                {["6 (3+3)", "7 (3+4)", "7 (4+3)", "8 (4+4)", "9 (4+5)", "9 (5+4)", "10 (5+5)"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Grade Group</label>
                              <select value={row.gleason_grade_group} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "gleason_grade_group", e.target.value);
                                handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `Grade Group ${e.target.value}` : "");
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select group</option>
                                <option value="1">1 (Gleason ≤ 6) — Very low/low risk</option>
                                <option value="2">2 (Gleason 3+4=7) — Favorable intermediate</option>
                                <option value="3">3 (Gleason 4+3=7) — Unfavorable intermediate</option>
                                <option value="4">4 (Gleason 8) — High risk</option>
                                <option value="5">5 (Gleason 9-10) — Very high risk</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {type === "neuroblastoma" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Neuroblastoma Staging</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">INSS Stage</label>
                              <select value={row.inss_stage} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "inss_stage", e.target.value);
                                handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `INSS ${e.target.value}` : "");
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select INSS</option>
                                <option value="1">Stage 1 (Localized, complete resection)</option>
                                <option value="2A">Stage 2A (Localized, incomplete resection)</option>
                                <option value="2B">Stage 2B (Localized, ipsilateral nodes+)</option>
                                <option value="3">Stage 3 (Crosses midline / contralateral nodes)</option>
                                <option value="4">Stage 4 (Distant metastases)</option>
                                <option value="4S">Stage 4S (Special — age &lt; 1, limited mets)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">INRG Stage</label>
                              <select value={row.inrg_stage} onChange={(e) => {
                                handleTableChange("clinicalStagingTable", idx, "inrg_stage", e.target.value);
                                handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `INRG ${e.target.value}` : "");
                              }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select INRG</option>
                                <option value="L1">L1 (Localized, no IDRFs)</option>
                                <option value="L2">L2 (Localized, with IDRFs)</option>
                                <option value="M">M (Metastatic)</option>
                                <option value="MS">MS (Metastatic, special — age &lt; 18 mo)</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {type === "wilms" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Wilms Tumor (NWTS/COG) Staging</h5>
                          <select value={row.nwts_stage} onChange={(e) => {
                            handleTableChange("clinicalStagingTable", idx, "nwts_stage", e.target.value);
                            handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `NWTS ${e.target.value}` : "");
                          }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                            <option value="">Select stage</option>
                            <option value="I">I (Confined to kidney, completely resected)</option>
                            <option value="II">II (Beyond kidney, completely resected)</option>
                            <option value="III">III (Residual tumor/positive nodes)</option>
                            <option value="IV">IV (Hematogenous metastases)</option>
                            <option value="V">V (Bilateral Wilms tumor)</option>
                          </select>
                        </div>
                      )}

                      {type === "thymoma" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Masaoka-Koga Staging (Thymoma)</h5>
                          <select value={row.masaoka_stage} onChange={(e) => {
                            handleTableChange("clinicalStagingTable", idx, "masaoka_stage", e.target.value);
                            handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `Masaoka ${e.target.value}` : "");
                          }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                            <option value="">Select stage</option>
                            <option value="I">I (Encapsulated, no invasion)</option>
                            <option value="IIA">IIA (Microscopic transcapsular invasion)</option>
                            <option value="IIB">IIB (Macroscopic invasion into thymus/fat)</option>
                            <option value="IIIA">IIIA (Invasion into pericardium/lung/pleura)</option>
                            <option value="IIIB">IIIB (Invasion into great vessels/myocardium)</option>
                            <option value="IVA">IVA (Pleural/pericardial dissemination)</option>
                            <option value="IVB">IVB (Lymphogenous/hematogenous mets)</option>
                          </select>
                        </div>
                      )}

                      {type === "who_cns" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">WHO CNS Grade</h5>
                          <select value={row.who_cns_grade} onChange={(e) => {
                            handleTableChange("clinicalStagingTable", idx, "who_cns_grade", e.target.value);
                            handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `WHO Grade ${e.target.value}` : "");
                          }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                            <option value="">Select grade</option>
                            <option value="1">Grade 1 (Lowest proliferation — curable surgically)</option>
                            <option value="2">Grade 2 (Infiltrating, low mitotic activity)</option>
                            <option value="3">Grade 3 (High mitotic activity, anaplasia)</option>
                            <option value="4">Grade 4 (Highly malignant, necrosis/angiogenesis)</option>
                          </select>
                        </div>
                      )}

                      {type === "chang" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Chang Staging (Medulloblastoma)</h5>
                          <select value={row.chang_stage} onChange={(e) => {
                            handleTableChange("clinicalStagingTable", idx, "chang_stage", e.target.value);
                            handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value ? `Chang ${e.target.value}` : "");
                          }} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                            <option value="">Select stage</option>
                            <option value="M0">M0 (No evidence of metastases)</option>
                            <option value="M1">M1 (Tumor cells in CSF)</option>
                            <option value="M2">M2 (Intracranial seeding)</option>
                            <option value="M3">M3 (Spinal seeding)</option>
                            <option value="M4">M4 (Extraneural metastases)</option>
                          </select>
                        </div>
                      )}

                      {type === "melanoma" && (
                        <div>
                          <h5 className="font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-700 pb-1 mb-3">Melanoma Staging (Clark / Breslow)</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Clark Level</label>
                              <select value={row.clark_level} onChange={(e) => handleTableChange("clinicalStagingTable", idx, "clark_level", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs">
                                <option value="">Select level</option>
                                <option value="I">I (Epidermis only — in situ)</option>
                                <option value="II">II (Into papillary dermis)</option>
                                <option value="III">III (Filling papillary dermis)</option>
                                <option value="IV">IV (Into reticular dermis)</option>
                                <option value="V">V (Into subcutaneous tissue)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Breslow Thickness (mm)</label>
                              <input type="text" value={row.breslow_thickness} onChange={(e) => handleTableChange("clinicalStagingTable", idx, "breslow_thickness", e.target.value)} placeholder="e.g. 1.2" className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Overall Stage — auto-computed and editable */}
                      <div className="border-t border-emerald-200 dark:border-emerald-700 pt-3">
                        <div className="flex items-center gap-3">
                          <label className="font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">Overall Stage Outcome:</label>
                          <input
                            type="text"
                            value={row.clinical_stage_group}
                            onChange={(e) => handleTableChange("clinicalStagingTable", idx, "clinical_stage_group", e.target.value)}
                            placeholder="Auto-calculated or manual"
                            className={`flex-1 p-2 bg-theme-surface dark:bg-slate-800 border rounded-xl text-xs font-bold text-center ${
                              computedStage ? "border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300" : "border-slate-200 dark:border-slate-700"
                            }`}
                          />
                          {type === "tnm" && row.clinical_t && row.clinical_n && row.clinical_m && (
                            <span className="text-[11.5px] text-slate-500 whitespace-nowrap">
                              cT{row.clinical_t} cN{row.clinical_n} cM{row.clinical_m}
                            </span>
                          )}
                        </div>
                        {stageDescription && (
                          <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400 italic pl-1">
                            {stageDescription}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Notes</label>
                        <textarea value={row.staging_notes} onChange={(e) => handleTableChange("clinicalStagingTable", idx, "staging_notes", e.target.value)} placeholder="Any additional staging details or remarks" rows={2} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-y" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {(!formState.clinicalStagingTable || formState.clinicalStagingTable.length === 0) && (
                <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                  No clinical staging entries added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Histology Grading Details */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("histologyGrading")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.histologyGrading ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-teal-500/10 dark:bg-teal-400/20 text-teal-700 dark:text-teal-200 flex items-center justify-center">
                <Layers className="h-3.5 w-3.5" />
              </span>
              <h3 className="h-section">Histology Grading Details</h3>
              <SectionUploadActions section="histologyGrading" label="Histology Grading Details" />
            </div>
            {openSections.histologyGrading ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.histologyGrading && (
            <div className="p-5 text-xs text-slate-700 dark:text-slate-350 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[11.5px] text-slate-500">Record histological grading using standardized systems. Select a grading system to show the appropriate fields.</p>
                <button type="button" onClick={() => addRow("histologyGradingTable", tableTemplates.histologyGradingTable)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-teal-600 hover:underline">
                  <CirclePlus className="h-3.5 w-3.5" /> Add Grading Entry
                </button>
              </div>

              {(formState.histologyGradingTable || []).map((row, idx) => {
                const sys = row.grading_system;

                const calcNottinghamGrade = (ts: string, ns: string, ms: string) => {
                  const t = parseInt(ts), n = parseInt(ns), m = parseInt(ms);
                  if (isNaN(t) || isNaN(n) || isNaN(m)) return "";
                  const total = t + n + m;
                  if (total >= 3 && total <= 5) return "I (Well differentiated)";
                  if (total >= 6 && total <= 7) return "II (Moderately differentiated)";
                  if (total >= 8 && total <= 9) return "III (Poorly differentiated)";
                  return "";
                };

                const gradingSystemGroups: { label: string; systems: string[] }[] = [
                  { label: "Universal / Multiple Cancer Types", systems: ["Standard Histological Grade (G1-G4)", "Differentiation Grade", "Nuclear Grade (1-4)"] },
                  { label: "Breast Cancer", systems: ["Nottingham (Elston-Ellis / Bloom-Richardson)"] },
                  { label: "Renal Cell Carcinoma", systems: ["Fuhrman Nuclear Grade", "ISUP Grade", "WHO/ISUP Grade"] },
                  { label: "Prostate Cancer", systems: ["Gleason Score / Grade Group"] },
                  { label: "Endometrial / Ovarian Cancer", systems: ["FIGO Histological Grade"] },
                  { label: "CNS / Brain Tumors", systems: ["WHO CNS Grade"] },
                  { label: "Lung Cancer (Growth Patterns)", systems: ["Lung Adenocarcinoma Pattern-Based"] },
                  { label: "Gastrointestinal / Pancreatobiliary", systems: ["GI / Pancreatobiliary Differentiation"] },
                  { label: "Soft Tissue Sarcoma", systems: ["FNCLCC Sarcoma Grade"] },
                ];

                const gradingDescriptions: Record<string, string> = {
                  "Standard Histological Grade (G1-G4)": "Overall differentiation grade applicable to most carcinoma types",
                  "Differentiation Grade": "Grade based on how closely tumor cells resemble normal tissue",
                  "Nuclear Grade (1-4)": "Grade based on nuclear pleomorphism, size, and chromatin pattern",
                  "Nottingham (Elston-Ellis / Bloom-Richardson)": "Sum of tubule formation, nuclear pleomorphism, and mitotic count scores (3-9). Standard for invasive breast carcinoma.",
                  "Fuhrman Nuclear Grade": "Nuclear grading for RCC based on nuclear size, shape, and nucleolar prominence",
                  "ISUP Grade": "ISUP nucleolar-based grading for renal cell carcinoma",
                  "WHO/ISUP Grade": "WHO/ISUP grading for urothelial carcinoma — low vs high grade",
                  "Gleason Score / Grade Group": "Primary + secondary pattern scores (6-10) mapped to Grade Groups 1-5 for prostate cancer",
                  "FIGO Histological Grade": "Architectural grade for endometrial carcinoma based on glandular vs solid growth",
                  "WHO CNS Grade": "WHO grading for CNS tumors (1-4) based on histology and molecular features",
                  "Lung Adenocarcinoma Pattern-Based": "Semiquantitative assessment of lepidic, acinar, papillary, micropapillary, and solid patterns",
                  "GI / Pancreatobiliary Differentiation": "Degree of differentiation, mucinous component, signet ring cells, and medullary features",
                  "FNCLCC Sarcoma Grade": "Score based on differentiation, mitotic count, and necrosis for soft tissue sarcomas",
                };

                const updateField = (field: string, value: string) => {
                  handleTableChange("histologyGradingTable", idx, field, value);
                };

                const updateNottingham = (field: string, value: string) => {
                  const nextRow = { ...row, [field]: value };
                  const ts = field === "nottingham_tubule_score" ? value : nextRow.nottingham_tubule_score;
                  const ns = field === "nottingham_nuclear_score" ? value : nextRow.nottingham_nuclear_score;
                  const ms = field === "nottingham_mitotic_score" ? value : nextRow.nottingham_mitotic_score;
                  const grade = calcNottinghamGrade(ts, ns, ms);
                  const total = [ts, ns, ms].map(v => parseInt(v)).filter(v => !isNaN(v)).reduce((a, b) => a + b, 0);
                  const updates: Record<string, string> = { [field]: value };
                  if (total >= 3) updates.nottingham_score = String(total);
                  if (grade) {
                    updates.nottingham_grade = grade;
                    updates.histological_grade = `Grade ${grade.charAt(0)}`;
                    updates.histological_grade_description = grade;
                  }
                  Object.entries(updates).forEach(([k, v]) => {
                    handleTableChange("histologyGradingTable", idx, k, v);
                  });
                };

                return (
                  <div key={idx} className="rounded-xl border border-teal-200 dark:border-teal-800 overflow-hidden">
                    <div className="flex justify-between items-center p-3 bg-teal-50 dark:bg-teal-950/30">
                      <h4 className="font-bold text-teal-800 dark:text-teal-200">
                        Grading Entry {idx + 1}{row.histological_grade ? `: ${row.histological_grade}` : row.histological_grade_description ? `: ${row.histological_grade_description}` : ""}
                      </h4>
                      <button type="button" onClick={() => removeRow("histologyGradingTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block font-semibold mb-1">Grading System *</label>
                          <select
                            value={sys}
                            onChange={(e) => {
                              const v = e.target.value;
                              handleTableChange("histologyGradingTable", idx, "grading_system", v);
                              const desc = gradingDescriptions[v] || "";
                              handleTableChange("histologyGradingTable", idx, "histological_grade_description", desc);
                            }}
                            className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                          >
                            <option value="">Select grading system</option>
                            {gradingSystemGroups.map((group, gi) => (
                              <optgroup key={gi} label={group.label}>
                                {group.systems.map((s, si) => <option key={si} value={s}>{s}</option>)}
                              </optgroup>
                            ))}
                          </select>
                          {row.histological_grade_description && (
                            <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400 italic">{row.histological_grade_description}</p>
                          )}
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Grading Date</label>
                          <input type="date" value={row.grading_date} onChange={(e) => updateField("grading_date", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                        </div>
                      </div>

                      <div className="border-t border-teal-200 dark:border-teal-700 pt-3">
                        <h5 className="font-bold text-teal-700 dark:text-teal-300 pb-2 text-[11.5px]">Universal Grading Parameters</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block font-semibold mb-1">Histological Grade</label>
                            <select value={row.histological_grade} onChange={(e) => updateField("histological_grade", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Grade 1 (G1)", "Grade 2 (G2)", "Grade 3 (G3)", "Grade 4 (G4)", "Low Grade", "Intermediate Grade", "High Grade", "Not gradable", "Unknown"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Differentiation</label>
                            <select value={row.differentiation} onChange={(e) => updateField("differentiation", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Well differentiated", "Moderately differentiated", "Poorly differentiated", "Undifferentiated", "Not specified"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Nuclear Grade</label>
                            <select value={row.nuclear_grade} onChange={(e) => updateField("nuclear_grade", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["1 (Mild atypia)", "2 (Moderate atypia)", "3 (Severe atypia)", "4 (Anaplastic)"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Mitotic Count</label>
                            <input type="text" value={row.mitotic_count} onChange={(e) => updateField("mitotic_count", e.target.value)} placeholder="e.g. 5 per 10 HPF" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Mitotic Score</label>
                            <select value={row.mitotic_score} onChange={(e) => updateField("mitotic_score", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["1 (Low)", "2 (Intermediate)", "3 (High)"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Ki-67 / MIB-1 (%)</label>
                            <input type="text" value={row.ki67_percentage} onChange={(e) => updateField("ki67_percentage", e.target.value)} placeholder="e.g. 15%" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Lymphovascular Invasion</label>
                            <select value={row.lymphovascular_invasion} onChange={(e) => updateField("lymphovascular_invasion", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Absent", "Present", "Suspected", "Not assessed"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Perineural Invasion</label>
                            <select value={row.perineural_invasion} onChange={(e) => updateField("perineural_invasion", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Absent", "Present", "Suspected", "Not assessed"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Tumor Budding</label>
                            <select value={row.tumor_budding} onChange={(e) => updateField("tumor_budding", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Low (BD1)", "Intermediate (BD2)", "High (BD3)", "Not assessed"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Necrosis</label>
                            <select value={row.necrosis} onChange={(e) => updateField("necrosis", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Absent", "Present (focal)", "Present (extensive)", "Geographic necrosis"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Cellularity</label>
                            <select value={row.cellularity} onChange={(e) => updateField("cellularity", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Low", "Moderate", "High", "Very high"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      {sys === "Nottingham (Elston-Ellis / Bloom-Richardson)" && (
                        <div className="border-t border-teal-200 dark:border-teal-700 pt-3">
                          <h5 className="font-bold text-teal-700 dark:text-teal-300 pb-2 text-[11.5px]">Nottingham (Elston-Ellis) Score — Breast Cancer</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Tubule Formation Score</label>
                              <select value={row.nottingham_tubule_score} onChange={(e) => updateNottingham("nottingham_tubule_score", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                <option value="1">1 (&gt;75% tubular)</option>
                                <option value="2">2 (10-75% tubular)</option>
                                <option value="3">3 (&lt;10% tubular)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Nuclear Pleomorphism Score</label>
                              <select value={row.nottingham_nuclear_score} onChange={(e) => updateNottingham("nottingham_nuclear_score", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                <option value="1">1 (Small, uniform nuclei)</option>
                                <option value="2">2 (Moderate variation)</option>
                                <option value="3">3 (Marked pleomorphism)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Mitotic Count Score</label>
                              <select value={row.nottingham_mitotic_score} onChange={(e) => updateNottingham("nottingham_mitotic_score", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                <option value="1">1 (Low mitotic rate)</option>
                                <option value="2">2 (Intermediate mitotic rate)</option>
                                <option value="3">3 (High mitotic rate)</option>
                              </select>
                            </div>
                          </div>
                          {row.nottingham_score && (
                            <div className="mt-2 flex items-center gap-2 text-[11.5px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/20 p-2 rounded-lg">
                              <span>Total Score: <strong>{row.nottingham_score}</strong> / 9</span>
                              {row.nottingham_grade && <span>→ Grade: <strong>{row.nottingham_grade}</strong></span>}
                            </div>
                          )}
                        </div>
                      )}

                      {(sys === "Fuhrman Nuclear Grade" || sys === "ISUP Grade" || sys === "WHO/ISUP Grade") && (
                        <div className="border-t border-teal-200 dark:border-teal-700 pt-3">
                          <h5 className="font-bold text-teal-700 dark:text-teal-300 pb-2 text-[11.5px]">
                            {sys === "Fuhrman Nuclear Grade" ? "Fuhrman Nuclear Grade — RCC" :
                             sys === "ISUP Grade" ? "ISUP Grade — RCC" : "WHO/ISUP Grade — Urothelial Carcinoma"}
                          </h5>
                          {sys === "Fuhrman Nuclear Grade" && (
                            <select value={row.fuhrman_grade} onChange={(e) => {
                              updateField("fuhrman_grade", e.target.value);
                              if (e.target.value) updateField("histological_grade", `Fuhrman ${e.target.value}`);
                            }} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              <option value="1">1 — Small uniform nuclei, inconspicuous nucleoli</option>
                              <option value="2">2 — Larger nuclei, nucleoli visible at 400x</option>
                              <option value="3">3 — Irregular nuclei, nucleoli visible at 100x</option>
                              <option value="4">4 — Bizarre, multilobed nuclei, marked atypia</option>
                            </select>
                          )}
                          {sys === "ISUP Grade" && (
                            <select value={row.isup_grade} onChange={(e) => {
                              updateField("isup_grade", e.target.value);
                              if (e.target.value) updateField("histological_grade", `ISUP Grade ${e.target.value}`);
                            }} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              <option value="1">1 — Nucleoli absent/inconspicuous at 400x</option>
                              <option value="2">2 — Nucleoli distinct at 400x, not at 100x</option>
                              <option value="3">3 — Nucleoli prominent at 100x</option>
                              <option value="4">4 — Extreme pleomorphism / sarcomatoid / rhabdoid</option>
                            </select>
                          )}
                          {sys === "WHO/ISUP Grade" && (
                            <select value={row.who_isup_grade} onChange={(e) => {
                              updateField("who_isup_grade", e.target.value);
                              if (e.target.value) updateField("histological_grade", `WHO/ISUP: ${e.target.value}`);
                            }} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              <option value="Low Grade (LG)">Low Grade (LG)</option>
                              <option value="High Grade (HG)">High Grade (HG)</option>
                            </select>
                          )}
                        </div>
                      )}

                      {sys === "Gleason Score / Grade Group" && (
                        <div className="border-t border-teal-200 dark:border-teal-700 pt-3">
                          <h5 className="font-bold text-teal-700 dark:text-teal-300 pb-2 text-[11.5px]">Gleason Score — Prostate Cancer</h5>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Primary Pattern</label>
                              <select value={row.gleason_primary} onChange={(e) => updateField("gleason_primary", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                {["3", "4", "5"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Secondary Pattern</label>
                              <select value={row.gleason_secondary} onChange={(e) => updateField("gleason_secondary", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                {["3", "4", "5"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Gleason Score</label>
                              <select value={row.gleason_score} onChange={(e) => updateField("gleason_score", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                {["6 (3+3)", "7 (3+4)", "7 (4+3)", "8 (4+4)", "9 (4+5)", "9 (5+4)", "10 (5+5)"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Grade Group</label>
                              <select value={row.gleason_grade_group} onChange={(e) => {
                                updateField("gleason_grade_group", e.target.value);
                                if (e.target.value) updateField("histological_grade", `Grade Group ${e.target.value}`);
                              }} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                <option value="1">1 (≤6) — Very low/low risk</option>
                                <option value="2">2 (3+4=7) — Favorable intermediate</option>
                                <option value="3">3 (4+3=7) — Unfavorable intermediate</option>
                                <option value="4">4 (8) — High risk</option>
                                <option value="5">5 (9-10) — Very high risk</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {sys === "FIGO Histological Grade" && (
                        <div className="border-t border-teal-200 dark:border-teal-700 pt-3">
                          <h5 className="font-bold text-teal-700 dark:text-teal-300 pb-2 text-[11.5px]">FIGO Histological Grade</h5>
                          <select value={row.figo_grade} onChange={(e) => {
                            updateField("figo_grade", e.target.value);
                            if (e.target.value) updateField("histological_grade", `FIGO Grade ${e.target.value}`);
                          }} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                            <option value="">Select</option>
                            <option value="1">Grade 1 — ≤5% solid growth (well differentiated)</option>
                            <option value="2">Grade 2 — 6-50% solid growth (moderately differentiated)</option>
                            <option value="3">Grade 3 — &gt;50% solid growth (poorly differentiated)</option>
                          </select>
                        </div>
                      )}

                      {sys === "WHO CNS Grade" && (
                        <div className="border-t border-teal-200 dark:border-teal-700 pt-3">
                          <h5 className="font-bold text-teal-700 dark:text-teal-300 pb-2 text-[11.5px]">WHO CNS Grade</h5>
                          <select value={row.who_cns_grade} onChange={(e) => {
                            updateField("who_cns_grade", e.target.value);
                            if (e.target.value) updateField("histological_grade", `WHO Grade ${e.target.value}`);
                          }} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                            <option value="">Select</option>
                            <option value="1">Grade 1 — Low proliferation, often curable surgically</option>
                            <option value="2">Grade 2 — Infiltrating, low mitotic activity</option>
                            <option value="3">Grade 3 — High mitotic activity, anaplasia</option>
                            <option value="4">Grade 4 — Highly malignant, necrosis/angiogenesis</option>
                          </select>
                        </div>
                      )}

                      {sys === "Lung Adenocarcinoma Pattern-Based" && (
                        <div className="border-t border-teal-200 dark:border-teal-700 pt-3">
                          <h5 className="font-bold text-teal-700 dark:text-teal-300 pb-2 text-[11.5px]">Lung Adenocarcinoma Growth Patterns (%)</h5>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {[
                              ["Lepidic", "lepidic_pattern"],
                              ["Acinar", "acinar_pattern"],
                              ["Papillary", "papillary_pattern"],
                              ["Micropapillary", "micropapillary_pattern"],
                              ["Solid", "solid_pattern"],
                            ].map(([label, field]) => (
                              <div key={field}>
                                <label className="block font-semibold mb-1">{label}</label>
                                <input type="text" value={row[field as keyof typeof row] as string} onChange={(e) => updateField(field, e.target.value)} placeholder="%" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {sys === "GI / Pancreatobiliary Differentiation" && (
                        <div className="border-t border-teal-200 dark:border-teal-700 pt-3">
                          <h5 className="font-bold text-teal-700 dark:text-teal-300 pb-2 text-[11.5px]">GI / Pancreatobiliary Differentiation</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Differentiation</label>
                              <select value={row.tumor_differentiation} onChange={(e) => {
                                updateField("tumor_differentiation", e.target.value);
                                if (e.target.value && !row.histological_grade) updateField("histological_grade", e.target.value);
                              }} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                {["Well differentiated", "Moderately differentiated", "Poorly differentiated", "Undifferentiated"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Mucinous Component</label>
                              <select value={row.mucinous_component} onChange={(e) => updateField("mucinous_component", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                {["Absent", "<50%", "≥50% (mucinous carcinoma)", "Unknown"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Signet Ring Cells</label>
                              <select value={row.signet_ring_cells} onChange={(e) => updateField("signet_ring_cells", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                {["Absent", "Present (focal)", "Present (extensive)", "Unknown"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Medullary Features</label>
                              <select value={row.medullary_features} onChange={(e) => updateField("medullary_features", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                {["Absent", "Present (medullary carcinoma)", "Unknown"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {sys === "FNCLCC Sarcoma Grade" && (
                        <div className="border-t border-teal-200 dark:border-teal-700 pt-3">
                          <h5 className="font-bold text-teal-700 dark:text-teal-300 pb-2 text-[11.5px]">FNCLCC Sarcoma Grade</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">Sarcoma Grade</label>
                              <select value={row.sarcoma_grade} onChange={(e) => {
                                updateField("sarcoma_grade", e.target.value);
                                if (e.target.value) updateField("histological_grade", `FNCLCC Grade ${e.target.value}`);
                              }} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                <option value="1">Grade 1 — Low (score 2-3)</option>
                                <option value="2">Grade 2 — Intermediate (score 4-5)</option>
                                <option value="3">Grade 3 — High (score 6-8)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Mitoses / 10 HPF</label>
                              <input type="text" value={row.mitoses_per_10hpf} onChange={(e) => updateField("mitoses_per_10hpf", e.target.value)} placeholder="e.g. 8" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Tumor Necrosis (%)</label>
                              <input type="text" value={row.tumor_necrosis_percentage} onChange={(e) => updateField("tumor_necrosis_percentage", e.target.value)} placeholder="e.g. 25" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="border-t border-teal-200 dark:border-teal-700 pt-3">
                        <div className="flex items-center gap-3">
                          <label className="font-bold text-teal-700 dark:text-teal-300 whitespace-nowrap">Overall Histological Grade:</label>
                          <input
                            type="text"
                            value={row.histological_grade}
                            onChange={(e) => updateField("histological_grade", e.target.value)}
                            placeholder="Auto-populated from system or manual"
                            className={`flex-1 p-2 bg-theme-surface dark:bg-slate-800 border rounded-xl text-xs font-bold text-center ${
                              row.histological_grade ? "border-teal-300 dark:border-teal-600 text-teal-700 dark:text-teal-300" : "border-slate-200 dark:border-slate-700"
                            }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold mb-1">Notes</label>
                        <textarea value={row.grading_notes} onChange={(e) => updateField("grading_notes", e.target.value)} placeholder="Any additional grading details or remarks" rows={2} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs resize-y" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {(!formState.histologyGradingTable || formState.histologyGradingTable.length === 0) && (
                <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                  No histology grading entries added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Section: Adjuvant Therapy */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("adjuvantTherapy")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.adjuvantTherapy ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-pink-500/10 dark:bg-pink-400/20 text-pink-700 dark:text-pink-200 flex items-center justify-center">
                <FlaskConical className="h-3.5 w-3.5" />
              </span>
              <h3 className="h-section">Adjuvant Therapy</h3>
              <SectionUploadActions section="adjuvantTherapy" label="Adjuvant Therapy" />
            </div>
            {openSections.adjuvantTherapy ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.adjuvantTherapy && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wider">Therapy Records</span>
                <button type="button" onClick={() => addRow("adjuvantTherapyTable", tableTemplates.adjuvantTherapyTable)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-cyan-600 hover:underline">
                  <CirclePlus className="h-3 w-3" />
                  Add Therapy
                </button>
              </div>

              {(formState.adjuvantTherapyTable || []).map((row, idx) => {
                const uf = (field: string, value: string) => handleTableChange("adjuvantTherapyTable", idx, field, value);
                return (
                  <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 bg-white/40 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wider">Therapy #{idx + 1}</span>
                      <button type="button" onClick={() => removeRow("adjuvantTherapyTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Therapy Type</label>
                        <select value={row.therapy_type} onChange={(e) => uf("therapy_type", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                          <option value="">—</option>
                          <option value="Adjuvant Chemotherapy">Adjuvant Chemotherapy</option>
                          <option value="Adjuvant Radiotherapy">Adjuvant Radiotherapy</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Date of Commencement</label>
                        <input type="date" value={row.date_of_commencement} onChange={(e) => uf("date_of_commencement", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Regimen</label>
                        <input type="text" value={row.regimen} onChange={(e) => uf("regimen", e.target.value)} placeholder="e.g. FOLFOX, 50 Gy" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Cycles / Dose</label>
                        <input type="text" value={row.cycles_dose} onChange={(e) => uf("cycles_dose", e.target.value)} placeholder="e.g. 6 cycles, 25 fractions" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Details</label>
                        <textarea value={row.details} onChange={(e) => uf("details", e.target.value)} rows={2} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Notes</label>
                        <input type="text" value={row.notes} onChange={(e) => uf("notes", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {(!formState.adjuvantTherapyTable || formState.adjuvantTherapyTable.length === 0) && (
                <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                  No adjuvant therapy records added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pre-Operative Assessment */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("preOperativeAssessment")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.preOperativeAssessment ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-cyan-500/10 dark:bg-cyan-400/20 text-cyan-700 dark:text-cyan-200 flex items-center justify-center">
                <ClipboardCheck className="h-3.5 w-3.5" />
              </span>
              <h3 className="h-section">Pre-Operative Assessment</h3>
              <SectionUploadActions section="preOperativeAssessment" label="Pre-Operative Assessment" />
            </div>
            {openSections.preOperativeAssessment ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.preOperativeAssessment && (
            <div className="p-5 text-xs text-slate-700 dark:text-slate-350 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-[11.5px] text-slate-500">Comprehensive pre-operative workup including labs, imaging, risk assessments, and MDT discussion.</p>
                <button type="button" onClick={() => addRow("preOperativeAssessmentTable", tableTemplates.preOperativeAssessmentTable)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-cyan-600 hover:underline">
                  <CirclePlus className="h-3.5 w-3.5" /> Add Assessment
                </button>
              </div>

              {(formState.preOperativeAssessmentTable || []).map((row, idx) => {
                const uf = (field: string, value: string) => handleTableChange("preOperativeAssessmentTable", idx, field, value);
                const addLabRow = () => {
                  const current = [...(row.additional_labs || [])];
                  current.push({ test_name: "", result: "", unit: "", reference_range: "" });
                  uf("additional_labs", current as any);
                };
                const removeLabRow = (li: number) => {
                  const current = [...(row.additional_labs || [])];
                  current.splice(li, 1);
                  uf("additional_labs", current as any);
                };
                const updateLabRow = (li: number, field: string, value: string) => {
                  const current = [...(row.additional_labs || [])];
                  current[li] = { ...current[li], [field]: value };
                  uf("additional_labs", current as any);
                };
                const addImagingRow = () => {
                  const current = [...(row.additional_imaging || [])];
                  current.push({ imaging_type: "", imaging_date: "", imaging_findings: "" });
                  uf("additional_imaging", current as any);
                };
                const removeImagingRow = (ii: number) => {
                  const current = [...(row.additional_imaging || [])];
                  current.splice(ii, 1);
                  uf("additional_imaging", current as any);
                };
                const updateImagingRow = (ii: number, field: string, value: string) => {
                  const current = [...(row.additional_imaging || [])];
                  current[ii] = { ...current[ii], [field]: value };
                  uf("additional_imaging", current as any);
                };
                return (
                  <div key={idx} className="rounded-xl border border-cyan-200 dark:border-cyan-800 overflow-hidden">
                    <div className="flex justify-between items-center p-3 bg-cyan-50 dark:bg-cyan-950/30">
                      <h4 className="font-bold text-cyan-800 dark:text-cyan-200">
                        Pre-Op Assessment {idx + 1}{row.surgery_name ? ` — ${row.surgery_name}` : row.assessment_date ? ` — ${row.assessment_date}` : ""}
                      </h4>
                      <button type="button" onClick={() => removeRow("preOperativeAssessmentTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="p-4 space-y-5">
                      {/* Surgery Name & Assessment Date */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block font-semibold mb-1">Surgery Name *</label>
                          <input type="text" value={row.surgery_name} onChange={(e) => uf("surgery_name", e.target.value)} placeholder="e.g. Right Hemicolectomy, Whipple Procedure, Total Gastrectomy" className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-1">Assessment Date</label>
                          <input type="date" value={row.assessment_date} onChange={(e) => uf("assessment_date", e.target.value)} className="w-full p-2.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs" />
                        </div>
                      </div>

                      {/* 1. Pre-Op Lab Values */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Pre-Operative Lab Values</summary>
                        <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                          {([["Hb (g/dL)", "lab_hb", false], ["WBC (×10⁹/L)", "lab_wbc", false], ["Platelets (×10⁹/L)", "lab_platelets", false], ["Creatinine (μmol/L)", "lab_creatinine", false], ["eGFR (mL/min)", "lab_egfr", false], ["Albumin (g/L)", "lab_albumin", false], ["INR", "lab_inr", false], ["APTT (sec)", "lab_aptt", false], ["ALT (U/L)", "lab_alt", false], ["AST (U/L)", "lab_ast", false], ["Bilirubin (μmol/L)", "lab_bilirubin", false], ["CRP (mg/L)", "lab_crp", false], ["Troponin", "lab_troponin", false], ["BNP / NT-proBNP", "lab_bnp", false], ["Blood Group", "lab_blood_group", true]] as const).map((entry) => {
                            const label = entry[0];
                            const field = entry[1];
                            const skipInterpret = entry[2];
                            const val = row[field as keyof typeof row] as string;
                            const interp = skipInterpret ? null : interpretLabValue(field, val || '');
                            return (
                              <div key={field}>
                                <label className="block font-semibold mb-0.5 text-[11.5px] flex items-center gap-1">
                                  {label}
                                  {interp && (
                                    <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(interp.severity)}`}>
                                      {interp.text}
                                    </span>
                                  )}
                                </label>
                                <input type="text" value={val} onChange={(e) => uf(field, e.target.value)} placeholder="—" className={`w-full p-1.5 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-[11.5px] ${interp ? severityBorder(interp.severity) : 'border-slate-200 dark:border-slate-700'}`} />
                              </div>
                            );
                          })}
                          <div className="md:col-span-2">
                            <label className="block font-semibold mb-0.5 text-[11.5px]">Other Lab Values</label>
                            <input type="text" value={row.lab_other} onChange={(e) => uf("lab_other", e.target.value)} placeholder="Any other significant lab results" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                          </div>
                        </div>
                        <div className="px-3 pb-3">
                          <div className="flex items-center justify-between mt-2 mb-1">
                            <span className="text-[11.5px] font-semibold text-cyan-600 dark:text-cyan-400">Additional Lab Tests</span>
                            <button type="button" onClick={addLabRow} className="inline-flex items-center gap-0.5 text-[11.5px] font-bold text-cyan-600 hover:underline">
                              <CirclePlus className="h-3 w-3" /> Add Test
                            </button>
                          </div>
                          {(row.additional_labs || []).length > 0 && (
                            <div className="space-y-1">
                              {(row.additional_labs || []).map((lab, li) => (
                                <div key={li} className="grid grid-cols-[1fr_1fr_0.7fr_0.7fr_auto] gap-1 items-center">
                                  <input type="text" value={lab.test_name} onChange={(e) => updateLabRow(li, "test_name", e.target.value)} placeholder="Test name" className="p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  <input type="text" value={lab.result} onChange={(e) => updateLabRow(li, "result", e.target.value)} placeholder="Result" className="p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  <input type="text" value={lab.unit} onChange={(e) => updateLabRow(li, "unit", e.target.value)} placeholder="Unit" className="p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  <input type="text" value={lab.reference_range} onChange={(e) => updateLabRow(li, "reference_range", e.target.value)} placeholder="Ref range" className="p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  <button type="button" onClick={() => removeLabRow(li)} className="text-rose-500 hover:text-rose-700 p-1"><Trash className="h-3 w-3" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                          {(!row.additional_labs || row.additional_labs.length === 0) && (
                            <p className="text-[9px] text-slate-400 mt-1">Add custom lab tests not listed above.</p>
                          )}
                        </div>
                      </details>

                      {/* 2. Baseline Imaging */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Baseline Imaging</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold mb-1">Imaging Type</label>
                            <select value={row.baseline_imaging_type} onChange={(e) => uf("baseline_imaging_type", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["CT Chest/Abdomen/Pelvis", "CT Chest", "CT Abdomen/Pelvis", "MRI", "PET-CT", "PET-MRI", "Ultrasound", "Mammography", "Bone Scan", "X-Ray", "Other"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Date</label>
                            <input type="date" value={row.baseline_imaging_date} onChange={(e) => uf("baseline_imaging_date", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Key Findings</label>
                            <input type="text" value={row.baseline_imaging_findings} onChange={(e) => uf("baseline_imaging_findings", e.target.value)} placeholder="e.g. T3N1M0, 4cm mass" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                        <div className="px-3 pb-3">
                          <div className="flex items-center justify-between mt-2 mb-1">
                            <span className="text-[11.5px] font-semibold text-cyan-600 dark:text-cyan-400">Additional Imaging Studies</span>
                            <button type="button" onClick={addImagingRow} className="inline-flex items-center gap-0.5 text-[11.5px] font-bold text-cyan-600 hover:underline">
                              <CirclePlus className="h-3 w-3" /> Add Imaging
                            </button>
                          </div>
                          {(row.additional_imaging || []).length > 0 && (
                            <div className="space-y-1">
                              {(row.additional_imaging || []).map((img, ii) => (
                                <div key={ii} className="grid grid-cols-[1.2fr_0.8fr_1fr_auto] gap-1 items-center">
                                  <select value={img.imaging_type} onChange={(e) => updateImagingRow(ii, "imaging_type", e.target.value)} className="p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                    <option value="">Select modality</option>
                                    {["CT Chest/Abdomen/Pelvis", "CT Chest", "CT Abdomen/Pelvis", "MRI", "PET-CT", "PET-MRI", "Ultrasound", "Mammography", "Bone Scan", "X-Ray", "Other"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                  <input type="date" value={img.imaging_date} onChange={(e) => updateImagingRow(ii, "imaging_date", e.target.value)} className="p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  <input type="text" value={img.imaging_findings} onChange={(e) => updateImagingRow(ii, "imaging_findings", e.target.value)} placeholder="Key findings" className="p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  <button type="button" onClick={() => removeImagingRow(ii)} className="text-rose-500 hover:text-rose-700 p-1"><Trash className="h-3 w-3" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                          {(!row.additional_imaging || row.additional_imaging.length === 0) && (
                            <p className="text-[9px] text-slate-400 mt-1">Add additional imaging studies beyond the baseline.</p>
                          )}
                        </div>
                      </details>

                      {/* 3. Surgical Candidacy */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Surgical Candidacy</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Candidacy Status
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretSelect('surgical_candidacy', row.surgical_candidacy))}
                            </label>
                            <select value={row.surgical_candidacy} onChange={(e) => uf("surgical_candidacy", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${selectBorder(row.surgical_candidacy, SELECT_SEVERITY.surgical_candidacy)}`}>
                              <option value="">Select</option>
                              {["Candidate — planned", "Candidate — deferred", "Borderline candidate", "Not a candidate", "Under evaluation", "Already resected"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-semibold mb-1">Notes</label>
                            <input type="text" value={row.surgical_candidacy_notes} onChange={(e) => uf("surgical_candidacy_notes", e.target.value)} placeholder="Rationale for candidacy decision" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                      </details>

                      {/* 4. Anesthetic Risk */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Anesthetic Risk Assessment (ASA)</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              ASA Class
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretSelect('asa_class', row.asa_class))}
                            </label>
                            <select value={row.asa_class} onChange={(e) => uf("asa_class", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${selectBorder(row.asa_class, SELECT_SEVERITY.asa_class)}`}>
                              <option value="">Select</option>
                              {["ASA I — Normal healthy", "ASA II — Mild systemic disease", "ASA III — Severe systemic disease", "ASA IV — Severe life-threatening disease", "ASA V — Moribund, not expected to survive", "ASA VI — Brain-dead organ donor"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-semibold mb-1">Notes</label>
                            <input type="text" value={row.asa_notes} onChange={(e) => uf("asa_notes", e.target.value)} placeholder="Anesthesia considerations" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                      </details>

                      {/* 5. Margin Status Expectation */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Margin Status Expectation</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Expected Margin
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretSelect('margin_status_expectation', row.margin_status_expectation))}
                            </label>
                            <select value={row.margin_status_expectation} onChange={(e) => uf("margin_status_expectation", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${selectBorder(row.margin_status_expectation, SELECT_SEVERITY.margin_status_expectation)}`}>
                              <option value="">Select</option>
                              {["R0 — Negative margins expected", "R1 — Microscopic positive margin possible", "R2 — Macroscopic residual expected", "Unsure / Depends on intra-op findings"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-semibold mb-1">Notes</label>
                            <input type="text" value={row.margin_notes} onChange={(e) => uf("margin_notes", e.target.value)} placeholder="e.g. aiming for 1cm clearance" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                      </details>

                      {/* 6. Expected Resection Extent */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Expected Extent of Resection</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold mb-1">Extent</label>
                            <select value={row.expected_resection_extent} onChange={(e) => uf("expected_resection_extent", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Wide local excision", "Segmental resection", "Lobectomy", "Pneumonectomy", "Hemihepatectomy", "Whipple / Pancreaticoduodenectomy", "Total gastrectomy", "Partial gastrectomy", "Colectomy (right/left)", "Total mesorectal excision", "Abdominoperineal resection", "Nephrectomy (radical)", "Nephrectomy (partial)", "Cystectomy (radical)", "Hysterectomy (radical)", "Hysterectomy (total)", "Maximal safe resection (CNS)", "Debulking / Cytoreduction", "Excisional biopsy", "Other"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-semibold mb-1">Details</label>
                            <input type="text" value={row.expected_resection_notes} onChange={(e) => uf("expected_resection_notes", e.target.value)} placeholder="Specific structures to be resected" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                      </details>

                      {/* 7. Expected Lymphadenectomy */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Expected Lymphadenectomy Extent</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold mb-1">Lymphadenectomy</label>
                            <select value={row.expected_lymphadenectomy} onChange={(e) => uf("expected_lymphadenectomy", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Sentinel node biopsy only", "Sampling (limited)", "Regional lymphadenectomy", "D2 lymphadenectomy", "D3 lymphadenectomy", "Pelvic lymph node dissection", "Para-aortic lymph node dissection", "Mediastinal lymph node dissection", "Cervical lymph node dissection", "Axillary lymph node dissection", "Inguinal lymph node dissection", "No lymphadenectomy planned"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Node Levels</label>
                            <input type="text" value={row.expected_lymph_node_levels} onChange={(e) => uf("expected_lymph_node_levels", e.target.value)} placeholder="e.g. Levels I-III" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Target Node Count</label>
                            <input type="text" value={row.expected_lymph_node_count} onChange={(e) => uf("expected_lymph_node_count", e.target.value)} placeholder="e.g. ≥ 12 nodes" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                      </details>

                      {/* 8. Cardiac Assessment */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Cardiac Assessment</summary>
                        <div className="p-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Status
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretCategoricalSeverity('cardiac', row.cardiac_assessment_status))}
                              </label>
                              <select value={row.cardiac_assessment_status} onChange={(e) => uf("cardiac_assessment_status", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretCategoricalSeverity('cardiac', row.cardiac_assessment_status))}`}>
                                <option value="">Select</option>
                                {["Normal — no significant cardiac history", "Known CAD — stable", "Known CAD — unstable", "Heart failure — compensated", "Heart failure — decompensated", "Arrhythmia — controlled", "Arrhythmia — uncontrolled", "Valvular disease — mild", "Valvular disease — moderate/severe", "Not assessed"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Risk Stratification
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretSelect('cardiac_risk_stratification', row.cardiac_risk_stratification))}
                              </label>
                              <select value={row.cardiac_risk_stratification} onChange={(e) => uf("cardiac_risk_stratification", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${selectBorder(row.cardiac_risk_stratification, SELECT_SEVERITY.cardiac_risk_stratification)}`}>
                                <option value="">Select</option>
                                {["Low risk (RCRI 0)", "Intermediate risk (RCRI 1-2)", "High risk (RCRI ≥ 3)", "Indeterminate / Further testing needed"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>
                          <details className="border border-sky-200 dark:border-sky-700/40 rounded-lg overflow-hidden" open>
                            <summary className="p-2 bg-sky-50/50 dark:bg-sky-950/20 font-bold text-sky-700 dark:text-sky-300 cursor-pointer text-[11.5px]">RCRI Components {row.cardiac_risk_manual ? '(manual)' : '(auto-calc)'}</summary>
                            <div className="p-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                              {[["rcri_high_risk_surgery", "High-risk surgery (intraperitoneal/intrathoracic/suprainguinal vascular)"], ["rcri_ischemic_heart_disease", "History of ischemic heart disease"], ["rcri_heart_failure", "History of heart failure"], ["rcri_cerebrovascular_disease", "History of cerebrovascular disease"], ["rcri_insulin_diabetes", "Insulin-dependent diabetes"], ["rcri_renal_dysfunction", "Preop creatinine > 2 mg/dL / eGFR < 60"]].map(([fld, lbl]) => (
                                <div key={fld}>
                                  <label className="block font-semibold mb-0.5 text-[9px]">{lbl}</label>
                                  <select value={(row as any)[fld]} onChange={(e) => uf(fld, e.target.value)} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                    <option value="">—</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                  </select>
                                </div>
                              ))}
                              {(() => {
                                const flds = ['rcri_high_risk_surgery','rcri_ischemic_heart_disease','rcri_heart_failure','rcri_cerebrovascular_disease','rcri_insulin_diabetes','rcri_renal_dysfunction'];
                                let score = 0;
                                flds.forEach(f => { if ((row as any)[f] === 'yes') score++; });
                                const cat = score === 0 ? "Low risk (RCRI 0)" : score <= 2 ? "Intermediate risk (RCRI 1-2)" : "High risk (RCRI ≥ 3)";
                                const isAuto = row.cardiac_risk_manual !== 'manual';
                                const currentRisk = row.cardiac_risk_stratification;
                                const matches = isAuto && score > 0 && currentRisk === cat;
                                return (
                                  <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                      <label className="block font-semibold mb-0.5 text-[9px] text-sky-600 dark:text-sky-400">RCRI Score (auto)</label>
                                      <input type="text" value={score > 0 ? String(score) : ''} readOnly placeholder="0-6" className={`w-full p-1 ${score > 0 ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-700 text-sky-700 dark:text-sky-300' : 'bg-theme-surface dark:bg-slate-800 border-slate-200 dark:border-slate-700'} border rounded text-[11.5px] font-bold`} />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block font-semibold mb-0.5 text-[9px]">Risk (auto)</label>
                                      <input type="text" value={score > 0 ? cat : ''} readOnly placeholder="—" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                    </div>
                                    <div>
                                      <label className="block font-semibold mb-0.5 text-[9px]">Manual</label>
                                      <select value={row.cardiac_risk_manual} onChange={(e) => {
                                        uf("cardiac_risk_manual", e.target.value);
                                        if (e.target.value !== 'manual' && score > 0) {
                                          uf('rcri_score_auto', String(score));
                                          uf('cardiac_risk_stratification', cat);
                                        }
                                      }} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                        <option value="">Auto</option>
                                        <option value="manual">Manual</option>
                                      </select>
                                    </div>
                                    {!matches && score > 0 && isAuto && (
                                      <button type="button" onClick={() => { uf('rcri_score_auto', String(score)); uf('cardiac_risk_stratification', cat); }} className="p-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded text-[11.5px] font-bold whitespace-nowrap">Apply</button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </details>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">ECG Findings</label>
                              <input type="text" value={row.cardiac_ecg_findings} onChange={(e) => uf("cardiac_ecg_findings", e.target.value)} placeholder="Normal sinus rhythm / ST changes / etc." className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Echocardiography Findings</label>
                              <input type="text" value={row.cardiac_echo_findings} onChange={(e) => uf("cardiac_echo_findings", e.target.value)} placeholder="EF%, wall motion, valve function" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Cardiac Clearance
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretSelect('cardiac_clearance', row.cardiac_clearance))}
                              </label>
                              <select value={row.cardiac_clearance} onChange={(e) => uf("cardiac_clearance", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${selectBorder(row.cardiac_clearance, SELECT_SEVERITY.cardiac_clearance)}`}>
                                <option value="">Select</option>
                                {["Cleared for surgery", "Cleared with precautions", "Deferred — further workup needed", "Not cleared", "Not applicable"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Notes</label>
                              <input type="text" value={row.cardiac_notes} onChange={(e) => uf("cardiac_notes", e.target.value)} placeholder="Cardiology recommendations" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                          </div>
                        </div>
                      </details>

                      {/* 9. Pulmonary Assessment */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Pulmonary Assessment</summary>
                        <div className="p-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Status
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretCategoricalSeverity('pulmonary', row.pulmonary_assessment_status))}
                              </label>
                              <select value={row.pulmonary_assessment_status} onChange={(e) => uf("pulmonary_assessment_status", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretCategoricalSeverity('pulmonary', row.pulmonary_assessment_status))}`}>
                                <option value="">Select</option>
                                {["Normal pulmonary function", "COPD — mild", "COPD — moderate", "COPD — severe", "Restrictive lung disease", "Asthma — controlled", "Asthma — uncontrolled", "OSA — treated", "OSA — untreated", "Not assessed"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Risk Stratification
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretSelect('pulmonary_risk_stratification', row.pulmonary_risk_stratification))}
                              </label>
                              <select value={row.pulmonary_risk_stratification} onChange={(e) => uf("pulmonary_risk_stratification", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${selectBorder(row.pulmonary_risk_stratification, SELECT_SEVERITY.pulmonary_risk_stratification)}`}>
                                <option value="">Select</option>
                                {["Low risk", "Intermediate risk", "High risk", "Indeterminate"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>
                          <details className="border border-sky-200 dark:border-sky-700/40 rounded-lg overflow-hidden" open>
                            <summary className="p-2 bg-sky-50/50 dark:bg-sky-950/20 font-bold text-sky-700 dark:text-sky-300 cursor-pointer text-[11.5px]">Pulmonary Risk Components {row.pulmonary_risk_manual ? '(manual)' : '(auto-calc)'}</summary>
                            <div className="p-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                              {[["pulm_age_risk", "Age > 50 years"], ["pulm_spo2_risk", "Preop SpO2 < 95%"], ["pulm_upper_surgery", "Upper abdominal / thoracic surgery"], ["pulm_copd", "COPD / chronic lung disease"], ["pulm_smoking", "Current smoker"], ["pulm_emergency", "Emergency surgery"]].map(([fld, lbl]) => (
                                <div key={fld}>
                                  <label className="block font-semibold mb-0.5 text-[9px]">{lbl}</label>
                                  <select value={(row as any)[fld]} onChange={(e) => uf(fld, e.target.value)} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                    <option value="">—</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                  </select>
                                </div>
                              ))}
                              {(() => {
                                const pflds = ['pulm_age_risk','pulm_spo2_risk','pulm_upper_surgery','pulm_copd','pulm_smoking','pulm_emergency'];
                                let pscore = 0;
                                pflds.forEach(f => { if ((row as any)[f] === 'yes') pscore++; });
                                const pcat = pscore <= 1 ? "Low risk" : pscore <= 3 ? "Intermediate risk" : "High risk";
                                const isAuto = row.pulmonary_risk_manual !== 'manual';
                                const curRisk = row.pulmonary_risk_stratification;
                                const match = isAuto && pscore > 0 && curRisk === pcat;
                                return (
                                  <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                      <label className="block font-semibold mb-0.5 text-[9px] text-sky-600 dark:text-sky-400">Risk Score (auto)</label>
                                      <input type="text" value={pscore > 0 ? String(pscore) : ''} readOnly placeholder="0-6" className={`w-full p-1 ${pscore > 0 ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-700 text-sky-700 dark:text-sky-300' : 'bg-theme-surface dark:bg-slate-800 border-slate-200 dark:border-slate-700'} border rounded text-[11.5px] font-bold`} />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block font-semibold mb-0.5 text-[9px]">Risk (auto)</label>
                                      <input type="text" value={pscore > 0 ? pcat : ''} readOnly placeholder="—" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                    </div>
                                    <div>
                                      <label className="block font-semibold mb-0.5 text-[9px]">Manual</label>
                                      <select value={row.pulmonary_risk_manual} onChange={(e) => {
                                        uf("pulmonary_risk_manual", e.target.value);
                                        if (e.target.value !== 'manual' && pscore > 0) uf('pulmonary_risk_stratification', pcat);
                                      }} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                        <option value="">Auto</option>
                                        <option value="manual">Manual</option>
                                      </select>
                                    </div>
                                    {!match && pscore > 0 && isAuto && (
                                      <button type="button" onClick={() => uf('pulmonary_risk_stratification', pcat)} className="p-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded text-[11.5px] font-bold whitespace-nowrap">Apply</button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </details>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">PFT Findings</label>
                              <input type="text" value={row.pulmonary_pft_findings} onChange={(e) => uf("pulmonary_pft_findings", e.target.value)} placeholder="FEV1, FVC, DLCO, etc." className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Imaging Findings</label>
                              <input type="text" value={row.pulmonary_imaging_findings} onChange={(e) => uf("pulmonary_imaging_findings", e.target.value)} placeholder="Chest X-ray / CT findings" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Pulmonary Clearance
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretSelect('pulmonary_clearance', row.pulmonary_clearance))}
                              </label>
                              <select value={row.pulmonary_clearance} onChange={(e) => uf("pulmonary_clearance", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${selectBorder(row.pulmonary_clearance, SELECT_SEVERITY.pulmonary_clearance)}`}>
                                <option value="">Select</option>
                                {["Cleared for surgery", "Cleared with precautions", "Deferred — further workup", "Not cleared", "Not applicable"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Notes</label>
                              <input type="text" value={row.pulmonary_notes} onChange={(e) => uf("pulmonary_notes", e.target.value)} placeholder="Respiratory recommendations" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                          </div>
                        </div>
                      </details>

                      {/* Liver Assessment */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Liver Assessment</summary>
                        <div className="p-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Liver Status
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretLiverKidney('liver_assessment_status', row.liver_assessment_status))}
                              </label>
                              <select value={row.liver_assessment_status} onChange={(e) => uf("liver_assessment_status", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretLiverKidney('liver_assessment_status', row.liver_assessment_status))}`}>
                                <option value="">Select</option>
                                {["Normal liver function", "Chronic liver disease — compensated", "Chronic liver disease — decompensated", "Cirrhosis — compensated", "Cirrhosis — decompensated", "Fatty liver / NAFLD", "Alcohol-related liver disease", "Hepatitis B — carrier", "Hepatitis B — active", "Hepatitis C — treated", "Hepatitis C — active", "Not assessed"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Portal Hypertension
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretCategoricalSeverity('portal', row.liver_portal_hypertension))}
                              </label>
                              <select value={row.liver_portal_hypertension} onChange={(e) => uf("liver_portal_hypertension", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretCategoricalSeverity('portal', row.liver_portal_hypertension))}`}>
                                <option value="">Select</option>
                                {["Absent", "Mild (varices, no bleeding)", "Moderate (varices, prior bleeding)", "Severe (ascites, encephalopathy)", "Not assessed"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>
                          <h6 className="text-[11.5px] font-semibold text-cyan-600 dark:text-cyan-400 mt-2">Scoring Systems</h6>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Child-Pugh Score
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.liver_child_pugh_score, 5, 6, 7, 9, 10, 15))}
                              </label>
                              <input type="text" value={row.liver_child_pugh_score} onChange={(e) => uf("liver_child_pugh_score", e.target.value)} placeholder="5-15" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.liver_child_pugh_score, 5, 6, 7, 9, 10, 15))}`} />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Child-Pugh Grade
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretLiverKidney('liver_child_pugh_grade', row.liver_child_pugh_grade))}
                              </label>
                              <select value={row.liver_child_pugh_grade} onChange={(e) => uf("liver_child_pugh_grade", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretLiverKidney('liver_child_pugh_grade', row.liver_child_pugh_grade))}`}>
                                <option value="">Select</option>
                                <option value="A">A (5-6 pts — well-compensated)</option>
                                <option value="B">B (7-9 pts — significant impairment)</option>
                                <option value="C">C (10-15 pts — decompensated)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                MELD Score
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.liver_meld_score, 6, 10, 11, 19, 20, 40))}
                              </label>
                              <input type="text" value={row.liver_meld_score} onChange={(e) => uf("liver_meld_score", e.target.value)} placeholder="e.g. 12" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.liver_meld_score, 6, 10, 11, 19, 20, 40))}`} />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                MELD-Na Score
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.liver_meld_na_score, 6, 10, 11, 19, 20, 40))}
                              </label>
                              <input type="text" value={row.liver_meld_na_score} onChange={(e) => uf("liver_meld_na_score", e.target.value)} placeholder="e.g. 14" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.liver_meld_na_score, 6, 10, 11, 19, 20, 40))}`} />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                ALBI Grade
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretLiverKidney('liver_albi_grade', row.liver_albi_grade))}
                              </label>
                              <select value={row.liver_albi_grade} onChange={(e) => uf("liver_albi_grade", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretLiverKidney('liver_albi_grade', row.liver_albi_grade))}`}>
                                <option value="">Select</option>
                                <option value="1">Grade 1 (≤ -2.60) — good liver function</option>
                                <option value="2">Grade 2 (&gt; -2.60 to ≤ -1.39) — intermediate</option>
                                <option value="3">Grade 3 (&gt; -1.39) — poor liver function</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Fibrosis Stage
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretLiverKidney('liver_fibrosis_stage', row.liver_fibrosis_stage))}
                              </label>
                              <select value={row.liver_fibrosis_stage} onChange={(e) => uf("liver_fibrosis_stage", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretLiverKidney('liver_fibrosis_stage', row.liver_fibrosis_stage))}`}>
                                <option value="">Select</option>
                                <option value="F0">F0 — No fibrosis</option>
                                <option value="F1">F1 — Mild (portal fibrosis)</option>
                                <option value="F2">F2 — Moderate (periportal fibrosis)</option>
                                <option value="F3">F3 — Severe (bridging fibrosis)</option>
                                <option value="F4">F4 — Cirrhosis</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Steatosis
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretCategoricalSeverity('steatosis', row.liver_steatosis))}
                              </label>
                              <select value={row.liver_steatosis} onChange={(e) => uf("liver_steatosis", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretCategoricalSeverity('steatosis', row.liver_steatosis))}`}>
                                <option value="">Select</option>
                                <option value="None">None</option>
                                <option value="Mild (&lt;33%)">Mild (&lt;33%)</option>
                                <option value="Moderate (33-66%)">Moderate (33-66%)</option>
                                <option value="Severe (&gt;66%)">Severe (&gt;66%)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Notes</label>
                              <input type="text" value={row.liver_notes} onChange={(e) => uf("liver_notes", e.target.value)} placeholder="Hepatology recommendations" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                          </div>
                          <details className="border border-sky-200 dark:border-sky-700/40 rounded-lg overflow-hidden" open>
                            <summary className="p-2 bg-sky-50/50 dark:bg-sky-950/20 font-bold text-sky-700 dark:text-sky-300 cursor-pointer text-[11.5px]">Child-Pugh Components {row.child_pugh_manual ? '(manual)' : '(auto-calc)'}</summary>
                            <div className="p-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                              <div>
                                <label className="block font-semibold mb-0.5 text-[9px]">Total Bilirubin</label>
                                <select value={row.cp_bilirubin} onChange={(e) => uf("cp_bilirubin", e.target.value)} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                  <option value="">—</option>
                                  <option value="1">&lt;2 mg/dL (&lt;34 μmol/L) — 1 pt</option>
                                  <option value="2">2-3 mg/dL (34-50 μmol/L) — 2 pts</option>
                                  <option value="3">&gt;3 mg/dL (&gt;50 μmol/L) — 3 pts</option>
                                </select>
                              </div>
                              <div>
                                <label className="block font-semibold mb-0.5 text-[9px]">Albumin</label>
                                <select value={row.cp_albumin} onChange={(e) => uf("cp_albumin", e.target.value)} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                  <option value="">—</option>
                                  <option value="1">&gt;3.5 g/dL (&gt;35 g/L) — 1 pt</option>
                                  <option value="2">2.8-3.5 g/dL (28-35 g/L) — 2 pts</option>
                                  <option value="3">&lt;2.8 g/dL (&lt;28 g/L) — 3 pts</option>
                                </select>
                              </div>
                              <div>
                                <label className="block font-semibold mb-0.5 text-[9px]">INR</label>
                                <select value={row.cp_inr} onChange={(e) => uf("cp_inr", e.target.value)} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                  <option value="">—</option>
                                  <option value="1">&lt;1.7 — 1 pt</option>
                                  <option value="2">1.7-2.3 — 2 pts</option>
                                  <option value="3">&gt;2.3 — 3 pts</option>
                                </select>
                              </div>
                              <div>
                                <label className="block font-semibold mb-0.5 text-[9px]">Ascites</label>
                                <select value={row.cp_ascites} onChange={(e) => uf("cp_ascites", e.target.value)} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                  <option value="">—</option>
                                  <option value="1">None — 1 pt</option>
                                  <option value="2">Mild-Moderate (diuretic-responsive) — 2 pts</option>
                                  <option value="3">Severe (refractory) — 3 pts</option>
                                </select>
                              </div>
                              <div>
                                <label className="block font-semibold mb-0.5 text-[9px]">Encephalopathy</label>
                                <select value={row.cp_encephalopathy} onChange={(e) => uf("cp_encephalopathy", e.target.value)} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                  <option value="">—</option>
                                  <option value="1">None — 1 pt</option>
                                  <option value="2">Grade 1-2 (West Haven) — 2 pts</option>
                                  <option value="3">Grade 3-4 (West Haven) — 3 pts</option>
                                </select>
                              </div>
                              {(() => {
                                const bili = parseInt(row.cp_bilirubin) || 0;
                                const alb = parseInt(row.cp_albumin) || 0;
                                const inr = parseInt(row.cp_inr) || 0;
                                const asc = parseInt(row.cp_ascites) || 0;
                                const enc = parseInt(row.cp_encephalopathy) || 0;
                                const total = bili + alb + inr + asc + enc;
                                const hasAny = bili > 0 || alb > 0 || inr > 0 || asc > 0 || enc > 0;
                                let grade = '';
                                if (total >= 5 && total <= 6) grade = 'A';
                                else if (total >= 7 && total <= 9) grade = 'B';
                                else if (total >= 10) grade = 'C';
                                const isAuto = row.child_pugh_manual !== 'manual';
                                const scoreMatches = isAuto && total >= 5 && row.liver_child_pugh_score === String(total);
                                const gradeMatches = isAuto && grade && row.liver_child_pugh_grade === grade;
                                return (
                                  <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                      <label className="block font-semibold mb-0.5 text-[9px] text-sky-600 dark:text-sky-400">Total (auto)</label>
                                      <input type="text" value={total >= 5 ? String(total) : hasAny ? `${total} (incomplete)` : ''} readOnly className={`w-full p-1 ${hasAny ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-700 text-sky-700 dark:text-sky-300' : 'bg-theme-surface dark:bg-slate-800 border-slate-200 dark:border-slate-700'} border rounded text-[11.5px] font-bold`} />
                                    </div>
                                    <div className="flex-1">
                                      <label className="block font-semibold mb-0.5 text-[9px]">Grade (auto)</label>
                                      <input type="text" value={grade || ''} readOnly placeholder="—" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                    </div>
                                    <div>
                                      <label className="block font-semibold mb-0.5 text-[9px]">Manual</label>
                                      <select value={row.child_pugh_manual} onChange={(e) => {
                                        uf("child_pugh_manual", e.target.value);
                                        if (e.target.value !== 'manual' && total >= 5) {
                                          uf('liver_child_pugh_score', String(total));
                                          if (grade) uf('liver_child_pugh_grade', grade);
                                        }
                                      }} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                        <option value="">Auto</option>
                                        <option value="manual">Manual</option>
                                      </select>
                                    </div>
                                    {total >= 5 && (!scoreMatches || !gradeMatches) && isAuto && (
                                      <button type="button" onClick={() => { uf('liver_child_pugh_score', String(total)); if (grade) uf('liver_child_pugh_grade', grade); }} className="p-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded text-[11.5px] font-bold whitespace-nowrap">Apply</button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                    </details>
                  </div>
                      </details>

                      {/* Kidney Assessment */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Kidney / Renal Assessment</summary>
                        <div className="p-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Kidney Status
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretLiverKidney('kidney_assessment_status', row.kidney_assessment_status))}
                              </label>
                              <select value={row.kidney_assessment_status} onChange={(e) => uf("kidney_assessment_status", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretLiverKidney('kidney_assessment_status', row.kidney_assessment_status))}`}>
                                <option value="">Select</option>
                                {["Normal kidney function", "Acute kidney injury (AKI)", "Chronic kidney disease", "Solitary kidney", "Polycystic kidney disease", "Diabetic nephropathy", "Hypertensive nephropathy", "Obstructive uropathy", "Not assessed"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                eGFR Category
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretLiverKidney('kidney_egfr_category', row.kidney_egfr_category))}
                              </label>
                              <select value={row.kidney_egfr_category} onChange={(e) => uf("kidney_egfr_category", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretLiverKidney('kidney_egfr_category', row.kidney_egfr_category))}`}>
                                <option value="">Select</option>
                                <option value="G1 (≥90)">G1 (≥90 mL/min) — Normal</option>
                                <option value="G2 (60-89)">G2 (60-89 mL/min) — Mildly decreased</option>
                                <option value="G3a (45-59)">G3a (45-59 mL/min) — Mild-moderate</option>
                                <option value="G3b (30-44)">G3b (30-44 mL/min) — Moderate-severe</option>
                                <option value="G4 (15-29)">G4 (15-29 mL/min) — Severely decreased</option>
                                <option value="G5 (&lt;15)">G5 (&lt;15 mL/min) — Kidney failure</option>
                              </select>
                            </div>
                          </div>
                          <h6 className="text-[11.5px] font-semibold text-cyan-600 dark:text-cyan-400 mt-2">Scoring Systems</h6>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                CKD Stage
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretLiverKidney('kidney_ckd_stage', row.kidney_ckd_stage))}
                              </label>
                              <select value={row.kidney_ckd_stage} onChange={(e) => uf("kidney_ckd_stage", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretLiverKidney('kidney_ckd_stage', row.kidney_ckd_stage))}`}>
                                <option value="">Select</option>
                                <option value="Stage 1">Stage 1 — eGFR ≥ 90, kidney damage present</option>
                                <option value="Stage 2">Stage 2 — eGFR 60-89, mild CKD</option>
                                <option value="Stage 3a">Stage 3a — eGFR 45-59, mild-moderate CKD</option>
                                <option value="Stage 3b">Stage 3b — eGFR 30-44, moderate-severe CKD</option>
                                <option value="Stage 4">Stage 4 — eGFR 15-29, severe CKD</option>
                                <option value="Stage 5">Stage 5 — eGFR &lt; 15, kidney failure</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                RIFLE Stage
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretLiverKidney('kidney_rifle_stage', row.kidney_rifle_stage))}
                              </label>
                              <select value={row.kidney_rifle_stage} onChange={(e) => uf("kidney_rifle_stage", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretLiverKidney('kidney_rifle_stage', row.kidney_rifle_stage))}`}>
                                <option value="">Select</option>
                                <option value="Risk">R — Risk (Cr ↑ 1.5× or UO &lt;0.5 mL/kg × 6h)</option>
                                <option value="Injury">I — Injury (Cr ↑ 2× or UO &lt;0.5 mL/kg × 12h)</option>
                                <option value="Failure">F — Failure (Cr ↑ 3× or Cr ≥ 354 or UO &lt;0.3 mL/kg × 24h)</option>
                                <option value="Loss">L — Loss (persistent failure &gt; 4 weeks)</option>
                                <option value="ESRD">E — ESRD (failure &gt; 3 months)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                AKIN Stage
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretLiverKidney('kidney_akin_stage', row.kidney_akin_stage))}
                              </label>
                              <select value={row.kidney_akin_stage} onChange={(e) => uf("kidney_akin_stage", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretLiverKidney('kidney_akin_stage', row.kidney_akin_stage))}`}>
                                <option value="">Select</option>
                                <option value="Stage 1">Stage 1 — Cr ↑ ≥ 0.3 mg/dL or ≥ 1.5-2×</option>
                                <option value="Stage 2">Stage 2 — Cr ↑ &gt; 2-3×</option>
                                <option value="Stage 3">Stage 3 — Cr ↑ &gt; 3× or Cr ≥ 354 or RRT</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                KDIGO Stage
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretLiverKidney('kidney_kdigo_stage', row.kidney_kdigo_stage))}
                              </label>
                              <select value={row.kidney_kdigo_stage} onChange={(e) => uf("kidney_kdigo_stage", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretLiverKidney('kidney_kdigo_stage', row.kidney_kdigo_stage))}`}>
                                <option value="">Select</option>
                                <option value="Stage 1">Stage 1 — Cr 1.5-1.9× baseline or ↑ ≥ 0.3 mg/dL</option>
                                <option value="Stage 2">Stage 2 — Cr 2-2.9× baseline</option>
                                <option value="Stage 3">Stage 3 — Cr ≥ 3× or Cr ≥ 4.0 or RRT</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Urine ACR (mg/g)
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.kidney_urine_acr, 0, 30, 31, 300, 301, 1000))}
                              </label>
                              <input type="text" value={row.kidney_urine_acr} onChange={(e) => uf("kidney_urine_acr", e.target.value)} placeholder="e.g. 30" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.kidney_urine_acr, 0, 30, 31, 300, 301, 1000))}`} />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1 flex items-center gap-1">
                                Proteinuria
                                {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretCategoricalSeverity('proteinuria', row.kidney_proteinuria))}
                              </label>
                              <select value={row.kidney_proteinuria} onChange={(e) => uf("kidney_proteinuria", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretCategoricalSeverity('proteinuria', row.kidney_proteinuria))}`}>
                                <option value="">Select</option>
                                <option value="None / Trace">None / Trace</option>
                                <option value="Mild (1+)">Mild (1+)</option>
                                <option value="Moderate (2+)">Moderate (2+)</option>
                                <option value="Severe (3+ or &gt;3g/day)">Severe (3+ or &gt;3g/day)</option>
                                <option value="Nephrotic range">Nephrotic range</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block font-semibold mb-1">Notes</label>
                              <input type="text" value={row.kidney_notes} onChange={(e) => uf("kidney_notes", e.target.value)} placeholder="Nephrology recommendations" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                          </div>
                        </div>
                      </details>

                      {/* 10. Metabolic Risk */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Metabolic Risk Assessment</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Diabetes Status
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretCategoricalSeverity('diabetes', row.metabolic_diabetes_status))}
                            </label>
                            <select value={row.metabolic_diabetes_status} onChange={(e) => uf("metabolic_diabetes_status", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretCategoricalSeverity('diabetes', row.metabolic_diabetes_status))}`}>
                              <option value="">Select</option>
                              {["No diabetes", "Type 1 — controlled", "Type 1 — uncontrolled", "Type 2 — diet-controlled", "Type 2 — oral agents", "Type 2 — insulin", "Type 2 — uncontrolled", "Prediabetes", "Unknown"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              HbA1c (%)
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.metabolic_hba1c, 0, 5.6, 5.7, 6.4, 6.5, 99))}
                            </label>
                            <input type="text" value={row.metabolic_hba1c} onChange={(e) => uf("metabolic_hba1c", e.target.value)} placeholder="e.g. 6.5" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.metabolic_hba1c, 0, 5.6, 5.7, 6.4, 6.5, 99))}`} />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Nutritional Status
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretCategoricalSeverity('nutrition', row.metabolic_nutritional_status))}
                            </label>
                            <select value={row.metabolic_nutritional_status} onChange={(e) => uf("metabolic_nutritional_status", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretCategoricalSeverity('nutrition', row.metabolic_nutritional_status))}`}>
                              <option value="">Select</option>
                              {["Well-nourished", "Mild malnutrition", "Moderate malnutrition", "Severe malnutrition", "Obese (BMI ≥ 30)", "Cachectic", "Not assessed"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Risk Stratification
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretCategoricalSeverity('metabolic_risk', row.metabolic_risk_stratification))}
                            </label>
                            <select value={row.metabolic_risk_stratification} onChange={(e) => uf("metabolic_risk_stratification", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretCategoricalSeverity('metabolic_risk', row.metabolic_risk_stratification))}`}>
                              <option value="">Select</option>
                              {["Low metabolic risk", "Intermediate metabolic risk", "High metabolic risk", "Indeterminate"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-4">
                            <label className="block font-semibold mb-1">Notes</label>
                            <input type="text" value={row.metabolic_notes} onChange={(e) => uf("metabolic_notes", e.target.value)} placeholder="Dietary / endocrine recommendations" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                        <details className="border border-sky-200 dark:border-sky-700/40 rounded-lg overflow-hidden mx-3 mb-3" open>
                          <summary className="p-2 bg-sky-50/50 dark:bg-sky-950/20 font-bold text-sky-700 dark:text-sky-300 cursor-pointer text-[11.5px]">Metabolic Syndrome Components {row.metabolic_risk_manual ? '(manual)' : '(auto-calc)'}</summary>
                          <div className="p-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                              <label className="block font-semibold mb-0.5 text-[9px]">Waist Circumference (cm)</label>
                              <input type="text" value={row.met_waist_cm} onChange={(e) => uf("met_waist_cm", e.target.value)} placeholder="≥102(M)/≥88(F)" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-0.5 text-[9px]">BP Systolic (mmHg)</label>
                              <input type="text" value={row.met_bp_systolic} onChange={(e) => uf("met_bp_systolic", e.target.value)} placeholder="≥130" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-0.5 text-[9px]">BP Diastolic (mmHg)</label>
                              <input type="text" value={row.met_bp_diastolic} onChange={(e) => uf("met_bp_diastolic", e.target.value)} placeholder="≥85" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-0.5 text-[9px]">HDL (mg/dL)</label>
                              <input type="text" value={row.met_hdl} onChange={(e) => uf("met_hdl", e.target.value)} placeholder="&lt;40(M)/&lt;50(F)" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-0.5 text-[9px]">Triglycerides (mg/dL)</label>
                              <input type="text" value={row.met_triglycerides} onChange={(e) => uf("met_triglycerides", e.target.value)} placeholder="≥150" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-0.5 text-[9px]">Fasting Glucose (mg/dL)</label>
                              <input type="text" value={row.met_fasting_glucose} onChange={(e) => uf("met_fasting_glucose", e.target.value)} placeholder="≥100" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                            </div>
                            {(() => {
                              const waist = parseFloat(row.met_waist_cm) || 0;
                              const bpSys = parseFloat(row.met_bp_systolic) || 0;
                              const bpDia = parseFloat(row.met_bp_diastolic) || 0;
                              const hdl = parseFloat(row.met_hdl) || 0;
                              const tg = parseFloat(row.met_triglycerides) || 0;
                              const glu = parseFloat(row.met_fasting_glucose) || 0;
                              let count = 0;
                              if (waist >= 102 || waist >= 88) count++; // approximate
                              if (bpSys >= 130 || bpDia >= 85) count++;
                              if (hdl > 0 && hdl < 40) count++; // simplified
                              if (tg >= 150) count++;
                              if (glu >= 100) count++;
                              const metCat = count >= 3 ? "High metabolic risk" : count >= 2 ? "Intermediate metabolic risk" : count >= 1 ? "Low metabolic risk" : '';
                              const isAuto = row.metabolic_risk_manual !== 'manual';
                              const riskMatch = isAuto && metCat && row.metabolic_risk_stratification === metCat;
                              return (
                                <div className="flex items-end gap-2">
                                  <div className="flex-1">
                                    <label className="block font-semibold mb-0.5 text-[9px] text-sky-600 dark:text-sky-400">Components (auto)</label>
                                    <input type="text" value={count > 0 ? `${count}/5` : ''} readOnly className={`w-full p-1 ${count > 0 ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-700 text-sky-700 dark:text-sky-300' : 'bg-theme-surface dark:bg-slate-800 border-slate-200 dark:border-slate-700'} border rounded text-[11.5px] font-bold`} />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block font-semibold mb-0.5 text-[9px]">Risk (auto)</label>
                                    <input type="text" value={metCat || ''} readOnly placeholder="—" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  </div>
                                  <div>
                                    <label className="block font-semibold mb-0.5 text-[9px]">Manual</label>
                                    <select value={row.metabolic_risk_manual} onChange={(e) => {
                                      uf("metabolic_risk_manual", e.target.value);
                                      if (e.target.value !== 'manual' && metCat) uf('metabolic_risk_stratification', metCat);
                                    }} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                      <option value="">Auto</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                  </div>
                                  {!riskMatch && metCat && isAuto && (
                                    <button type="button" onClick={() => uf('metabolic_risk_stratification', metCat)} className="p-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded text-[11.5px] font-bold whitespace-nowrap">Apply</button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </details>
                      </details>

                      {/* 11. Immunological Assessment */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Immunological Assessment</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Immune Status
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretCategoricalSeverity('immune', row.immunological_status))}
                            </label>
                            <select value={row.immunological_status} onChange={(e) => uf("immunological_status", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretCategoricalSeverity('immune', row.immunological_status))}`}>
                              <option value="">Select</option>
                              {["Immunocompetent", "Immunocompromised — mild", "Immunocompromised — moderate", "Immunocompromised — severe", "Unknown"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Neutrophil Count
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.immunological_neutrophil_count, 1.5, 8, 1, 1.4, 0.5, 12))}
                            </label>
                            <input type="text" value={row.immunological_neutrophil_count} onChange={(e) => uf("immunological_neutrophil_count", e.target.value)} placeholder="×10⁹/L" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.immunological_neutrophil_count, 1.5, 8, 1, 1.4, 0.5, 12))}`} />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Lymphocyte Count
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.immunological_lymphocyte_count, 1, 4, 0.7, 0.9, 0.3, 6))}
                            </label>
                            <input type="text" value={row.immunological_lymphocyte_count} onChange={(e) => uf("immunological_lymphocyte_count", e.target.value)} placeholder="×10⁹/L" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.immunological_lymphocyte_count, 1, 4, 0.7, 0.9, 0.3, 6))}`} />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">HIV Status</label>
                            <select value={row.immunological_hiv_status} onChange={(e) => uf("immunological_hiv_status", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Negative", "Positive — on ART, undetectable", "Positive — on ART, detectable", "Positive — not on ART", "Unknown / Not tested"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Steroid Use</label>
                            <select value={row.immunological_steroid_use} onChange={(e) => uf("immunological_steroid_use", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["None", "Low dose (<10mg prednisolone/day)", "Moderate dose (10-40mg/day)", "High dose (>40mg/day)", "Pulse steroids", "Inhaled steroids only"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Other Immunosuppression</label>
                            <input type="text" value={row.immunological_other_immunosuppression} onChange={(e) => uf("immunological_other_immunosuppression", e.target.value)} placeholder="e.g. Methotrexate, Biologics" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block font-semibold mb-1">Notes</label>
                            <input type="text" value={row.immunological_notes} onChange={(e) => uf("immunological_notes", e.target.value)} placeholder="Immunology / rheumatology recommendations" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                      </details>

                      {/* 12. POSSUM */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">POSSUM Predictive Risk Assessment</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Physiological Score
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.possum_physiological_score, 12, 24, 25, 35, 36, 99))}
                            </label>
                            <input type="text" value={row.possum_physiological_score} onChange={(e) => uf("possum_physiological_score", e.target.value)} placeholder="e.g. 18" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.possum_physiological_score, 12, 24, 25, 35, 36, 99))}`} />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Operative Severity Score
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.possum_operative_severity, 8, 16, 17, 24, 25, 99))}
                            </label>
                            <input type="text" value={row.possum_operative_severity} onChange={(e) => uf("possum_operative_severity", e.target.value)} placeholder="e.g. 12" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.possum_operative_severity, 8, 16, 17, 24, 25, 99))}`} />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Predicted Morbidity (%)
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.possum_predicted_morbidity, 0, 25, 26, 50, 51, 100))}
                            </label>
                            <input type="text" value={row.possum_predicted_morbidity} onChange={(e) => uf("possum_predicted_morbidity", e.target.value)} placeholder="e.g. 45%" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.possum_predicted_morbidity, 0, 25, 26, 50, 51, 100))}`} />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Predicted Mortality (%)
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretNumericValue(row.possum_predicted_mortality, 0, 5, 6, 15, 16, 100))}
                            </label>
                            <input type="text" value={row.possum_predicted_mortality} onChange={(e) => uf("possum_predicted_mortality", e.target.value)} placeholder="e.g. 5%" className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${(ipp => ipp ? severityBorder(ipp.severity) : 'border-slate-200 dark:border-slate-700')(interpretNumericValue(row.possum_predicted_mortality, 0, 5, 6, 15, 16, 100))}`} />
                          </div>
                          <div className="md:col-span-4">
                            <label className="block font-semibold mb-1">Notes</label>
                            <input type="text" value={row.possum_notes} onChange={(e) => uf("possum_notes", e.target.value)} placeholder="P-POSSUM / modified POSSUM details" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                        <details className="border border-sky-200 dark:border-sky-700/40 rounded-lg overflow-hidden mx-3 mb-3" open>
                          <summary className="p-2 bg-sky-50/50 dark:bg-sky-950/20 font-bold text-sky-700 dark:text-sky-300 cursor-pointer text-[11.5px]">POSSUM Components {row.possum_phys_manual === 'manual' || row.possum_op_manual === 'manual' ? '(manual)' : '(auto-calc)'}</summary>
                          <div className="p-2 space-y-2">
                            <h6 className="text-[9px] font-bold text-sky-600 dark:text-sky-400">Physiological Parameters</h6>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[["possum_age_score", "Age Score", "1=<60,2=61-70,4=>71"],
                                ["possum_cardiac_signs", "Cardiac Signs", "1=normal,2=diuret/digox,4=edema/warf,8=JVP"],
                                ["possum_respiratory_signs", "Respiratory Signs", "1=normal,2=SOB mild,4=SOB mod,8=SOB rest"],
                                ["possum_sbp", "SBP (mmHg)", "1=110-130,2=100-109,4=90-99,8=<90"],
                                ["possum_pulse_rate", "Pulse (/min)", "1=50-80,2=40-49,4=81-100,8=>100"],
                                ["possum_gcs_score", "GCS Score", "1=15,2=12-14,4=9-11,8=<9"],
                                ["possum_hb_val", "Hb (g/dL)", "1=13-16,2=11-12.9,4=10-11.4,8=<10"],
                                ["possum_wbc_val", "WBC (×10⁹/L)", "1=4-10,2=10-20,4=>20,8=abnormal"],
                                ["possum_urea_val", "Urea (mmol/L)", "1=<7.5,2=7.5-10,4=10-15,8=>15"],
                                ["possum_na_val", "Na (mmol/L)", "1=136-145,2=131-135,4=126-130,8=<126"],
                                ["possum_k_val", "K (mmol/L)", "1=3.5-5.0,2=3.2-3.4,4=2.9-3.1,8=<2.9"],
                                ["possum_ecg_abnormal", "ECG", "1=normal,2=AF 60-90,4=≥3 ectopics,8=abnormal"]].map(([fld, lbl, hint]) => (
                                  <div key={fld}>
                                    <label className="block font-semibold mb-0.5 text-[9px]">{lbl}</label>
                                    <input type="text" value={(row as any)[fld]} onChange={(e) => uf(fld, e.target.value)} placeholder={hint} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  </div>
                                ))}
                            </div>
                            <h6 className="text-[9px] font-bold text-sky-600 dark:text-sky-400">Operative Parameters</h6>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[["possum_operative_multiple", "Multiple Procedures", "1=single,2=multiple"],
                                ["possum_blood_loss_ml", "Blood Loss (mL)", "1=<100,2=100-500,4=500-999,8=>1000"],
                                ["possum_peritoneal_soiling", "Peritoneal Soiling", "1=none,2=serous,4=pus,8=perf"],
                                ["possum_malignancy_present", "Malignancy", "1=none,2=primary,4=nodal mets,8=distant mets"],
                                ["possum_urgency", "Urgency", "1=elective,2=urgent<2h,4=emergency<2h"]].map(([fld, lbl, hint]) => (
                                  <div key={fld}>
                                    <label className="block font-semibold mb-0.5 text-[9px]">{lbl}</label>
                                    <input type="text" value={(row as any)[fld]} onChange={(e) => uf(fld, e.target.value)} placeholder={hint} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  </div>
                                ))}
                            </div>
                            {(() => {
                              const physFields = ['possum_age_score','possum_cardiac_signs','possum_respiratory_signs','possum_sbp','possum_pulse_rate','possum_gcs_score','possum_hb_val','possum_wbc_val','possum_urea_val','possum_na_val','possum_k_val','possum_ecg_abnormal'];
                              const opFields = ['possum_operative_multiple','possum_blood_loss_ml','possum_peritoneal_soiling','possum_malignancy_present','possum_urgency'];
                              let physScore = 0;
                              let physCount = 0;
                              physFields.forEach(f => { const v = parseFloat((row as any)[f]); if (!isNaN(v)) { physScore += v; physCount++; } });
                              let opScore = 0;
                              opFields.forEach(f => { const v = parseFloat((row as any)[f]); if (!isNaN(v)) opScore += v; });
                              const hasPhys = physCount >= 3;
                              const hasOp = opScore > 0;
                              let morb = '', mort = '';
                              if (hasPhys && hasOp) {
                                const logit = -5.91 + 0.16 * physScore + 0.19 * opScore;
                                const predMorb = Math.round(100 / (1 + Math.exp(-logit)));
                                const logitMort = -7.04 + 0.13 * physScore + 0.16 * opScore;
                                const predMort = Math.round(100 / (1 + Math.exp(-logitMort)));
                                morb = String(predMorb) + '%';
                                mort = String(predMort) + '%';
                              }
                              const isPhysAuto = row.possum_phys_manual !== 'manual';
                              const isOpAuto = row.possum_op_manual !== 'manual';
                              const physMatch = isPhysAuto && hasPhys && row.possum_physiological_score === String(physScore);
                              const opMatch = isOpAuto && hasOp && row.possum_operative_severity === String(opScore);
                              return (
                                <div className="flex items-end gap-2 mt-2">
                                  <div className="w-20">
                                    <label className="block font-semibold mb-0.5 text-[9px] text-sky-600 dark:text-sky-400">Phys Score (auto)</label>
                                    <input type="text" value={hasPhys ? String(physScore) : ''} readOnly className={`w-full p-1 ${hasPhys ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-700 text-sky-700 dark:text-sky-300' : 'bg-theme-surface dark:bg-slate-800 border-slate-200 dark:border-slate-700'} border rounded text-[11.5px] font-bold`} />
                                  </div>
                                  <div>
                                    <label className="block font-semibold mb-0.5 text-[9px]">Phys Manual</label>
                                    <select value={row.possum_phys_manual} onChange={(e) => { uf("possum_phys_manual", e.target.value); if (e.target.value !== 'manual' && hasPhys) uf('possum_physiological_score', String(physScore)); }} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                      <option value="">Auto</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                  </div>
                                  <div className="w-20">
                                    <label className="block font-semibold mb-0.5 text-[9px] text-sky-600 dark:text-sky-400">Op Score (auto)</label>
                                    <input type="text" value={hasOp ? String(opScore) : ''} readOnly className={`w-full p-1 ${hasOp ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-700 text-sky-700 dark:text-sky-300' : 'bg-theme-surface dark:bg-slate-800 border-slate-200 dark:border-slate-700'} border rounded text-[11.5px] font-bold`} />
                                  </div>
                                  <div>
                                    <label className="block font-semibold mb-0.5 text-[9px]">Op Manual</label>
                                    <select value={row.possum_op_manual} onChange={(e) => { uf("possum_op_manual", e.target.value); if (e.target.value !== 'manual' && hasOp) uf('possum_operative_severity', String(opScore)); }} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                      <option value="">Auto</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                  </div>
                                  <div className="w-20">
                                    <label className="block font-semibold mb-0.5 text-[9px] text-sky-600 dark:text-sky-400">Morbidity (auto)</label>
                                    <input type="text" value={morb} readOnly placeholder="—" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  </div>
                                  <div className="w-20">
                                    <label className="block font-semibold mb-0.5 text-[9px] text-sky-600 dark:text-sky-400">Mortality (auto)</label>
                                    <input type="text" value={mort} readOnly placeholder="—" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  </div>
                                  {hasPhys && (!physMatch && isPhysAuto) && (
                                    <button type="button" onClick={() => uf('possum_physiological_score', String(physScore))} className="p-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded text-[11.5px] font-bold whitespace-nowrap">Apply Phys</button>
                                  )}
                                  {hasOp && (!opMatch && isOpAuto) && (
                                    <button type="button" onClick={() => uf('possum_operative_severity', String(opScore))} className="p-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded text-[11.5px] font-bold whitespace-nowrap">Apply Op</button>
                                  )}
                                  {hasPhys && hasOp && morb && (
                                    <button type="button" onClick={() => { uf('possum_predicted_morbidity', morb); uf('possum_predicted_mortality', mort); }} className="p-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded text-[11.5px] font-bold whitespace-nowrap">Apply Morb/Mort</button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </details>
                      </details>

                      {/* 13. Neo-Adjuvant Chemo Response */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Neo-Adjuvant Chemotherapy Response</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block font-semibold mb-1">Received</label>
                            <select value={row.neoadj_chemo_received} onChange={(e) => uf("neoadj_chemo_received", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                              <option value="Planned but not yet started">Planned, not started</option>
                              <option value="Not applicable">Not applicable</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Regimen</label>
                            <input type="text" value={row.neoadj_chemo_regimen} onChange={(e) => uf("neoadj_chemo_regimen", e.target.value)} placeholder="e.g. FLOT" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Cycles</label>
                            <input type="text" value={row.neoadj_chemo_cycles} onChange={(e) => uf("neoadj_chemo_cycles", e.target.value)} placeholder="e.g. 4" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Completion Date</label>
                            <input type="date" value={row.neoadj_chemo_completion_date} onChange={(e) => uf("neoadj_chemo_completion_date", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Response (RECIST)
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretSelect('neoadj_chemo_response', row.neoadj_chemo_response))}
                            </label>
                            <select value={row.neoadj_chemo_response} onChange={(e) => uf("neoadj_chemo_response", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${selectBorder(row.neoadj_chemo_response, SELECT_SEVERITY.neoadj_chemo_response)}`}>
                              <option value="">Select</option>
                              {["Complete response (CR)", "Partial response (PR)", "Stable disease (SD)", "Progressive disease (PD)", "Pathologic CR (pCR)", "Major pathologic response (MPR)", "Not yet evaluated"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-3">
                            <label className="block font-semibold mb-1">Response Details</label>
                            <input type="text" value={row.neoadj_chemo_response_details} onChange={(e) => uf("neoadj_chemo_response_details", e.target.value)} placeholder="e.g. 90% tumor regression, ypT2N0" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                        <details className="border border-sky-200 dark:border-sky-700/40 rounded-lg overflow-hidden mx-3 mb-3" open>
                          <summary className="p-2 bg-sky-50/50 dark:bg-sky-950/20 font-bold text-sky-700 dark:text-sky-300 cursor-pointer text-[11.5px]">RECIST Target Lesions {row.neoadj_chemo_manual ? '(manual)' : '(auto-calc)'}</summary>
                          <div className="p-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                              <label className="block font-semibold mb-0.5 text-[9px]">Target Lesions (n)</label>
                              <input type="text" value={row.neoadj_target_count} onChange={(e) => uf("neoadj_target_count", e.target.value)} placeholder="Max 5" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-0.5 text-[9px]">Sum Diameters Before (mm)</label>
                              <input type="text" value={row.neoadj_target_sum_before} onChange={(e) => uf("neoadj_target_sum_before", e.target.value)} placeholder="Baseline" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-0.5 text-[9px]">Sum Diameters After (mm)</label>
                              <input type="text" value={row.neoadj_target_sum_after} onChange={(e) => uf("neoadj_target_sum_after", e.target.value)} placeholder="Post-treatment" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                            </div>
                            {(() => {
                              const before = parseFloat(row.neoadj_target_sum_before);
                              const after = parseFloat(row.neoadj_target_sum_after);
                              let pct = NaN;
                              let recist = '';
                              if (!isNaN(before) && !isNaN(after) && before > 0) {
                                pct = Math.round((after - before) / before * 100);
                                if (pct <= -100) recist = 'Complete response (CR)';
                                else if (pct <= -30) recist = 'Partial response (PR)';
                                else if (pct >= 20) recist = 'Progressive disease (PD)';
                                else recist = 'Stable disease (SD)';
                              }
                              const isAuto = row.neoadj_chemo_manual !== 'manual';
                              const curResp = row.neoadj_chemo_response;
                              const match = isAuto && recist && curResp === recist;
                              return (
                                <div className="flex items-end gap-2">
                                  <div className="flex-1">
                                    <label className="block font-semibold mb-0.5 text-[9px] text-sky-600 dark:text-sky-400">% Change (auto)</label>
                                    <input type="text" value={!isNaN(pct) ? `${pct}%` : ''} readOnly className={`w-full p-1 ${!isNaN(pct) ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-700 text-sky-700 dark:text-sky-300' : 'bg-theme-surface dark:bg-slate-800 border-slate-200 dark:border-slate-700'} border rounded text-[11.5px] font-bold`} />
                                  </div>
                                  <div className="flex-1">
                                    <label className="block font-semibold mb-0.5 text-[9px]">RECIST (auto)</label>
                                    <input type="text" value={recist || ''} readOnly placeholder="—" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  </div>
                                  <div>
                                    <label className="block font-semibold mb-0.5 text-[9px]">Manual</label>
                                    <select value={row.neoadj_chemo_manual} onChange={(e) => {
                                      uf("neoadj_chemo_manual", e.target.value);
                                      if (e.target.value !== 'manual' && recist) uf('neoadj_chemo_response', recist);
                                    }} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]">
                                      <option value="">Auto</option>
                                      <option value="manual">Manual</option>
                                    </select>
                                  </div>
                                  {!match && recist && isAuto && (
                                    <button type="button" onClick={() => uf('neoadj_chemo_response', recist)} className="p-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded text-[11.5px] font-bold whitespace-nowrap">Apply</button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </details>
                      </details>

                      {/* 14. Neo-Adjuvant Radio Response */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Neo-Adjuvant Radiotherapy Response</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block font-semibold mb-1">Received</label>
                            <select value={row.neoadj_radio_received} onChange={(e) => uf("neoadj_radio_received", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                              <option value="Planned but not yet started">Planned, not started</option>
                              <option value="Not applicable">Not applicable</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Regimen</label>
                            <input type="text" value={row.neoadj_radio_regimen} onChange={(e) => uf("neoadj_radio_regimen", e.target.value)} placeholder="e.g. Long course RT" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Dose (Gy)</label>
                            <input type="text" value={row.neoadj_radio_dose} onChange={(e) => uf("neoadj_radio_dose", e.target.value)} placeholder="e.g. 50.4 Gy / 28 fx" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Completion Date</label>
                            <input type="date" value={row.neoadj_radio_completion_date} onChange={(e) => uf("neoadj_radio_completion_date", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 flex items-center gap-1">
                              Response
                              {(ipp => ipp ? <span className={`inline-block text-[7px] leading-tight px-1 py-0.5 rounded-full font-bold ${severityBadge(ipp.severity)}`}>{ipp.text}</span> : null)(interpretSelect('neoadj_radio_response', row.neoadj_radio_response))}
                            </label>
                            <select value={row.neoadj_radio_response} onChange={(e) => uf("neoadj_radio_response", e.target.value)} className={`w-full p-2 bg-theme-surface dark:bg-slate-800 border-2 rounded-lg text-xs ${selectBorder(row.neoadj_radio_response, SELECT_SEVERITY.neoadj_radio_response)}`}>
                              <option value="">Select</option>
                              {["Complete response (CR)", "Partial response (PR)", "Stable disease (SD)", "Progressive disease (PD)", "Pathologic CR (pCR)", "Not yet evaluated"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div className="md:col-span-3">
                            <label className="block font-semibold mb-1">Response Details</label>
                            <input type="text" value={row.neoadj_radio_response_details} onChange={(e) => uf("neoadj_radio_response_details", e.target.value)} placeholder="e.g. Significant downsizing, ypT2N0" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                      </details>

                      {/* 15. Organ-Specific Resistance Testing */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">Organ-Specific Resistance Testing</summary>
                        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold mb-1">Testing Status</label>
                            <select value={row.organ_resistance_testing} onChange={(e) => uf("organ_resistance_testing", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                              <option value="">Select</option>
                              {["Performed", "Planned", "Not indicated", "Not available", "Declined"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Results</label>
                            <input type="text" value={row.organ_resistance_results} onChange={(e) => uf("organ_resistance_results", e.target.value)} placeholder="e.g. No resistance mutations detected" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Notes</label>
                            <input type="text" value={row.organ_resistance_notes} onChange={(e) => uf("organ_resistance_notes", e.target.value)} placeholder="Specific tests performed" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                          </div>
                        </div>
                      </details>

                      {/* 16. MDT Discussion */}
                      <details className="border border-cyan-200 dark:border-cyan-700/50 rounded-xl overflow-hidden" open>
                        <summary className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 font-bold text-cyan-700 dark:text-cyan-300 cursor-pointer text-[11.5px]">MDT Discussion Details</summary>
                        <div className="p-3 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block font-semibold mb-1">MDT Date</label>
                              <input type="date" value={row.mdt_date} onChange={(e) => uf("mdt_date", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">Participants</label>
                              <input type="text" value={row.mdt_participants} onChange={(e) => uf("mdt_participants", e.target.value)} placeholder="e.g. Surg, Onc, RadOnc, Path, Rad" className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                            </div>
                            <div>
                              <label className="block font-semibold mb-1">MDT Decision</label>
                              <select value={row.mdt_decision} onChange={(e) => uf("mdt_decision", e.target.value)} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                                <option value="">Select</option>
                                {["Proceed with surgery", "Defer surgery — neoadjuvant therapy first", "Defer surgery — further workup needed", "Non-surgical management recommended", "Palliative care referral", "Awaiting further information"].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">MDT Recommendation</label>
                            <textarea value={row.mdt_recommendation} onChange={(e) => uf("mdt_recommendation", e.target.value)} placeholder="Detailed recommendation from multidisciplinary team" rows={2} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs resize-y" />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1">Additional Notes</label>
                            <textarea value={row.mdt_notes} onChange={(e) => uf("mdt_notes", e.target.value)} placeholder="Any other MDT discussion details" rows={2} className="w-full p-2 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs resize-y" />
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                );
              })}

              {(!formState.preOperativeAssessmentTable || formState.preOperativeAssessmentTable.length === 0) && (
                <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                  No pre-operative assessments added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Section: Surgery Details */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("definitiveSurgery")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.definitiveSurgery ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-cyan-500/10 dark:bg-cyan-400/20 text-cyan-700 dark:text-cyan-200 flex items-center justify-center">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </span>
              <h3 className="h-section">Surgery Details</h3>
              <SectionUploadActions section="definitiveSurgery" label="Surgery Details" />
            </div>
            {openSections.definitiveSurgery ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.definitiveSurgery && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wider">Surgery Records</span>
                <button type="button" onClick={() => addRow("definitiveSurgeryTable", tableTemplates.definitiveSurgeryTable)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-cyan-600 hover:underline">
                  <CirclePlus className="h-3 w-3" />
                  Add Surgery
                </button>
              </div>

              {(formState.definitiveSurgeryTable || []).map((row, idx) => {
                const uf = (field: string, value: string) => handleTableChange("definitiveSurgeryTable", idx, field, value);
                const addImagingEntry = () => {
                  const current = [...(row.intraop_imaging_list || [])];
                  current.push({ imaging_type: "", imaging_findings: "" });
                  uf("intraop_imaging_list", current as any);
                };
                const removeImagingEntry = (ii: number) => {
                  const current = [...(row.intraop_imaging_list || [])];
                  current.splice(ii, 1);
                  uf("intraop_imaging_list", current as any);
                };
                const updateImagingEntry = (ii: number, field: string, value: string) => {
                  const current = [...(row.intraop_imaging_list || [])];
                  current[ii] = { ...current[ii], [field]: value };
                  uf("intraop_imaging_list", current as any);
                };
                return (
                  <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 bg-white/40 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wider">Surgery #{idx + 1}</span>
                      <button type="button" onClick={() => removeRow("definitiveSurgeryTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Identification & Timing */}
                    <details className="group border border-sky-200 dark:border-sky-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider cursor-pointer select-none">Identification & Timing</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgery Name</label>
                          <input type="text" value={row.surgery_name} onChange={(e) => uf("surgery_name", e.target.value)} placeholder="e.g. Whipple Procedure" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgery Date</label>
                          <input type="date" value={row.surgery_date} onChange={(e) => uf("surgery_date", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgeon Name</label>
                          <input type="text" value={row.surgeon_name} onChange={(e) => uf("surgeon_name", e.target.value)} placeholder="Dr. ..." className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgeon Specialty</label>
                          <input type="text" value={row.surgeon_specialty} onChange={(e) => uf("surgeon_specialty", e.target.value)} placeholder="e.g. HPB, Colorectal" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgeon Volume (cases/year)</label>
                          <input type="text" value={row.surgeon_volume} onChange={(e) => uf("surgeon_volume", e.target.value)} placeholder="e.g. 50" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Hospital Name</label>
                          <input type="text" value={row.hospital_name} onChange={(e) => uf("hospital_name", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgery Type</label>
                          <input type="text" value={row.surgery_type} onChange={(e) => uf("surgery_type", e.target.value)} placeholder="e.g. Resection, Reconstruction" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgery Intent</label>
                          <select value={row.surgery_intent} onChange={(e) => uf("surgery_intent", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Curative">Curative</option>
                            <option value="Palliative">Palliative</option>
                            <option value="Diagnostic">Diagnostic</option>
                            <option value="Prophylactic">Prophylactic</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgery Phase</label>
                          <select value={row.surgery_phase} onChange={(e) => uf("surgery_phase", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Primary">Primary</option>
                            <option value="Adjuvant">Adjuvant</option>
                            <option value="Neoadjuvant">Neoadjuvant</option>
                            <option value="Salvage">Salvage</option>
                            <option value="Reoperation">Reoperation</option>
                            <option value="Staging">Staging</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgery Timing</label>
                          <select value={row.surgery_timing} onChange={(e) => uf("surgery_timing", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Elective">Elective</option>
                            <option value="Urgent">Urgent</option>
                            <option value="Emergency">Emergency</option>
                            <option value="Salvage">Salvage</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Pre-op Diagnosis</label>
                          <input type="text" value={row.preop_diagnosis} onChange={(e) => uf("preop_diagnosis", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Indication for Surgery</label>
                          <input type="text" value={row.indication_for_surgery} onChange={(e) => uf("indication_for_surgery", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                      </div>
                    </details>

                    {/* Intra-operative Details */}
                    <details className="group border border-sky-200 dark:border-sky-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider cursor-pointer select-none">Intra-operative Details</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Anesthesia Type</label>
                          <select value={row.anesthesia_type} onChange={(e) => uf("anesthesia_type", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="General">General</option>
                            <option value="Regional">Regional</option>
                            <option value="Local">Local</option>
                            <option value="MAC">MAC</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Operative Duration (min)</label>
                          <input type="text" value={row.operative_duration_min} onChange={(e) => uf("operative_duration_min", e.target.value)} placeholder="e.g. 240" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Incision to Closure (min)</label>
                          <input type="text" value={row.incision_to_closure} onChange={(e) => uf("incision_to_closure", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Est. Blood Loss (ml)</label>
                          <input type="text" value={row.estimated_blood_loss_ml} onChange={(e) => uf("estimated_blood_loss_ml", e.target.value)} placeholder="e.g. 500" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Intra-op Fluids (ml)</label>
                          <input type="text" value={row.intraop_fluids_ml} onChange={(e) => uf("intraop_fluids_ml", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Blood Transfusion</label>
                          <input type="text" value={row.intraop_blood_transfusion} onChange={(e) => uf("intraop_blood_transfusion", e.target.value)} placeholder="e.g. 2 units PRBC" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Intra-op Complications</label>
                          <input type="text" value={row.intraop_complications} onChange={(e) => uf("intraop_complications", e.target.value)} placeholder="e.g. hemorrhage, hypotension" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Intra-op Findings</label>
                          <input type="text" value={row.intraop_findings} onChange={(e) => uf("intraop_findings", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Specimen Description</label>
                          <input type="text" value={row.specimen_description} onChange={(e) => uf("specimen_description", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Intra-op Imaging</label>
                          <input type="text" value={row.intraop_imaging} onChange={(e) => uf("intraop_imaging", e.target.value)} placeholder="e.g. cholangiogram, ultrasound" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11.5px] font-semibold text-slate-500">Additional Imaging</span>
                            <button type="button" onClick={addImagingEntry} className="text-[11.5px] text-cyan-600 hover:underline font-semibold">+ Add</button>
                          </div>
                          {(row.intraop_imaging_list || []).map((img: any, ii: number) => (
                            <div key={ii} className="flex items-center gap-2 mb-1">
                              <input type="text" value={img.imaging_type} onChange={(e) => updateImagingEntry(ii, "imaging_type", e.target.value)} placeholder="Type" className="flex-1 p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                              <input type="text" value={img.imaging_findings} onChange={(e) => updateImagingEntry(ii, "imaging_findings", e.target.value)} placeholder="Findings" className="flex-1 p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                              <button type="button" onClick={() => removeImagingEntry(ii)} className="text-rose-400 hover:text-rose-600">
                                <Trash className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>

                    {/* Approach & Resection */}
                    <details className="group border border-sky-200 dark:border-sky-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider cursor-pointer select-none">Approach & Resection</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgery Approach</label>
                          <select value={row.surgery_approach} onChange={(e) => uf("surgery_approach", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Open">Open</option>
                            <option value="Laparoscopic">Laparoscopic</option>
                            <option value="Robotic">Robotic</option>
                            <option value="Endoscopic">Endoscopic</option>
                            <option value="Percutaneous">Percutaneous</option>
                            <option value="Hybrid">Hybrid</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgery Site</label>
                          <input type="text" value={row.surgery_site} onChange={(e) => uf("surgery_site", e.target.value)} placeholder="e.g. Right upper quadrant" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Procedure Details</label>
                          <input type="text" value={row.procedure_details} onChange={(e) => uf("procedure_details", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Resection Status</label>
                          <select value={row.resection_status} onChange={(e) => uf("resection_status", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="R0">R0</option>
                            <option value="R1">R1</option>
                            <option value="R2">R2</option>
                            <option value="R0 (microscopic)">R0 (microscopic)</option>
                            <option value="Not applicable">Not applicable</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Margin Status</label>
                          <select value={row.margin_status} onChange={(e) => uf("margin_status", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Negative">Negative</option>
                            <option value="Positive">Positive</option>
                            <option value="Close">Close</option>
                            <option value="Not assessed">Not assessed</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Closest Margin (mm)</label>
                          <input type="text" value={row.closest_margin_mm} onChange={(e) => uf("closest_margin_mm", e.target.value)} placeholder="e.g. 2" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Lymph Node Dissection</label>
                          <select value={row.lymph_node_dissection} onChange={(e) => uf("lymph_node_dissection", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="D1">D1</option>
                            <option value="D2">D2</option>
                            <option value="D3">D3</option>
                            <option value="Sentinel node">Sentinel node</option>
                            <option value="Sampling">Sampling</option>
                            <option value="None">None</option>
                            <option value="Not specified">Not specified</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Lymph Nodes Harvested</label>
                          <input type="text" value={row.lymph_node_harvested} onChange={(e) => uf("lymph_node_harvested", e.target.value)} placeholder="e.g. 15" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Positive Lymph Nodes</label>
                          <input type="text" value={row.lymph_node_positive} onChange={(e) => uf("lymph_node_positive", e.target.value)} placeholder="e.g. 2" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Organ/Resection Details</label>
                          <input type="text" value={row.organ_resection_details} onChange={(e) => uf("organ_resection_details", e.target.value)} placeholder="e.g. Segments II, III" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Multi-visceral Resection</label>
                          <select value={row.multi_visceral_resection} onChange={(e) => uf("multi_visceral_resection", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Sentinel Node Biopsy</label>
                          <select value={row.sentinel_node_biopsy} onChange={(e) => uf("sentinel_node_biopsy", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Done">Done</option>
                            <option value="Not done">Not done</option>
                            <option value="Failed">Failed</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Sentinel Node Results</label>
                          <input type="text" value={row.sentinel_node_biopsy_results} onChange={(e) => uf("sentinel_node_biopsy_results", e.target.value)} placeholder="e.g. Positive, 2/3 nodes" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Neo-adjuvant Effect Details</label>
                          <input type="text" value={row.neoadj_effect_details} onChange={(e) => uf("neoadj_effect_details", e.target.value)} placeholder="e.g. TRG 1, minimal residual" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">En Bloc Resection</label>
                          <select value={row.en_bloc_resection} onChange={(e) => uf("en_bloc_resection", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Depth of Invasion</label>
                          <input type="text" value={row.depth_of_invasion} onChange={(e) => uf("depth_of_invasion", e.target.value)} placeholder="e.g. pT3, >5 mm" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Resected Specimen Size</label>
                          <input type="text" value={row.resected_specimen_size} onChange={(e) => uf("resected_specimen_size", e.target.value)} placeholder="e.g. 12×8×5 cm" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Conversion to Open</label>
                          <select value={row.conversion_to_open} onChange={(e) => uf("conversion_to_open", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes (planned)">Yes (planned)</option>
                            <option value="Yes (unplanned)">Yes (unplanned)</option>
                            <option value="N/A (open from start)">N/A (open from start)</option>
                          </select>
                        </div>
                      </div>
                    </details>

                    {/* Reconstruction & Post-operative */}
                    <details className="group border border-sky-200 dark:border-sky-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider cursor-pointer select-none">Reconstruction & Post-operative</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Reconstruction Type</label>
                          <select value={row.reconstruction_type} onChange={(e) => uf("reconstruction_type", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="None">None</option>
                            <option value="Primary closure">Primary closure</option>
                            <option value="Flap">Flap</option>
                            <option value="Graft">Graft</option>
                            <option value="Anastomosis">Anastomosis</option>
                            <option value="Stent">Stent</option>
                            <option value="Prosthesis">Prosthesis</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Reconstruction Details</label>
                          <input type="text" value={row.reconstruction_details} onChange={(e) => uf("reconstruction_details", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Post-op Diagnosis</label>
                          <input type="text" value={row.postop_diagnosis} onChange={(e) => uf("postop_diagnosis", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Recovery Status</label>
                          <select value={row.recovery_status} onChange={(e) => uf("recovery_status", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Uncomplicated">Uncomplicated</option>
                            <option value="Minor complication">Minor complication</option>
                            <option value="Major complication">Major complication</option>
                            <option value="ICU stay">ICU stay</option>
                            <option value="Deceased">Deceased</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Discharge Date</label>
                          <input type="date" value={row.discharge_date} onChange={(e) => uf("discharge_date", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Discharge Status</label>
                          <select value={row.discharge_status} onChange={(e) => uf("discharge_status", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Home">Home</option>
                            <option value="Rehabilitation">Rehabilitation</option>
                            <option value="Transfer to other hospital">Transfer</option>
                            <option value="Deceased">Deceased</option>
                            <option value="AMA">AMA</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Readmission (30 days)</label>
                          <select value={row.readmission_30d} onChange={(e) => uf("readmission_30d", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Readmission Reason</label>
                          <input type="text" value={row.readmission_reason} onChange={(e) => uf("readmission_reason", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Pathology Specimen ID</label>
                          <input type="text" value={row.pathology_specimen_id} onChange={(e) => uf("pathology_specimen_id", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Pathology Link</label>
                          <input type="text" value={row.pathology_link} onChange={(e) => uf("pathology_link", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Surgery Notes</label>
                          <textarea value={row.surgery_notes} onChange={(e) => uf("surgery_notes", e.target.value)} rows={2} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}

              {(!formState.definitiveSurgeryTable || formState.definitiveSurgeryTable.length === 0) && (
                <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                  No surgery records added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Section: Surgical Outcome Assessment */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("treatmentOutcome")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.treatmentOutcome ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-amber-500/10 dark:bg-amber-400/20 text-amber-700 dark:text-amber-200 flex items-center justify-center">
                <ClipboardCheck className="h-3.5 w-3.5" />
              </span>
              <h3 className="h-section">Surgical Outcome Assessment</h3>
              <SectionUploadActions section="treatmentOutcome" label="Surgical Outcome Assessment" />
            </div>
            {openSections.treatmentOutcome ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.treatmentOutcome && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wider">Outcome Records</span>
                <button type="button" onClick={() => addRow("treatmentOutcomeTable", tableTemplates.treatmentOutcomeTable)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-cyan-600 hover:underline">
                  <CirclePlus className="h-3 w-3" />
                  Add Outcome
                </button>
              </div>

              {(formState.treatmentOutcomeTable || []).map((row, idx) => {
                const uf = (field: string, value: string) => handleTableChange("treatmentOutcomeTable", idx, field, value);
                return (
                  <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 bg-white/40 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wider">Outcome #{idx + 1}</span>
                      <button type="button" onClick={() => removeRow("treatmentOutcomeTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Surgery Outcome */}
                    <details className="group border border-amber-200 dark:border-amber-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider cursor-pointer select-none">Surgery Outcome</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Hospital Entry Date</label>
                          <input type="date" value={row.hospital_entry_date} onChange={(e) => { uf("hospital_entry_date", e.target.value); if (e.target.value && row.hospital_exit_date) { const d1 = new Date(e.target.value); const d2 = new Date(row.hospital_exit_date); const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)); uf("hospital_stay_days", diff >= 0 ? String(diff) : ""); } }} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Hospital Exit Date</label>
                          <input type="date" value={row.hospital_exit_date} onChange={(e) => { uf("hospital_exit_date", e.target.value); if (e.target.value && row.hospital_entry_date) { const d1 = new Date(row.hospital_entry_date); const d2 = new Date(e.target.value); const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)); uf("hospital_stay_days", diff >= 0 ? String(diff) : ""); } }} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Hospital Stay (days)</label>
                          <input type="text" value={row.hospital_stay_days} onChange={(e) => uf("hospital_stay_days", e.target.value)} readOnly className="w-full p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-[11.5px] text-slate-500 cursor-default" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">ICU Admission</label>
                          <select value={row.icu_admission} onChange={(e) => uf("icu_admission", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">ICU Admit Date</label>
                          <input type="date" value={row.icu_admit_date} onChange={(e) => { uf("icu_admit_date", e.target.value); if (e.target.value && row.icu_exit_date) { const d1 = new Date(e.target.value); const d2 = new Date(row.icu_exit_date); const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)); uf("icu_stay_days", diff >= 0 ? String(diff) : ""); } }} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">ICU Exit Date</label>
                          <input type="date" value={row.icu_exit_date} onChange={(e) => { uf("icu_exit_date", e.target.value); if (e.target.value && row.icu_admit_date) { const d1 = new Date(row.icu_admit_date); const d2 = new Date(e.target.value); const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)); uf("icu_stay_days", diff >= 0 ? String(diff) : ""); } }} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">ICU Stay (days)</label>
                          <input type="text" value={row.icu_stay_days} onChange={(e) => uf("icu_stay_days", e.target.value)} readOnly className="w-full p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-[11.5px] text-slate-500 cursor-default" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Return to OR (30 days)</label>
                          <select value={row.return_to_or_30d} onChange={(e) => uf("return_to_or_30d", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Transfusion Needed</label>
                          <select value={row.transfusion_needed} onChange={(e) => uf("transfusion_needed", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Transfusion Type</label>
                          <input type="text" value={row.transfusion_type} onChange={(e) => uf("transfusion_type", e.target.value)} placeholder="e.g. PRBC, FFP, Platelets" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Transfused Amount</label>
                          <input type="text" value={row.transfusion_amount} onChange={(e) => uf("transfusion_amount", e.target.value)} placeholder="e.g. 2 units" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Wound Infection</label>
                          <select value={row.wound_infection} onChange={(e) => uf("wound_infection", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Superficial">Superficial</option>
                            <option value="Deep">Deep</option>
                            <option value="Organ/space">Organ/space</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Anastomotic Leak</label>
                          <select value={row.anastomotic_leak} onChange={(e) => uf("anastomotic_leak", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Grade A">Grade A</option>
                            <option value="Grade B">Grade B</option>
                            <option value="Grade C">Grade C</option>
                            <option value="Yes (not graded)">Yes (not graded)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Thromboembolic Events</label>
                          <select value={row.thromboembolic_events} onChange={(e) => uf("thromboembolic_events", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="DVT">DVT</option>
                            <option value="PE">PE</option>
                            <option value="Both">Both</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Cardiac Complication</label>
                          <select value={row.cardiac_complication} onChange={(e) => uf("cardiac_complication", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Cardiac Details</label>
                          <input type="text" value={row.cardiac_complication_details} onChange={(e) => uf("cardiac_complication_details", e.target.value)} placeholder="e.g. AF, MI, CHF" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Pulmonary Complication</label>
                          <select value={row.pulmonary_complication} onChange={(e) => uf("pulmonary_complication", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Pulmonary Details</label>
                          <input type="text" value={row.pulmonary_complication_details} onChange={(e) => uf("pulmonary_complication_details", e.target.value)} placeholder="e.g. Pneumonia, effusion" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Acute Kidney Injury</label>
                          <select value={row.acute_kidney_injury} onChange={(e) => uf("acute_kidney_injury", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Stage 1">Stage 1</option>
                            <option value="Stage 2">Stage 2</option>
                            <option value="Stage 3">Stage 3</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Hepatic Dysfunction</label>
                          <select value={row.hepatic_dysfunction} onChange={(e) => uf("hepatic_dysfunction", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Anastomotic Stricture</label>
                          <select value={row.anastomotic_stricture} onChange={(e) => uf("anastomotic_stricture", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Lymphoedema</label>
                          <select value={row.lymphoedema} onChange={(e) => uf("lymphoedema", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Seroma / Hematoma</label>
                          <select value={row.seroma_hematoma} onChange={(e) => uf("seroma_hematoma", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Seroma">Seroma</option>
                            <option value="Hematoma">Hematoma</option>
                            <option value="Both">Both</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Nerve Injury</label>
                          <select value={row.nerve_injury} onChange={(e) => uf("nerve_injury", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Fistula Formation</label>
                          <select value={row.fistula_formation} onChange={(e) => uf("fistula_formation", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Sepsis Development</label>
                          <select value={row.sepsis_development} onChange={(e) => uf("sepsis_development", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Sepsis">Sepsis</option>
                            <option value="Severe sepsis">Severe sepsis</option>
                            <option value="Septic shock">Septic shock</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">30-Day Mortality</label>
                          <select value={row.mortality_30d} onChange={(e) => uf("mortality_30d", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">90-Day Mortality</label>
                          <select value={row.mortality_90d} onChange={(e) => uf("mortality_90d", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">1-Year Mortality</label>
                          <select value={row.mortality_1y} onChange={(e) => uf("mortality_1y", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Unplanned Readmission</label>
                          <select value={row.unplanned_readmission} onChange={(e) => uf("unplanned_readmission", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Discharge Destination</label>
                          <select value={row.discharge_destination} onChange={(e) => uf("discharge_destination", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Home">Home</option>
                            <option value="Rehabilitation">Rehabilitation</option>
                            <option value="Transfer">Transfer</option>
                            <option value="Deceased">Deceased</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Clavien-Dindo Grade</label>
                          <select value={row.clavien_dindo_grade} onChange={(e) => uf("clavien_dindo_grade", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="I">I - Deviation from normal course, no therapy</option>
                            <option value="II">II - Pharmacological treatment required</option>
                            <option value="IIIa">IIIa - Intervention not under GA</option>
                            <option value="IIIb">IIIb - Intervention under GA</option>
                            <option value="IVa">IVa - ICU, single organ dysfunction</option>
                            <option value="IVb">IVb - ICU, multi-organ dysfunction</option>
                            <option value="V">V - Death</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Clavien-Dindo Criteria</label>
                          <input type="text" value={row.clavien_dindo_criteria} onChange={(e) => uf("clavien_dindo_criteria", e.target.value)} placeholder="e.g. Grade II + Grade IIIb" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Severe Complication Rate Criteria</label>
                          <input type="text" value={row.severe_complication_rate_criteria} onChange={(e) => uf("severe_complication_rate_criteria", e.target.value)} placeholder="e.g. Grade ≥ III / total patients" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                      </div>

                      {/* ICU & Ward Management */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">ICU Management Details</label>
                          <textarea value={row.icu_management_details} onChange={(e) => uf("icu_management_details", e.target.value)} rows={2} placeholder="e.g. ventilatory support, inotropes" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Ward Management Details</label>
                          <textarea value={row.ward_management_details} onChange={(e) => uf("ward_management_details", e.target.value)} rows={2} placeholder="e.g. wound care, drain management" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                      </div>

                      {/* Post-op Monitoring */}
                      <details className="group border border-amber-200 dark:border-amber-800 rounded-lg p-2" open>
                        <summary className="text-[11.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider cursor-pointer select-none">Post-op Monitoring</summary>
                        {(row.postop_monitoring || []).map((mon: any, mi: number) => {
                          const updateMon = (field: string, value: string) => {
                            const current = [...(row.postop_monitoring || [])];
                            current[mi] = { ...current[mi], [field]: value };
                            uf("postop_monitoring", current as any);
                          };
                          const addParam = () => {
                            const current = [...(row.postop_monitoring || [])];
                            current[mi] = { ...current[mi], parameters: [...(current[mi].parameters || []), { parameter: "", finding: "" }] };
                            uf("postop_monitoring", current as any);
                          };
                          const updateParam = (pi: number, field: string, value: string) => {
                            const current = [...(row.postop_monitoring || [])];
                            const params = [...(current[mi].parameters || [])];
                            params[pi] = { ...params[pi], [field]: value };
                            current[mi] = { ...current[mi], parameters: params };
                            uf("postop_monitoring", current as any);
                          };
                          const removeParam = (pi: number) => {
                            const current = [...(row.postop_monitoring || [])];
                            const params = [...(current[mi].parameters || [])];
                            params.splice(pi, 1);
                            current[mi] = { ...current[mi], parameters: params };
                            uf("postop_monitoring", current as any);
                          };
                          return (
                            <div key={mi} className="mt-2 p-2 border border-amber-100 dark:border-amber-800/50 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11.5px] font-bold text-amber-600">Day #{mi + 1}</span>
                                <button type="button" onClick={() => {
                                  const current = [...(row.postop_monitoring || [])];
                                  current.splice(mi, 1);
                                  uf("postop_monitoring", current as any);
                                }} className="text-rose-400 hover:text-rose-600"><Trash className="h-3 w-3" /></button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                                <div>
                                  <label className="block font-semibold mb-0.5 text-[9px] text-slate-500">Post-op Day</label>
                                  <input type="text" value={mon.postop_day} onChange={(e) => updateMon("postop_day", e.target.value)} placeholder="e.g. POD 1" className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                </div>
                                <div>
                                  <label className="block font-semibold mb-0.5 text-[9px] text-slate-500">Date</label>
                                  <input type="date" value={mon.date} onChange={(e) => updateMon("date", e.target.value)} className="w-full p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                </div>
                              </div>
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-[9px] font-semibold text-slate-500">Parameters</span>
                                <button type="button" onClick={addParam} className="text-[9px] text-cyan-600 hover:underline font-semibold">+ Add</button>
                              </div>
                              {(mon.parameters || []).map((param: any, pi: number) => (
                                <div key={pi} className="flex items-center gap-1 mb-1">
                                  <input type="text" value={param.parameter} onChange={(e) => updateParam(pi, "parameter", e.target.value)} placeholder="Parameter" className="flex-1 p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  <input type="text" value={param.finding} onChange={(e) => updateParam(pi, "finding", e.target.value)} placeholder="Finding" className="flex-1 p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                  <button type="button" onClick={() => removeParam(pi)} className="text-rose-400 hover:text-rose-600"><Trash className="h-3 w-3" /></button>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                        <button type="button" onClick={() => {
                          const current = [...(row.postop_monitoring || [])];
                          current.push({ postop_day: "", date: "", parameters: [] });
                          uf("postop_monitoring", current as any);
                        }} className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-cyan-600 hover:underline">
                          <CirclePlus className="h-3 w-3" /> Add Monitoring Day
                        </button>
                      </details>

                      {/* Post-op Complications */}
                      <details className="group border border-amber-200 dark:border-amber-800 rounded-lg p-2" open>
                        <summary className="text-[11.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider cursor-pointer select-none">Post-op Complications</summary>
                        <div className="grid grid-cols-1 gap-2 mt-2">
                          <div>
                            <label className="block font-semibold mb-0.5 text-[11.5px]">Reference Surgery Date</label>
                            <input type="date" value={row.reference_surgery_date} onChange={(e) => uf("reference_surgery_date", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11.5px] font-semibold text-slate-500">Complications</span>
                            <button type="button" onClick={() => {
                              const current = [...(row.postop_complications || [])];
                              current.push({ complication_name: "", occurrence_date: "", days_postop: "" });
                              uf("postop_complications", current as any);
                            }} className="text-[11.5px] text-cyan-600 hover:underline font-semibold">+ Add</button>
                          </div>
                          {(row.postop_complications || []).map((comp: any, ci: number) => {
                            const updateComp = (field: string, value: string) => {
                              const current = [...(row.postop_complications || [])];
                              current[ci] = { ...current[ci], [field]: value };
                              if (field === "occurrence_date" && value && row.reference_surgery_date) {
                                const d1 = new Date(row.reference_surgery_date);
                                const d2 = new Date(value);
                                const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
                                current[ci] = { ...current[ci], days_postop: diff >= 0 ? String(diff) : "" };
                              }
                              uf("postop_complications", current as any);
                            };
                            return (
                              <div key={ci} className="flex items-center gap-1 p-1.5 border border-amber-100 dark:border-amber-800/50 rounded-lg">
                                <input type="text" value={comp.complication_name} onChange={(e) => updateComp("complication_name", e.target.value)} placeholder="Complication" className="flex-[2] p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                <input type="date" value={comp.occurrence_date} onChange={(e) => updateComp("occurrence_date", e.target.value)} className="flex-1 p-1 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11.5px]" />
                                <input type="text" value={comp.days_postop} readOnly className="w-14 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-[11.5px] text-slate-500 cursor-default text-center" placeholder="days" />
                                <button type="button" onClick={() => {
                                  const current = [...(row.postop_complications || [])];
                                  current.splice(ci, 1);
                                  uf("postop_complications", current as any);
                                }} className="text-rose-400 hover:text-rose-600"><Trash className="h-3 w-3" /></button>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </details>
                  </div>
                );
              })}

              {(!formState.treatmentOutcomeTable || formState.treatmentOutcomeTable.length === 0) && (
                <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                  No surgical outcome assessment records added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Section: After Surgical Therapies */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("afterSurgicalTherapies")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.afterSurgicalTherapies ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-violet-500/10 dark:bg-violet-400/20 text-violet-700 dark:text-violet-200 flex items-center justify-center">
                <Syringe className="h-3.5 w-3.5" />
              </span>
              <h3 className="h-section">After Surgical Therapies</h3>
              <SectionUploadActions section="afterSurgicalTherapies" label="After Surgical Therapies" />
            </div>
            {openSections.afterSurgicalTherapies ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.afterSurgicalTherapies && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wider">Therapy Records</span>
                <button type="button" onClick={() => addRow("afterSurgicalTherapiesTable", tableTemplates.afterSurgicalTherapiesTable)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-cyan-600 hover:underline">
                  <CirclePlus className="h-3 w-3" />
                  Add Therapy
                </button>
              </div>

              {(formState.afterSurgicalTherapiesTable || []).map((row, idx) => {
                const uf = (field: string, value: string) => handleTableChange("afterSurgicalTherapiesTable", idx, field, value);
                return (
                  <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 bg-white/40 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wider">Therapy #{idx + 1}</span>
                      <button type="button" onClick={() => removeRow("afterSurgicalTherapiesTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Therapy Type</label>
                        <select value={row.therapy_type} onChange={(e) => uf("therapy_type", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                          <option value="">—</option>
                          <option value="Adjuvant Chemotherapy">Adjuvant Chemotherapy</option>
                          <option value="Adjuvant Radiotherapy">Adjuvant Radiotherapy</option>
                          <option value="Hormonal Therapy">Hormonal Therapy</option>
                          <option value="Immunotherapy">Immunotherapy</option>
                          <option value="Targeted Therapy">Targeted Therapy</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Start Date</label>
                        <input type="date" value={row.start_date} onChange={(e) => uf("start_date", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">End Date</label>
                        <input type="date" value={row.end_date} onChange={(e) => uf("end_date", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Regimen</label>
                        <input type="text" value={row.regimen} onChange={(e) => uf("regimen", e.target.value)} placeholder="e.g. FOLFOX, 5-FU" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Cycles / Dose</label>
                        <input type="text" value={row.cycles_dose} onChange={(e) => uf("cycles_dose", e.target.value)} placeholder="e.g. 6 cycles, 50 Gy" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Details</label>
                        <textarea value={row.details} onChange={(e) => uf("details", e.target.value)} rows={2} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                      <div>
                        <label className="block font-semibold mb-0.5 text-[11.5px]">Notes</label>
                        <input type="text" value={row.notes} onChange={(e) => uf("notes", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                      </div>
                    </div>

                    {/* Treatment Timeline */}
                    <details className="group border border-violet-200 dark:border-violet-800 rounded-lg p-2" open>
                      <summary className="text-[11.5px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider cursor-pointer select-none">Treatment Timeline & Intensity</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Diagnosis Date (ref)</label>
                          <input type="date" value={row.diagnosis_date_ref} onChange={(e) => { uf("diagnosis_date_ref", e.target.value); if (e.target.value && row.first_therapy_date) { const d1 = new Date(e.target.value); const d2 = new Date(row.first_therapy_date); const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)); uf("days_diag_to_therapy", diff >= 0 ? String(diff) : ""); } }} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">First Systemic Therapy Date</label>
                          <input type="date" value={row.first_therapy_date} onChange={(e) => { uf("first_therapy_date", e.target.value); if (e.target.value && row.diagnosis_date_ref) { const d1 = new Date(row.diagnosis_date_ref); const d2 = new Date(e.target.value); const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)); uf("days_diag_to_therapy", diff >= 0 ? String(diff) : ""); } }} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Days Diag. to Therapy</label>
                          <input type="text" value={row.days_diag_to_therapy} readOnly className="w-full p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-[11.5px] text-slate-500 cursor-default" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Chemo Dose Intensity</label>
                          <input type="text" value={row.chemo_dose_intensity} onChange={(e) => uf("chemo_dose_intensity", e.target.value)} placeholder="e.g. 85%, reduced due to toxicity" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Chemo Toxicity Grade</label>
                          <select value={row.chemo_toxicity_grade} onChange={(e) => uf("chemo_toxicity_grade", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Grade 0">Grade 0</option>
                            <option value="Grade 1">Grade 1</option>
                            <option value="Grade 2">Grade 2</option>
                            <option value="Grade 3">Grade 3</option>
                            <option value="Grade 4">Grade 4</option>
                            <option value="Grade 5">Grade 5</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Radiation Dose Modifications</label>
                          <input type="text" value={row.radiation_dose_modifications} onChange={(e) => uf("radiation_dose_modifications", e.target.value)} placeholder="e.g. Reduced by 10 Gy" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Treatment Adherence</label>
                          <select value={row.treatment_adherence} onChange={(e) => uf("treatment_adherence", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Full adherence">Full adherence</option>
                            <option value="Partial adherence">Partial adherence</option>
                            <option value="Non-adherence">Non-adherence</option>
                            <option value="Interrupted">Interrupted</option>
                            <option value="Discontinued">Discontinued</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Treatment Related Mortality</label>
                          <select value={row.treatment_related_mortality} onChange={(e) => uf("treatment_related_mortality", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                            <option value="Suspected">Suspected</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Late Toxicity (&gt;90 days)</label>
                          <input type="text" value={row.late_toxicity} onChange={(e) => uf("late_toxicity", e.target.value)} placeholder="e.g. Peripheral neuropathy, fibrosis" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}

              {(!formState.afterSurgicalTherapiesTable || formState.afterSurgicalTherapiesTable.length === 0) && (
                <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                  No after surgical therapy records added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Section: Follow-up & Prognosis */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("followUpPrognosis")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.followUpPrognosis ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-teal-500/10 dark:bg-teal-400/20 text-teal-700 dark:text-teal-200 flex items-center justify-center">
                <Activity className="h-3.5 w-3.5" />
              </span>
              <h3 className="h-section">Follow-up &amp; Prognosis</h3>
              <SectionUploadActions section="followUpPrognosis" label="Follow-up and Prognosis" />
            </div>
            {openSections.followUpPrognosis ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.followUpPrognosis && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wider">Follow-up Records</span>
                <button type="button" onClick={() => addRow("followUpPrognosisTable", tableTemplates.followUpPrognosisTable)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-cyan-600 hover:underline">
                  <CirclePlus className="h-3 w-3" />
                  Add Record
                </button>
              </div>

              {(formState.followUpPrognosisTable || []).map((row, idx) => {
                const uf = (field: string, value: string) => handleTableChange("followUpPrognosisTable", idx, field, value);
                return (
                  <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 bg-white/40 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wider">Record #{idx + 1}</span>
                      <button type="button" onClick={() => removeRow("followUpPrognosisTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Second Cancer & Survival */}
                    <details className="group border border-teal-200 dark:border-teal-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider cursor-pointer select-none">Second Cancer &amp; Survival</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Second Cancer Development</label>
                          <select value={row.second_cancer_development} onChange={(e) => uf("second_cancer_development", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Second Cancer Details</label>
                          <input type="text" value={row.second_cancer_details} onChange={(e) => uf("second_cancer_details", e.target.value)} placeholder="e.g. Type, date, location" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Cancer Specific Survival</label>
                          <input type="text" value={row.cancer_specific_survival} onChange={(e) => uf("cancer_specific_survival", e.target.value)} placeholder="e.g. 5-year CSS 75%" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Conditional Survival Details</label>
                          <input type="text" value={row.conditional_survival_details} onChange={(e) => uf("conditional_survival_details", e.target.value)} placeholder="e.g. If survived 2yr, 5yr CSS 85%" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                      </div>
                    </details>

                    {/* Quality of Life & Functional Recovery */}
                    <details className="group border border-teal-200 dark:border-teal-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider cursor-pointer select-none">QoL &amp; Functional Recovery</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">QoL Assessment Done</label>
                          <select value={row.qol_assessment_done} onChange={(e) => uf("qol_assessment_done", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">QoL Score System</label>
                          <select value={row.qol_score_system} onChange={(e) => uf("qol_score_system", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="EORTC QLQ-C30">EORTC QLQ-C30</option>
                            <option value="FACT-G">FACT-G</option>
                            <option value="SF-36">SF-36</option>
                            <option value="EQ-5D">EQ-5D</option>
                            <option value="WHOQOL-BREF">WHOQOL-BREF</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">QoL Score</label>
                          <input type="text" value={row.qol_score} onChange={(e) => uf("qol_score", e.target.value)} placeholder="e.g. 72/100" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block font-semibold mb-0.5 text-[11.5px]">QoL Parameters</label>
                          <input type="text" value={row.qol_parameters} onChange={(e) => uf("qol_parameters", e.target.value)} placeholder="e.g. Physical, emotional, social functioning" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Functional Recovery</label>
                          <input type="text" value={row.functional_recovery} onChange={(e) => uf("functional_recovery", e.target.value)} placeholder="e.g. Full, partial, dependent" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                      </div>
                    </details>

                    {/* Genetics, Trials & Readmission */}
                    <details className="group border border-teal-200 dark:border-teal-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider cursor-pointer select-none">Genetics, Trials &amp; Readmission</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Genetic Review Done</label>
                          <select value={row.genetic_review_done} onChange={(e) => uf("genetic_review_done", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="Pending">Pending</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Genetic Review Details</label>
                          <input type="text" value={row.genetic_review_details} onChange={(e) => uf("genetic_review_details", e.target.value)} placeholder="e.g. BRCA, MSI, germline testing results" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Clinical Trial Enrollment</label>
                          <select value={row.clinical_trial_enrollment} onChange={(e) => uf("clinical_trial_enrollment", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                            <option value="Offered, declined">Offered, declined</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Clinical Trial Details</label>
                          <input type="text" value={row.clinical_trial_details} onChange={(e) => uf("clinical_trial_details", e.target.value)} placeholder="e.g. Trial name, NCT number" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Readmission (30 days)</label>
                          <select value={row.readmission_30d} onChange={(e) => uf("readmission_30d", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Readmission (90 days)</label>
                          <select value={row.readmission_90d} onChange={(e) => uf("readmission_90d", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Follow-up Notes</label>
                          <textarea value={row.follow_up_notes} onChange={(e) => uf("follow_up_notes", e.target.value)} rows={2} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}

              {(!formState.followUpPrognosisTable || formState.followUpPrognosisTable.length === 0) && (
                <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                  No follow-up & prognosis records added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Section: Oncological Outcome Assessment */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("oncologicalOutcome")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.oncologicalOutcome ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-amber-500/10 dark:bg-amber-400/20 text-amber-700 dark:text-amber-200 flex items-center justify-center">
                <ClipboardCheck className="h-3.5 w-3.5" />
              </span>
              <h3 className="h-section">Oncological Outcome Assessment</h3>
              <SectionUploadActions section="oncologicalOutcome" label="Oncological Outcome Assessment" />
            </div>
            {openSections.oncologicalOutcome ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.oncologicalOutcome && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wider">Outcome Assessment Records</span>
                <button type="button" onClick={() => addRow("oncologicalOutcomeTable", tableTemplates.oncologicalOutcomeTable)} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-cyan-600 hover:underline">
                  <CirclePlus className="h-3 w-3" />
                  Add Assessment
                </button>
              </div>

              {(formState.oncologicalOutcomeTable || []).map((row, idx) => {
                const uf = (field: string, value: string) => handleTableChange("oncologicalOutcomeTable", idx, field, value);
                return (
                  <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 bg-white/40 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wider">Assessment #{idx + 1}</span>
                      <button type="button" onClick={() => removeRow("oncologicalOutcomeTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>

                    <details className="group border border-amber-200 dark:border-amber-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider cursor-pointer select-none">Assessment &amp; Response</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Assessment Date</label>
                          <input type="date" value={row.assessment_date} onChange={(e) => uf("assessment_date", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Response Criteria</label>
                          <select value={row.response_evaluation_criteria} onChange={(e) => uf("response_evaluation_criteria", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            {["RECIST 1.1", "iRECIST", "RANO", "PERCIST", "Deauville", "Lugano", "Not specified"].map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Overall Response</label>
                          <select value={row.overall_response} onChange={(e) => uf("overall_response", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            {["CR", "PR", "SD", "PD", "Mixed", "Not evaluable"].map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Target Lesion Response</label>
                          <input type="text" value={row.target_lesion_response} onChange={(e) => uf("target_lesion_response", e.target.value)} placeholder="e.g. -30% reduction" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Non-target Lesion Response</label>
                          <input type="text" value={row.non_target_lesion_response} onChange={(e) => uf("non_target_lesion_response", e.target.value)} placeholder="e.g. Stable or resolved" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">New Lesions</label>
                          <select value={row.new_lesions} onChange={(e) => uf("new_lesions", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </div>
                      </div>
                    </details>

                    <details className="group border border-amber-200 dark:border-amber-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider cursor-pointer select-none">Progression &amp; Recurrence</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Progression Date</label>
                          <input type="date" value={row.progression_date} onChange={(e) => uf("progression_date", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Recurrence Status</label>
                          <select value={row.recurrence_status} onChange={(e) => uf("recurrence_status", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            {["No recurrence", "Local", "Regional", "Distant", "Unknown"].map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Recurrence Date</label>
                          <input type="date" value={row.recurrence_date} onChange={(e) => uf("recurrence_date", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Recurrence Location</label>
                          <input type="text" value={row.recurrence_location} onChange={(e) => uf("recurrence_location", e.target.value)} placeholder="e.g. Liver, lung, local surgical bed" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                      </div>
                    </details>

                    <details className="group border border-amber-200 dark:border-amber-800 rounded-lg p-2 open:pb-3" open>
                      <summary className="text-[11.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider cursor-pointer select-none">Survival &amp; Follow-up</summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Survival Status</label>
                          <select value={row.survival_status} onChange={(e) => uf("survival_status", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            {["Alive", "Deceased", "Unknown"].map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Survival Date</label>
                          <input type="date" value={row.survival_date} onChange={(e) => uf("survival_date", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Cause of Death</label>
                          <input type="text" value={row.cause_of_death} onChange={(e) => uf("cause_of_death", e.target.value)} placeholder="e.g. Disease progression" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">ECOG Status</label>
                          <select value={row.ecog_status} onChange={(e) => uf("ecog_status", e.target.value)} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]">
                            <option value="">—</option>
                            {["0", "1", "2", "3", "4", "5"].map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Tumour Markers (follow-up)</label>
                          <input type="text" value={row.tumor_markers_followup} onChange={(e) => uf("tumor_markers_followup", e.target.value)} placeholder="e.g. CEA 2.5 ng/mL" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div>
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Imaging (follow-up)</label>
                          <input type="text" value={row.imaging_followup} onChange={(e) => uf("imaging_followup", e.target.value)} placeholder="e.g. CT chest/abdomen findings" className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                          <label className="block font-semibold mb-0.5 text-[11.5px]">Outcome Notes</label>
                          <textarea value={row.outcome_notes} onChange={(e) => uf("outcome_notes", e.target.value)} rows={2} className="w-full p-1.5 bg-theme-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11.5px]" />
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}

              {(!formState.oncologicalOutcomeTable || formState.oncologicalOutcomeTable.length === 0) && (
                <div className="text-center py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400">
                  No oncological outcome assessment records added yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Collapsible Section 6: AI Added Extra Parameters (kept at the end) */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("extraParams")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.extraParams ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 flex items-center justify-center"><Sparkles className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">AI Added Extra Parameters</h3>
              <SectionUploadActions section="extraParams" label="AI Added Extra Parameters" />
            </div>
            {openSections.extraParams ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSections.extraParams && (
            <div className="p-5 space-y-3 text-xs text-slate-700 dark:text-slate-350">
              <div className="flex items-start gap-2 text-[11.5px] text-slate-500 dark:text-slate-400 bg-violet-50/40 dark:bg-violet-950/20 border border-violet-200/60 dark:border-violet-800/40 rounded-lg p-2.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300 mt-0.5 flex-shrink-0" />
                <span>
                  AI-understood clinical facts that did not fit any of the predefined tables above are preserved here as <strong>Source / New Column</strong> + <strong>Preserved AI Detail</strong> rows. Add your own rows manually or let Gemini populate them from uploaded reports.
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/30 p-2.5 pl-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="h-subsection">
                    AI Added Extra Parameters
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addRow("unmapped_medical_information", { source_section: "manual", detail: "", medical_importance: "medium" })}
                  className="text-[11.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <CirclePlus className="h-3.5 w-3.5" />
                  <span>Add Extra Row</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-natural-border/50 dark:border-slate-700 rounded-xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="h-table-col">
                      <th className="p-2.5">Source / New Column</th>
                      <th className="p-2.5">Preserved AI Detail</th>
                      <th className="p-2.5">Importance</th>
                      <th className="p-2.5 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                    {formState.unmapped_medical_information?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-2">
                          <input type="text" value={row.source_section} onChange={(e) => handleTableChange("unmapped_medical_information", idx, "source_section", e.target.value)} placeholder="e.g. ECOG / unusual marker" className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                        </td>
                        <td className="p-2">
                          <textarea value={row.detail} onChange={(e) => handleTableChange("unmapped_medical_information", idx, "detail", e.target.value)} rows={2} placeholder="AI preserved detail that does not fit the standard columns" className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={row.medical_importance} onChange={(e) => handleTableChange("unmapped_medical_information", idx, "medical_importance", e.target.value)} placeholder="e.g. High" className="w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs" />
                        </td>
                        <td className="p-2 text-right">
                          <button type="button" onClick={() => removeRow("unmapped_medical_information", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20 transition">
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!formState.unmapped_medical_information || formState.unmapped_medical_information.length === 0) && (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-slate-400 text-[11.5px]">No extra AI-only parameters captured yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Section 3b: Supplementary / Additional Details (dynamic AI headings, subheadings, cells) */}
        <div className="minimal-card rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection("supplementary")}
            className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${openSections.supplementary ? "border-b border-natural-border" : ""} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all`}
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-amber-500/10 dark:bg-amber-400/20 text-amber-700 dark:text-amber-200 flex items-center justify-center"><FileStack className="h-3.5 w-3.5" /></span>
              <h3 className="h-section">Supplementary / Additional Details</h3>
              <SectionUploadActions section="supplementary" label="Supplementary and Additional Details" />
            </div>
            <span className={`transition-transform text-slate-500 ${openSections.supplementary ? "rotate-180" : ""}`}>▼</span>
          </button>
          {openSections.supplementary && (
            <div className="p-5 space-y-5">
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Use this section to capture any details that don't fit the standard tables above. The AI adds rows here automatically when the source document contains headings, subheadings, or cells not covered by the predefined schema (e.g. Genetic Testing, Performance Status, Lifestyle, Comorbidities, Staging Details, etc.). Each row is one cell under a heading.
              </p>

              {/* Consent to AI Processing Toggle */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 cursor-pointer select-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={formState.consent_ai_processing === true}
                  onChange={(e) => setFormState(prev => ({ ...prev, consent_ai_processing: e.currentTarget.checked }))}
                  className="h-4 w-4 rounded border-slate-400 dark:border-slate-600 text-violet-600 focus:ring-violet-500"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Consent to AI data processing (Gemini)</span>
                  <span className="text-[11.5px] text-slate-500 dark:text-slate-400">Allow AI analysis of this patient's data using Google Gemini</span>
                </div>
              </label>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="h-subsection">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mr-2 align-middle" />Supplementary Details — Heading / Subheading / Cell
                  </h4>
                  <button
                    type="button"
                    onClick={() => addRow("supplementaryDetailsTable", { detail_heading: "", detail_subheading: "", detail_label: "", detail_value: "", detail_unit: "", detail_date: "", detail_priority: "medium", detail_category: "", detail_source: "", detail_notes: "" })}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:underline"
                  >
                    <CirclePlus className="h-3.5 w-3.5" />
                    <span>Add Supplementary Detail</span>
                  </button>
                </div>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/85 rounded-xl">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="h-table-col">
                        <th className="p-2.5">Heading</th>
                        <th className="p-2.5">Subheading</th>
                        <th className="p-2.5">Label (cell key)</th>
                        <th className="p-2.5">Value</th>
                        <th className="p-2.5">Unit</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Priority</th>
                        <th className="p-2.5 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-natural-border/30 dark:divide-slate-800/20">
                      {formState.supplementaryDetailsTable?.map((row, idx) => (
                        <tr key={idx} className={row.detail_heading || row.detail_value ? "ai-priority-row" : ""}>
                          <td className="p-2">
                            <input list="supp-heading-list" type="text" value={row.detail_heading} onChange={(e) => handleTableChange("supplementaryDetailsTable", idx, "detail_heading", e.target.value)} placeholder="e.g. Genetic Testing" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold ${row.detail_heading ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.detail_subheading} onChange={(e) => handleTableChange("supplementaryDetailsTable", idx, "detail_subheading", e.target.value)} placeholder="optional group" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.detail_subheading ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.detail_label} onChange={(e) => handleTableChange("supplementaryDetailsTable", idx, "detail_label", e.target.value)} placeholder="e.g. BRCA1 variant" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold ${row.detail_label ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.detail_value} onChange={(e) => handleTableChange("supplementaryDetailsTable", idx, "detail_value", e.target.value)} placeholder="value" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.detail_value ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.detail_unit} onChange={(e) => handleTableChange("supplementaryDetailsTable", idx, "detail_unit", e.target.value)} placeholder="unit" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.detail_unit ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="date" value={row.detail_date} onChange={(e) => handleTableChange("supplementaryDetailsTable", idx, "detail_date", e.target.value)} className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs ${row.detail_date ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2">
                            <input type="text" value={row.detail_priority} onChange={(e) => handleTableChange("supplementaryDetailsTable", idx, "detail_priority", e.target.value)} placeholder="e.g. High" className={`w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold ${row.detail_priority ? "ai-priority-text" : ""}`} />
                          </td>
                          <td className="p-2 text-right align-top">
                            <button type="button" onClick={() => removeRow("supplementaryDetailsTable", idx)} className="text-rose-500 hover:text-rose-700 p-1.5 rounded bg-rose-50 dark:bg-rose-950/20">
                              <Trash className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!formState.supplementaryDetailsTable || formState.supplementaryDetailsTable.length === 0) && (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-slate-400 text-[11.5px]">No supplementary details yet. AI will fill here automatically, or click "Add Supplementary Detail" to add manually.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <datalist id="supp-heading-list">
                  <option value="Genetic Testing" />
                  <option value="Family Cancer History" />
                  <option value="Performance Status" />
                  <option value="Vitals" />
                  <option value="Lifestyle" />
                  <option value="Cardiovascular Risk" />
                  <option value="Staging Details" />
                  <option value="Pathology Details" />
                  <option value="Complications" />
                  <option value="Pregnancy / Reproductive History" />
                  <option value="Allergies" />
                  <option value="Vaccinations" />
                  <option value="Molecular / NGS" />
                  <option value="Functional Status" />
                  <option value="Care Plan" />
                  <option value="Patient-Reported Outcomes" />
                  <option value="Adverse Event Logs" />
                  <option value="Discharge Medications" />
                  <option value="Discharge Summary" />
                  <option value="Follow-up Schedule" />
                  <option value="Comorbidities" />
                  <option value="Screening Tests" />
                  <option value="Bone Health" />
                  <option value="Renal Function" />
                  <option value="Coagulation" />
                  <option value="Infectious Disease" />
                  <option value="Autoimmune" />
                  <option value="Endocrine" />
                  <option value="Nutritional Status" />
                  <option value="Psychosocial" />
                  <option value="Occupational History" />
                  <option value="Travel History" />
                  <option value="Substance Use" />
                  <option value="Prior Therapies Outside This Encounter" />
                  <option value="Additional Biopsy Notes" />
                  <option value="Additional Imaging Notes" />
                  <option value="Additional Surgery Notes" />
                  <option value="Additional IHC Notes" />
                  <option value="Additional Lab Notes" />
                </datalist>
              </div>
            </div>
          )}
        </div>

        {/* Form action bar */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700/80">
          <button
            type="button"
            onClick={handleNavigateHome}
            className="px-6 py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-700 dark:hover:text-theme-on-accent transition duration-200 cursor-pointer text-xs hover-lift ripple-on-click"
          >
            Cancel and Discard Changes
          </button>
          {isSaving && saveProgress > 0 && saveProgress < 100 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                  strokeDasharray={`${saveProgress * 0.942} 94.2`}
                  strokeLinecap="round" className="text-blue-500 transition-all duration-500 ease-out" />
              </svg>
              <span className="max-w-[100px] truncate">{saveStage}</span>
            </div>
          )}
          <AnimatedButton
            type="submit"
            id="btn-save-record"
            variant="primary"
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 border-blue-600 text-theme-on-accent px-8"
            loading={isSaving}
            success={saveSuccess}
          >
            <Save className="h-4.5 w-4.5" />
            <span>Save Secure Record</span>
          </AnimatedButton>
        </div>

      </form>

      {/* Floating action buttons — portal to body to escape parent transform stacking context */}
      {createPortal(
        <div className="fixed bottom-8 right-8 z-[9999] flex flex-col gap-3">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className={`h-10 w-10 rounded-full shadow-xl flex items-center justify-center transition-all cursor-pointer ${
            isSaving
              ? "bg-blue-500/20 border-2 border-blue-400 text-blue-500 cursor-default"
              : "bg-white dark:bg-slate-800 border-2 border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:scale-110"
          }`}
          title={isSaving ? `Saving progress: ${saveProgress}%` : "Go to top"}
        >
          {isSaving ? (
            <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="15" stroke="rgba(59,130,246,0.25)" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15" stroke="#3B82F6" strokeWidth="3.5"
                strokeLinecap="round" strokeDasharray="94.2"
                strokeDashoffset={94.2 - (saveProgress / 100) * 94.2}
                className="transition-all duration-500 ease-out" />
            </svg>
          ) : (
            <ArrowUp className="h-5 w-5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => document.querySelector<HTMLFormElement>("form")?.requestSubmit()}
          className={`h-10 w-10 rounded-full shadow-xl flex items-center justify-center transition-all cursor-pointer ${
            isSaving
              ? "bg-blue-500/90 cursor-wait"
              : "bg-blue-600 text-white hover:from-blue-600 hover:to-indigo-700 hover:scale-110 hover:shadow-blue-500/30"
          }`}
          title={isSaving ? `Saving: ${saveStage} (${saveProgress}%)` : "Save record"}
          disabled={isSaving}
        >
          {isSaving ? (
            <svg className="h-5 w-5 -rotate-90" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="15" stroke="rgba(255,255,255,0.25)" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15" stroke="white" strokeWidth="3.5"
                strokeLinecap="round" strokeDasharray="94.2"
                strokeDashoffset={94.2 - (saveProgress / 100) * 94.2}
                className="transition-all duration-500 ease-out" />
            </svg>
          ) : (
            <Save className="h-5 w-5" />
          )}
        </button>
        {/* Save progress label — shows when saving */}
        {isSaving && (
          <div className="flex flex-col items-center bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl px-2 py-1.5 shadow-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[11.5px] font-bold text-blue-600 dark:text-blue-400">{saveProgress}%</span>
            <span className="text-[7px] text-slate-500 dark:text-slate-400 truncate max-w-[60px] leading-tight text-center">{saveStage}</span>
          </div>
        )}
      </div>,
        document.body
      )}

    </div>
  );
}
