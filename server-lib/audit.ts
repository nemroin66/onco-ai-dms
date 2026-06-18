import { saveDocument } from "./firebase.js";

export async function logAudit(
  user: { uid: string; email?: string } | null | undefined,
  action: string,
  patientId?: string | null,
  detail?: string | null,
) {
  try {
    const entry = {
      userId: user?.uid || "unknown",
      userEmail: user?.email || "",
      action,
      patientId: patientId || null,
      detail: detail || null,
      timestamp: new Date().toISOString(),
    };
    await saveDocument("audit_log", `${Date.now()}_${user?.uid || "unknown"}`, entry);
  } catch (e) {
    console.error("[audit] Failed to write log:", e);
  }
}
