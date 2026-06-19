/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { 
  Settings, 
  Moon, 
  Sun, 
  Download, 
  Trash2, 
  Calendar,
  Eye,
  ShieldAlert,
  Database,
  RefreshCw,
  Monitor,
  X,
  User,
  Save,
  Search,
  ChevronDown,
  ChevronRight,
  Columns3,
  FileSpreadsheet,
  ListChecks,
  Table2
} from "lucide-react";
import { apiFetch, apiFetchJson } from "../lib/api-client";
import { confirmDialog, notify } from "./AppDialog";
import { useTheme } from "./ThemeProvider";

interface SettingsViewProps {
  currentUser: { uid?: string; name: string; role: string; email?: string };
  onWipeDatabase: () => Promise<void>;
  onUpdateUser?: (updates: Partial<{ name: string }>) => void;
}

type CsvExportMode = "patient-wide" | "table-row";

interface ExportColumnNode {
  key: string;
  path: string;
  label: string;
  kind: "group" | "field" | "table";
  selectable: boolean;
  repeated?: boolean;
  repeatRoot?: string;
  children?: ExportColumnNode[];
}

interface ExportTableSource {
  path: string;
  label: string;
  repeatRoot: string;
}

interface ExportColumnsResponse {
  tree: ExportColumnNode[];
  requiredColumns: string[];
  defaultColumns: string[];
  tableSources: ExportTableSource[];
}

const CSV_PRESETS = [
  { id: "all", label: "All fields", sectionKeys: [] },
  { id: "identity", label: "Identity/Demographics", sectionKeys: ["patientIdentifiers", "demographics", "oncology", "hospital"] },
  { id: "investigations", label: "Investigations", sectionKeys: ["investigations", "histologyGrading"] },
  { id: "tumor", label: "Tumor characteristics", sectionKeys: ["tumorCharacteristics", "clinicalStaging"] },
  { id: "treatment", label: "Treatment", sectionKeys: ["adjuvantTherapy", "preOperativeAssessment", "definitiveSurgery", "treatments", "surgicalProcedures", "care"] },
  { id: "outcomes", label: "Outcomes", sectionKeys: ["treatmentOutcome", "afterSurgicalTherapies", "followUpPrognosis", "oncologicalOutcome"] },
  { id: "ai", label: "AI backups", sectionKeys: ["extraParams", "supplementary", "documentExtractions"] },
  { id: "system", label: "System metadata", sectionKeys: ["system"] },
];

function collectSelectablePaths(nodes: ExportColumnNode[]): string[] {
  return nodes.flatMap((node) => {
    const own = node.selectable ? [node.path] : [];
    return [...own, ...collectSelectablePaths(node.children || [])];
  });
}

function collectPathsForRoots(nodes: ExportColumnNode[], rootKeys: string[]): string[] {
  const selected = new Set(rootKeys);
  return nodes.flatMap((node) => selected.has(node.key) ? collectSelectablePaths([node]) : []);
}

function filterColumnTree(nodes: ExportColumnNode[], query: string): ExportColumnNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;
  return nodes.flatMap((node) => {
    const children = filterColumnTree(node.children || [], needle);
    const match = node.label.toLowerCase().includes(needle) || node.path.toLowerCase().includes(needle);
    if (!match && !children.length) return [];
    return [{ ...node, children }];
  });
}

