import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp, ArrowDown, Trash2, Edit, FileJson, FileSpreadsheet, MessageSquare, IdCard, Users, Dna, Building2, Stethoscope, Activity, Ruler, Scan, ClipboardList, FileCheck2, FlaskConical, Crosshair, BookOpen, Syringe, ClipboardPlus, FileText, HeartPulse, ScrollText, Heart, ActivitySquare, Calendar, Send, ShieldCheck, Bot, Clock, CheckCheck
} from "lucide-react";
import type { PatientRecord, DefinitiveSurgeryEntry, TreatmentOutcomeEntry, AfterSurgicalTherapyEntry, AdjuvantTherapyEntry, FollowUpPrognosisEntry, OncologicalOutcomeEntry, IntraopImagingEntry, PostOpComplicationEntry, TumorCharacteristicsEntry, PreOperativeAssessmentEntry, ClinicalStagingEntry, HistologyGradingEntry } from "../types";
import { ChatMarkdown, ThinkingDots } from "./ChatMarkdown";
import MANIFEST, { getExportKeyOrder } from "../formManifest";
import { apiFetch } from "../lib/api-client";

const D = ({ v }: { v: string | number | undefined | null }) => (
  <span className="text-slate-700 dark:text-slate-300">
    {v !== undefined && v !== null && v !== "" ? v : <span className="text-slate-300 dark:text-slate-600">-</span>}
  </span>
);

const DL = ({ label, value, fullWidth = false }: { label: string; value: string | number | undefined | null; fullWidth?: boolean }) => (
  <div className={fullWidth ? "md:col-span-4" : ""}>
    <label className="block font-semibold mb-1 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</label>
    <div className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm min-h-[38px] flex items-center">
      <D v={value} />
    </div>
  </div>
);

const sectionIconColors: Record<string, string> = {
  summary: "#10B981",
  patientIdentifiers: "#3B82F6", demographics: "#64748B", oncology: "#2563EB",
  hospital: "#10B981", history: "#2563EB", clinicalAssessment: "#2563EB",
  anthropometric: "#10B981", examination: "#10B981", provisionalDiagnosis: "#DC2626",
  definitiveDiagnosis: "#10B981", investigations: "#3B82F6", tumorCharacteristics: "#2563EB",
  clinicalStaging: "#10B981", histologyGrading: "#10B981", adjuvantTherapy: "#DC2626",
  preOperativeAssessment: "#10B981", definitiveSurgery: "#2563EB", treatmentOutcome: "#DC2626",
  afterSurgicalTherapies: "#2563EB", followUpPrognosis: "#10B981", oncologicalOutcome: "#DC2626",
  supplementary: "#DC2626",
};

const SectionHeader = ({ title, icon: Icon, isOpen, onToggle, color }: { title: string; icon: React.ElementType; isOpen: boolean; onToggle: () => void; color: string }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`w-full bg-natural-sidebar/15 dark:bg-theme-surface/5 hover:bg-natural-sidebar/25 dark:hover:bg-theme-surface/10 p-4 ${isOpen ? 'border-b border-natural-border' : ''} flex justify-between items-center cursor-pointer text-left focus:outline-none transition-all sticky top-0 z-10`}
  >
    <div className="flex items-center gap-2">
      <span className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "18", color }}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <h3 className="h-section">{title}</h3>
    </div>
    {isOpen ? <ArrowUp className="h-4 w-4 text-slate-400" /> : <ArrowDown className="h-4 w-4 text-slate-400" />}
  </button>
);

interface SectionWrapperProps {
  title: string;
  icon: React.ElementType;
  sectionKey: string;
  openSections: Record<string, boolean>;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}

const Section = ({ title, icon, sectionKey, openSections, onToggle, children }: SectionWrapperProps) => (
  <div className="minimal-card rounded-2xl overflow-hidden">
    <SectionHeader title={title} icon={icon} isOpen={openSections[sectionKey]} onToggle={() => onToggle(sectionKey)} color={sectionIconColors[sectionKey] || "#64748B"} />
    {openSections[sectionKey] && <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">{children}</div>}
  </div>
);

const TableView = ({ headers, rows, renderRow }: { headers: string[]; rows: any[]; renderRow: (row: any, idx: number) => React.ReactNode }) => {
  if (!rows || rows.length === 0) {
    return <div className="md:col-span-4 text-center py-4 text-slate-400 italic">No entries recorded.</div>;
  }
  return (
    <div className="md:col-span-4 overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800/50">
            {headers.map((h, i) => (
              <th key={i} className="p-2 text-left font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => renderRow(row, idx))}
        </tbody>
      </table>
    </div>
  );
};

const TD = ({ v }: { v: string | number | undefined | null }) => (
  <td className="p-2 border-b border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-300">
    <D v={v} />
  </td>
);

type SummaryItem = {
  section: string;
  label: string;
  value: string;
};

type BackupSummary = {
  documentName: string;
  extractionDate: string;
  extractionTime: string;
  fileReference: string;
  fields: Array<{ label: string; value: string }>;
  changes: Array<{ target: string; action: string; evidence: string }>;
  suggestions: Array<{ detail: string; target: string; reason: string }>;
  reviewIssues: string[];
};

const SUMMARY_SKIP_KEYS = new Set(["id", "createdAt", "updatedAt", "isDeleted", "document_extraction_backups"]);
const DEFAULT_ONLY_KEY_PATTERN = /(^id$|_id$|_unit$|_parameter$)/i;

const humanizeKey = (key: string) => (
  key
    .replace(/Table$/, "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
);

const hasFilledValue = (value: any): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value === true;
  if (Array.isArray(value)) return value.some((item) => hasFilledValue(item));
  if (typeof value === "object") {
    return Object.entries(value).some(([childKey, childValue]) => {
      if (DEFAULT_ONLY_KEY_PATTERN.test(childKey) && !hasFilledValue(childValue)) return false;
      if (DEFAULT_ONLY_KEY_PATTERN.test(childKey)) return false;
      return hasFilledValue(childValue);
    });
  }
  return Boolean(value);
};

const formatSummaryValue = (value: any): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "";
  if (Array.isArray(value)) {
    return value
      .filter((item) => hasFilledValue(item))
      .map((item, index) => {
        const formatted = formatSummaryValue(item);
        return typeof item === "object" && item !== null ? `${index + 1}. ${formatted}` : formatted;
      })
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, childValue]) => hasFilledValue(childValue))
      .map(([childKey, childValue]) => `${humanizeKey(childKey)}: ${formatSummaryValue(childValue)}`)
      .filter(Boolean)
      .join("; ");
  }
  return String(value);
};

