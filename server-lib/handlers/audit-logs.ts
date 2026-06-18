import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCollection } from "../firebase.js";
import { vercelUser } from "../auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = vercelUser(req);
    if (user.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    const actionFilter = req.query.action as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);

    let logs: any[];
    try {
      // DB-level order+limit — requires composite index on audit_log(timestamp desc)
      logs = await listCollection("audit_log", { orderBy: "timestamp desc", limit });
    } catch {
      // Fallback: load all + in-memory sort if index not yet deployed
      logs = await listCollection("audit_log");
      logs.sort((a: any, b: any) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      logs = logs.slice(0, limit);
    }

    if (actionFilter) {
      logs = logs.filter((l: any) => l.action === actionFilter);
    }

    return res.json({ logs });
  } catch (err: any) {
    console.error("[audit-logs] Failed to fetch:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch audit logs." });
  }
}
