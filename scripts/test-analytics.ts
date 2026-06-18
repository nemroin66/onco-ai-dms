import assert from "node:assert/strict";
import { analyticsCatalog } from "../src/analytics/catalog.js";
import { chartSpecSchema, statisticalAnalysisSchema } from "../src/analytics/types.js";
import { analyzeStatisticalRows, descriptiveStats, kaplanMeier } from "../server-lib/analytics.js";
import { inferStatisticalSpec } from "../server-lib/analytics-prompt.js";

const stats = descriptiveStats([1, 2, 3, 4, 5]);
assert.equal(stats.count, 5);
assert.equal(stats.mean, 3);
assert.equal(stats.median, 3);
assert.equal(stats.min, 1);
assert.equal(stats.max, 5);
assert.ok(Number(stats.ciLow) < 3);
assert.ok(Number(stats.ciHigh) > 3);

assert.ok(analyticsCatalog.some((field) => field.path === "patient.count"));
assert.ok(analyticsCatalog.some((field) => field.path === "oncology"));
assert.ok(analyticsCatalog.some((field) => field.path === "treatmentOutcomeTable.overall_response"));
assert.ok(!analyticsCatalog.some((field) => field.path === "first_name"));
assert.ok(!analyticsCatalog.some((field) => field.path === "nic"));

const spec = chartSpecSchema.parse({
  id: "chart_test",
  title: "Oncology distribution",
  chartType: "bar",
  dimension: "oncology",
});
assert.equal(spec.analysisUnit, "patient");
assert.equal(spec.measure, "patient.count");

const km = kaplanMeier([
  {
    date: "2024-01-01",
    updatedAt: "2025-01-01",
    oncologicalOutcomeTable: [{ survival_status: "Deceased", survival_date: "2024-07-01" }],
  },
  {
    date: "2024-01-01",
    updatedAt: "2025-01-01",
    oncologicalOutcomeTable: [{ survival_status: "Alive", assessment_date: "2025-01-01" }],
  },
]);
assert.equal(km[0].value, 1);
assert.ok(km.some((point) => point.value === 0.5));

const descriptiveSpec = statisticalAnalysisSchema.parse({
  title: "Age summary",
  method: "descriptive",
  outcome: "age",
});
const descriptiveResult = analyzeStatisticalRows(descriptiveSpec, [{ age: 30 }, { age: 40 }, { age: "" }]);
assert.equal(descriptiveResult.eligibleCount, 2);
assert.equal(descriptiveResult.missingCount, 1);
assert.equal(descriptiveResult.estimate, 35);

const welchSpec = statisticalAnalysisSchema.parse({
  title: "Age by gender",
  method: "welch-t",
  outcome: "age",
  predictor: "gender",
});
const welchResult = analyzeStatisticalRows(welchSpec, [
  { age: 20, gender: "Female" },
  { age: 22, gender: "Female" },
  { age: 40, gender: "Male" },
  { age: 42, gender: "Male" },
]);
assert.equal(welchResult.groupSummaries.length, 2);
assert.equal(welchResult.eligibleCount, 4);
assert.equal(welchResult.effectSizeName, "Cohen's d");
assert.ok(Number(welchResult.pValue) < 0.05);

const categoricalSpec = statisticalAnalysisSchema.parse({
  title: "Status by gender",
  method: "fisher-exact",
  outcome: "status",
  predictor: "gender",
});
const categoricalResult = analyzeStatisticalRows(categoricalSpec, [
  { status: "Active", gender: "Female" },
  { status: "Active", gender: "Female" },
  { status: "Inactive", gender: "Female" },
  { status: "Active", gender: "Male" },
  { status: "Inactive", gender: "Male" },
  { status: "Inactive", gender: "Male" },
]);
assert.deepEqual(categoricalResult.contingency?.counts, [[2, 1], [1, 2]]);
assert.ok(Number(categoricalResult.pValue) >= 0 && Number(categoricalResult.pValue) <= 1);

const promptedComparison = inferStatisticalSpec("Is age different by gender? Use Mann-Whitney.");
assert.equal(promptedComparison.method, "mann-whitney");
assert.equal(promptedComparison.outcome, "age");
assert.equal(promptedComparison.predictor, "gender");

const promptedValueComparison = inferStatisticalSpec("Is age different between male and female patients? Use a non-parametric test.");
assert.equal(promptedValueComparison.method, "mann-whitney");
assert.equal(promptedValueComparison.outcome, "age");
assert.equal(promptedValueComparison.predictor, "gender");
assert.equal(promptedValueComparison.analysisUnit, "patient");

const promptedCorrelation = inferStatisticalSpec("Check Spearman correlation between age and BMI.");
assert.equal(promptedCorrelation.method, "spearman");
assert.ok(new Set([promptedCorrelation.outcome, promptedCorrelation.predictor]).has("age"));
assert.ok(new Set([promptedCorrelation.outcome, promptedCorrelation.predictor]).has("bmi"));

const promptedAssociation = inferStatisticalSpec("Is patient status associated with gender?");
assert.equal(promptedAssociation.method, "chi-square");
assert.ok(new Set([promptedAssociation.outcome, promptedAssociation.predictor]).has("status"));
assert.ok(new Set([promptedAssociation.outcome, promptedAssociation.predictor]).has("gender"));

assert.throws(
  () => inferStatisticalSpec("Check whether these variables are correlated."),
  /Name both variables/,
);

console.log("analytics tests passed");
