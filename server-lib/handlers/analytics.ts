import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getAnalyticsCatalog,
  listDashboards,
  removeDashboard,
  runAdvancedStatistics,
  runAnalyticsQuery,
  saveDashboard,
} from "../analytics.js";
import { vercelUser } from "../auth.js";
import { generateAnalyticsSpec, generateStatisticalSpec } from "../analytics-prompt.js";

export default async function analytics(req: VercelRequest, res: VercelResponse) {
  try {
    const user = vercelUser(req);
    const route = String(req.query.analyticsPath || "");

    if (route === "catalog" && req.method === "GET") {
      return res.json({ fields: getAnalyticsCatalog() });
    }
    if (route === "query" && req.method === "POST") {
      return res.json(await runAnalyticsQuery(req.body));
    }
    if (route === "statistics" && req.method === "POST") {
      return res.json(await runAdvancedStatistics(req.body));
    }
    if (route === "statistics/prompt" && req.method === "POST") {
      const plan = await generateStatisticalSpec(String(req.body?.prompt || ""));
      const spec = {
        ...plan.spec,
        dateFrom: req.body?.dateFrom || plan.spec.dateFrom,
        dateTo: req.body?.dateTo || plan.spec.dateTo,
        filters: [...plan.spec.filters, ...(Array.isArray(req.body?.filters) ? req.body.filters : [])],
      };
      return res.json({ ...plan, spec, result: await runAdvancedStatistics(spec) });
    }
    if (route === "prompt" && req.method === "POST") {
      return res.json(await generateAnalyticsSpec(String(req.body?.prompt || "")));
    }
    if (route === "dashboards" && req.method === "GET") {
      return res.json(await listDashboards(user.uid));
    }
    if (route === "dashboards" && (req.method === "POST" || req.method === "PUT")) {
      return res.json(await saveDashboard(user.uid, req.body));
    }
    if (route.startsWith("dashboards/") && req.method === "DELETE") {
      await removeDashboard(user.uid, route.slice("dashboards/".length));
      return res.json({ success: true });
    }
    return res.status(405).json({ error: "Unsupported analytics operation." });
  } catch (error: any) {
    console.error("[analytics] Error:", error?.message || error);
    if (error?.stack) console.error(error.stack);
    return res.status(error?.status || 400).json({ error: "Analytics request failed." });
  }
}
