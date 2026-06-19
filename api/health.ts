process.env.NODE_NO_DEPRECATION = "1";
process.noDeprecation = true;
import type { VercelRequest, VercelResponse } from "@vercel/node";
import health from "../server-lib/handlers/health.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return health(_req, res);
}