function downloadBlobResponse(response: Response, fallbackExtension: "csv" | "json") {
  return response.blob().then((blob) => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const disposition = response.headers.get("content-disposition") || "";
    const fileName = disposition.match(/filename="([^"]+)"/)?.[1]
      || `FullBackups_OncoRegistry_${new Date().toISOString().split("T")[0]}.${fallbackExtension}`;
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function ColumnTreeRow({
  node,
  selected,
  expanded,
  onToggleExpanded,
  onTogglePaths,
  depth = 0,
}: {
  node: ExportColumnNode;
  selected: Set<string>;
  expanded: Set<string>;
  onToggleExpanded: (path: string) => void;
  onTogglePaths: (paths: string[], checked: boolean) => void;
  depth?: number;
}) {
  const children = node.children || [];
  const hasChildren = children.length > 0;
  const descendantPaths = collectSelectablePaths([node]);
  const checkedCount = descendantPaths.filter((path) => selected.has(path)).length;
  const checked = descendantPaths.length > 0 && checkedCount === descendantPaths.length;
  const partial = checkedCount > 0 && !checked;
  const isExpanded = expanded.has(node.path);
  const label = partial ? `${node.label} (${checkedCount}/${descendantPaths.length})` : node.label;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 pr-2 text-[11.5px] text-slate-700 dark:text-slate-250 hover:bg-slate-50 dark:hover:bg-slate-900/60 rounded-lg overflow-hidden"
        style={{ paddingLeft: `${depth * 10 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggleExpanded(node.path)}
          className="h-5 w-5 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-20"
          disabled={!hasChildren}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {hasChildren ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : null}
        </button>
        <input
          type="checkbox"
          checked={checked}
          disabled={!descendantPaths.length}
          onChange={(event) => onTogglePaths(descendantPaths, event.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 text-natural-accent focus:ring-natural-accent"
        />
        <button
          type="button"
          onClick={() => hasChildren ? onToggleExpanded(node.path) : onTogglePaths(descendantPaths, !checked)}
          className="min-w-0 flex-1 text-left truncate"
        >
          <span className={`font-semibold ${partial ? "text-natural-accent dark:text-natural-gold" : ""}`}>{label}</span>
          {node.selectable && node.path !== node.label && (
            <span className="ml-2 text-[10.5px] text-slate-400 hidden sm:inline">{node.path}</span>
          )}
        </button>
        {node.repeated && (
          <span className="rounded-full border border-natural-border px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">table</span>
        )}
      </div>
      {hasChildren && isExpanded && children.map((child) => (
        <ColumnTreeRow
          key={child.path}
          node={child}
          selected={selected}
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
          onTogglePaths={onTogglePaths}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function SettingsView({ currentUser, onWipeDatabase, onUpdateUser }: SettingsViewProps) {
  const { themeMode, setThemeMode } = useTheme();
  
  // Profile editing state
  const [displayName, setDisplayName] = useState(currentUser.name);
  const [savingName, setSavingName] = useState(false);

  const handleSaveName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed || trimmed === currentUser.name) return;
    if (!currentUser.uid) return;
    setSavingName(true);
    try {
      await apiFetchJson("/api/users", { method: "PATCH", body: JSON.stringify({ name: trimmed }), headers: { "Content-Type": "application/json" } });
      onUpdateUser?.({ name: trimmed });
      await notify("Display name updated.", "Profile Saved", "success");
    } catch (e) {
      await notify("Failed to save name.", "Error", "danger");
    } finally {
      setSavingName(false);
    }
  };

  const [quotaRemaining, setQuotaRemaining] = useState(0);
  const [totalQuota, setTotalQuota] = useState(1500);
  const [resetDate, setResetDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toLocaleString();
  });
  const [isRefreshingQuota, setIsRefreshingQuota] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [showCsvColumnModal, setShowCsvColumnModal] = useState(false);
  const [csvColumns, setCsvColumns] = useState<ExportColumnsResponse | null>(null);
  const [loadingCsvColumns, setLoadingCsvColumns] = useState(false);
  const [exportingSelectedCsv, setExportingSelectedCsv] = useState(false);
  const [selectedCsvColumns, setSelectedCsvColumns] = useState<string[]>([]);
  const [expandedCsvNodes, setExpandedCsvNodes] = useState<string[]>([]);
  const [csvSearch, setCsvSearch] = useState("");
  const [csvExportMode, setCsvExportMode] = useState<CsvExportMode>("patient-wide");
  const [csvTableRowSource, setCsvTableRowSource] = useState("");

  const selectedCsvSet = useMemo(() => new Set(selectedCsvColumns), [selectedCsvColumns]);
  const expandedCsvSet = useMemo(() => new Set(expandedCsvNodes), [expandedCsvNodes]);
  const filteredCsvTree = useMemo(() => filterColumnTree(csvColumns?.tree || [], csvSearch), [csvColumns, csvSearch]);
  const allSelectableCsvPaths = useMemo(() => collectSelectablePaths(csvColumns?.tree || []), [csvColumns]);
  const selectedCsvCount = selectedCsvColumns.length;

  const downloadPatientExport = async (format: "csv" | "json") => {
    const response = await apiFetch(`/api/patients/export?format=${format}`);
    if (!response.ok) {
      await notify("Could not export the patient registry.", "Export Failed", "danger");
      return;
    }
    await downloadBlobResponse(response, format);
  };

  // CSV/JSON overall database backups
  const handleBackupAllJSON = async () => {
    await downloadPatientExport("json");
  };

  const handleBackupAllCSV = async () => {
    await downloadPatientExport("csv");
  };

  const loadCsvColumns = async () => {
    setLoadingCsvColumns(true);
    try {
      const data = await apiFetchJson<ExportColumnsResponse>("/api/patients/export/columns");
      const allPaths = collectSelectablePaths(data.tree);
      const defaultSelection = collectPathsForRoots(data.tree, ["patientIdentifiers", "demographics"]);
      setCsvColumns(data);
      setSelectedCsvColumns(defaultSelection.length ? defaultSelection : data.requiredColumns);
      setExpandedCsvNodes(data.tree.map((node) => node.path));
      setCsvTableRowSource(data.tableSources[0]?.path || "");
      if (!allPaths.length) {
        await notify("No exportable columns were found.", "CSV Columns", "danger");
      }
    } catch (error) {
      await notify("Could not load export columns.", "Export Failed", "danger");
    } finally {
      setLoadingCsvColumns(false);
    }
  };

  const handleOpenCsvColumnModal = async () => {
    setShowCsvColumnModal(true);
    if (!csvColumns) await loadCsvColumns();
  };

  const handleToggleCsvExpanded = (path: string) => {
    setExpandedCsvNodes((current) => current.includes(path)
      ? current.filter((item) => item !== path)
      : [...current, path]);
  };

  const handleToggleCsvPaths = (paths: string[], checked: boolean) => {
    setSelectedCsvColumns((current) => {
      const next = new Set(current);
      for (const path of paths) {
        if (checked) next.add(path);
        else next.delete(path);
      }
      return Array.from(next);
    });
  };

  const handleApplyCsvPreset = (presetId: string) => {
    if (!csvColumns) return;
    const preset = CSV_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const paths = preset.id === "all"
      ? allSelectableCsvPaths
      : collectPathsForRoots(csvColumns.tree, preset.sectionKeys);
    setSelectedCsvColumns(paths);
    const roots = preset.id === "all" ? csvColumns.tree.map((node) => node.path) : preset.sectionKeys;
    setExpandedCsvNodes(Array.from(new Set([...expandedCsvNodes, ...roots])));
  };

  const handleDownloadSelectedCsv = async () => {
    if (!selectedCsvColumns.length) {
      await notify("Select at least one export column.", "Export Columns Required", "danger");
      return;
    }
    if (csvExportMode === "table-row" && !csvTableRowSource) {
      await notify("Select one repeatable table source for table-row CSV export.", "Table Source Required", "danger");
      return;
    }
    setExportingSelectedCsv(true);
    try {
      const response = await apiFetch("/api/patients/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "csv",
          mode: csvExportMode,
          columns: selectedCsvColumns,
          rowSource: csvExportMode === "table-row" ? csvTableRowSource : undefined,
        }),
        timeout: 0,
      });
      await downloadBlobResponse(response, "csv");
      await notify("Selected CSV export downloaded.", "Export Complete", "success");
    } catch (error) {
      await notify("Could not export the selected CSV columns.", "Export Failed", "danger");
    } finally {
      setExportingSelectedCsv(false);
    }
  };

  // Deep Wipe database
  const handleTriggerDeepWipe = async () => {
    if (currentUser.role !== "admin") {
      await notify("Only authorized administrators can wipe the clinical records database.", "Security Alert", "danger");
      return;
    }

    const firstPrompt = await confirmDialog(
      "You are about to execute a full database wipe. This removes all oncology patients, their respective files, and Google Drive subfolders. This is irreversible.\n\nDo you want to proceed?",
      "Critical Danger Zone",
      "danger",
      "Continue"
    );

    if (firstPrompt) {
      const secondPrompt = await confirmDialog(
        "Do you authorize the system to clear 100% of diagnostic timelines and files forever?",
        "Final Verification",
        "danger",
        "Wipe Everything"
      );
      if (secondPrompt) {
        setIsRefreshingQuota(true);
        try {
          await onWipeDatabase();
          await notify("All patient profiles, biopsy logs, blood tables, and drive directories have been wiped successfully.", "Database Wiped", "success");
        } catch (e) {
          await notify("Error executing wipe command.", "Wipe Failed", "danger");
        } finally {
          setIsRefreshingQuota(false);
        }
      }
    }
  };

  // Sync API metrics
  const triggerRefreshQuota = async () => {
    setIsRefreshingQuota(true);
    try {
      const response = await apiFetch("/api/quota");
      if (response.ok) {
        const quota = await response.json();
        setTotalQuota(Number(quota.quotaLimit || 1500));
        setQuotaRemaining(Number(quota.quotaRemainingEstimate || 0));
        setResetDate(quota.resetDate || resetDate);
      }
    } finally {
      setIsRefreshingQuota(false);
    }
  };

  const percentageRemaining = Math.round((quotaRemaining / totalQuota) * 100);

  const handleShowAgreement = () => setShowAgreementModal(true);
  const handleCloseAgreement = () => setShowAgreementModal(false);

  return (
    <div className="space-y-6 premium-page-enter">
      {showAgreementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-theme-surface dark:bg-slate-900 shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-natural-accent" />
                <h3 className="text-base font-bold text-slate-900 dark:text-theme-on-accent">User Agreement</h3>
              </div>
              <button
                type="button"
                onClick={handleCloseAgreement}
                className="rounded-full p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 space-y-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <p>
                I confirm I am the Data Controller under PDPA No. 9 of 2022 (Sri Lanka). I am solely responsible for patient consent and compliance. The developer bears no responsibility for data use.
              </p>
              <p className="font-bold text-amber-900 dark:text-amber-400">
                This web application has been developed for educational purposes only. Not for sale.
              </p>
              <p>
                The institution must maintain secure access credentials and ensure patient privacy is preserved at every stage of dossier creation, review, and archival.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6 pt-2">
              <button
                type="button"
                onClick={handleCloseAgreement}
                className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {showCsvColumnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3">
          <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-xl bg-theme-surface dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
              <div className="min-w-0 flex items-center gap-3">
                <Columns3 className="h-5 w-5 text-natural-accent flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-theme-on-accent">Customize CSV Columns</h3>
                  <p className="text-[11.5px] text-slate-500 dark:text-slate-400 truncate">
                    {selectedCsvCount} selected columns. Patient identity columns are always included by the server.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvColumnModal(false)}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-0 overflow-hidden">
              <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 p-3 lg:p-4 space-y-3 lg:space-y-4 overflow-y-auto bg-slate-50/70 dark:bg-slate-950/40">
                <div className="space-y-2">
                  <h4 className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Export Mode</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCsvExportMode("patient-wide")}
                      className={`p-2.5 rounded-lg border text-[11.5px] font-bold flex items-center justify-center gap-1.5 ${
                        csvExportMode === "patient-wide"
                          ? "bg-natural-accent text-theme-on-accent border-natural-accent"
                          : "bg-theme-surface dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-250"
                      }`}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Patient
                    </button>
                    <button
                      type="button"
                      onClick={() => setCsvExportMode("table-row")}
                      className={`p-2.5 rounded-lg border text-[11.5px] font-bold flex items-center justify-center gap-1.5 ${
                        csvExportMode === "table-row"
                          ? "bg-natural-accent text-theme-on-accent border-natural-accent"
                          : "bg-theme-surface dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-250"
                      }`}
                    >
                      <Table2 className="h-3.5 w-3.5" />
                      Table
                    </button>
                  </div>
                </div>

                {csvExportMode === "table-row" && (
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wide font-bold text-slate-500" htmlFor="csv-row-source">Table Row Source</label>
                    <select
                      id="csv-row-source"
                      value={csvTableRowSource}
                      onChange={(event) => setCsvTableRowSource(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-theme-surface dark:bg-slate-900 px-3 py-2 text-[11.5px] font-semibold text-slate-700 dark:text-slate-200"
                    >
                      {(csvColumns?.tableSources || []).map((source) => (
                        <option key={source.path} value={source.path}>{source.label} ({source.path})</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Built-in Presets</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {CSV_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyCsvPreset(preset.id)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-theme-surface dark:bg-slate-900 px-3 py-2 text-left text-[11.5px] font-bold text-slate-700 dark:text-slate-250 hover:border-natural-accent hover:text-natural-accent transition"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCsvColumns(allSelectableCsvPaths)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11.5px] font-bold text-slate-700 dark:text-slate-250 hover:border-natural-accent transition"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCsvColumns([])}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11.5px] font-bold text-slate-700 dark:text-slate-250 hover:border-rose-500 transition"
                  >
                    Clear
                  </button>
                </div>
              </aside>

              <main className="min-h-0 flex flex-col p-4 gap-3">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="search"
                      value={csvSearch}
                      onChange={(event) => setCsvSearch(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-theme-surface dark:bg-slate-950 pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-theme-on-accent outline-none focus:ring-1 focus:ring-natural-accent"
                      placeholder="Search headers, subheaders, nested fields, and paths"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={loadCsvColumns}
                    disabled={loadingCsvColumns}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-250 hover:border-natural-accent disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingCsvColumns ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>

                <div className="min-h-[360px] max-h-[56vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-theme-surface dark:bg-slate-950 p-2">
                  {loadingCsvColumns ? (
                    <div className="flex h-52 items-center justify-center text-xs font-bold text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Loading export columns...
                    </div>
                  ) : filteredCsvTree.length ? (
                    filteredCsvTree.map((node) => (
                      <ColumnTreeRow
                        key={node.path}
                        node={node}
                        selected={selectedCsvSet}
                        expanded={expandedCsvSet}
                        onToggleExpanded={handleToggleCsvExpanded}
                        onTogglePaths={handleToggleCsvPaths}
                      />
                    ))
                  ) : (
                    <div className="flex h-52 items-center justify-center text-xs font-bold text-slate-500">No columns match this search.</div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-natural-accent" />
                    <span>{selectedCsvCount} selected; identity columns are added automatically.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadSelectedCsv}
                    disabled={exportingSelectedCsv || loadingCsvColumns || !selectedCsvColumns.length}
                    className="rounded-lg bg-natural-accent hover:bg-natural-accent-dark disabled:opacity-50 text-theme-on-accent px-4 py-2.5 text-xs font-bold transition flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {exportingSelectedCsv ? "Exporting..." : "Download Selected CSV"}
                  </button>
                </div>
              </main>
            </div>
          </div>
        </div>
      )}
      
      {/* Title Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl border border-natural-accent/25 bg-natural-accent/10 text-natural-accent dark:text-natural-gold dark:bg-natural-accent/15 flex items-center justify-center flex-shrink-0">
          <Settings className="h-5.5 w-5.5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-theme-on-accent ">Settings & System Configurations</h2>
        </div>
      </div>

      {/* Main Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Thematic & Backups Panel */}
        <div className="space-y-6">
          
          {/* Theme Option */}
          <div className="minimal-card p-5 rounded-2xl text-xs text-slate-700 dark:text-slate-350">
            <h3 className="font-bold text-slate-800 dark:text-theme-on-accent text-sm mb-1">Color Palette Tones</h3>
            
            {/* Theme mode options wrapper */}
            <div className="space-y-4">
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    aria-pressed={themeMode === "system"}
                    onClick={() => setThemeMode("system")}
                    className={`p-3.5 flex flex-col items-center gap-2 rounded-xl border transition cursor-pointer select-none text-center ${
                      themeMode === "system"
                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-300 font-bold"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 hover:border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold"
                    }`}
                  >
                    <Monitor className="h-4.5 w-4.5 text-natural-accent font-bold" />
                    <span className="text-[11.5px]">System Default</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={themeMode === "light"}
                    onClick={() => setThemeMode("light")}
                    className={`p-3.5 flex flex-col items-center gap-2 rounded-xl border transition cursor-pointer select-none text-center ${
                      themeMode === "light"
                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-300 font-bold"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 hover:border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold"
                    }`}
                  >
                    <Sun className="h-4.5 w-4.5 text-natural-gold font-bold" />
                    <span className="text-[11.5px]">Matte Light</span>
                  </button>
 
                  <button
                    type="button"
                    aria-pressed={themeMode === "dark"}
                    onClick={() => setThemeMode("dark")}
                    className={`p-3.5 flex flex-col items-center gap-2 rounded-xl border transition cursor-pointer select-none text-center ${
                      themeMode === "dark"
                        ? "bg-blue-50 dark:bg-blue-950/30 border-blue-600 dark:border-blue-400 text-blue-700 dark:text-blue-300 font-bold"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 hover:border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold"
                    }`}
                  >
                    <Moon className="h-4.5 w-4.5 text-natural-accent font-bold" />
                    <span className="text-[11.5px]">Matte Dark</span>
                  </button>
                </div>
              </div>
 

            </div>
          </div>
 
          {/* Profile / Display Name */}
          <div className="minimal-card p-5 rounded-2xl text-xs text-slate-700 dark:text-slate-350">
            <h3 className="font-bold text-slate-800 dark:text-theme-on-accent text-sm mb-1 flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-500" />
              Profile Display Name
            </h3>
            <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              Change the name shown in the sidebar and throughout the app.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 p-2.5 bg-theme-surface dark:bg-slate-900 border border-slate-400 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-natural-accent focus:border-natural-accent outline-none text-slate-800 dark:text-theme-on-accent"
                placeholder="Enter your name"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || !displayName.trim() || displayName.trim() === currentUser.name}
                className="px-4 py-2.5 bg-natural-accent hover:bg-natural-accent-dark disabled:opacity-40 text-theme-on-accent rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                {savingName ? "Saving..." : "Save"}
              </button>
            </div>
            {currentUser.email && (
              <p className="text-[11.5px] text-slate-400 mt-2">Email: {currentUser.email}</p>
            )}
          </div>

          {/* Backup Database Dumps */}
          <div className="minimal-card p-5 rounded-2xl text-xs text-slate-700 dark:text-slate-350">
            <h3 className="font-bold text-slate-800 dark:text-theme-on-accent text-sm mb-1">User Agreement & Policy Review</h3>
            <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Review the same institutional user agreement that appears during login anytime from settings.
            </p>
            <button
              type="button"
              onClick={handleShowAgreement}
              className="w-full p-3.5 inline-flex items-center justify-center gap-2 bg-natural-accent hover:bg-natural-accent-dark text-theme-on-accent rounded-xl font-bold text-xs transition"
            >
              <Eye className="h-4 w-4" />
              View User Agreement
            </button>
          </div>

          <div className="minimal-card p-5 rounded-2xl text-xs text-slate-700 dark:text-slate-350">
            <h3 className="font-bold text-slate-800 dark:text-theme-on-accent text-sm mb-1">Patient Dossier Registry Backups</h3>
            
            <div className="space-y-3">
              <button
                onClick={handleBackupAllCSV}
                className="btn-clr-csv w-full p-3.5 flex items-center justify-between rounded-xl font-bold cursor-pointer select-none text-left transition text-xs"
              >
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span>Download Full CSV Registries</span>
                </span>
                <Download className="h-4 w-4 font-bold" />
              </button>

              <button
                onClick={handleOpenCsvColumnModal}
                className="w-full p-3.5 flex items-center justify-between rounded-xl font-bold cursor-pointer select-none text-left transition text-xs border border-natural-border bg-theme-surface dark:bg-slate-900 text-slate-700 dark:text-slate-250 hover:border-natural-accent hover:text-natural-accent"
              >
                <span className="flex items-center gap-2">
                  <Columns3 className="h-4 w-4" />
                  <span>Customize CSV Columns</span>
                </span>
                <ListChecks className="h-4 w-4 font-bold" />
              </button>
 
              <button
                onClick={handleBackupAllJSON}
                className="btn-clr-json w-full p-3.5 flex items-center justify-between rounded-xl font-bold cursor-pointer select-none text-left transition text-xs"
              >
                <span className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span>Export JSON Metadata Archive</span>
                </span>
                <Download className="h-4 w-4 font-bold" />
              </button>
            </div>
          </div>
 
        </div>
 
        {/* Gemini API Quota Monitor & Danger Zone */}
        <div className="space-y-6">
          
          {/* Gemini API Usage Meter */}
          <div className="minimal-card p-5 rounded-2xl text-xs text-slate-700 dark:text-slate-350">
            <div className="flex justify-between items-start border-b border-natural-border pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-theme-on-accent text-sm">Gemini AI Usage Meter & Quota</h3>
              </div>
              <button
                onClick={triggerRefreshQuota}
                disabled={isRefreshingQuota}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-505 hover:text-slate-800 dark:text-slate-400 dark:hover:text-theme-on-accent transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshingQuota ? "animate-spin" : ""}`} />
              </button>
            </div>
 
            <div className="space-y-4">
              {/* Progress bar info */}
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Daily API requests remaining:</span>
                  <span className="text-natural-accent dark:text-natural-gold font-bold">{quotaRemaining} / {totalQuota} Standard Calls</span>
                </div>
                <div className="w-full bg-natural-card dark:bg-slate-900 h-2.5 rounded-full overflow-hidden border border-natural-border dark:border-slate-800">
                  <div 
                    className="h-full bg-natural-accent rounded-full transition-all duration-300"
                    style={{ width: `${percentageRemaining}%` }}
                  />
                </div>
                <p className="text-[11.5px] text-slate-400 mt-1">{percentageRemaining}% of quota remains active for AI document understanding.</p>
              </div>
 
              {/* Reset date info */}
              <div className="flex items-center gap-2 bg-natural-card dark:bg-slate-900/60 p-3 rounded-xl border border-natural-border/40 dark:border-natural-border">
                <Calendar className="h-4 w-4 text-natural-brown flex-shrink-0" />
                <div className="truncate">
                  <h4 className="font-bold text-slate-750 dark:text-slate-300">Quota Reset Date</h4>
                  <p className="text-[11.5px] text-slate-400 ">{resetDate}</p>
                </div>
              </div>
 
              {/* Active API key info */}
 
            </div>
          </div>
 
          {/* Danger Zone (Locked for general users) */}
          <div className="bg-rose-500/5 dark:bg-rose-950/10 p-5 rounded-2xl border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300">
            <h3 className="font-bold text-sm text-rose-700 dark:text-rose-400 mb-1 flex items-center gap-1.5">
              <span>Security System Danger Zone</span>
            </h3>
            
            {currentUser.role === "admin" ? (
              <button
                onClick={handleTriggerDeepWipe}
                className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-theme-on-accent font-bold py-2.5 px-5 rounded-xl shadow-xs cursor-pointer select-none transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>Execute Complete Database Wipe</span>
              </button>
            ) : (
              <div className="bg-rose-100/50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200/50 text-[11.5px] font-semibold text-rose-700">
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
