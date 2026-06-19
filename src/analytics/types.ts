import { z } from "zod";

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

export const filterSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["eq", "neq", "in", "contains", "gt", "gte", "lt", "lte", "between", "exists"]),
  value: z.unknown().optional(),
});

export const chartSpecSchema = z.object({
  id: z.string().min(1).default(() => crypto.randomUUID()),
  title: z.string().min(1).max(120),
  scope: z.enum(["cohort", "patient"]).default("cohort"),
  patientId: z.string().optional(),
  chartType: z.enum(chartTypes),
  analysisUnit: z.enum(["patient", "event"]).default("patient"),
  dimension: z.string().optional(),
  measure: z.string().default("patient.count"),
  aggregation: z.enum(["count", "sum", "mean", "median", "min", "max", "percentage"]).default("count"),
  groupBy: z.string().optional(),
  filters: z.array(filterSchema).default([]),
  statistic: z.enum([
    "none",
    "descriptive",
    "pearson",
    "spearman",
    "chi-square",
    "fisher-exact",
    "welch-t",
    "mann-whitney",
    "welch-anova",
    "kruskal-wallis",
    "log-rank",
  ]).default("descriptive"),
  sort: z.enum(["label-asc", "label-desc", "value-asc", "value-desc"]).default("value-desc"),
  limit: z.number().int().min(1).max(100).default(30),
  color: z.string().default("#16a34a"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  layout: z.object({
    x: z.number().int().min(0).default(0),
    y: z.number().int().min(0).default(0),
    w: z.number().int().min(2).max(12).default(6),
    h: z.number().int().min(2).max(12).default(5),
  }).default({ x: 0, y: 0, w: 6, h: 5 }),
});

export const dashboardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(240).default(""),
  charts: z.array(chartSpecSchema).max(24),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const statisticalAnalysisSchema = z.object({
  title: z.string().min(1).max(120).default("Advanced statistical analysis"),
  method: z.enum(statisticalMethods),
  analysisUnit: z.enum(["patient", "event"]).default("patient"),
  outcome: z.string().min(1),
  predictor: z.string().optional(),
  filters: z.array(filterSchema).default([]),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type ChartType = typeof chartTypes[number];
export type ChartSpec = z.infer<typeof chartSpecSchema>;
export type AnalyticsDashboard = z.infer<typeof dashboardSchema>;
export type StatisticalMethod = typeof statisticalMethods[number];
export type StatisticalAnalysisSpec = z.infer<typeof statisticalAnalysisSchema>;

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
