import assert from "node:assert/strict";
import {
  aiChangeId,
  aiSuggestionId,
  buildAcceptedAiFillData,
  buildAcceptedSuggestedData,
  buildAcceptedSuggestedRows,
  defaultAcceptedAiChangeIds,
  defaultAcceptedSuggestionIds,
} from "../src/utils/aiFillReview.js";

const changes = [
  {
    target: "gender",
    action: "fill_field" as const,
    value: "Female",
  },
  {
    target: "imagingTable[0]",
    action: "append_row" as const,
    value: { imaging_type: "CT", imaging_date: "2026-05-20", imaging_findings: "Left lung mass" },
    rowGroup: "CT|2026-05-20|left lung",
  },
  {
    target: "status",
    action: "fill_field" as const,
    value: "under_treatment",
  },
];

const defaultAccepted = defaultAcceptedAiChangeIds(changes);
assert.equal(defaultAccepted.has(aiChangeId(changes[0], 0)), true);
assert.equal(defaultAccepted.has(aiChangeId(changes[1], 1)), true);
assert.equal(defaultAccepted.has(aiChangeId(changes[2], 2)), true);

const defaultData = buildAcceptedAiFillData(changes, defaultAccepted);
assert.equal(defaultData.gender, "Female");
assert.equal(defaultData.status, "under_treatment");
assert.deepEqual(defaultData.imagingTable, [
  {
    imaging_type: "CT",
    imaging_date: "2026-05-20",
    imaging_findings: "Left lung mass",
    _aiRowGroup: "CT|2026-05-20|left lung",
  },
]);

const oneChangeOnly = new Set([aiChangeId(changes[1], 1)]);
const oneChangeData = buildAcceptedAiFillData(changes, oneChangeOnly);
assert.equal(oneChangeData.gender, undefined);
assert.equal(oneChangeData.imagingTable[0]._aiRowGroup, "CT|2026-05-20|left lung");

const rejectedData = buildAcceptedAiFillData(changes, new Set());
assert.deepEqual(rejectedData, {});

const suggestions = [
  {
    sourceKey: "final_diagnosis",
    value: "Left breast carcinoma",
    candidateTarget: "definitiveDiagnosis",
    reason: "Belongs to definitive diagnosis",
  },
  {
    sourceKey: "unmapped_marker",
    value: "Rare marker noted",
    reason: "No exact target exists",
  },
];

const acceptedSuggestions = defaultAcceptedSuggestionIds(suggestions);
assert.equal(acceptedSuggestions.has(aiSuggestionId(suggestions[0], 0)), true);
assert.equal(acceptedSuggestions.has(aiSuggestionId(suggestions[1], 1)), true);
assert.deepEqual(buildAcceptedSuggestedData(suggestions, acceptedSuggestions), {
  final_diagnosis: "Left breast carcinoma",
});
assert.deepEqual(buildAcceptedSuggestedRows(suggestions, acceptedSuggestions), [
  {
    source_section: "unmapped_marker",
    detail: "unmapped_marker: Rare marker noted",
    medical_importance: "medium",
  },
]);

console.log("AI fill review tests passed");
