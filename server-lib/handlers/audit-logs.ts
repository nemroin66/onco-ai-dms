import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCollection } from "../firebase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const logs = await listCollection("audit_log");
    const actionFilter = req.query.action as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);

    let filtered = logs
      .filter((l: any) => !actionFilter || l.action === actionFilter)
      .sort((a: any, b: any) => (b.timestamp || "").localeCompare(a.timestamp || ""))
      .slice(0, limit);

    return res.json({ logs: filtered });
  } catch (err: any) {
    console.error("[audit-logs] Failed to fetch:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch audit logs." });
  }
}
