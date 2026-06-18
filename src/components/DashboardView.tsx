import React, { useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bot,
  Download,
  FlaskConical,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { GridLayout, useContainerWidth, verticalCompactor, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { PatientRecord, UserAccount } from "../types";
import type {
  AnalyticsDashboard,
  AnalyticsField,
  AnalyticsResult,
  ChartSpec,
  ChartType,
} from "../analytics/types";
import { chartTypes } from "../analytics/types";
import { apiFetch } from "../lib/api-client";
import AdvancedStatisticsLab from "./AdvancedStatisticsLab";
import AnalyticsChart from "./AnalyticsChart";

interface DashboardViewProps {
  allPatients: PatientRecord[];
  currentUser: UserAccount;
}

const newId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

function baseChart(title: string, dimension: string | undefined, chartType: ChartType = "bar"): ChartSpec {
  return {
    id: newId("chart"),
    title,
    scope: "cohort",
    chartType,
    analysisUnit: "patient",
    dimension,
    measure: "patient.count",
    aggregation: chartType === "donut" ? "percentage" : "count",
    filters: [],
    statistic: chartType === "kaplan-meier" ? "log-rank" : "descriptive",
    sort: "value-desc",
    limit: 20,
    color: "#5f7567",
    layout: { x: 0, y: 0, w: 6, h: 5 },
  };
}

function starterDashboards(): AnalyticsDashboard[] {
  return [
    {
      id: "starter_registry",
      name: "Registry Overview",
      description: "Population, diagnosis, and status distribution.",
      charts: [
        { ...baseChart("Total registered patients", undefined, "kpi"), layout: { x: 0, y: 0, w: 4, h: 4 } },
        { ...baseChart("Oncology distribution", "oncology", "donut"), layout: { x: 4, y: 0, w: 4, h: 5 } },
        { ...baseChart("Patient status", "status", "bar"), layout: { x: 8, y: 0, w: 4, h: 5 } },
        { ...baseChart("Age distribution", "age", "histogram"), aggregation: "mean", measure: "age", layout: { x: 0, y: 5, w: 6, h: 5 } },
        { ...baseChart("Gender distribution", "gender", "bar"), layout: { x: 6, y: 5, w: 6, h: 5 } },
      ],
    },
    {
      id: "starter_treatment",
      name: "Treatment Outcomes",
      description: "Response, adherence, and therapy patterns.",
      charts: [
        { ...baseChart("Overall response", "oncologicalOutcomeTable.overall_response", "bar"), analysisUnit: "event", layout: { x: 0, y: 0, w: 6, h: 5 } },
        { ...baseChart("Treatment adherence", "afterSurgicalTherapiesTable.treatment_adherence", "donut"), analysisUnit: "event", layout: { x: 6, y: 0, w: 6, h: 5 } },
        { ...baseChart("Therapy types", "afterSurgicalTherapiesTable.therapy_type", "bar"), analysisUnit: "event", layout: { x: 0, y: 5, w: 6, h: 5 } },
        { ...baseChart("ECOG outcomes", "oncologicalOutcomeTable.ecog_status", "line"), analysisUnit: "event", layout: { x: 6, y: 5, w: 6, h: 5 } },
      ],
    },
    {
      id: "starter_survival",
      name: "Survival and Recurrence",
      description: "Exploratory survival and recurrence analytics.",
      charts: [
        { ...baseChart("Overall survival", undefined, "kaplan-meier"), layout: { x: 0, y: 0, w: 8, h: 6 } },
        { ...baseChart("Recurrence status", "oncologicalOutcomeTable.recurrence_status", "donut"), analysisUnit: "event", layout: { x: 8, y: 0, w: 4, h: 6 } },
        { ...baseChart("Survival status", "oncologicalOutcomeTable.survival_status", "bar"), analysisUnit: "event", layout: { x: 0, y: 6, w: 6, h: 5 } },
        { ...baseChart("Disease response", "oncologicalOutcomeTable.overall_response", "stacked-bar"), analysisUnit: "event", groupBy: "overall_stage", layout: { x: 6, y: 6, w: 6, h: 5 } },
      ],
    },
    {
      id: "starter_surgical",
      name: "Surgical Outcomes",
      description: "Complications, length of stay, and postoperative outcomes.",
      charts: [
        { ...baseChart("Clavien-Dindo grade", "treatmentOutcomeTable.clavien_dindo_grade", "bar"), analysisUnit: "event", layout: { x: 0, y: 0, w: 6, h: 5 } },
        { ...baseChart("ICU admissions", "treatmentOutcomeTable.icu_admission", "donut"), analysisUnit: "event", layout: { x: 6, y: 0, w: 6, h: 5 } },
        { ...baseChart("Hospital stay", "treatmentOutcomeTable.hospital_stay_days", "box-plot"), analysisUnit: "event", measure: "treatmentOutcomeTable.hospital_stay_days", aggregation: "mean", layout: { x: 0, y: 5, w: 6, h: 5 } },
        { ...baseChart("30-day mortality", "treatmentOutcomeTable.mortality_30d", "bar"), analysisUnit: "event", layout: { x: 6, y: 5, w: 6, h: 5 } },
      ],
    },
    {
      id: "starter_patient",
      name: "Patient Timeline",
      description: "Individual patient longitudinal outcomes.",
      charts: [
        { ...baseChart("Outcome assessments", "oncologicalOutcomeTable.assessment_date", "timeline"), scope: "patient", analysisUnit: "event", layout: { x: 0, y: 0, w: 8, h: 5 } },
        { ...baseChart("ECOG trajectory", "oncologicalOutcomeTable.assessment_date", "line"), scope: "patient", analysisUnit: "event", measure: "oncologicalOutcomeTable.ecog_status", aggregation: "mean", layout: { x: 8, y: 0, w: 4, h: 5 } },
        { ...baseChart("Weight trajectory", "anthropometricTable.date", "line"), scope: "patient", analysisUnit: "event", measure: "anthropometricTable.weight", aggregation: "mean", layout: { x: 0, y: 5, w: 6, h: 5 } },
        { ...baseChart("Tumor response", "oncologicalOutcomeTable.overall_response", "bar"), scope: "patient", analysisUnit: "event", layout: { x: 6, y: 5, w: 6, h: 5 } },
      ],
    },
  ];
}

const emptyBuilder = () => ({
  title: "Custom clinical analysis",
  chartType: "bar" as ChartType,
  scope: "cohort" as "cohort" | "patient",
  patientId: "",
  analysisUnit: "patient" as "patient" | "event",
  dimension: "oncology",
  measure: "patient.count",
  aggregation: "count" as ChartSpec["aggregation"],
  groupBy: "",
  statistic: "descriptive" as ChartSpec["statistic"],
  sort: "value-desc" as ChartSpec["sort"],
  color: "#5f7567",
  filterField: "",
  filterOperator: "eq" as ChartSpec["filters"][number]["operator"],
  filterValue: "",
});

export default function DashboardView({ allPatients, currentUser }: DashboardViewProps) {
  const starters = useMemo(starterDashboards, []);
  const [fields, setFields] = useState<AnalyticsField[]>([]);
  const [savedDashboards, setSavedDashboards] = useState<AnalyticsDashboard[]>([]);
  const [dashboard, setDashboard] = useState<AnalyticsDashboard>(starters[0]);
  const [results, setResults] = useState<Record<string, AnalyticsResult>>({});
  const [loadingCharts, setLoadingCharts] = useState<Set<string>>(new Set());
  const [cohortCount, setCohortCount] = useState(0);
  const [builder, setBuilder] = useState(emptyBuilder);
  const [prompt, setPrompt] = useState("");
  const [proposed, setProposed] = useState<ChartSpec | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showStatisticsLab, setShowStatisticsLab] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [oncologyFilter, setOncologyFilter] = useState("");
  const [message, setMessage] = useState("");
  const dashboardRef = useRef<HTMLDivElement>(null);
  const { width, containerRef, mounted } = useContainerWidth();

  const dimensionFields = fields.filter((field) => field.allowedAsDimension);
  const measureFields = fields.filter((field) => field.allowedAsMeasure);
  const oncologyTypes = [...new Set(allPatients.flatMap((patient) => patient.oncology_types?.length ? patient.oncology_types : [patient.oncology]).filter(Boolean))].sort();

  const loadConfiguration = async () => {
    const [catalogResponse, dashboardResponse] = await Promise.all([
      apiFetch("/api/analytics/catalog"),
      apiFetch("/api/analytics/dashboards"),
    ]);
    if (catalogResponse.ok) setFields((await catalogResponse.json()).fields || []);
    if (dashboardResponse.ok) setSavedDashboards(await dashboardResponse.json());
  };

  const runChart = async (chart: ChartSpec) => {
    const configured: ChartSpec = {
      ...chart,
      patientId: chart.scope === "patient" ? chart.patientId || builder.patientId || allPatients[0]?.id : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      filters: [
        ...chart.filters.filter((filter) => filter.field !== "oncology"),
        ...(oncologyFilter ? [{ field: "oncology", operator: "eq" as const, value: oncologyFilter }] : []),
      ],
    };
    setLoadingCharts((current) => new Set(current).add(chart.id));
    try {
      const response = await apiFetch("/api/analytics/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configured),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analytics query failed.");
      setResults((current) => ({ ...current, [chart.id]: data }));
      if (data.eligibleCount) setCohortCount((prev) => Math.max(prev, data.eligibleCount));
    } finally {
      setLoadingCharts((current) => {
        const next = new Set(current);
        next.delete(chart.id);
        return next;
      });
    }
  };

  const runDashboard = async (target = dashboard) => {
    setMessage("");
    setCohortCount(0);
    await loadConfiguration();
    await Promise.all(target.charts.map((chart) => runChart(chart).catch((error) => {
      setMessage(error.message);
    })));
  };

  const selectDashboard = (id: string) => {
    const selected = [...starters, ...savedDashboards].find((item) => item.id === id);
    if (!selected) return;
    const cloned = structuredClone(selected);
    setDashboard(cloned);
    setResults({});
  };

  const chartFromBuilder = (): ChartSpec => ({
    id: newId("chart"),
    title: builder.title.trim() || "Custom clinical analysis",
    scope: builder.scope,
    patientId: builder.scope === "patient" ? builder.patientId : undefined,
    chartType: builder.chartType,
    analysisUnit: builder.analysisUnit,
    dimension: builder.chartType === "kpi" || builder.chartType === "kaplan-meier" ? undefined : builder.dimension || undefined,
    measure: builder.measure,
    aggregation: builder.aggregation,
    groupBy: builder.groupBy || undefined,
    filters: builder.filterField && builder.filterValue
      ? [{ field: builder.filterField, operator: builder.filterOperator, value: builder.filterValue }]
      : [],
    statistic: builder.statistic,
    sort: builder.sort,
    limit: 30,
    color: builder.color,
    layout: { x: 0, y: 999, w: 6, h: 5 },
  });

  const addChart = async (chart = chartFromBuilder()) => {
    const nextDashboard = { ...dashboard, charts: [...dashboard.charts, chart] };
    setDashboard(nextDashboard);
    setShowBuilder(false);
    setProposed(null);
    await runChart(chart);
  };

  const promptBuilder = async () => {
    setMessage("");
    const response = await apiFetch("/api/analytics/prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not generate chart.");
    setProposed({ ...data.spec, id: newId("chart"), layout: { x: 0, y: 999, w: 6, h: 5 } });
  };

  const saveCurrentDashboard = async () => {
    const dashboardToSave = dashboard.id.startsWith("starter_")
      ? { ...dashboard, id: newId("dashboard") }
      : dashboard;
    const response = await apiFetch("/api/analytics/dashboards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dashboardToSave),
    });
    const saved = await response.json();
    if (!response.ok) throw new Error(saved.error || "Could not save dashboard.");
    setDashboard(saved);
    setSavedDashboards((current) => [...current.filter((item) => item.id !== saved.id), saved]);
    setMessage("Dashboard saved to your clinician profile.");
  };

  const deleteCurrentDashboard = async () => {
    if (!savedDashboards.some((item) => item.id === dashboard.id)) return;
    await apiFetch(`/api/analytics/dashboards/${dashboard.id}`, { method: "DELETE" });
    setSavedDashboards((current) => current.filter((item) => item.id !== dashboard.id));
    setDashboard(structuredClone(starters[0]));
    setResults({});
  };

  const isMobileLayout = mounted && width < 640;

  const onLayoutChange = (layout: Layout) => {
    if (isMobileLayout) return;

    setDashboard((current) => ({
      ...current,
      charts: current.charts.map((chart) => {
        const item = layout.find((candidate) => candidate.i === chart.id);
        return item ? { ...chart, layout: { x: item.x, y: item.y, w: item.w, h: item.h } } : chart;
      }),
    }));
  };

  const exportDashboardCsv = () => {
    const rows = Object.values(results).flatMap((result) => result.series.map((point) => ({
      chart: result.spec.title,
      label: point.label,
      group: point.group || "",
      value: point.value,
      eligible: result.eligibleCount,
      missing: result.missingCount,
      method: result.method,
    })));
    const headers = ["chart", "label", "group", "value", "eligible", "missing", "method"];
    const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => `"${String(row[header as keyof typeof row]).replace(/"/g, '""')}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `${dashboard.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportDashboardPdf = async () => {
    if (!dashboardRef.current) return;
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(dashboardRef.current, { scale: 1.5, backgroundColor: "#f8fafc", useCORS: true });
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const widthMm = 277;
    const heightMm = canvas.height * widthMm / canvas.width;
    pdf.setFontSize(14);
    pdf.text(dashboard.name, 10, 10);
    pdf.setFontSize(8);
    pdf.text(`Generated ${new Date().toLocaleString()} · User: ${currentUser.name}`, 10, 16);
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 10, 20, widthMm, Math.min(heightMm, 170));
    pdf.setFontSize(7);
    pdf.text("Exploratory clinical analytics. Results do not establish causation or replace clinician review.", 10, 198);
    pdf.save(`${dashboard.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
  };

  let mobileRow = 0;
  const layout: Layout = dashboard.charts.map((chart) => {
    const height = Math.max(chart.layout.h, 5);
    const item = isMobileLayout
      ? {
          i: chart.id,
          x: 0,
          y: mobileRow,
          w: 1,
          h: height,
          minW: 1,
          maxW: 1,
          minH: 5,
        }
      : {
          i: chart.id,
          x: Number.isFinite(chart.layout.x) ? chart.layout.x : 0,
          y: Number.isFinite(chart.layout.y) ? chart.layout.y : 999,
          w: chart.layout.w,
          h: chart.layout.h,
          minW: 4,
          minH: 3,
        };

    mobileRow += height;
    return item;
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-natural-accent" />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-theme-on-accent">Clinical Analytics Studio</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">Build reproducible cohort and patient-level analyses from validated clinical fields.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowStatisticsLab((value) => !value)}
            className={`${showStatisticsLab ? "btn-primary" : "btn-secondary"} px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2`}
          >
            <FlaskConical className="h-4 w-4" /> Statistics Lab
          </button>
          <button type="button" onClick={() => setShowBuilder((value) => !value)} className="btn-clr-add btn-secondary px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><Plus className="h-4 w-4" /> Add chart</button>
          <button type="button" onClick={() => runDashboard()} className="btn-primary px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Run</button>
          {cohortCount > 0 && (
            <span className="text-[11.5px] text-slate-500 font-semibold self-center">{cohortCount} patients analyzed</span>
          )}
          <button type="button" onClick={saveCurrentDashboard} className="btn-primary px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><Save className="h-4 w-4" /> Save</button>
          <button type="button" onClick={exportDashboardCsv} className="btn-clr-csv btn-secondary px-3 py-2 rounded-xl text-xs font-bold">CSV</button>
          <button type="button" onClick={exportDashboardPdf} className="btn-secondary px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><Download className="h-4 w-4" /> PDF</button>
        </div>
      </header>

      <section className="minimal-card rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        <label className="text-[11.5px] font-bold text-slate-500 uppercase">Dashboard
          <select value={dashboard.id} onChange={(event) => selectDashboard(event.target.value)} className="input-field mt-1 w-full">
            <optgroup label="Starter templates">{starters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>
            {savedDashboards.length > 0 && <optgroup label="My dashboards">{savedDashboards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>}
          </select>
        </label>
        <label className="text-[11.5px] font-bold text-slate-500 uppercase">Dashboard name
          <input value={dashboard.name} onChange={(event) => setDashboard((current) => ({ ...current, name: event.target.value }))} className="input-field mt-1 w-full" />
        </label>
        <label className="text-[11.5px] font-bold text-slate-500 uppercase">Oncology cohort
          <select value={oncologyFilter} onChange={(event) => setOncologyFilter(event.target.value)} className="input-field mt-1 w-full">
            <option value="">All oncology types</option>{oncologyTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="text-[11.5px] font-bold text-slate-500 uppercase">From date
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="input-field mt-1 w-full" />
        </label>
        <label className="text-[11.5px] font-bold text-slate-500 uppercase">To date
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="input-field mt-1 w-full" />
        </label>
      </section>

      {message && <div className="px-4 py-3 rounded-xl bg-natural-accent/10 text-natural-accent-dark text-xs font-semibold">{message}</div>}

      {showStatisticsLab && (
        <AdvancedStatisticsLab
          fields={fields}
          oncologyFilter={oncologyFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}

      {showBuilder && (
        <section className="minimal-card rounded-2xl p-5 space-y-5">
          <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /><h3 className="font-bold text-sm">Chart builder</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <label className="label-form">Title<input value={builder.title} onChange={(event) => setBuilder((current) => ({ ...current, title: event.target.value }))} className="input-field mt-1 w-full" /></label>
            <label className="label-form">Chart type<select value={builder.chartType} onChange={(event) => setBuilder((current) => ({ ...current, chartType: event.target.value as ChartType }))} className="input-field mt-1 w-full">{chartTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label className="label-form">Scope<select value={builder.scope} onChange={(event) => setBuilder((current) => ({ ...current, scope: event.target.value as "cohort" | "patient" }))} className="input-field mt-1 w-full"><option value="cohort">Cohort</option><option value="patient">Patient</option></select></label>
            <label className="label-form">Analysis unit<select value={builder.analysisUnit} onChange={(event) => setBuilder((current) => ({ ...current, analysisUnit: event.target.value as "patient" | "event" }))} className="input-field mt-1 w-full"><option value="patient">One row per patient</option><option value="event">One row per repeated event</option></select></label>
            {builder.scope === "patient" && <label className="label-form">Patient<select value={builder.patientId} onChange={(event) => setBuilder((current) => ({ ...current, patientId: event.target.value }))} className="input-field mt-1 w-full"><option value="">Select patient</option>{allPatients.map((patient) => <option key={patient.id} value={patient.id}>{patient.auto_id} · {patient.first_name} {patient.last_name}</option>)}</select></label>}
            <label className="label-form">Dimension<select value={builder.dimension} onChange={(event) => setBuilder((current) => ({ ...current, dimension: event.target.value }))} className="input-field mt-1 w-full">{dimensionFields.map((field) => <option key={field.path} value={field.path}>{field.label}</option>)}</select></label>
            <label className="label-form">Measure<select value={builder.measure} onChange={(event) => setBuilder((current) => ({ ...current, measure: event.target.value }))} className="input-field mt-1 w-full">{measureFields.map((field) => <option key={field.path} value={field.path}>{field.label}</option>)}</select></label>
            <label className="label-form">Aggregation<select value={builder.aggregation} onChange={(event) => setBuilder((current) => ({ ...current, aggregation: event.target.value as ChartSpec["aggregation"] }))} className="input-field mt-1 w-full">{["count", "percentage", "sum", "mean", "median", "min", "max"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="label-form">Group by<select value={builder.groupBy} onChange={(event) => setBuilder((current) => ({ ...current, groupBy: event.target.value }))} className="input-field mt-1 w-full"><option value="">No grouping</option>{dimensionFields.map((field) => <option key={field.path} value={field.path}>{field.label}</option>)}</select></label>
            <label className="label-form">Statistic<select value={builder.statistic} onChange={(event) => setBuilder((current) => ({ ...current, statistic: event.target.value as ChartSpec["statistic"] }))} className="input-field mt-1 w-full">{["none", "descriptive", "pearson", "spearman", "chi-square", "fisher-exact", "welch-t", "mann-whitney", "welch-anova", "kruskal-wallis", "log-rank"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="label-form">Filter field<select value={builder.filterField} onChange={(event) => setBuilder((current) => ({ ...current, filterField: event.target.value }))} className="input-field mt-1 w-full"><option value="">No filter</option>{fields.map((field) => <option key={field.path} value={field.path}>{field.label}</option>)}</select></label>
            <label className="label-form">Filter operator<select value={builder.filterOperator} onChange={(event) => setBuilder((current) => ({ ...current, filterOperator: event.target.value as ChartSpec["filters"][number]["operator"] }))} className="input-field mt-1 w-full">{["eq", "neq", "contains", "gt", "gte", "lt", "lte", "exists"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="label-form">Filter value<input value={builder.filterValue} onChange={(event) => setBuilder((current) => ({ ...current, filterValue: event.target.value }))} className="input-field mt-1 w-full" /></label>
            <label className="label-form">Color<input type="color" value={builder.color} onChange={(event) => setBuilder((current) => ({ ...current, color: event.target.value }))} className="input-field mt-1 w-full h-10" /></label>
          </div>
          <div className="flex justify-end"><button type="button" onClick={() => addChart()} className="btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><Plus className="h-4 w-4" /> Add analysis</button></div>

          <div className="border-t border-natural-border/40 pt-5">
            <div className="flex items-center gap-2 mb-3"><Bot className="h-4 w-4 text-natural-accent" /><h4 className="text-sm font-bold">AI prompt builder</h4><span className="text-[11.5px] text-slate-500">Catalog only; no patient-level data sent.</span></div>
            <div className="flex flex-col md:flex-row gap-2">
              <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Example: show recurrence status by oncology type" className="input-field flex-1" />
              <button type="button" onClick={() => promptBuilder().catch((error) => setMessage(error.message))} className="btn-secondary px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"><Sparkles className="h-4 w-4" /> Propose chart</button>
            </div>
            {proposed && (
              <div className="mt-3 p-3 rounded-xl bg-natural-accent/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="text-xs"><strong>{proposed.title}</strong><p className="text-slate-500 mt-1">{proposed.chartType} · {proposed.dimension || "survival endpoint"} · {proposed.aggregation}</p></div>
                <button type="button" onClick={() => addChart(proposed)} className="btn-primary px-4 py-2 rounded-xl text-xs font-bold">Confirm and run</button>
              </div>
            )}
          </div>
        </section>
      )}

      <div ref={dashboardRef} className={isMobileLayout ? "analytics-mobile-stack" : undefined}>
        <div ref={containerRef}>
          {mounted && (
            <GridLayout
              key={isMobileLayout ? "mobile" : "desktop"}
              width={width}
              layout={layout}
              onLayoutChange={onLayoutChange}
              gridConfig={{
                cols: isMobileLayout ? 1 : 12,
                rowHeight: isMobileLayout ? 72 : 68,
                margin: isMobileLayout ? [0, 16] : [16, 16],
                containerPadding: [0, 0],
              }}
              dragConfig={{ enabled: !isMobileLayout, handle: ".analytics-drag-handle" }}
              resizeConfig={{ enabled: !isMobileLayout, handles: ["se"] }}
              compactor={verticalCompactor}
            >
              {dashboard.charts.map((chart) => (
                <div key={chart.id}>
                  <AnalyticsChart
                    result={results[chart.id]}
                    loading={loadingCharts.has(chart.id)}
                    onRemove={() => setDashboard((current) => ({ ...current, charts: current.charts.filter((item) => item.id !== chart.id) }))}
                  />
                </div>
              ))}
            </GridLayout>
          )}
        </div>
      </div>

      {savedDashboards.some((item) => item.id === dashboard.id) && (
        <div className="flex justify-end">
          <button type="button" onClick={deleteCurrentDashboard} className="btn-clr-delete text-xs font-bold flex items-center gap-2 px-2 py-1 rounded-lg"><Trash2 className="h-4 w-4" /> Delete personal dashboard</button>
        </div>
      )}
    </div>
  );
}
