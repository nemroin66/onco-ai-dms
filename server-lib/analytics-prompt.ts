import { GoogleGenAI } from "@google/genai";
import { analyticsCatalog, analyticsFieldMap } from "../src/analytics/catalog.js";
import {
  chartSpecSchema,
  statisticalAnalysisSchema,
  type ChartSpec,
  type StatisticalAnalysisSpec,
  type StatisticalMethod,
} from "../src/analytics/types.js";

function fallbackSpec(prompt: string): ChartSpec {
  const text = prompt.toLowerCase();
  const field = analyticsCatalog.find((candidate) =>
    candidate.allowedAsDimension
    && candidate.label.toLowerCase().split(" · ").some((part) => text.includes(part.toLowerCase())),
  ) || analyticsFieldMap.get("oncology") || analyticsCatalog.find((candidate) => candidate.allowedAsDimension)!;
  const chartType = text.includes("survival")
    ? "kaplan-meier"
    : text.includes("trend") || text.includes("over time")
      ? "line"
      : text.includes("percentage") || text.includes("proportion")
        ? "donut"
        : "bar";
  return chartSpecSchema.parse({
    id: crypto.randomUUID(),
    title: prompt.trim().slice(0, 100) || "AI-generated analysis",
    chartType,
    dimension: chartType === "kaplan-meier" ? undefined : field.path,
    measure: chartType === "kaplan-meier" ? "patient.count" : "patient.count",
    aggregation: text.includes("percentage") ? "percentage" : "count",
  });
}

export async function generateAnalyticsSpec(prompt: string) {
  if (!prompt.trim()) throw new Error("Describe the analysis you want.");
  const key = process.env.GEMINI_API_KEY_PRIMARY || process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_SECONDARY;
  if (!key) return { spec: fallbackSpec(prompt), source: "rules" };

  const compactCatalog = analyticsCatalog.map((field) => ({
    path: field.path,
    label: field.label,
    type: field.dataType,
    repeated: field.repeated,
    dimension: field.allowedAsDimension,
    measure: field.allowedAsMeasure,
  }));
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL_PRIMARY || "gemini-2.5-flash-lite",
      contents: [{
        role: "user",
        parts: [{
          text: `Convert the request into one JSON ChartSpec. Use only catalog paths. Do not include prose or markdown.
Request: ${prompt}
Catalog: ${JSON.stringify(compactCatalog)}
Allowed chartType: kpi, table, bar, stacked-bar, line, area, donut, histogram, box-plot, scatter, heatmap, funnel, timeline, kaplan-meier.
Required keys: id, title, scope, chartType, analysisUnit, measure, aggregation, filters, statistic, sort, limit, color, layout.
For survival use chartType kaplan-meier and measure patient.count.`,
        }],
      }],
    });
    const raw = String(response.text || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = chartSpecSchema.parse(JSON.parse(raw));
    for (const path of [parsed.dimension, parsed.measure, parsed.groupBy].filter(Boolean)) {
      if (!analyticsFieldMap.has(path!)) throw new Error(`Unknown field ${path}`);
    }
    return { spec: parsed, source: "gemini" };
  } catch (error: any) {
    const reason = String(error?.message || "").includes("429") ? "Gemini quota unavailable" : "Gemini response unavailable";
    return { spec: fallbackSpec(prompt), source: "rules", warning: `${reason}; safe catalog-based fallback generated.` };
  }
}

