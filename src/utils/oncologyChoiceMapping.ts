export const coerceOncologyTypes = (val: any, _knownTypes?: string[]): { selected: string[]; otherValues: string[] } => {
  const arr = Array.isArray(val) ? val : [val].filter(Boolean);
  return { selected: arr.filter((v: any) => typeof v === "string"), otherValues: [] };
};