const buildPatientSummary = (record: PatientRecord): SummaryItem[] => {
  const items: SummaryItem[] = [];
  const consumedKeys = new Set<string>();

  const addSummaryField = (section: string, key: string, value: any) => {
    consumedKeys.add(key);
    if (SUMMARY_SKIP_KEYS.has(key) || !hasFilledValue(value)) return;

    if (Array.isArray(value)) {
      value.forEach((row, index) => {
        if (!hasFilledValue(row)) return;
        const formatted = formatSummaryValue(row);
        if (formatted) {
          items.push({
            section,
            label: `${humanizeKey(key)} #${index + 1}`,
            value: formatted,
          });
        }
      });
      return;
    }

    const formatted = formatSummaryValue(value);
    if (formatted) {
      items.push({
        section,
        label: humanizeKey(key),
        value: formatted,
      });
    }
  };

  Object.values(MANIFEST.sections).forEach((section) => {
    Object.keys(section.fields).forEach((key) => {
      addSummaryField(section.label, key, (record as any)[key]);
    });
  });

  Object.entries(record).forEach(([key, value]) => {
    if (!consumedKeys.has(key)) {
      addSummaryField("Additional Details", key, value);
    }
  });

  return items;
};

const summariseBackupValue = (value: any): string => {
  const formatted = formatSummaryValue(value);
  return formatted.length > 180 ? `${formatted.slice(0, 177)}...` : formatted;
};

const buildBackupSummaries = (record: PatientRecord): BackupSummary[] => {
  const backups = Array.isArray(record.document_extraction_backups) ? record.document_extraction_backups : [];
  return backups.map((entry: any) => {
    let parsed: any = null;
    try {
      parsed = entry.raw_extracted_data ? JSON.parse(entry.raw_extracted_data) : null;
    } catch {
      parsed = null;
    }

    const fields = parsed?.data && typeof parsed.data === "object"
      ? Object.entries(parsed.data)
          .filter(([, value]) => hasFilledValue(value))
          .slice(0, 12)
          .map(([key, value]) => ({ label: humanizeKey(key), value: summariseBackupValue(value) }))
      : [];

    const changes = Array.isArray(parsed?.proposedChanges)
      ? parsed.proposedChanges.slice(0, 8).map((change: any) => ({
          target: humanizeKey(String(change?.target || "Review")),
          action: humanizeKey(String(change?.action || "Fill")),
          evidence: String(change?.evidence?.quote || ""),
        }))
      : [];

    const suggestions = Array.isArray(parsed?.suggestedElsewhere)
      ? parsed.suggestedElsewhere.slice(0, 6).map((suggestion: any) => ({
          detail: summariseBackupValue(suggestion?.detail ?? suggestion?.value ?? ""),
          target: humanizeKey(String(suggestion?.candidateTarget || suggestion?.sourceKey || "Suggested Field")),
          reason: String(suggestion?.reason || ""),
        }))
      : [];

    return {
      documentName: String(entry.document_name || "Untitled document"),
      extractionDate: String(entry.extraction_date || ""),
      extractionTime: String(entry.extraction_time || ""),
      fileReference: String(entry.file_reference || ""),
      fields,
      changes,
      suggestions,
      reviewIssues: Array.isArray(parsed?.reviewIssues) ? parsed.reviewIssues.map(String).slice(0, 6) : [],
    };
  }).filter((entry) => hasFilledValue(entry.documentName) || entry.fields.length > 0 || entry.changes.length > 0 || entry.suggestions.length > 0);
};

