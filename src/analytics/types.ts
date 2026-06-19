export const chartTypes = [
  "kpi",
  "table",
  "bar",
  "stacked-bar",
  "line",
  "area",
  "donut",
  "histogram",
  "box-plot",
  "scatter",
  "heatmap",
  "funnel",
  "timeline",
  "kaplan-meier",
] as const;

export const dataTypes = ["categorical", "numeric", "date", "boolean"] as const;
export const statisticalMethods = [
  "descriptive",
  "pearson",
  "spearman",
  "chi-square",
  "fisher-exact",
  "welch-t",
  "mann-whitney",
  "welch-anova",
  "kruskal-wallis",
] as const;

export type ChartType = typeof chartTypes[number];
export type StatisticalMethod = typeof statisticalMethods[number];

export interface AnalyticsFilter {
  field: string;
  operator: "eq" | "neq" | "in" | "contains" | "gt" | "gte" | "lt" | "lte" | "between" | "exists";
  value?: unknown;
}

export interface ChartSpec {
  id: string;
  title: string;
  scope: "cohort" | "patient";
  patientId?: string;
  chartType: ChartType;
  analysisUnit: "patient" | "event";
  dimension?: string;
  measure: string;
  aggregation: "count" | "sum" | "mean" | "median" | "min" | "max" | "percentage";
  groupBy?: string;
  filters: AnalyticsFilter[];
  statistic: StatisticalMethod | "none" | "log-rank";
  sort: "label-asc" | "label-desc" | "value-asc" | "value-desc";
  limit: number;
  color: string;
  dateFrom?: string;
  dateTo?: string;
  layout: { x: number; y: number; w: number; h: number };
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  description: string;
  charts: ChartSpec[];
  createdAt?: string;
  updatedAt?: string;
}

export interface StatisticalAnalysisSpec {
  title: string;
  method: StatisticalMethod;
  analysisUnit: "patient" | "event";
  outcome: string;
  predictor?: string;
  filters: AnalyticsFilter[];
  dateFrom?: string;
  dateTo?: string;
}

export interface AnalyticsField {
  path: string;
  label: string;
  section: string;
  dataType: typeof dataTypes[number];
  repeated: boolean;
  eventRoot?: string;
  allowedAsDimension: boolean;
  allowedAsMeasure: boolean;
  options?: string[];
}

export interface AnalyticsPoint {
  label: string;
  value: number;
  group?: string;
  lower?: number;
  upper?: number;
  atRisk?: number;
  censored?: number;
}

export interface AnalyticsResult {
  spec: ChartSpec;
  sampleSize: number;
  eligibleCount: number;
  missingCount: number;
  warnings: string[];
  series: AnalyticsPoint[];
  rows?: Record<string, string | number>[];
  summary: Record<string, number | string | null>;
  method: string;
  generatedAt: string;
}

export interface StatisticalGroupSummary {
  label: string;
  count: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  q1: number | null;
  q3: number | null;
}

export interface StatisticalAnalysisResult {
  spec: StatisticalAnalysisSpec;
  sampleSize: number;
  eligibleCount: number;
  missingCount: number;
  method: string;
  statisticName: string;
  statistic: number | null;
  pValue: number | null;
  estimateName: string;
  estimate: number | null;
  confidenceInterval: { low: number; high: number; level: number } | null;
  effectSizeName: string | null;
  effectSize: number | null;
  groupSummaries: StatisticalGroupSummary[];
  contingency?: {
    rowLabels: string[];
    columnLabels: string[];
    counts: number[][];
  };
  assumptions: string[];
  warnings: string[];
  generatedAt: string;
}
