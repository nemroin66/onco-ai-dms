import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { NextFunction, Request, Response } from "express";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { logAudit } from "./audit.js";

export interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";
  if (!raw || raw === "{") throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required for authenticated API access.");
  try {
    return JSON.parse(raw.replace(/\n/g, "\\n").replace(/\\n/g, "\n"));
  } catch {
    return JSON.parse(raw);
  }
}

function ensureAdminApp() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(parseServiceAccount()),
      projectId: process.env.FIREBASE_WEB_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    });
  }
}

function bearerToken(header: string | string[] | undefined) {
  const value = Array.isArray(header) ? header[0] : header;
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

async function resolveUser(header: string | string[] | undefined): Promise<AuthenticatedUser> {
  ensureAdminApp();
  const token = bearerToken(header);
  if (!token) throw new Error("Missing Firebase ID token.");
  const decoded = await getAuth().verifyIdToken(token, true);
  const profile = await getFirestore().collection("users").doc(decoded.uid).get();
  const data = profile.exists ? profile.data() || {} : {};
  return {
    uid: decoded.uid,
    email: decoded.email || String(data.email || ""),
    name: String(data.name || decoded.name || decoded.email || "User"),
    role: data.role === "admin" ? "admin" : "user",
  };
}

export async function expressAuth(req: Request, res: Response, next: NextFunction) {
  try {
    (req as Request & { authUser: AuthenticatedUser }).authUser = await resolveUser(req.headers.authorization);
    next();
  } catch (error: any) {
    console.error("[auth] Auth failed:", error?.message || error);
    logAudit(null, "auth.failed", null, error?.message?.slice(0, 200));
    res.status(401).json({ error: "Authentication required." });
  }
}

export function expressUser(req: Request) {
  return (req as Request & { authUser: AuthenticatedUser }).authUser;
}

export async function vercelAuth(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await resolveUser(req.headers.authorization);
    (req as VercelRequest & { authUser: AuthenticatedUser }).authUser = user;
    return user;
  } catch (error: any) {
    console.error("[auth] Vercel auth failed:", error?.message || error);
    logAudit(null, "auth.failed", null, error?.message?.slice(0, 200));
    res.status(401).json({ error: "Authentication required." });
    return null;
  }
}

export function vercelUser(req: VercelRequest) {
  return (req as VercelRequest & { authUser: AuthenticatedUser }).authUser;
}

export function requireAdmin(user: AuthenticatedUser) {
  if (user.role !== "admin") {
    const error = new Error("Administrator access required.");
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
}