interface PatientViewProps {
  patient: PatientRecord;
  onEdit: (patient: PatientRecord) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function PatientView({ patient, onEdit, onDelete, onClose }: PatientViewProps) {
  const [activeTab, setActiveTab] = useState<"dossier" | "chat">("dossier");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteStage, setDeleteStage] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    summary: true,
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
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const [chatMessage, setChatMessage] = useState("");
  const [chatThread, setChatThread] = useState<Array<{ sender: "user" | "ai"; text: string; timestamp: string }>>([
    {
      sender: "ai",
      text: `Hello. I am your ASCO & NCCN clinical oncology advisor. I have analyzed the medical recordings of **${patient.title ? `${patient.title} ` : ""}${patient.first_name} ${patient.last_name}** (Primary Diagnosis: *${patient.oncology}*, Stage: *${patient.overall_stage || "N/A"}*). Ask any questions concerning clinical staging, chemotherapy options, or patient care guidelines.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatThread, chatLoading, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatLoading) return;

    const userText = chatMessage;
    setChatMessage("");
    setChatThread(prev => [...prev, {
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setChatLoading(true);

    try {
      const response = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientRecord: patient,
          query: userText
        })
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.reply || data.text;
        setChatThread(prev => [...prev, {
          sender: "ai",
          text: reply || "Diagnostic advisor returned an empty reply.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      } else {
        let detail = "";
        try {
          const errBody = await response.json();
          detail = errBody?.error || errBody?.detail || "";
        } catch {}
        setChatThread(prev => [...prev, {
          sender: "ai",
          text: `The oncology advisor could not be reached (HTTP ${response.status})${detail ? ": " + detail : ". Please retry or verify your Gemini API key in Settings."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (err: any) {
      setChatThread(prev => [...prev, {
        sender: "ai",
        text: `Error contacting the AI Clinical engine: ${err?.message || "network failure"}. Check your network and retry.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const p = patient;
  const summaryItems = React.useMemo(() => buildPatientSummary(p), [p]);
  const backupSummaries = React.useMemo(() => buildBackupSummaries(p), [p]);

  const handleExportJSON = () => {
    const keyOrder = getExportKeyOrder();
    const data = JSON.stringify(p, keyOrder, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `OncoDossier_${p.first_name}_${p.last_name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const flatten = (obj: any, prefix = ""): [string, string][] => {
      const entries: [string, string][] = [];
      for (const [key, value] of Object.entries(obj)) {
        const k = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === "object" && !Array.isArray(value)) {
          entries.push(...flatten(value, k));
        } else if (Array.isArray(value)) {
          entries.push([k, JSON.stringify(value)]);
        } else {
          entries.push([k, String(value ?? "")]);
        }
      }
      return entries;
    };
    const flat = flatten(p);
    const headers = flat.map(([k]) => k).join(",");
    const values = flat.map(([, v]) => `"${v.replace(/"/g, '""')}"`).join(",");
    const csv = `${headers}\n${values}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `OncoDossier_${p.first_name}_${p.last_name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteProgress(10);
    setDeleteStage("Confirming...");
    // Small delay so user sees the progress ring
    await new Promise(r => setTimeout(r, 200));
    setDeleteProgress(50);
    setDeleteStage("Moving to trash...");
    // Set final states before calling onDelete (which may unmount)
    setDeleteProgress(100);
    setDeleteStage("Done");
    setIsDeleting(false);
    setDeleteProgress(0);
    setDeleteStage("");
    onDelete(p.id);
  };

  return (
    <div className="space-y-6 fade-in max-w-7xl mx-auto">
      <div className="minimal-card rounded-2xl overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              title="Back to list"
            >
              <ArrowDown className="h-4 w-4 rotate-45 text-slate-400" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                {p.title} {p.first_name} {p.last_name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {p.auto_id} &middot; {p.oncology} &middot; {p.hospital}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => onEdit(p)} className="btn-clr-edit inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition">
              <Edit className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={handleExportJSON} className="btn-clr-json inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition">
              <FileJson className="h-3.5 w-3.5" /> JSON
            </button>
            <button onClick={handleExportCSV} className="btn-clr-csv inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition">
              <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
            </button>
            <button onClick={handleDelete} disabled={isDeleting} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${isDeleting ? "btn-clr-delete opacity-70" : "btn-clr-delete"}`}>
              {isDeleting ? (
                <svg className="h-4 w-4 -rotate-90" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="18" r="15" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="3.5"
                    strokeLinecap="round" strokeDasharray="94.2"
                    strokeDashoffset={94.2 - (deleteProgress / 100) * 94.2}
                    className="transition-all duration-500 ease-out" />
                </svg>
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {isDeleting ? deleteStage : "Delete"}
            </button>
          </div>
        </div>
        <div className="flex border-t border-natural-border">
          <button
            onClick={() => setActiveTab("dossier")}
            className={`flex-1 py-2.5 text-xs font-semibold text-center transition ${activeTab === "dossier" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30"}`}
          >
            <FileText className="h-3.5 w-3.5 inline mr-1.5" /> Clinical Dossier
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-2.5 text-xs font-semibold text-center transition ${activeTab === "chat" ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-b-2 border-purple-500" : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/30"}`}
          >
            <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" /> AI Oncology Advisor
          </button>
        </div>
      </div>

      {activeTab === "dossier" ? (
        <div className="space-y-4">
          <Section title="Summary" icon={ScrollText} sectionKey="summary" openSections={openSections} onToggle={toggleSection}>
            {summaryItems.length > 0 ? (
              <ul className="md:col-span-4 grid grid-cols-1 lg:grid-cols-2 gap-2">
                {summaryItems.map((item, index) => (
                  <li key={`${item.section}-${item.label}-${index}`} className="flex gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-slate-700 dark:text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <div className="min-w-0 leading-relaxed">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">{item.section}</div>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{item.label}: </span>
                      <span className="break-words">{item.value}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : backupSummaries.length === 0 ? (
              <div className="md:col-span-4 text-center py-4 text-slate-400 italic">No filled data recorded.</div>
            ) : null}
            {backupSummaries.length > 0 && (
              <details className="md:col-span-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 overflow-hidden">
                <summary className="cursor-pointer select-none px-4 py-3 text-xs font-bold text-purple-800 dark:text-purple-200">
                  Extracted Backup Summary ({backupSummaries.length})
                </summary>
                <div className="border-t border-purple-200/70 dark:border-purple-800/70 p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {backupSummaries.map((backup, index) => (
                    <div key={`${backup.documentName}-${index}`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 p-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-bold text-slate-800 dark:text-slate-100 truncate">{backup.documentName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {[backup.extractionDate, backup.extractionTime].filter(Boolean).join(" ")}
                          </p>
                        </div>
                        {backup.fileReference && (
                          <a href={backup.fileReference} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-blue-600 dark:text-blue-300 hover:underline whitespace-nowrap">
                            View file
                          </a>
                        )}
                      </div>

                      {backup.fields.length > 0 && (
                        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                          <table className="w-full text-[10px]">
                            <tbody>
                              {backup.fields.map((field, fieldIndex) => (
                                <tr key={`${field.label}-${fieldIndex}`} className="border-b last:border-b-0 border-slate-100 dark:border-slate-800">
                                  <td className="w-32 p-2 font-bold text-slate-500 dark:text-slate-400 align-top">{field.label}</td>
                                  <td className="p-2 text-slate-700 dark:text-slate-200 align-top">{field.value}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {backup.changes.length > 0 && (
                        <div className="grid grid-cols-1 gap-1.5">
                          {backup.changes.map((change, changeIndex) => (
                            <div key={`${change.target}-${changeIndex}`} className="rounded-lg bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800 px-2 py-1.5">
                              <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-200">{change.action} {"->"} {change.target}</p>
                              {change.evidence && <p className="text-[9px] text-emerald-700 dark:text-emerald-300 line-clamp-2">{change.evidence}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {backup.suggestions.length > 0 && (
                        <div className="grid grid-cols-1 gap-1.5">
                          {backup.suggestions.map((suggestion, suggestionIndex) => (
                            <div key={`${suggestion.target}-${suggestionIndex}`} className="rounded-lg bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800 px-2 py-1.5">
                              <p className="text-[10px] font-bold text-amber-800 dark:text-amber-200">{suggestion.target}</p>
                              <p className="text-[9px] text-amber-700 dark:text-amber-300 line-clamp-2">{suggestion.detail || suggestion.reason}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {backup.fields.length === 0 && backup.changes.length === 0 && backup.suggestions.length === 0 && (
                        <p className="text-[10px] text-slate-400 italic">Backup saved; no table-ready extracted fields were found in this backup.</p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Section>

          <Section title="Patient Identifiers" icon={IdCard} sectionKey="patientIdentifiers" openSections={openSections} onToggle={toggleSection}>
            <DL label="Auto ID" value={p.auto_id} />
            <DL label="Title" value={p.title} />
            <DL label="Initials" value={p.initials} />
            <DL label="First Name" value={p.first_name} />
            <DL label="Last Name" value={p.last_name} />
            <DL label="NIC" value={p.nic} />
            <DL label="Phone" value={p.tp} />
            <DL label="Clinic" value={p.clinic} />
            <DL label="BHT" value={p.bht} />
          </Section>

          <Section title="Demographics" icon={Users} sectionKey="demographics" openSections={openSections} onToggle={toggleSection}>
            <DL label="Date of Birth" value={p.dob} />
            <DL label="Age" value={p.age} />
            <DL label="Gender" value={p.gender} />
            <DL label="Status" value={p.status} />
            <DL label="Marital Status" value={p.marital_status} />
            <DL label="Education" value={p.education_status} />
            <DL label="Ethnicity" value={p.ethnicity} />
            <DL label="Geographic Accessibility" value={p.geographic_accessibility} />
            <DL label="Living Area" value={p.living_area} />
            <DL label="Occupation" value={p.occupation} />
          </Section>

          <Section title="Oncology Types" icon={Dna} sectionKey="oncology" openSections={openSections} onToggle={toggleSection}>
            <DL label="Primary Oncology" value={p.oncology} fullWidth />
            <DL label="Oncology Types" value={p.oncology_types?.join(", ")} fullWidth />
            <DL label="Other" value={p.oncology_other} fullWidth />
          </Section>

          <Section title="Hospital Information" icon={Building2} sectionKey="hospital" openSections={openSections} onToggle={toggleSection}>
            <DL label="Hospital Name" value={p.hospital} />
            <DL label="Location" value={p.hospital_location} />
            <DL label="Type" value={p.hospital_type} />
          </Section>

          <Section title="Clinical History" icon={Stethoscope} sectionKey="history" openSections={openSections} onToggle={toggleSection}>
            {p.pastMedicalTable && p.pastMedicalTable.length > 0 && (
              <TableView headers={["Date", "Comorbidity", "Notes"]} rows={p.pastMedicalTable} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30"><TD v={r.date} /><TD v={r.comorbidity} /><TD v={r.notes} /></tr>
              )} />
            )}
            {p.pastSurgicalTable && p.pastSurgicalTable.length > 0 && (
              <TableView headers={["Date", "Surgery", "Complications", "Notes"]} rows={p.pastSurgicalTable} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30"><TD v={r.date} /><TD v={r.surgery} /><TD v={r.complication} /><TD v={r.notes} /></tr>
              )} />
            )}
            <DL label="Smoking" value={p.smoking} />
            <DL label="Smoking Amount" value={p.smoking_amount} />
            <DL label="Alcohol" value={p.alcohol} />
            <DL label="Alcohol Amount" value={p.alcohol_amount} />
            <DL label="Food Allergies" value={p.allergy_food} />
            <DL label="Drug Allergies" value={p.allergy_drugs} />
            <DL label="Plaster Allergies" value={p.allergy_plasters} />
            <DL label="Other Allergies" value={p.allergy_other} />
          </Section>

          <Section title="Clinical Assessment" icon={Activity} sectionKey="clinicalAssessment" openSections={openSections} onToggle={toggleSection}>
            <DL label="ECOG Status" value={p.ecog_status} />
            <DL label="Charlson Index" value={p.charlson_index} />
            <DL label="ADL Score" value={p.functional_adl_score} />
            <DL label="IADL Score" value={p.functional_iadl_score} />
            {p.presentingComplaintsTable && p.presentingComplaintsTable.length > 0 && (
              <TableView headers={["Date", "Complaint", "Notes"]} rows={p.presentingComplaintsTable} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30"><TD v={r.date} /><TD v={r.complaint} /><TD v={r.notes} /></tr>
              )} />
            )}
          </Section>

          <Section title="Anthropometric Measures" icon={Ruler} sectionKey="anthropometric" openSections={openSections} onToggle={toggleSection}>
            <DL label="Height" value={p.height} />
            <DL label="Weight" value={p.weight} />
            <DL label="BMI" value={p.bmi} />
            <DL label="BSA" value={p.bsa} />
            {p.anthropometricTable && p.anthropometricTable.length > 0 && (
              <TableView headers={["Date", "Height", "Weight", "BMI", "BSA"]} rows={p.anthropometricTable} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30"><TD v={r.date} /><TD v={r.height} /><TD v={r.weight} /><TD v={r.bmi} /><TD v={r.bsa} /></tr>
              )} />
            )}
          </Section>

          <Section title="Examination Findings" icon={Scan} sectionKey="examination" openSections={openSections} onToggle={toggleSection}>
            {p.examFindingsTable && p.examFindingsTable.length > 0 ? p.examFindingsTable.map((group, gi) => (
              <div key={gi} className="md:col-span-4 mb-2">
                <p className="text-xs font-semibold text-slate-500 mb-1">Date: <D v={group.date} /></p>
                <TableView headers={["System", "Findings", "Notes"]} rows={group.entries} renderRow={(r, i) => (
                  <tr key={i}><TD v={r.organ_system} /><TD v={r.findings} /><TD v={r.notes} /></tr>
                )} />
              </div>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No examination findings recorded.</div>}
          </Section>

          <Section title="Provisional Diagnosis" icon={ClipboardList} sectionKey="provisionalDiagnosis" openSections={openSections} onToggle={toggleSection}>
            <DL label="Provisional Diagnosis" value={p.provisional_diagnosis} fullWidth />
          </Section>

          <Section title="Definitive Diagnosis" icon={FileCheck2} sectionKey="definitiveDiagnosis" openSections={openSections} onToggle={toggleSection}>
            <DL label="Diagnosis Delay (days)" value={p.diagnosis_delay_days} />
            {p.definitiveDiagnosisTable && p.definitiveDiagnosisTable.length > 0 && (
              <TableView headers={["Date", "Diagnosis", "Notes"]} rows={p.definitiveDiagnosisTable} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30"><TD v={r.date} /><TD v={r.diagnosis} /><TD v={r.notes} /></tr>
              )} />
            )}
          </Section>

          <Section title="Medical Investigations" icon={FlaskConical} sectionKey="investigations" openSections={openSections} onToggle={toggleSection}>
            {p.bloodTable && p.bloodTable.length > 0 && (
              <TableView headers={["Type", "Purpose", "Date", "Findings", "Notes"]} rows={p.bloodTable} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30"><TD v={r.blood_type} /><TD v={r.blood_purpose} /><TD v={r.blood_date} /><TD v={r.blood_findings} /><TD v={r.blood_notes} /></tr>
              )} />
            )}
            {p.tumorMarkersTable && p.tumorMarkersTable.length > 0 && (
              <TableView headers={["Marker", "Value", "Unit", "Date", "Purpose", "Ref Range", "Notes"]} rows={p.tumorMarkersTable} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30"><TD v={r.marker_name} /><TD v={r.marker_value} /><TD v={r.marker_unit} /><TD v={r.marker_date} /><TD v={r.marker_purpose} /><TD v={r.marker_ref_range} /><TD v={r.marker_notes} /></tr>
              )} />
            )}
            {p.imagingTable && p.imagingTable.length > 0 && (
              <TableView headers={["Type", "Purpose", "Date", "Findings", "Mass", "Size", "Location"]} rows={p.imagingTable} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30"><TD v={r.imaging_type} /><TD v={r.imaging_purpose} /><TD v={r.imaging_date} /><TD v={r.imaging_findings} /><TD v={r.mass_present} /><TD v={r.mass_size} /><TD v={r.mass_location} /></tr>
              )} />
            )}
            {p.biopsyTable && p.biopsyTable.length > 0 && (
              <TableView headers={["Type", "Purpose", "Date", "Findings", "Stage", "Cell Type"]} rows={p.biopsyTable} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30"><TD v={r.biopsy_type} /><TD v={r.biopsy_purpose} /><TD v={r.biopsy_date} /><TD v={r.biopsy_findings} /><TD v={r.biopsy_stage} /><TD v={r.cell_type} /></tr>
              )} />
            )}
            <DL label="TNM Stage" value={p.tnm_stage} />
            <DL label="Overall Stage" value={p.overall_stage} />
            <DL label="Final Diagnosis" value={p.final_diagnosis} fullWidth />
          </Section>

          <Section title="Tumor Characteristics" icon={Crosshair} sectionKey="tumorCharacteristics" openSections={openSections} onToggle={toggleSection}>
            {p.tumorCharacteristicsTable && p.tumorCharacteristicsTable.length > 0 ? p.tumorCharacteristicsTable.map((t: TumorCharacteristicsEntry, i: number) => (
              <React.Fragment key={i}>
                <div className="md:col-span-4 text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">Tumour #{i + 1}</div>
                <DL label="Tumour Site(s)" value={t.tumour_sites} />
                <DL label="Laterality" value={t.laterality} />
                <DL label="Primary Count" value={t.primary_count} />
                <DL label="Tumor Size (LxWxD)" value={`${t.tumor_size_length || ""}${t.tumor_size_length && t.tumor_size_unit ? " " : ""}${t.tumor_size_unit || ""}`} />
                <DL label="Macroscopic Features" value={t.macroscopic_features} fullWidth />
                <DL label="Specimen Type" value={t.specimen_type} />
                <DL label="Diagnostic Modality" value={t.diagnostic_modality} />
                <DL label="Sampling Confirmation" value={t.sampling_confirmation} />
                <DL label="Histological Type" value={t.histological_type} />
                <DL label="Histological Grade" value={t.histological_grade} />
                <DL label="Histological Info" value={t.histological_info} fullWidth />
                <DL label="Cell Morphology" value={t.cell_morphology} />
                <DL label="Differentiation" value={t.tumor_differentiation_status} />
                <DL label="Microscopic Size" value={t.microscopic_size} />
                <DL label="Microscopic Features" value={t.microscopic_features} fullWidth />
                <DL label="LVI" value={t.lvi} />
                <DL label="Perineural Invasion" value={t.perineural_invasion} />
                <DL label="Margin Status" value={t.margin_status} />
                <DL label="Mitotic Rate" value={t.mitotic_rate} />
                <DL label="TILs" value={t.tumor_infiltrating_lymphocytes} />
                <DL label="Stroma %" value={t.stroma_percentage} />
                <DL label="Tumor-Assoc. Macrophages" value={t.tumor_associated_macrophages} />
                <DL label="Diagnosis Date" value={t.diagnosis_date} />
                <DL label="Nodal Mets" value={t.nodal_metastasis_details} />
                <DL label="Distant Mets" value={t.distant_metastasis_details} />
                <DL label="Synchronous Malignancy" value={t.synchronous_malignancy} />
                <DL label="Metachronous Malignancy" value={t.metachronous_malignancy} />
                <DL label="Pathological Interpretation" value={t.pathological_interpretation} fullWidth />
                <DL label="Pathology Report Status" value={t.pathology_reporting_status} />
                <DL label="Pathology Report Date" value={t.pathology_reporting_date} />
                <DL label="Risk Stratification" value={t.risk_stratification} />
                <DL label="Genomic Risk Score" value={t.genomic_risk_score} />
                <DL label="Molecular Markers" value={t.molecular_markers} />
                <DL label="IHC" value={t.immunohistochemistry} />
                <DL label="Genomic Testing" value={t.genomic_testing} />
                <DL label="Biology Summary" value={t.biology_summary} fullWidth />
              </React.Fragment>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No tumor characteristics recorded.</div>}
          </Section>

          <Section title="Clinical Staging" icon={BookOpen} sectionKey="clinicalStaging" openSections={openSections} onToggle={toggleSection}>
            {p.clinicalStagingTable && p.clinicalStagingTable.length > 0 ? p.clinicalStagingTable.map((s: ClinicalStagingEntry, i: number) => (
              <React.Fragment key={i}>
                <DL label="Staging System" value={s.staging_system} />
                <DL label="Type" value={s.staging_type} />
                <DL label="Date" value={s.staging_date} />
                <DL label="Clinical T" value={s.clinical_t} />
                <DL label="Clinical N" value={s.clinical_n} />
                <DL label="Clinical M" value={s.clinical_m} />
                <DL label="Pathological T" value={s.pathological_t} />
                <DL label="Pathological N" value={s.pathological_n} />
                <DL label="Pathological M" value={s.pathological_m} />
                <DL label="Clinical Stage Group" value={s.clinical_stage_group} />
                <DL label="Pathological Stage Group" value={s.pathological_stage_group} />
                <DL label="Notes" value={s.staging_notes} fullWidth />
              </React.Fragment>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No staging entries recorded.</div>}
          </Section>

          <Section title="Histology Grading" icon={ClipboardPlus} sectionKey="histologyGrading" openSections={openSections} onToggle={toggleSection}>
            {p.histologyGradingTable && p.histologyGradingTable.length > 0 ? p.histologyGradingTable.map((h: HistologyGradingEntry, i: number) => (
              <React.Fragment key={i}>
                <DL label="Grading System" value={h.grading_system} />
                <DL label="Date" value={h.grading_date} />
                <DL label="Grade" value={h.histological_grade} />
                <DL label="Differentiation" value={h.differentiation} />
                <DL label="Nuclear Grade" value={h.nuclear_grade} />
                <DL label="Mitotic Count" value={h.mitotic_count} />
                <DL label="Ki67 %" value={h.ki67_percentage} />
                <DL label="LVI" value={h.lymphovascular_invasion} />
                <DL label="PNI" value={h.perineural_invasion} />
                <DL label="Notes" value={h.grading_notes} fullWidth />
                {h.nottingham_score && <DL label="Nottingham Score" value={`${h.nottingham_score} (${h.nottingham_grade || ""})`} />}
                {h.gleason_score && <DL label="Gleason Score" value={`${h.gleason_score} (Grade Group ${h.gleason_grade_group || ""})`} />}
              </React.Fragment>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No histology grading recorded.</div>}
          </Section>

          <Section title="Adjuvant Therapy" icon={Syringe} sectionKey="adjuvantTherapy" openSections={openSections} onToggle={toggleSection}>
            {p.adjuvantTherapyTable && p.adjuvantTherapyTable.length > 0 ? p.adjuvantTherapyTable.map((a: AdjuvantTherapyEntry, i: number) => (
              <React.Fragment key={i}>
                <div className="md:col-span-4 text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">Therapy #{i + 1}</div>
                <DL label="Therapy Type" value={a.therapy_type} />
                <DL label="Date of Commencement" value={a.date_of_commencement} />
                <DL label="Regimen" value={a.regimen} />
                <DL label="Cycles / Dose" value={a.cycles_dose} />
                <DL label="Details" value={a.details} fullWidth />
                <DL label="Notes" value={a.notes} fullWidth />
              </React.Fragment>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No adjuvant therapy recorded.</div>}
          </Section>

          <Section title="Pre-Operative Assessment" icon={FileText} sectionKey="preOperativeAssessment" openSections={openSections} onToggle={toggleSection}>
            {p.preOperativeAssessmentTable && p.preOperativeAssessmentTable.length > 0 ? p.preOperativeAssessmentTable.map((pr: PreOperativeAssessmentEntry, i: number) => (
              <React.Fragment key={i}>
                <DL label="Surgery Name" value={pr.surgery_name} />
                <DL label="Assessment Date" value={pr.assessment_date} />
                <DL label="ASA Class" value={pr.asa_class} />
                <DL label="Surgical Candidacy" value={pr.surgical_candidacy} />
                <DL label="Hb" value={pr.lab_hb} /><DL label="WBC" value={pr.lab_wbc} /><DL label="Platelets" value={pr.lab_platelets} />
                <DL label="Creatinine" value={pr.lab_creatinine} /><DL label="eGFR" value={pr.lab_egfr} /><DL label="Albumin" value={pr.lab_albumin} />
                <DL label="INR" value={pr.lab_inr} /><DL label="ALT" value={pr.lab_alt} /><DL label="AST" value={pr.lab_ast} />
                <DL label="Bilirubin" value={pr.lab_bilirubin} /><DL label="CRP" value={pr.lab_crp} />
                <DL label="Notes" value={pr.surgical_candidacy_notes} fullWidth />
              </React.Fragment>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No pre-operative assessment recorded.</div>}
          </Section>

          <Section title="Surgery Details" icon={HeartPulse} sectionKey="definitiveSurgery" openSections={openSections} onToggle={toggleSection}>
            {p.definitiveSurgeryTable && p.definitiveSurgeryTable.length > 0 ? p.definitiveSurgeryTable.map((ds: DefinitiveSurgeryEntry, i: number) => (
              <React.Fragment key={i}>
                <div className="md:col-span-4 text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">Surgery #{i + 1}</div>
                <DL label="Surgery Name" value={ds.surgery_name} />
                <DL label="Date" value={ds.surgery_date} />
                <DL label="Surgeon" value={ds.surgeon_name} />
                <DL label="Specialty" value={ds.surgeon_specialty} />
                <DL label="Hospital" value={ds.hospital_name} />
                <DL label="Type" value={ds.surgery_type} />
                <DL label="Intent" value={ds.surgery_intent} />
                <DL label="Approach" value={ds.surgery_approach} />
                <DL label="Site" value={ds.surgery_site} />
                <DL label="Duration (min)" value={ds.operative_duration_min} />
                <DL label="Blood Loss (mL)" value={ds.estimated_blood_loss_ml} />
                <DL label="Resection Status" value={ds.resection_status} />
                <DL label="Margin Status" value={ds.margin_status} />
                <DL label="Closest Margin (mm)" value={ds.closest_margin_mm} />
                <DL label="LND" value={ds.lymph_node_dissection} />
                <DL label="Nodes Harvested" value={ds.lymph_node_harvested} />
                <DL label="Nodes Positive" value={ds.lymph_node_positive} />
                <DL label="Reconstruction" value={ds.reconstruction_type} />
                <DL label="Recovery Status" value={ds.recovery_status} />
                <DL label="Discharge Date" value={ds.discharge_date} />
                <DL label="Discharge Status" value={ds.discharge_status} />
                <DL label="Readmission (30d)" value={ds.readmission_30d} />
                <DL label="Notes" value={ds.surgery_notes} fullWidth />
                {ds.intraop_imaging_list && ds.intraop_imaging_list.length > 0 && (
                  <TableView headers={["Imaging Type", "Findings"]} rows={ds.intraop_imaging_list} renderRow={(r: IntraopImagingEntry, idx: number) => (
                    <tr key={idx}><TD v={r.imaging_type} /><TD v={r.imaging_findings} /></tr>
                  )} />
                )}
              </React.Fragment>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No surgery details recorded.</div>}
          </Section>

          <Section title="Surgical Outcome Assessment" icon={ClipboardPlus} sectionKey="treatmentOutcome" openSections={openSections} onToggle={toggleSection}>
            {p.treatmentOutcomeTable && p.treatmentOutcomeTable.length > 0 ? p.treatmentOutcomeTable.map((to: TreatmentOutcomeEntry, i: number) => (
              <React.Fragment key={i}>
                <div className="md:col-span-4 text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">Outcome #{i + 1}</div>
                <DL label="Assessment Date" value={to.assessment_date} />
                <DL label="Response Criteria" value={to.response_evaluation_criteria} />
                <DL label="Overall Response" value={to.overall_response} />
                <DL label="Target Lesion Response" value={to.target_lesion_response} />
                <DL label="Progression Date" value={to.progression_date} />
                <DL label="Recurrence" value={to.recurrence_status} />
                <DL label="Recurrence Date" value={to.recurrence_date} />
                <DL label="Survival Status" value={to.survival_status} />
                <DL label="Survival Date" value={to.survival_date} />
                <DL label="ECOG" value={to.ecog_status} />
                <DL label="Hospital Stay (days)" value={to.hospital_stay_days} />
                <DL label="ICU Stay (days)" value={to.icu_stay_days} />
                <DL label="Return to OR (30d)" value={to.return_to_or_30d} />
                <DL label="Wound Infection" value={to.wound_infection} />
                <DL label="Anastomotic Leak" value={to.anastomotic_leak} />
                <DL label="Thromboembolic" value={to.thromboembolic_events} />
                <DL label="Cardiac Complication" value={to.cardiac_complication} />
                <DL label="Pulmonary Complication" value={to.pulmonary_complication} />
                <DL label="AKI" value={to.acute_kidney_injury} />
                <DL label="Clavien-Dindo Grade" value={to.clavien_dindo_grade} />
                <DL label="Mortality (30d)" value={to.mortality_30d} />
                <DL label="Mortality (90d)" value={to.mortality_90d} />
                <DL label="Mortality (1y)" value={to.mortality_1y} />
                <DL label="Unplanned Readmission" value={to.unplanned_readmission} />
                <DL label="Discharge Destination" value={to.discharge_destination} />
                <DL label="Notes" value={to.outcome_notes} fullWidth />
                {to.postop_complications && to.postop_complications.length > 0 && (
                  <TableView headers={["Complication", "Occurrence Date", "Days Post-Op"]} rows={to.postop_complications} renderRow={(r: PostOpComplicationEntry, idx: number) => (
                    <tr key={idx}><TD v={r.complication_name} /><TD v={r.occurrence_date} /><TD v={r.days_postop} /></tr>
                  )} />
                )}
              </React.Fragment>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No surgical outcomes recorded.</div>}
          </Section>

          <Section title="After Surgical Therapies" icon={HeartPulse} sectionKey="afterSurgicalTherapies" openSections={openSections} onToggle={toggleSection}>
            {p.afterSurgicalTherapiesTable && p.afterSurgicalTherapiesTable.length > 0 ? p.afterSurgicalTherapiesTable.map((ast: AfterSurgicalTherapyEntry, i: number) => (
              <React.Fragment key={i}>
                <div className="md:col-span-4 text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1 mb-1">Therapy #{i + 1}</div>
                <DL label="Therapy Type" value={ast.therapy_type} />
                <DL label="Start Date" value={ast.start_date} />
                <DL label="End Date" value={ast.end_date} />
                <DL label="Regimen" value={ast.regimen} />
                <DL label="Cycles / Dose" value={ast.cycles_dose} />
                <DL label="Days Diagnosis to Therapy" value={ast.days_diag_to_therapy} />
                <DL label="Chemo Dose Intensity" value={ast.chemo_dose_intensity} />
                <DL label="Toxicity Grade" value={ast.chemo_toxicity_grade} />
                <DL label="Radiation Dose Modifications" value={ast.radiation_dose_modifications} />
                <DL label="Treatment Adherence" value={ast.treatment_adherence} />
                <DL label="Treatment-Related Mortality" value={ast.treatment_related_mortality} />
                <DL label="Late Toxicity (>90d)" value={ast.late_toxicity} />
                <DL label="Details" value={ast.details} fullWidth />
                <DL label="Notes" value={ast.notes} fullWidth />
              </React.Fragment>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No after surgical therapies recorded.</div>}
          </Section>

          <Section title="Follow-up & Prognosis" icon={Heart} sectionKey="followUpPrognosis" openSections={openSections} onToggle={toggleSection}>
            {p.followUpPrognosisTable && p.followUpPrognosisTable.length > 0 ? p.followUpPrognosisTable.map((fup: FollowUpPrognosisEntry, i: number) => (
              <React.Fragment key={i}>
                <DL label="Second Cancer" value={fup.second_cancer_development} />
                <DL label="Second Cancer Details" value={fup.second_cancer_details} fullWidth />
                <DL label="Cancer-Specific Survival" value={fup.cancer_specific_survival} />
                <DL label="Conditional Survival" value={fup.conditional_survival_details} />
                <DL label="QoL Assessment Done" value={fup.qol_assessment_done} />
                <DL label="QoL Score System" value={fup.qol_score_system} />
                <DL label="QoL Score" value={fup.qol_score} />
                <DL label="Functional Recovery" value={fup.functional_recovery} />
                <DL label="Genetic Review" value={fup.genetic_review_done} />
                <DL label="Genetic Review Details" value={fup.genetic_review_details} fullWidth />
                <DL label="Clinical Trial Enrollment" value={fup.clinical_trial_enrollment} />
                <DL label="Trial Details" value={fup.clinical_trial_details} fullWidth />
                <DL label="Readmission (30d)" value={fup.readmission_30d} />
                <DL label="Readmission (90d)" value={fup.readmission_90d} />
                <DL label="Notes" value={fup.follow_up_notes} fullWidth />
              </React.Fragment>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No follow-up / prognosis recorded.</div>}
          </Section>

          <Section title="Oncological Outcome Assessment" icon={ActivitySquare} sectionKey="oncologicalOutcome" openSections={openSections} onToggle={toggleSection}>
            {p.oncologicalOutcomeTable && p.oncologicalOutcomeTable.length > 0 ? p.oncologicalOutcomeTable.map((oo: OncologicalOutcomeEntry, i: number) => (
              <React.Fragment key={i}>
                <DL label="Assessment Date" value={oo.assessment_date} />
                <DL label="Response Criteria" value={oo.response_evaluation_criteria} />
                <DL label="Overall Response" value={oo.overall_response} />
                <DL label="Target Lesion Response" value={oo.target_lesion_response} />
                <DL label="Non-Target Lesion Response" value={oo.non_target_lesion_response} />
                <DL label="New Lesions" value={oo.new_lesions} />
                <DL label="Progression Date" value={oo.progression_date} />
                <DL label="Recurrence Status" value={oo.recurrence_status} />
                <DL label="Recurrence Date" value={oo.recurrence_date} />
                <DL label="Survival Status" value={oo.survival_status} />
                <DL label="Survival Date" value={oo.survival_date} />
                <DL label="Cause of Death" value={oo.cause_of_death} />
                <DL label="ECOG Status" value={oo.ecog_status} />
                <DL label="Tumor Markers Follow-up" value={oo.tumor_markers_followup} fullWidth />
                <DL label="Notes" value={oo.outcome_notes} fullWidth />
              </React.Fragment>
            )) : <div className="md:col-span-4 text-center py-2 text-slate-400 italic">No oncological outcomes recorded.</div>}
          </Section>

          <Section title="Supplementary Details" icon={ScrollText} sectionKey="supplementary" openSections={openSections} onToggle={toggleSection}>
            <DL label="General Notes" value={p.general_notes} fullWidth />
            <div className="md:col-span-4">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold ${p.consent_ai_processing ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                <span className={`h-2 w-2 rounded-full ${p.consent_ai_processing ? "bg-emerald-500" : "bg-slate-400"}`} />
                {p.consent_ai_processing ? "AI Processing Consent Granted" : "AI Processing Consent Not Given"}
              </div>
            </div>
            {p.supplementaryDetailsTable && p.supplementaryDetailsTable.length > 0 && (
              <TableView headers={["Heading", "Label", "Value", "Date", "Category", "Notes"]} rows={p.supplementaryDetailsTable} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <TD v={r.detail_heading} /><TD v={r.detail_label} /><TD v={r.detail_value} /><TD v={r.detail_date} /><TD v={r.detail_category} /><TD v={r.detail_notes} />
                </tr>
              )} />
            )}
            {p.unmapped_medical_information && p.unmapped_medical_information.length > 0 && (
              <TableView headers={["Source Section", "Detail", "Importance"]} rows={p.unmapped_medical_information} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <TD v={r.source_section} /><TD v={r.detail} /><TD v={r.medical_importance} />
                </tr>
              )} />
            )}
            {p.source_file_summaries && p.source_file_summaries.length > 0 && (
              <TableView headers={["File Name", "Document Type", "Summary"]} rows={p.source_file_summaries} renderRow={(r, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <TD v={r.file_name} /><TD v={r.document_type} /><TD v={r.clinically_relevant_summary} />
                </tr>
              )} />
            )}
          </Section>

          <Section title="Registry Metadata" icon={Calendar} sectionKey="patientIdentifiers" openSections={openSections} onToggle={() => {}}>
            <DL label="Created" value={p.createdAt} />
            <DL label="Updated" value={p.updatedAt} />
            <DL label="Record ID" value={p.id} fullWidth />
          </Section>
        </div>
      ) : (
        <div className="h-[60vh] flex flex-col justify-between border border-natural-border dark:border-natural-border rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900/10">

          <div className="px-4 py-2.5 bg-natural-accent/10 border-b border-natural-border dark:border-natural-border flex items-center gap-2 text-[11.5px] text-slate-750 dark:text-slate-300">
            <ShieldCheck className="h-4 w-4 text-natural-accent animate-bounce flex-shrink-0" />
            <span>
              <strong>Clinical Decision Support Indicator:</strong> Generated responses reference ASCO / NCCN oncology criteria and tailormade patient history. Verify therapeutic decisions clinically.
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatThread.map((msg, i) => {
              const isAI = msg.sender === "ai";
              const isLast = i === chatThread.length - 1;
              return (
                <div
                  key={i}
                  className={`flex gap-3 max-w-4xl chat-message-in ${isAI ? "" : "ml-auto flex-row-reverse"}`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-theme-on-accent flex-shrink-0 shadow-sm ${
                    isAI
                      ? "bg-natural-accent"
                      : "bg-natural-brown"
                  }`}>
                    {isAI ? <Bot className="h-4 w-4" /> : "MD"}
                  </div>

                  <div className={`p-3.5 rounded-2xl tracking-normal leading-relaxed select-text chat-prose ${
                    isAI
                      ? "chat-ai-bubble border border-natural-border dark:border-slate-700 text-xs shadow-sm"
                      : "bg-natural-accent text-theme-on-accent dark:bg-natural-accent/90 text-xs shadow-sm"
                  }`}>
                    {isAI ? (
                      <ChatMarkdown text={msg.text} />
                    ) : (
                      <div className="whitespace-pre-wrap text-xs">{msg.text}</div>
                    )}
                    <span className={`text-[9px] flex items-center gap-1 justify-end mt-2.5 pt-1.5 border-t ${
                      isAI
                        ? "text-slate-500 dark:text-slate-400 border-slate-200/70 dark:border-slate-700/60"
                        : "text-theme-on-accent/70 border-theme-highlight/20"
                    }`}>
                      <Clock className="h-2.5 w-2.5" />
                      {msg.timestamp}
                      {isLast && isAI && (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 ml-1">
                          <CheckCheck className="h-3 w-3" />
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}

            {chatLoading && (
              <div className="flex gap-3 chat-message-in">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-natural-accent text-theme-on-accent">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="chat-ai-bubble border border-natural-border dark:border-slate-700 p-3.5 rounded-2xl shadow-sm">
                  <ThinkingDots label="Compiling oncology guidelines" />
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3.5 border-t border-natural-border bg-theme-surface/20 dark:bg-slate-850/30 flex items-center gap-3">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder={`Ask oncology advisor guidelines concerning ${patient.first_name}'s reports...`}
              className="flex-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-natural-border dark:border-natural-border placeholder-slate-400 dark:placeholder-slate-500 rounded-xl text-xs focus:ring-1 focus:ring-natural-accent focus:border-natural-accent"
            />
            <button
              type="submit"
              disabled={chatLoading}
              className="btn-clr-chat font-bold p-2.5 rounded-xl flex items-center justify-center transition disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </form>

        </div>
      )}

      {/* Floating delete progress indicator */}
      {isDeleting && createPortal(
        <div className="fixed bottom-20 right-8 z-[9999] flex flex-col items-center gap-1 pointer-events-none">
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="15" stroke="rgba(239,68,68,0.25)" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15" stroke="#EF4444" strokeWidth="3.5"
              strokeLinecap="round" strokeDasharray="94.2"
              strokeDashoffset={94.2 - (deleteProgress / 100) * 94.2}
              className="transition-all duration-500 ease-out" />
          </svg>
          <span className="text-[11.5px] font-bold text-red-500 bg-white/90 dark:bg-slate-800/90 px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
            {deleteStage} ({deleteProgress}%)
          </span>
        </div>,
        document.body
      )}
    </div>
  );
}
