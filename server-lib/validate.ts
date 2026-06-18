import { z } from "zod";

/** Strip prototype pollution keys from any object */
export function cleanBody(body: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    cleaned[key] = body[key];
  }
  return cleaned;
}

/** Patient write schema — validates top-level structure and key field types */
export const patientSchema = z.object({
  id: z.string().max(100).optional(),
  first_name: z.string().max(200).optional().default(""),
  last_name: z.string().max(200).optional().default(""),
  title: z.string().max(50).optional().default(""),
  initials: z.string().max(20).optional().default(""),
  nic: z.string().max(30).optional().default(""),
  tp: z.string().max(50).optional().default(""),
  dob: z.string().max(20).optional().default(""),
  age: z.string().max(10).optional().default(""),
  gender: z.string().max(20).optional().default(""),
  living_area: z.string().max(300).optional().default(""),
  hospital: z.string().max(200).optional().default(""),
  oncology: z.string().max(200).optional().default(""),
  oncology_types: z.array(z.string()).optional().default([]),
  oncology_other: z.string().max(500).optional().default(""),
  consent_ai_processing: z.boolean().optional(),
  isDeleted: z.boolean().optional().default(false),
  driveFolderId: z.string().optional(),
  auto_id: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  // All other fields pass through as-is (too many to enumerate — 400+)
}).passthrough();

/** File metadata schema */
export const fileSchema = z.object({
  patientId: z.string().min(1).max(100),
  name: z.string().max(300).optional().default("file"),
  mimeType: z.string().max(100).optional().default("application/octet-stream"),
  size: z.number().max(50 * 1024 * 1024).optional().default(0),
  contentBase64: z.string().optional(),
}).passthrough();
