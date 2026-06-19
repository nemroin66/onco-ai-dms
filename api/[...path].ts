process.env.NODE_NO_DEPRECATION = "1";
process.noDeprecation = true;
import type { VercelRequest, VercelResponse } from "@vercel/node";
import files from "../server-lib/handlers/files.js";
import patients from "../server-lib/handlers/patients.js";
import patient from "../server-lib/handlers/patients/id/index.js";
import permanent from "../server-lib/handlers/patients/id/permanent.js";
import restore from "../server-lib/handlers/patients/id/restore.js";
import trash from "../server-lib/handlers/patients/trash.js";
import count from "../server-lib/handlers/patients/count.js";
import patientExport from "../server-lib/handlers/patients/export.js";
import storage from "../server-lib/handlers/storage.js";
import quota from "../server-lib/handlers/quota.js";
import analytics from "../server-lib/handlers/analytics.js";
import users from "../server-lib/handlers/users.js";
import { vercelAuth } from "../server-lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parts = (req.url || "").split("?")[0].replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const route = parts.join("/");

  if (route === "favicon.ico") return res.status(204).end();

  const user = await vercelAuth(req, res);
  if (!user) return;

  if (
    (route === "patients/trash" && req.method === "POST")
    || (parts[0] === "patients" && parts[2] === "permanent")
  ) {
    if (user.role !== "admin") {
      console.error("[admin] Access denied: user role is", user.role);
      return res.status(403).json({ error: "Administrator access required." });
    }
  }

  if (parts[0] === "analytics") {
    req.query.analyticsPath = parts.slice(1).join("/");
    return analytics(req, res);
  }
  if (route === "users") return users(req, res);
  if (route === "quota") return quota(req, res);
  if (route === "files") return files(req, res);
  if (route === "patients") return patients(req, res);
  if (route === "patients/export/columns") {
    req.query.exportPath = "columns";
    return patientExport(req, res);
  }
  if (route === "patients/export") return patientExport(req, res);
  if (route === "patients/trash") return trash(req, res);
  if (route === "patients/count") return count(req, res);
  if (route === "storage") return storage(req, res);

  if (parts[0] === "patients" && parts[1]) {
    req.query.id = parts[1];
    if (parts.length === 2) return patient(req, res);
    if (parts.length === 3 && parts[2] === "restore") return restore(req, res);
    if (parts.length === 3 && parts[2] === "permanent") return permanent(req, res);
  }

  return res.status(404).json({ error: "API route not found." });
}
