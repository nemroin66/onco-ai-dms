import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Calculator,
  CheckCircle2,
  Download,
  FlaskConical,
  Play,
  Sparkles,
} from "lucide-react";
import type {
  AnalyticsField,
  StatisticalAnalysisResult,
  StatisticalMethod,
} from "../analytics/types";
import { statisticalMethods } from "../analytics/types";
import { apiFetch } from "../lib/api-client";

interface AdvancedStatisticsLabProps {
  fields: AnalyticsField[];
  oncologyFilter: string;
  dateFrom: string;
  dateTo: string;
}

const methodLabels: Record<StatisticalMethod, string> = {
  descriptive: "Descriptive statistics",
  pearson: "Pearson correlation",
  spearman: "Spearman correlation",
  "chi-square": "Chi-square association",
  "fisher-exact": "Fisher exact (2x2)",
  "welch-t": "Welch two-sample t-test",
  "mann-whitney": "Mann-Whitney U",
  "welch-anova": "Welch one-way ANOVA",
  "kruskal-wallis": "Kruskal-Wallis",
};

const methodHelp: Record<StatisticalMethod, string> = {
  descriptive: "Summarize a numeric outcome with mean, median, SD, IQR, range, and a 95% confidence interval.",
  pearson: "Measure linear association between two numeric variables.",
  spearman: "Measure monotonic association between two numeric variables using ranks.",
  "chi-square": "Test association between two categorical variables.",
  "fisher-exact": "Exact association test for a categorical 2x2 table.",
  "welch-t": "Compare a numeric outcome between exactly two groups without assuming equal variance.",
  "mann-whitney": "Rank-based comparison of a numeric outcome between exactly two groups.",
  "welch-anova": "Compare a numeric outcome across two or more groups without assuming equal variance.",
  "kruskal-wallis": "Rank-based comparison of a numeric outcome across two or more groups.",
};

