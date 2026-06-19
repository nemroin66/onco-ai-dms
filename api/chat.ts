process.env.NODE_NO_DEPRECATION = "1";
process.noDeprecation = true;
import type { VercelRequest, VercelResponse } from "@vercel/node";
import chat from "../server-lib/handlers/chat.js";
import { vercelAuth } from "../server-lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await vercelAuth(req, res);
  if (!user) return;
  return chat(req, res);
}
