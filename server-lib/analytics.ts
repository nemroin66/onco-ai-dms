import crypto from "crypto";
import { analyticsCatalog, analyticsFieldMap } from "../src/analytics/catalog.js";
import {
  chartSpecSchema,
  dashboardSchema,
  statisticalAnalysisSchema,
} from "../src/analytics/schemas.js";
import {
  type AnalyticsDashboard,
  type AnalyticsPoint,
  type AnalyticsResult,
  type ChartSpec,
  type StatisticalAnalysisResult,
  type StatisticalAnalysisSpec,
  type StatisticalGroupSummary,
} from "../src/analytics/types.js";
import { getFirestoreDoc, listCollection, saveDocument, deleteDocument } from "./firebase.js";

const resultCache = new Map<string, { expires: number; result: AnalyticsResult }>();
let patientSnapshotCache: { expires: number; patients: any[] } | null = null;
let patientSnapshotPromise: Promise<any[]> | null = null;
let versionCache: { expires: number; version: number } | null = null;
let versionPromise: Promise<number> | null = null;

async function loadPatientSnapshot(userId?: string) {
  if (patientSnapshotCache && patientSnapshotCache.expires > Date.now()) return patientSnapshotCache.patients;
  if (!patientSnapshotPromise) {
    patientSnapshotPromise = listCollection("patients")
      .then((patients) => {
        patientSnapshotCache = { expires: Date.now() + 300_000, patients };
        return patients;
      })
      .finally(() => {
        patientSnapshotPromise = null;
      });
  }
  const allPatients = (await patientSnapshotPromise).filter((p: any) => p.isDeleted !== true);
  if (!userId) return allPatients;
  return allPatients.filter((p: any) => !p.createdBy || p.createdBy === userId);
}

async function analyticsVersion() {
  if (versionCache && versionCache.expires > Date.now()) return versionCache.version;
  if (!versionPromise) {
    versionPromise = getFirestoreDoc("system", "analytics")
      .then((document) => Number(document?.version || 0))
      .then((version) => {
        versionCache = { expires: Date.now() + 60_000, version };
        return version;
      })
      .finally(() => {
        versionPromise = null;
      });
  }
  return versionPromise;
}