function promptScore(prompt: string, field: (typeof analyticsCatalog)[number]) {
  const text = ` ${prompt.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const leaf = field.path.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const labelLeaf = field.label.split("·").pop()!.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const terms = `${field.path} ${field.label}`
    .toLowerCase()
    .replace(/[._·/-]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2);
  const exactScore = [leaf, labelLeaf].reduce(
    (score, term) => score + (term && text.includes(` ${term} `) ? 100 + term.length : 0),
    0,
  );
  const optionScore = (field.options || []).reduce((score, option) => {
    const normalized = option.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return score + (normalized && text.includes(` ${normalized} `) ? 80 + normalized.length : 0);
  }, 0);
  return exactScore + optionScore
    + terms.reduce((score, term) => score + (text.includes(` ${term} `) ? term.length : 0), 0);
}

function matchedOptionCount(prompt: string, field?: (typeof analyticsCatalog)[number]) {
  const text = ` ${prompt.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  return (field?.options || []).filter((option) => {
    const normalized = option.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return normalized && text.includes(` ${normalized} `);
  }).length;
}

function bestPromptField(
  prompt: string,
  predicate: (field: (typeof analyticsCatalog)[number]) => boolean,
  excluded = new Set<string>(),
) {
  const excludedLeaves = new Set([...excluded].map((path) => path.split(".").pop()));
  return analyticsCatalog
    .filter((field) =>
      predicate(field)
      && !excluded.has(field.path)
      && !excludedLeaves.has(field.path.split(".").pop()),
    )
    .map((field) => ({ field, score: promptScore(prompt, field) }))
    .sort((a, b) =>
      b.score - a.score
      || Number(a.field.repeated) - Number(b.field.repeated)
      || a.field.label.localeCompare(b.field.label),
    )[0];
}

export function inferStatisticalSpec(prompt: string): StatisticalAnalysisSpec {
  const text = prompt.toLowerCase();
  const mentionedNumeric = bestPromptField(prompt, (field) =>
    field.dataType === "numeric" && field.path !== "patient.count",
  );
  const firstCategorical = bestPromptField(prompt, (field) =>
    field.allowedAsDimension && ["categorical", "boolean"].includes(field.dataType),
  );
  const secondCategorical = bestPromptField(
    prompt,
    (field) => field.allowedAsDimension && ["categorical", "boolean"].includes(field.dataType),
    new Set(firstCategorical?.field ? [firstCategorical.field.path] : []),
  );
  const secondNumeric = bestPromptField(
    prompt,
    (field) => field.dataType === "numeric" && field.path !== "patient.count",
    new Set(mentionedNumeric?.field ? [mentionedNumeric.field.path] : []),
  );

  let method: StatisticalMethod = "descriptive";
  if (text.includes("pearson")) method = "pearson";
  else if (text.includes("spearman") || text.includes("correlat")) method = "spearman";
  else if (text.includes("fisher") || text.includes("exact test")) method = "fisher-exact";
  else if (text.includes("chi-square") || text.includes("chi square") || text.includes("categorical association")) method = "chi-square";
  else if (text.includes("anova")) method = "welch-anova";
  else if (text.includes("kruskal")) method = "kruskal-wallis";
  else if (text.includes("mann") || text.includes("rank-sum") || text.includes("rank sum")) method = "mann-whitney";
  else if (text.includes("t-test") || text.includes("t test") || text.includes("compare mean")) method = "welch-t";
  else if (text.includes("relationship") || text.includes("associat") || text.includes("related")) {
    method = firstCategorical?.score && secondCategorical?.score && !mentionedNumeric?.score
      ? "chi-square"
      : "spearman";
  } else if (text.includes("compare") || text.includes("difference") || text.includes("differ") || text.includes("between groups")) {
    const mentionedGroups = matchedOptionCount(prompt, firstCategorical?.field);
    method = mentionedGroups === 2 || (firstCategorical?.field.options?.length || 0) === 2
      ? "mann-whitney"
      : "kruskal-wallis";
  }

  let outcome = mentionedNumeric?.field.path || "";
  let predictor: string | undefined;
  if (["pearson", "spearman"].includes(method)) {
    if (!mentionedNumeric?.score || !secondNumeric?.score) {
      throw new Error("Could not identify two numeric fields. Name both variables in the request.");
    }
    predictor = secondNumeric.field.path;
  } else if (["chi-square", "fisher-exact"].includes(method)) {
    if (!firstCategorical?.score || !secondCategorical?.score) {
      throw new Error("Could not identify two categorical fields. Name both variables in the request.");
    }
    outcome = firstCategorical.field.path;
    predictor = secondCategorical.field.path;
  } else if (["welch-t", "mann-whitney", "welch-anova", "kruskal-wallis"].includes(method)) {
    if (!mentionedNumeric?.score || !firstCategorical?.score) {
      throw new Error("Could not identify numeric outcome and grouping field. Name both variables in the request.");
    }
    predictor = firstCategorical.field.path;
  } else if (!mentionedNumeric?.score) {
    throw new Error("Could not identify numeric outcome. Name the variable to summarize.");
  }

  const selectedFields = [outcome, predictor]
    .filter(Boolean)
    .map((path) => analyticsFieldMap.get(path!));
  return statisticalAnalysisSchema.parse({
    title: prompt.trim().slice(0, 120) || "AI-configured statistical analysis",
    method,
    analysisUnit: selectedFields.some((field) => field?.repeated) ? "event" : "patient",
    outcome,
    predictor,
    filters: [],
  });
}

export async function generateStatisticalSpec(prompt: string) {
  if (!prompt.trim()) throw new Error("Describe the statistical analysis you want.");
  const key = process.env.GEMINI_API_KEY_PRIMARY || process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_SECONDARY;
  if (!key) return { spec: inferStatisticalSpec(prompt), source: "rules" };

  const compactCatalog = analyticsCatalog.map((field) => ({
    path: field.path,
    label: field.label,
    type: field.dataType,
    repeated: field.repeated,
    options: field.options?.slice(0, 30),
  }));
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL_PRIMARY || "gemini-2.5-flash-lite",
      contents: [{
        role: "user",
        parts: [{
          text: `Configure one supported statistical analysis from this clinician request.
Return only JSON. Never calculate results. Never invent fields. Use only catalog paths.
Request: ${prompt}
Catalog: ${JSON.stringify(compactCatalog)}
Allowed methods: descriptive, pearson, spearman, chi-square, fisher-exact, welch-t, mann-whitney, welch-anova, kruskal-wallis.
Rules:
- descriptive: numeric outcome, no predictor.
- pearson/spearman: numeric outcome and numeric predictor.
- chi-square/fisher-exact: categorical outcome and categorical predictor. Fisher only when request clearly implies 2x2/exact.
- welch-t/mann-whitney: numeric outcome and categorical predictor expected to have two groups.
- welch-anova/kruskal-wallis: numeric outcome and categorical predictor with two or more groups.
- Default correlation to spearman, two-group comparison to mann-whitney, and multi-group comparison to kruskal-wallis unless user requests parametric methods.
- analysisUnit must be event when either selected field is repeated; otherwise patient.
Required JSON keys: title, method, analysisUnit, outcome, filters. Add predictor for every method except descriptive.`,
        }],
      }],
    });
    const raw = String(response.text || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = statisticalAnalysisSchema.parse(JSON.parse(raw));
    for (const path of [parsed.outcome, parsed.predictor, ...parsed.filters.map((filter) => filter.field)].filter(Boolean)) {
      if (!analyticsFieldMap.has(path!)) throw new Error(`Unknown field ${path}`);
    }
    return { spec: parsed, source: "gemini" };
  } catch (error: any) {
    const reason = String(error?.message || "").includes("429") ? "Gemini quota unavailable" : "Gemini plan unavailable";
    return {
      spec: inferStatisticalSpec(prompt),
      source: "rules",
      warning: `${reason}; safe catalog-based fallback used.`,
    };
  }
}
