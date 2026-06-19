import { z } from "zod";
import {
  chartTypes,
  statisticalMethods,
  type AnalyticsDashboard,
  type AnalyticsFilter,
  type ChartSpec,
  type StatisticalAnalysisSpec,
} from "./types.js";

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

filterSchema satisfies z.ZodType<AnalyticsFilter>;
chartSpecSchema satisfies z.ZodType<ChartSpec>;
dashboardSchema satisfies z.ZodType<AnalyticsDashboard>;
statisticalAnalysisSchema satisfies z.ZodType<StatisticalAnalysisSpec>;