function valueAt(source: any, path?: string): any {
  if (!path || path === "patient.count") return 1;
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function nonEmpty(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value ?? "").trim().replace(/[^0-9.+-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === "+" || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

export function descriptiveStats(values: number[]) {
  if (!values.length) return { count: 0, mean: null, median: null, sd: null, min: null, max: null, q1: null, q3: null, ciLow: null, ciHigh: null };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (values.length - 1)
    : 0;
  const sd = Math.sqrt(variance);
  const margin = values.length > 1 ? 1.96 * sd / Math.sqrt(values.length) : 0;
  return {
    count: values.length,
    mean,
    median: quantile(values, 0.5),
    sd,
    min: Math.min(...values),
    max: Math.max(...values),
    q1: quantile(values, 0.25),
    q3: quantile(values, 0.75),
    ciLow: mean - margin,
    ciHigh: mean + margin,
  };
}

function rank(values: number[]) {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array(values.length);
  for (let i = 0; i < indexed.length;) {
    let j = i + 1;
    while (j < indexed.length && indexed[j].value === indexed[i].value) j++;
    const averageRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[indexed[k].index] = averageRank;
    i = j;
  }
  return ranks;
}

function pearson(x: number[], y: number[]) {
  if (x.length < 2 || x.length !== y.length) return null;
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  const numerator = x.reduce((sum, value, index) => sum + (value - mx) * (y[index] - my), 0);
  const denominator = Math.sqrt(
    x.reduce((sum, value) => sum + (value - mx) ** 2, 0)
    * y.reduce((sum, value) => sum + (value - my) ** 2, 0),
  );
  return denominator ? numerator / denominator : null;
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function twoSidedNormalP(z: number) {
  return Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));
}

function logFactorial(value: number) {
  let total = 0;
  for (let index = 2; index <= value; index++) total += Math.log(index);
  return total;
}

function hypergeometricProbability(a: number, b: number, c: number, d: number) {
  const n = a + b + c + d;
  return Math.exp(
    logFactorial(a + b) + logFactorial(c + d) + logFactorial(a + c) + logFactorial(b + d)
    - logFactorial(a) - logFactorial(b) - logFactorial(c) - logFactorial(d) - logFactorial(n),
  );
}

function fisherExact(table: number[][]) {
  if (table.length !== 2 || table.some((row) => row.length !== 2)) return null;
  const [[a, b], [c, d]] = table;
  const observed = hypergeometricProbability(a, b, c, d);
  const row1 = a + b;
  const row2 = c + d;
  const col1 = a + c;
  const minA = Math.max(0, col1 - row2);
  const maxA = Math.min(row1, col1);
  let p = 0;
  for (let candidate = minA; candidate <= maxA; candidate++) {
    const candidateTable = [candidate, row1 - candidate, col1 - candidate, row2 - (col1 - candidate)];
    const probability = hypergeometricProbability(...candidateTable as [number, number, number, number]);
    if (probability <= observed + 1e-12) p += probability;
  }
  return Math.min(1, p);
}

function chiSquare(table: number[][]) {
  const rowTotals = table.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = table[0]?.map((_, column) => table.reduce((sum, row) => sum + row[column], 0)) || [];
  const total = rowTotals.reduce((a, b) => a + b, 0);
  let statistic = 0;
  table.forEach((row, rowIndex) => row.forEach((observed, columnIndex) => {
    const expected = rowTotals[rowIndex] * colTotals[columnIndex] / total;
    if (expected > 0) statistic += (observed - expected) ** 2 / expected;
  }));
  const df = Math.max(1, (table.length - 1) * (colTotals.length - 1));
  const z = (Math.pow(statistic / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return { statistic, df, p: 1 - normalCdf(z) };
}

function mannWhitney(groups: number[][]) {
  if (groups.length !== 2 || groups.some((group) => !group.length)) return null;
  const combined = [...groups[0].map((value) => ({ value, group: 0 })), ...groups[1].map((value) => ({ value, group: 1 }))];
  const ranks = rank(combined.map((item) => item.value));
  const rankSum = combined.reduce((sum, item, index) => sum + (item.group === 0 ? ranks[index] : 0), 0);
  const n1 = groups[0].length;
  const n2 = groups[1].length;
  const u = rankSum - n1 * (n1 + 1) / 2;
  const mean = n1 * n2 / 2;
  const sd = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  return { statistic: u, p: sd ? twoSidedNormalP((u - mean) / sd) : 1 };
}

function welchT(groups: number[][]) {
  if (groups.length !== 2 || groups.some((group) => group.length < 2)) return null;
  const stats = groups.map(descriptiveStats);
  const denominator = Math.sqrt((Number(stats[0].sd) ** 2 / groups[0].length) + (Number(stats[1].sd) ** 2 / groups[1].length));
  const statistic = denominator ? (Number(stats[0].mean) - Number(stats[1].mean)) / denominator : 0;
  return { statistic, p: twoSidedNormalP(statistic) };
}

function kruskalWallis(groups: number[][]) {
  const combined = groups.flatMap((group, groupIndex) => group.map((value) => ({ value, groupIndex })));
  if (combined.length < 3 || groups.some((group) => !group.length)) return null;
  const ranks = rank(combined.map((item) => item.value));
  let h = 0;
  groups.forEach((group, groupIndex) => {
    const rankSum = combined.reduce((sum, item, index) => sum + (item.groupIndex === groupIndex ? ranks[index] : 0), 0);
    h += rankSum ** 2 / group.length;
  });
  h = 12 / (combined.length * (combined.length + 1)) * h - 3 * (combined.length + 1);
  const df = groups.length - 1;
  const z = (Math.pow(Math.max(h, 0) / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return { statistic: h, df, p: 1 - normalCdf(z) };
}

function welchAnova(groups: number[][]) {
  if (groups.length < 2 || groups.some((group) => group.length < 2)) return null;
  const means = groups.map((group) => group.reduce((a, b) => a + b, 0) / group.length);
  const grand = groups.flat().reduce((a, b) => a + b, 0) / groups.flat().length;
  const between = groups.reduce((sum, group, index) => sum + group.length * (means[index] - grand) ** 2, 0) / (groups.length - 1);
  const withinDf = groups.flat().length - groups.length;
  const within = groups.reduce((sum, group, index) => sum + group.reduce((inner, value) => inner + (value - means[index]) ** 2, 0), 0) / Math.max(1, withinDf);
  const statistic = within ? between / within : 0;
  const z = Math.sqrt(Math.max(statistic, 0));
  return { statistic, df1: groups.length - 1, df2: withinDf, p: 1 - normalCdf(z) };
}

function passesFilter(row: any, filter: ChartSpec["filters"][number]) {
  const value = valueAt(row, filter.field);
  const expected = filter.value as any;
  switch (filter.operator) {
    case "eq": return String(value) === String(expected);
    case "neq": return String(value) !== String(expected);
    case "contains": return String(value ?? "").toLowerCase().includes(String(expected ?? "").toLowerCase());
    case "in": return Array.isArray(expected) && expected.map(String).includes(String(value));
    case "gt": return Number(value) > Number(expected);
    case "gte": return Number(value) >= Number(expected);
    case "lt": return Number(value) < Number(expected);
    case "lte": return Number(value) <= Number(expected);
    case "between": return Array.isArray(expected) && Number(value) >= Number(expected[0]) && Number(value) <= Number(expected[1]);
    case "exists": return expected === false ? !nonEmpty(value) : nonEmpty(value);
  }
}

function eventRows(patient: any, spec: ChartSpec) {
  const candidate = [spec.dimension, spec.measure, spec.groupBy]
    .filter(Boolean)
    .map((path) => analyticsFieldMap.get(path!))
    .find((field) => field?.eventRoot);
  if (spec.analysisUnit !== "event" || !candidate?.eventRoot) return [{ ...patient, __patient: patient }];
  const events = valueAt(patient, candidate.eventRoot);
  if (!Array.isArray(events)) return [];
  return events.map((event) => ({ ...patient, [candidate.eventRoot!]: event, __patient: patient }));
}

function statisticalEventRows(patient: any, spec: StatisticalAnalysisSpec) {
  const eventRoots = [...new Set(
    [spec.outcome, spec.predictor, ...spec.filters.map((filter) => filter.field)]
      .filter(Boolean)
      .map((path) => analyticsFieldMap.get(path!)?.eventRoot)
      .filter(Boolean),
  )] as string[];
  if (spec.analysisUnit !== "event" || eventRoots.length === 0) return [{ ...patient, __patient: patient }];
  if (eventRoots.length > 1) {
    throw new Error("Event-level analyses must use fields from the same repeated clinical table.");
  }
  const eventRoot = eventRoots[0];
  const events = valueAt(patient, eventRoot);
  if (!Array.isArray(events)) return [];
  return events.map((event) => ({ ...patient, [eventRoot]: event, __patient: patient }));
}

function aggregateValue(values: number[], aggregation: ChartSpec["aggregation"]) {
  if (aggregation === "count" || aggregation === "percentage") return values.length;
  if (!values.length) return 0;
  if (aggregation === "sum") return values.reduce((a, b) => a + b, 0);
  if (aggregation === "mean") return values.reduce((a, b) => a + b, 0) / values.length;
  if (aggregation === "median") return quantile(values, 0.5);
  if (aggregation === "min") return Math.min(...values);
  return Math.max(...values);
}

function dateValue(value: unknown) {
  const time = new Date(String(value || "")).getTime();
  return Number.isFinite(time) ? time : null;
}

function latestClinicalDate(patient: any) {
  const dates = [patient.updatedAt, patient.date];
  for (const root of ["treatmentOutcomeTable", "oncologicalOutcomeTable"]) {
    for (const entry of patient[root] || []) dates.push(entry.assessment_date, entry.survival_date, entry.progression_date);
  }
  return Math.max(...dates.map(dateValue).filter((value): value is number => value !== null), Date.now());
}

export function kaplanMeier(patients: any[], endpoint: "overall" | "progression" = "overall"): AnalyticsPoint[] {
  const observations = patients.flatMap((patient) => {
    const diagnosis = dateValue(
      patient.tumor_diagnosis_date
      || patient.tumorCharacteristicsTable?.[0]?.diagnosis_date
      || patient.date
      || patient.createdAt,
    );
    if (diagnosis === null) return [];
    const outcomes = [...(patient.oncologicalOutcomeTable || []), ...(patient.treatmentOutcomeTable || [])];
    const death = outcomes.find((entry: any) => entry.survival_status === "Deceased" && entry.survival_date);
    const progression = outcomes.find((entry: any) => entry.progression_date || (entry.recurrence_status && entry.recurrence_status !== "No recurrence"));
    const eventDate = endpoint === "overall"
      ? dateValue(death?.survival_date)
      : dateValue(progression?.progression_date || progression?.recurrence_date);
    const end = eventDate ?? latestClinicalDate(patient);
    return [{ time: Math.max(0, (end - diagnosis) / 86400000 / 30.4375), event: eventDate !== null }];
  }).sort((a, b) => a.time - b.time);

  if (!observations.length) return [];
  let survival = 1;
  let varianceSum = 0;
  const points: AnalyticsPoint[] = [{ label: "0", value: 1, lower: 1, upper: 1, atRisk: observations.length, censored: 0 }];
  const times = [...new Set(observations.filter((item) => item.event).map((item) => item.time))];
  for (const time of times) {
    const atRisk = observations.filter((item) => item.time >= time).length;
    const events = observations.filter((item) => item.time === time && item.event).length;
    const censored = observations.filter((item) => item.time === time && !item.event).length;
    survival *= 1 - events / atRisk;
    if (atRisk > events) varianceSum += events / (atRisk * (atRisk - events));
    const se = survival * Math.sqrt(varianceSum);
    points.push({
      label: time.toFixed(1),
      value: survival,
      lower: Math.max(0, survival - 1.96 * se),
      upper: Math.min(1, survival + 1.96 * se),
      atRisk,
      censored,
    });
  }
  return points;
}

function validateFields(spec: ChartSpec) {
  for (const path of [spec.dimension, spec.measure, spec.groupBy, ...spec.filters.map((filter) => filter.field)].filter(Boolean)) {
    if (!analyticsFieldMap.has(path!)) throw new Error(`Unknown or restricted analytics field: ${path}`);
  }
}

function validateStatisticalFields(spec: StatisticalAnalysisSpec) {
  const paths = [spec.outcome, spec.predictor, ...spec.filters.map((filter) => filter.field)].filter(Boolean) as string[];
  for (const path of paths) {
    if (!analyticsFieldMap.has(path)) throw new Error(`Unknown or restricted analytics field: ${path}`);
  }

  const outcome = analyticsFieldMap.get(spec.outcome)!;
  const predictor = spec.predictor ? analyticsFieldMap.get(spec.predictor)! : undefined;
  if (predictor && spec.outcome === spec.predictor) {
    throw new Error("Outcome and predictor must be different fields.");
  }
  const numericOutcomeMethods = ["descriptive", "welch-t", "mann-whitney", "welch-anova", "kruskal-wallis"];
  if (numericOutcomeMethods.includes(spec.method) && outcome.dataType !== "numeric") {
    throw new Error(`${spec.method} requires a numeric outcome field.`);
  }
  if (["pearson", "spearman"].includes(spec.method)) {
    if (!predictor || outcome.dataType !== "numeric" || predictor.dataType !== "numeric") {
      throw new Error(`${spec.method} requires two numeric fields.`);
    }
  }
  if (["chi-square", "fisher-exact"].includes(spec.method)) {
    if (!predictor || outcome.dataType === "numeric" || predictor.dataType === "numeric") {
      throw new Error(`${spec.method} requires two categorical fields.`);
    }
  }
  if (["welch-t", "mann-whitney", "welch-anova", "kruskal-wallis"].includes(spec.method)) {
    if (!predictor || predictor.dataType === "numeric" || predictor.dataType === "date") {
      throw new Error(`${spec.method} requires a categorical grouping field.`);
    }
  }
  if (paths.some((path) => analyticsFieldMap.get(path)?.repeated) && spec.analysisUnit !== "event") {
    throw new Error("Repeated clinical fields require event-level analysis.");
  }
  if (spec.analysisUnit === "event" && !paths.some((path) => analyticsFieldMap.get(path)?.repeated)) {
    throw new Error("Event-level analysis requires at least one repeated clinical field.");
  }
}

function groupSummary(label: string, values: number[]): StatisticalGroupSummary {
  const stats = descriptiveStats(values);
  return {
    label,
    count: values.length,
    mean: stats.mean,
    median: stats.median,
    sd: stats.sd,
    q1: stats.q1,
    q3: stats.q3,
  };
}

function correlationInterval(correlation: number, count: number) {
  if (count <= 3 || Math.abs(correlation) >= 1) return null;
  const z = 0.5 * Math.log((1 + correlation) / (1 - correlation));
  const margin = 1.96 / Math.sqrt(count - 3);
  return {
    low: Math.tanh(z - margin),
    high: Math.tanh(z + margin),
    level: 0.95,
  };
}

function comparisonGroups(rows: any[], outcome: string, predictor: string) {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const group = valueAt(row, predictor);
    const value = numberValue(valueAt(row, outcome));
    if (!nonEmpty(group) || value === null) continue;
    const label = String(group);
    grouped.set(label, [...(grouped.get(label) || []), value]);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function analyzeStatisticalRows(
  spec: StatisticalAnalysisSpec,
  rows: any[],
  sampleSize = rows.length,
): StatisticalAnalysisResult {
  const warnings = ["Exploratory analysis only; results do not establish causation or replace clinical review."];
  const assumptions: string[] = ["Complete-case analysis; no missing-value imputation was performed."];
  let eligibleCount = 0;
  let statistic: number | null = null;
  let pValue: number | null = null;
  let estimate: number | null = null;
  let confidenceInterval: StatisticalAnalysisResult["confidenceInterval"] = null;
  let effectSize: number | null = null;
  let statisticName = "Not applicable";
  let estimateName = "Estimate";
  let effectSizeName: string | null = null;
  let method: string = spec.method;
  let groupSummaries: StatisticalGroupSummary[] = [];
  let contingency: StatisticalAnalysisResult["contingency"];

  if (spec.method === "descriptive") {
    const values = rows.map((row) => numberValue(valueAt(row, spec.outcome))).filter((value): value is number => value !== null);
    const stats = descriptiveStats(values);
    eligibleCount = values.length;
    estimate = stats.mean;
    estimateName = "Mean";
    confidenceInterval = stats.ciLow === null || stats.ciHigh === null
      ? null
      : { low: stats.ciLow, high: stats.ciHigh, level: 0.95 };
    groupSummaries = [groupSummary("All eligible observations", values)];
    method = "Descriptive statistics with normal-approximation 95% CI";
    assumptions.push("The confidence interval describes the mean and uses a normal approximation.");
  } else if (spec.method === "pearson" || spec.method === "spearman") {
    const pairs = rows
      .map((row) => [numberValue(valueAt(row, spec.predictor)), numberValue(valueAt(row, spec.outcome))] as const)
      .filter((pair): pair is [number, number] => pair[0] !== null && pair[1] !== null);
    const x = pairs.map((pair) => pair[0]);
    const y = pairs.map((pair) => pair[1]);
    const correlation = spec.method === "spearman" ? pearson(rank(x), rank(y)) : pearson(x, y);
    eligibleCount = pairs.length;
    statistic = correlation;
    statisticName = spec.method === "spearman" ? "Spearman rho" : "Pearson r";
    estimate = correlation;
    estimateName = statisticName;
    effectSize = correlation;
    effectSizeName = "Correlation coefficient";
    if (correlation !== null && pairs.length > 2) {
      const testStatistic = correlation * Math.sqrt((pairs.length - 2) / Math.max(1e-12, 1 - correlation ** 2));
      pValue = twoSidedNormalP(testStatistic);
      confidenceInterval = correlationInterval(correlation, pairs.length);
    }
    method = spec.method === "spearman" ? "Spearman rank correlation" : "Pearson product-moment correlation";
    assumptions.push(spec.method === "pearson"
      ? "Pearson correlation assumes an approximately linear relationship without influential outliers."
      : "Spearman correlation evaluates a monotonic relationship using ranked values.");
  } else if (spec.method === "chi-square" || spec.method === "fisher-exact") {
    const complete = rows.filter((row) => nonEmpty(valueAt(row, spec.outcome)) && nonEmpty(valueAt(row, spec.predictor)));
    const rowLabels = [...new Set(complete.map((row) => String(valueAt(row, spec.outcome))))].sort();
    const columnLabels = [...new Set(complete.map((row) => String(valueAt(row, spec.predictor))))].sort();
    const counts = rowLabels.map((rowLabel) => columnLabels.map((columnLabel) =>
      complete.filter((row) => String(valueAt(row, spec.outcome)) === rowLabel && String(valueAt(row, spec.predictor)) === columnLabel).length,
    ));
    if (rowLabels.length < 2 || columnLabels.length < 2) throw new Error("Categorical comparison requires at least two observed categories in each field.");
    if (spec.method === "fisher-exact" && (rowLabels.length !== 2 || columnLabels.length !== 2)) {
      throw new Error("Fisher exact test currently requires a 2x2 table.");
    }
    const chi = chiSquare(counts);
    eligibleCount = complete.length;
    statistic = spec.method === "fisher-exact" ? null : chi.statistic;
    statisticName = spec.method === "fisher-exact" ? "Exact test" : "Chi-square";
    pValue = spec.method === "fisher-exact" ? fisherExact(counts) : chi.p;
    const minDimension = Math.min(rowLabels.length - 1, columnLabels.length - 1);
    effectSize = minDimension > 0 ? Math.sqrt(chi.statistic / (complete.length * minDimension)) : null;
    effectSizeName = "Cramer's V";
    contingency = { rowLabels, columnLabels, counts };
    method = spec.method === "fisher-exact" ? "Fisher exact test (two-sided)" : "Pearson chi-square test";
    assumptions.push(spec.method === "chi-square"
      ? "Chi-square inference assumes independent observations and adequate expected cell counts."
      : "Fisher exact inference is calculated for a 2x2 contingency table.");
    const rowTotals = counts.map((row) => row.reduce((sum, value) => sum + value, 0));
    const columnTotals = counts[0].map((_, index) => counts.reduce((sum, row) => sum + row[index], 0));
    if (counts.some((row, rowIndex) => row.some((_, columnIndex) =>
      rowTotals[rowIndex] * columnTotals[columnIndex] / complete.length < 5,
    ))) warnings.push("One or more expected cell counts are below five; consider Fisher exact testing for a 2x2 table.");
  } else {
    const groups = comparisonGroups(rows, spec.outcome, spec.predictor!);
    const values = groups.map(([, groupValues]) => groupValues);
    eligibleCount = values.flat().length;
    groupSummaries = groups.map(([label, groupValues]) => groupSummary(label, groupValues));
    if (["welch-t", "mann-whitney"].includes(spec.method) && groups.length !== 2) {
      throw new Error(`${spec.method} requires exactly two observed groups.`);
    }
    if (groups.length < 2) throw new Error(`${spec.method} requires at least two observed groups.`);

    if (spec.method === "welch-t") {
      const result = welchT(values);
      if (!result) throw new Error("Welch t-test requires at least two complete observations in each group.");
      const stats = values.map(descriptiveStats);
      const standardError = Math.sqrt((Number(stats[0].sd) ** 2 / values[0].length) + (Number(stats[1].sd) ** 2 / values[1].length));
      const difference = Number(stats[0].mean) - Number(stats[1].mean);
      const pooledVariance = (
        (values[0].length - 1) * Number(stats[0].sd) ** 2
        + (values[1].length - 1) * Number(stats[1].sd) ** 2
      ) / Math.max(1, values[0].length + values[1].length - 2);
      statistic = result.statistic;
      statisticName = "Welch t";
      pValue = result.p;
      estimate = difference;
      estimateName = `Mean difference (${groups[0][0]} - ${groups[1][0]})`;
      confidenceInterval = { low: difference - 1.96 * standardError, high: difference + 1.96 * standardError, level: 0.95 };
      effectSize = pooledVariance > 0 ? difference / Math.sqrt(pooledVariance) : null;
      effectSizeName = "Cohen's d";
      method = "Welch two-sample t-test (normal p-value approximation)";
      assumptions.push("Welch testing assumes independent observations and approximately normal group means.");
    } else if (spec.method === "mann-whitney") {
      const result = mannWhitney(values);
      if (!result) throw new Error("Mann-Whitney testing requires complete observations in both groups.");
      statistic = result.statistic;
      statisticName = "Mann-Whitney U";
      pValue = result.p;
      estimate = Number(descriptiveStats(values[0]).median) - Number(descriptiveStats(values[1]).median);
      estimateName = `Median difference (${groups[0][0]} - ${groups[1][0]})`;
      effectSize = 1 - (2 * result.statistic) / (values[0].length * values[1].length);
      effectSizeName = "Rank-biserial correlation";
      method = "Mann-Whitney U test (normal approximation)";
      assumptions.push("Mann-Whitney testing assumes independent observations and similarly shaped group distributions for location interpretation.");
    } else if (spec.method === "welch-anova") {
      const result = welchAnova(values);
      if (!result) throw new Error("Welch ANOVA requires at least two complete observations in every group.");
      const allValues = values.flat();
      const grandMean = allValues.reduce((sum, value) => sum + value, 0) / allValues.length;
      const between = values.reduce((sum, group, index) =>
        sum + group.length * (Number(descriptiveStats(group).mean) - grandMean) ** 2, 0);
      const total = allValues.reduce((sum, value) => sum + (value - grandMean) ** 2, 0);
      statistic = result.statistic;
      statisticName = "Welch F";
      pValue = result.p;
      effectSize = total > 0 ? between / total : null;
      effectSizeName = "Eta-squared";
      method = "Welch-style one-way ANOVA approximation";
      assumptions.push("Welch ANOVA assumes independent observations and approximately normal outcomes within groups.");
    } else {
      const result = kruskalWallis(values);
      if (!result) throw new Error("Kruskal-Wallis testing requires complete observations in every group.");
      statistic = result.statistic;
      statisticName = "Kruskal-Wallis H";
      pValue = result.p;
      effectSize = eligibleCount > groups.length
        ? Math.max(0, (result.statistic - groups.length + 1) / (eligibleCount - groups.length))
        : null;
      effectSizeName = "Epsilon-squared";
      method = "Kruskal-Wallis rank test";
      assumptions.push("Kruskal-Wallis testing assumes independent observations and similarly shaped group distributions for location interpretation.");
    }
  }

  const missingCount = Math.max(0, rows.length - eligibleCount);
  if (eligibleCount < 5) warnings.push("Low sample size: results may be unstable and potentially identifiable.");
  if (pValue !== null && pValue < 0.05) {
    warnings.push("A small p-value is not evidence of clinical importance and does not correct for multiple testing.");
  }

  return {
    spec,
    sampleSize,
    eligibleCount,
    missingCount,
    method,
    statisticName,
    statistic,
    pValue,
    estimateName,
    estimate,
    confidenceInterval,
    effectSizeName,
    effectSize,
    groupSummaries,
    contingency,
    assumptions,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

export async function runAdvancedStatistics(input: unknown, userId?: string): Promise<StatisticalAnalysisResult> {
  const spec = statisticalAnalysisSchema.parse(input);
  validateStatisticalFields(spec);
  const patients = await loadPatientSnapshot(userId);
  const rows = patients.flatMap((patient) => statisticalEventRows(patient, spec)).filter((row) => {
    if (spec.dateFrom || spec.dateTo) {
      const date = dateValue(row.updatedAt || row.date);
      if (date === null) return false;
      if (spec.dateFrom && date < new Date(spec.dateFrom).getTime()) return false;
      if (spec.dateTo && date > new Date(spec.dateTo).getTime() + 86399999) return false;
    }
    return spec.filters.every((filter) => passesFilter(row, filter));
  });
  return analyzeStatisticalRows(spec, rows, patients.length);
}

export async function runAnalyticsQuery(input: unknown, userId?: string): Promise<AnalyticsResult> {
  const spec = chartSpecSchema.parse(input);
  validateFields(spec);
  const version = await analyticsVersion();
  const cacheKey = crypto.createHash("sha256").update(JSON.stringify({ spec, version })).digest("hex");
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.result;

  const patients = await loadPatientSnapshot(userId);
  const scoped = spec.scope === "patient" ? patients.filter((patient) => patient.id === spec.patientId) : patients;
  const rows = scoped.flatMap((patient) => eventRows(patient, spec)).filter((row) => {
    if (spec.dateFrom || spec.dateTo) {
      const date = dateValue(row.updatedAt || row.date);
      if (date === null) return false;
      if (spec.dateFrom && date < new Date(spec.dateFrom).getTime()) return false;
      if (spec.dateTo && date > new Date(spec.dateTo).getTime() + 86399999) return false;
    }
    return spec.filters.every((filter) => passesFilter(row, filter));
  });

  const warnings: string[] = [];
  if (rows.length < 5) warnings.push("Low sample size: results may be unstable and potentially identifiable.");
  if (spec.statistic !== "none" && spec.statistic !== "descriptive") warnings.push("Inferential output is exploratory and does not establish causation.");

  if (spec.chartType === "kaplan-meier") {
    const series = kaplanMeier(scoped, spec.measure.includes("progression") ? "progression" : "overall");
    const median = series.find((point) => point.value <= 0.5)?.label ?? null;
    const result: AnalyticsResult = {
      spec,
      sampleSize: scoped.length,
      eligibleCount: series.length ? scoped.length : 0,
      missingCount: series.length ? 0 : scoped.length,
      warnings,
      series,
      summary: { medianSurvivalMonths: median, confidenceLevel: "95%" },
      method: "Kaplan-Meier with Greenwood 95% confidence interval",
      generatedAt: new Date().toISOString(),
    };
    resultCache.set(cacheKey, { expires: Date.now() + 5 * 60_000, result });
    return result;
  }

  const dimensionField = spec.dimension ? analyticsFieldMap.get(spec.dimension) : undefined;
  const measureField = analyticsFieldMap.get(spec.measure);

  if (spec.chartType === "histogram") {
    const numericPath = dimensionField?.dataType === "numeric" ? spec.dimension : spec.measure;
    const values = rows.map((row) => numberValue(valueAt(row, numericPath))).filter((value): value is number => value !== null);
    const stats = descriptiveStats(values);
    const binCount = Math.max(4, Math.min(15, Math.ceil(Math.sqrt(values.length || 1))));
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const width = max > min ? (max - min) / binCount : 1;
    const series = Array.from({ length: binCount }, (_, index) => {
      const lower = min + index * width;
      const upper = index === binCount - 1 ? max : lower + width;
      return {
        label: `${lower.toFixed(1)}-${upper.toFixed(1)}`,
        value: values.filter((value) => value >= lower && (index === binCount - 1 ? value <= upper : value < upper)).length,
      };
    });
    const result: AnalyticsResult = {
      spec,
      sampleSize: scoped.length,
      eligibleCount: values.length,
      missingCount: rows.length - values.length,
      warnings,
      series,
      rows: series,
      summary: stats,
      method: "Histogram with square-root bin selection and descriptive statistics",
      generatedAt: new Date().toISOString(),
    };
    resultCache.set(cacheKey, { expires: Date.now() + 5 * 60_000, result });
    return result;
  }

  let missingCount = 0;
  const grouped = new Map<string, { label: string; group?: string; values: number[]; raw: any[] }>();

  for (const row of rows) {
    const rawDimension = spec.dimension ? valueAt(row, spec.dimension) : "All patients";
    const rawMeasure = valueAt(row, spec.measure);
    if (spec.dimension && !nonEmpty(rawDimension)) {
      missingCount++;
      continue;
    }
    const labels = Array.isArray(rawDimension) ? rawDimension : [rawDimension];
    for (const rawLabel of labels) {
      const label = String(rawLabel ?? "Unknown");
      const group = spec.groupBy ? String(valueAt(row, spec.groupBy) || "Unknown") : undefined;
      const key = `${label}\u0000${group || ""}`;
      const entry = grouped.get(key) || { label, group, values: [], raw: [] };
      const numeric = spec.measure === "patient.count" ? 1 : numberValue(rawMeasure);
      if (numeric !== null) entry.values.push(numeric);
      entry.raw.push(row);
      grouped.set(key, entry);
    }
  }

  let series: AnalyticsPoint[] = [...grouped.values()].map((entry) => ({
    label: entry.label,
    group: entry.group,
    value: aggregateValue(entry.values, spec.aggregation),
  }));
  if (spec.aggregation === "percentage") {
    const total = series.reduce((sum, point) => sum + point.value, 0) || 1;
    series = series.map((point) => ({ ...point, value: point.value / total * 100 }));
  }

  const direction = spec.sort.endsWith("desc") ? -1 : 1;
  const byValue = spec.sort.startsWith("value");
  series.sort((a, b) => direction * (byValue ? a.value - b.value : a.label.localeCompare(b.label)));
  series = series.slice(0, spec.limit);

  const numericValues = rows.map((row) => numberValue(valueAt(row, spec.measure))).filter((value): value is number => value !== null);
  const summary: Record<string, number | string | null> = { ...descriptiveStats(numericValues) };
  let method = spec.statistic === "none" ? "Aggregation only" : "Descriptive statistics with normal-approximation 95% CI";
  if ((spec.statistic === "pearson" || spec.statistic === "spearman") && dimensionField?.dataType === "numeric" && measureField?.dataType === "numeric") {
    const pairs = rows.map((row) => [numberValue(valueAt(row, spec.dimension)), numberValue(valueAt(row, spec.measure))] as const)
      .filter((pair): pair is [number, number] => pair[0] !== null && pair[1] !== null);
    const x = pairs.map((pair) => pair[0]);
    const y = pairs.map((pair) => pair[1]);
    summary.correlation = spec.statistic === "spearman" ? pearson(rank(x), rank(y)) : pearson(x, y);
    method = spec.statistic === "spearman" ? "Spearman rank correlation" : "Pearson correlation";
  }
  if (["chi-square", "fisher-exact"].includes(spec.statistic) && spec.dimension && spec.groupBy) {
    const rowLabels = [...new Set(rows.map((row) => String(valueAt(row, spec.dimension) || "Unknown")))];
    const columnLabels = [...new Set(rows.map((row) => String(valueAt(row, spec.groupBy) || "Unknown")))];
    const table = rowLabels.map((rowLabel) => columnLabels.map((columnLabel) =>
      rows.filter((row) => String(valueAt(row, spec.dimension)) === rowLabel && String(valueAt(row, spec.groupBy)) === columnLabel).length,
    ));
    const chi = chiSquare(table);
    const fisher = spec.statistic === "fisher-exact" ? fisherExact(table) : null;
    summary.testStatistic = chi.statistic;
    summary.degreesOfFreedom = chi.df;
    summary.pValue = fisher ?? chi.p;
    method = fisher !== null ? "Fisher exact test (two-sided)" : "Pearson chi-square test";
  }
  if (["welch-t", "mann-whitney", "welch-anova", "kruskal-wallis"].includes(spec.statistic) && spec.groupBy) {
    const groupedValues = new Map<string, number[]>();
    for (const row of rows) {
      const group = String(valueAt(row, spec.groupBy) || "Unknown");
      const value = numberValue(valueAt(row, spec.measure));
      if (value === null) continue;
      groupedValues.set(group, [...(groupedValues.get(group) || []), value]);
    }
    const groups = [...groupedValues.values()];
    const comparison = spec.statistic === "welch-t"
      ? welchT(groups)
      : spec.statistic === "mann-whitney"
        ? mannWhitney(groups)
        : spec.statistic === "welch-anova"
          ? welchAnova(groups)
          : kruskalWallis(groups);
    if (comparison) {
      summary.testStatistic = comparison.statistic;
      summary.pValue = comparison.p;
    }
    method = {
      "welch-t": "Welch two-sample t-test (normal approximation)",
      "mann-whitney": "Mann-Whitney U test (normal approximation)",
      "welch-anova": "Welch-style one-way ANOVA approximation",
      "kruskal-wallis": "Kruskal-Wallis rank test",
    }[spec.statistic] || method;
  }

  const result: AnalyticsResult = {
    spec,
    sampleSize: scoped.length,
    eligibleCount: rows.length - missingCount,
    missingCount,
    warnings,
    series,
    rows: series.map((point) => ({ label: point.label, group: point.group || "", value: point.value })),
    summary,
    method,
    generatedAt: new Date().toISOString(),
  };
  resultCache.set(cacheKey, { expires: Date.now() + 5 * 60_000, result });
  return result;
}

export function getAnalyticsCatalog() {
  return analyticsCatalog;
}

export async function bumpAnalyticsVersion() {
  const current = await getFirestoreDoc("system", "analytics");
  const version = Number(current?.version || 0) + 1;
  await saveDocument("system", "analytics", { version, updatedAt: new Date().toISOString() });
  resultCache.clear();
  patientSnapshotCache = null;
  versionCache = { expires: Date.now() + 60_000, version };
}

export async function listDashboards(uid: string): Promise<AnalyticsDashboard[]> {
  return (await listCollection(`users/${uid}/analyticsDashboards`)) as AnalyticsDashboard[];
}

export async function saveDashboard(uid: string, input: unknown): Promise<AnalyticsDashboard> {
  const dashboard = dashboardSchema.parse(input);
  const now = new Date().toISOString();
  return await saveDocument(`users/${uid}/analyticsDashboards`, dashboard.id, {
    ...dashboard,
    ownerUid: uid,
    createdAt: dashboard.createdAt || now,
    updatedAt: now,
  }) as AnalyticsDashboard;
}

export async function removeDashboard(uid: string, id: string) {
  await deleteDocument(`users/${uid}/analyticsDashboards`, id);
}
