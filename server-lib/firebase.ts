import crypto from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Filter } from "firebase-admin/firestore";
import type { WhereFilterOp, OrderByDirection } from "firebase-admin/firestore";

function parseServiceAccount(raw: string) {
  if (!raw || raw === "{") return null;
  try {
    return JSON.parse(raw.replace(/\n/g, "\\n").replace(/\\n/g, "\n"));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

function ensureAdminApp() {
  if (!getApps().length) {
    const sa = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "");
    if (!sa) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
    initializeApp({
      credential: cert(sa),
      projectId: process.env.FIREBASE_WEB_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    });
  }
}

export function db() {
  ensureAdminApp();
  return getFirestore();
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function getGoogleAccessToken(scope: string) {
  const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "");
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required for Firestore server access.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claim}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(serviceAccount.private_key);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) throw new Error(`Google auth failed: ${await response.text()}`);
  return (await response.json()).access_token as string;
}

export async function getFirestoreDoc(collection: string, id: string): Promise<Record<string, any> | null> {
  const snap = await db().collection(collection).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export interface ListCollectionOpts {
  limit?: number;
  orderBy?: string;
  where?: Array<{ field: string; op: WhereFilterOp; value: any }>;
}

export async function listCollection(collection: string, opts?: ListCollectionOpts): Promise<Record<string, any>[]> {
  let query: FirebaseFirestore.Query = db().collection(collection);

  if (opts?.where) {
    for (const w of opts.where) {
      query = query.where(w.field, w.op, w.value);
    }
  }

  if (opts?.orderBy) {
    const parts = opts.orderBy.split(/\s+/);
    const field = parts[0];
    const dir: OrderByDirection = (parts[1] as OrderByDirection) || "asc";
    query = query.orderBy(field, dir);
  }

  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveDocument(collection: string, id: string, data: Record<string, any>) {
  await db().collection(collection).doc(id).set(data, { merge: true });
  return { ...data, id };
}

export async function deleteDocument(collection: string, id: string) {
  await db().collection(collection).doc(id).delete();
}