function formatValue(value: number | null, digits = 3) {
  if (value === null || !Number.isFinite(value)) return "Not available";
  if (value !== 0 && Math.abs(value) < 0.001) return value.toExponential(2);
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function exportResult(result: StatisticalAnalysisResult) {
  const rows = [
    ["Analysis", result.spec.title],
    ["Method", result.method],
    ["Eligible observations", result.eligibleCount],
    ["Missing observations", result.missingCount],
    [result.statisticName, result.statistic ?? ""],
    ["P value", result.pValue ?? ""],
    [result.estimateName, result.estimate ?? ""],
    [result.effectSizeName || "Effect size", result.effectSize ?? ""],
    ["Generated", result.generatedAt],
    [],
    ["Group", "N", "Mean", "Median", "SD", "Q1", "Q3"],
    ...result.groupSummaries.map((group) => [
      group.label,
      group.count,
      group.mean ?? "",
      group.median ?? "",
      group.sd ?? "",
      group.q1 ?? "",
      group.q3 ?? "",
    ]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `${result.spec.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-statistics.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function AdvancedStatisticsLab({
  fields,
  oncologyFilter,
  dateFrom,
  dateTo,
}: AdvancedStatisticsLabProps) {
  const [method, setMethod] = useState<StatisticalMethod>("descriptive");
  const [title, setTitle] = useState("Advanced clinical statistical analysis");
  const [outcome, setOutcome] = useState("");
  const [predictor, setPredictor] = useState("");
  const [analysisUnit, setAnalysisUnit] = useState<"patient" | "event">("patient");
  const [result, setResult] = useState<StatisticalAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSource, setAiSource] = useState<"gemini" | "rules" | "">("");
  const [aiWarning, setAiWarning] = useState("");
  const [error, setError] = useState("");
  const preservePromptResult = useRef(false);

  const numericFields = useMemo(
    () => fields.filter((field) => field.dataType === "numeric" && field.path !== "patient.count"),
    [fields],
  );
  const categoricalFields = useMemo(
    () => fields.filter((field) => field.allowedAsDimension && ["categorical", "boolean"].includes(field.dataType)),
    [fields],
  );
  const outcomeFields = ["chi-square", "fisher-exact"].includes(method) ? categoricalFields : numericFields;
  const predictorFields = ["pearson", "spearman"].includes(method) ? numericFields : categoricalFields;
  const availablePredictorFields = useMemo(
    () => predictorFields.filter((field) => field.path !== outcome),
    [predictorFields, outcome],
  );
  const needsPredictor = method !== "descriptive";

  useEffect(() => {
    if (!outcomeFields.some((field) => field.path === outcome)) {
      setOutcome(outcomeFields[0]?.path || "");
    }
    if (needsPredictor && !availablePredictorFields.some((field) => field.path === predictor)) {
      setPredictor(availablePredictorFields[0]?.path || "");
    }
  }, [method, fields, outcome, predictor, needsPredictor, outcomeFields, availablePredictorFields]);

  useEffect(() => {
    const selected = [outcome, predictor]
      .filter(Boolean)
      .map((path) => fields.find((field) => field.path === path));
    if (selected.some((field) => field?.repeated)) setAnalysisUnit("event");
  }, [fields, outcome, predictor]);

  useEffect(() => {
    if (preservePromptResult.current) {
      preservePromptResult.current = false;
      return;
    }
    setResult(null);
    setAiSource("");
    setAiWarning("");
  }, [method, outcome, predictor, analysisUnit, oncologyFilter, dateFrom, dateTo]);

  const runAnalysis = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await apiFetch("/api/analytics/statistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          method,
          analysisUnit,
          outcome,
          predictor: needsPredictor ? predictor : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          filters: oncologyFilter ? [{ field: "oncology", operator: "eq", value: oncologyFilter }] : [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Statistical analysis failed.");
      setResult(data);
    } catch (analysisError: any) {
      setResult(null);
      setError(analysisError?.message || "Statistical analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const runPromptAnalysis = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await apiFetch("/api/analytics/statistics/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          filters: oncologyFilter ? [{ field: "oncology", operator: "eq", value: oncologyFilter }] : [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI statistical analysis failed.");
      preservePromptResult.current = true;
      setTitle(data.spec.title);
      setMethod(data.spec.method);
      setOutcome(data.spec.outcome);
      setPredictor(data.spec.predictor || "");
      setAnalysisUnit(data.spec.analysisUnit);
      setAiSource(data.source);
      setAiWarning(data.warning || "");
      setResult(data.result);
    } catch (analysisError: any) {
      setResult(null);
      setError(analysisError?.message || "AI statistical analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const resultOutcome = result ? fields.find((field) => field.path === result.spec.outcome)?.label || result.spec.outcome : "";
  const resultPredictor = result?.spec.predictor
    ? fields.find((field) => field.path === result.spec.predictor)?.label || result.spec.predictor
    : "";

  return (
    <section className="minimal-card rounded-2xl overflow-hidden border border-natural-border/40">
      <div className="p-5 border-b border-natural-border/35 bg-theme-surface">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-natural-accent" />
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Advanced Statistics Lab</h3>
              <span className="px-2 py-1 rounded-full bg-natural-accent/10 text-natural-accent-dark text-[9px] font-bold uppercase tracking-wide">
                Exploratory
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Run validated complete-case tests with denominators, effect sizes, assumptions, and warnings.
            </p>
          </div>
          {result && (
            <button
              type="button"
              onClick={() => exportResult(result)}
              className="btn-secondary px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" /> Export results
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="rounded-2xl border border-natural-accent/25 bg-natural-accent/5 p-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-natural-accent/15 text-natural-accent-dark flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">AI statistical copilot</h4>
                <span className="text-[9px] text-slate-500">Safe field catalog sent to AI; patient records stay server-side.</span>
              </div>
              <p className="mt-1 text-[11.5px] text-slate-500">
                Describe question in plain English. AI configures supported method; deterministic engine calculates results.
              </p>
              <div className="mt-3 flex flex-col lg:flex-row gap-2">
                <textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && aiPrompt.trim()) {
                      event.preventDefault();
                      runPromptAnalysis();
                    }
                  }}
                  placeholder="Example: Is age different between male and female patients? Use a non-parametric test."
                  className="input-field min-h-20 flex-1 resize-y"
                />
                <button
                  type="button"
                  onClick={runPromptAnalysis}
                  disabled={loading || !aiPrompt.trim()}
                  className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 lg:self-end disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> {loading ? "Planning and calculating..." : "Analyze with AI"}
                </button>
              </div>
              {aiSource && result && (
                <div className="mt-3 rounded-xl bg-white/60 dark:bg-slate-900/30 border border-natural-border/30 px-3 py-2 text-[11.5px] text-slate-600 dark:text-slate-300">
                  <strong>Configured plan:</strong> {methodLabels[result.spec.method]} · outcome: {resultOutcome}
                  {resultPredictor ? ` · predictor/group: ${resultPredictor}` : ""}
                  {` · ${result.spec.analysisUnit} level`}
                  <span className="ml-2 text-slate-400">Planner: {aiSource === "gemini" ? "Gemini" : "safe rules fallback"}</span>
                  {aiWarning && <p className="mt-1 text-amber-700 dark:text-amber-300">{aiWarning}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px bg-natural-border/40 flex-1" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Manual configuration</span>
          <div className="h-px bg-natural-border/40 flex-1" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <label className="label-form xl:col-span-2">
            Analysis title
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="input-field mt-1 w-full" />
          </label>
          <label className="label-form">
            Statistical method
            <select
              value={method}
              onChange={(event) => {
                setMethod(event.target.value as StatisticalMethod);
                setResult(null);
              }}
              className="input-field mt-1 w-full"
            >
              {statisticalMethods.map((item) => <option key={item} value={item}>{methodLabels[item]}</option>)}
            </select>
          </label>
          <label className="label-form">
            Outcome
            <select value={outcome} onChange={(event) => setOutcome(event.target.value)} className="input-field mt-1 w-full">
              {outcomeFields.map((field) => <option key={field.path} value={field.path}>{field.label}</option>)}
            </select>
          </label>
          {needsPredictor ? (
            <label className="label-form">
              {["welch-t", "mann-whitney", "welch-anova", "kruskal-wallis"].includes(method) ? "Grouping field" : "Predictor"}
              <select value={predictor} onChange={(event) => setPredictor(event.target.value)} className="input-field mt-1 w-full">
                {availablePredictorFields.map((field) => <option key={field.path} value={field.path}>{field.label}</option>)}
              </select>
            </label>
          ) : (
            <label className="label-form">
              Analysis unit
              <select value={analysisUnit} onChange={(event) => setAnalysisUnit(event.target.value as "patient" | "event")} className="input-field mt-1 w-full">
                <option value="patient">One observation per patient</option>
                <option value="event">One observation per event</option>
              </select>
            </label>
          )}
        </div>

        {needsPredictor && (
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <label className="label-form w-full md:max-w-xs">
              Analysis unit
              <select value={analysisUnit} onChange={(event) => setAnalysisUnit(event.target.value as "patient" | "event")} className="input-field mt-1 w-full">
                <option value="patient">One observation per patient</option>
                <option value="event">One observation per repeated event</option>
              </select>
            </label>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading || !outcome || (needsPredictor && !predictor)}
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> {loading ? "Calculating..." : "Run statistical analysis"}
            </button>
          </div>
        )}
        {!needsPredictor && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={loading || !outcome}
              className="btn-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> {loading ? "Calculating..." : "Run statistical analysis"}
            </button>
          </div>
        )}

        <div className="rounded-xl bg-slate-50/70 dark:bg-slate-900/30 border border-natural-border/35 p-3 flex gap-3">
          <Calculator className="h-4 w-4 text-natural-accent mt-0.5 shrink-0" />
          <p className="text-xs text-slate-600 dark:text-slate-300">{methodHelp[method]}</p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 text-xs font-semibold flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-natural-border/35 p-4">
                <span className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">Eligible / missing</span>
                <strong className="block mt-1 text-xl text-slate-800 dark:text-slate-100">
                  {result.eligibleCount} / {result.missingCount}
                </strong>
              </div>
              <div className="rounded-xl border border-natural-border/35 p-4">
                <span className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">{result.estimateName}</span>
                <strong className="block mt-1 text-xl text-slate-800 dark:text-slate-100">{formatValue(result.estimate)}</strong>
                {result.confidenceInterval && (
                  <small className="text-[11.5px] text-slate-500">
                    95% CI {formatValue(result.confidenceInterval.low)} to {formatValue(result.confidenceInterval.high)}
                  </small>
                )}
              </div>
              <div className="rounded-xl border border-natural-border/35 p-4">
                <span className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">P value</span>
                <strong className="block mt-1 text-xl text-slate-800 dark:text-slate-100">{formatValue(result.pValue, 4)}</strong>
                <small className="text-[11.5px] text-slate-500">{result.statisticName}: {formatValue(result.statistic)}</small>
              </div>
              <div className="rounded-xl border border-natural-border/35 p-4">
                <span className="text-[9px] uppercase tracking-wide text-slate-500 font-bold">{result.effectSizeName || "Effect size"}</span>
                <strong className="block mt-1 text-xl text-slate-800 dark:text-slate-100">{formatValue(result.effectSize)}</strong>
              </div>
            </div>

            {result.groupSummaries.length > 0 && (
              <div className="overflow-auto rounded-xl border border-natural-border/35">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/40">
                    <tr>
                      {["Group", "N", "Mean", "Median", "SD", "Q1", "Q3"].map((heading) => (
                        <th key={heading} className="px-3 py-2 text-left text-[9px] uppercase tracking-wide text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.groupSummaries.map((group) => (
                      <tr key={group.label} className="border-t border-natural-border/25">
                        <td className="px-3 py-2 font-semibold">{group.label}</td>
                        <td className="px-3 py-2">{group.count}</td>
                        <td className="px-3 py-2">{formatValue(group.mean)}</td>
                        <td className="px-3 py-2">{formatValue(group.median)}</td>
                        <td className="px-3 py-2">{formatValue(group.sd)}</td>
                        <td className="px-3 py-2">{formatValue(group.q1)}</td>
                        <td className="px-3 py-2">{formatValue(group.q3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.contingency && (
              <div className="overflow-auto rounded-xl border border-natural-border/35">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/40">
                    <tr>
                      <th className="px-3 py-2 text-left">Outcome</th>
                      {result.contingency.columnLabels.map((label) => <th key={label} className="px-3 py-2 text-right">{label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.contingency.rowLabels.map((label, rowIndex) => (
                      <tr key={label} className="border-t border-natural-border/25">
                        <td className="px-3 py-2 font-semibold">{label}</td>
                        {result.contingency!.counts[rowIndex].map((count, columnIndex) => (
                          <td key={`${label}-${result.contingency!.columnLabels[columnIndex]}`} className="px-3 py-2 text-right">{count}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 p-4">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="h-4 w-4" /> Method and assumptions
                </div>
                <p className="mt-2 text-xs font-semibold">{result.method}</p>
                {result.assumptions.map((assumption) => <p key={assumption} className="mt-1 text-[11.5px] text-slate-600 dark:text-slate-300">• {assumption}</p>)}
              </div>
              <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 p-4">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <AlertTriangle className="h-4 w-4" /> Interpretation warnings
                </div>
                {result.warnings.map((warning) => <p key={warning} className="mt-2 text-[11.5px] text-slate-600 dark:text-slate-300">• {warning}</p>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
