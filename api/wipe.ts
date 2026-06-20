process.env.NODE_NO_DEPRECATION = "1";
process.noDeprecation = true;
import type { VercelRequest, VercelResponse } from "@vercel/node";
import wipe from "../server-lib/handlers/wipe.js";
import { isPrivilegedRole, vercelAuth } from "../server-lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const user = await vercelAuth(req, res);
  if (!user) return;
  if (!isPrivilegedRole(user.role)) {
    return res.status(403).json({ error: "Administrator access required." });
  }
  return wipe(req, res);
}
