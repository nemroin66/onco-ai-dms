export const coerceControlledChoice = (val: any, _fieldDef?: any): any => val;
export const normalizeChecklist = (val: any, _choices?: any[]): string => Array.isArray(val) ? val.join(",") : String(val || "");
export const normalizeSystemicInquiry = (val: any, _symptoms?: any): any[] => Array.isArray(val) ? val : [];
