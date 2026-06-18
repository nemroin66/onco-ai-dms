export type AiProposedChange = {
  target?: string;
  action?: "fill_field" | "append_value" | "append_row" | "review";
  value?: unknown;
  rowGroup?: string;
};

export type AiSuggestedElsewhere = {
  sourceKey?: string;
  value?: unknown;
  candidateTarget?: string;
  reason?: string;
};

export function aiChangeId(change: AiProposedChange, index: number) {
  return `${change.target || "change"}::${change.rowGroup || ""}::${index}`;
}

export function aiSuggestionId(suggestion: AiSuggestedElsewhere, index: number) {
  return `${suggestion.sourceKey || "suggestion"}::${suggestion.candidateTarget || ""}::${index}`;
}

export function defaultAcceptedAiChangeIds(changes: AiProposedChange[] = []) {
  return new Set(changes.map((change, index) => aiChangeId(change, index)));
}

export function defaultAcceptedSuggestionIds(suggestions: AiSuggestedElsewhere[] = []) {
  return new Set(suggestions.map((suggestion, index) => aiSuggestionId(suggestion, index)));
}

function assignScalarOrAppend(data: Record<string, any>, key: string, value: unknown, append: boolean) {
  if (!key || value === undefined || value === null || value === "") return;
  if (append) {
    const current = Array.isArray(data[key]) ? data[key] : [];
    const values = Array.isArray(value) ? value : [value];
    data[key] = Array.from(new Set([...current, ...values].filter((item) => item !== undefined && item !== null && item !== "")));
    return;
  }
  data[key] = value;
}

export function buildAcceptedAiFillData(changes: AiProposedChange[] = [], acceptedIds: Set<string>) {
  const data: Record<string, any> = {};

  changes.forEach((change, index) => {
    if (!acceptedIds.has(aiChangeId(change, index))) return;
    const target = String(change.target || "");
    if (!target) return;

    const rowMatch = target.match(/^([A-Za-z0-9_]+)\[(\d+)\]$/);
    if (rowMatch && change.value && typeof change.value === "object" && !Array.isArray(change.value)) {
      const tableKey = rowMatch[1];
      const row = { ...(change.value as Record<string, any>) };
      if (change.rowGroup) row._aiRowGroup = change.rowGroup;
      data[tableKey] = Array.isArray(data[tableKey]) ? data[tableKey] : [];
      data[tableKey].push(row);
      return;
    }

    const rowFieldMatch = target.match(/^([A-Za-z0-9_]+)\[(\d+)\]\.([A-Za-z0-9_]+)$/);
    if (rowFieldMatch) {
      const [, tableKey, rawIndex, fieldKey] = rowFieldMatch;
      const rowIndex = Number(rawIndex);
      data[tableKey] = Array.isArray(data[tableKey]) ? data[tableKey] : [];
      while (data[tableKey].length <= rowIndex) data[tableKey].push({});
      data[tableKey][rowIndex][fieldKey] = change.value;
      if (change.rowGroup) data[tableKey][rowIndex]._aiRowGroup = change.rowGroup;
      return;
    }

    assignScalarOrAppend(data, target, change.value, change.action === "append_value");
  });

  return data;
}

export function buildAcceptedSuggestedRows(suggestions: AiSuggestedElsewhere[] = [], acceptedIds: Set<string>) {
  return suggestions
    .filter((suggestion, index) => acceptedIds.has(aiSuggestionId(suggestion, index)) && !suggestion.candidateTarget)
    .map((suggestion) => ({
      source_section: suggestion.candidateTarget || suggestion.sourceKey || "Suggested elsewhere",
      detail: `${suggestion.sourceKey || "AI detail"}: ${
        typeof suggestion.value === "object" ? JSON.stringify(suggestion.value) : String(suggestion.value || "")
      }`,
      medical_importance: "medium",
    }))
    .filter((row) => row.detail.trim() !== `${row.source_section}:`);
}

export function buildAcceptedSuggestedData(suggestions: AiSuggestedElsewhere[] = [], acceptedIds: Set<string>) {
  const data: Record<string, any> = {};
  suggestions.forEach((suggestion, index) => {
    if (!acceptedIds.has(aiSuggestionId(suggestion, index))) return;
    if (!suggestion.candidateTarget || !suggestion.sourceKey) return;
    if (suggestion.value === undefined || suggestion.value === null || suggestion.value === "") return;
    data[suggestion.sourceKey] = suggestion.value;
  });
  return data;
}
