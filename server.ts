process.env.NODE_NO_DEPRECATION = "1";
process.noDeprecation = true;
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { expressAuth, expressUser, requireAdmin } from "./server-lib/auth.js";
import { logAudit } from "./server-lib/audit.js";
import {
  bumpAnalyticsVersion,
  getAnalyticsCatalog,
  listDashboards,
  removeDashboard,
  runAdvancedStatistics,
  runAnalyticsQuery,
  saveDashboard,
} from "./server-lib/analytics.js";
import { generateAnalyticsSpec, generateStatisticalSpec } from "./server-lib/analytics-prompt.js";
import { cleanBody, patientSchema } from "./server-lib/validate.js";
import { ensureDriveFolder, uploadToDrive } from "./server-lib/drive.js";
import {
  buildPatientCsv,
  buildPatientExportColumnTree,
  buildSelectedPatientCsv,
  patientExportFileName,
  type PatientExportMode,
} from "./server-lib/patient-export.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

import countPatients from "./server-lib/handlers/patients/count.js";

// Security middleware
const CLIENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://oncodb.vercel.app",
  process.env.CLIENT_ORIGIN || "",
].filter(Boolean);
app.use(cors({ origin: CLIENT_ORIGINS, methods: ["GET", "POST", "PUT", "DELETE", "PATCH"] }));
const isDev = process.env.NODE_ENV !== "production";
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
       scriptSrc: [
        "'self'",
        "https://apis.google.com",
        "https://*.firebaseio.com",
        "https://identitytoolkit.googleapis.com",
        "https://www.gstatic.com",
        "https://accounts.google.com",
        "https://vercel.live",
        ...(isDev ? ["'unsafe-inline'"] : []),
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://firestore.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://www.googleapis.com",
        "https://generativelanguage.googleapis.com",
        "https://www.gstatic.com",
        "https://vercel.live",
        "wss://vercel.live",
        ...(isDev ? ["ws://localhost:24678"] : []),
      ],
      fontSrc: ["'self'"],
      frameSrc: ["https://vercel.live"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
}));
app.use("/api/", rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));
app.use(["/api/extract", "/api/document-fill"], rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Too many document understanding requests. Try again later." } }));
app.use("/api/health", rateLimit({ windowMs: 60_000, max: 5, standardHeaders: true, legacyHeaders: false }));

/** Log real error server-side, return generic message to client. */
function apiError(res: express.Response, error: unknown, defaultStatus = 500, defaultMessage = "Request failed.") {
  const err = error as any;
  let status = typeof err?.status === "number" ? err.status : defaultStatus;
  if (status < 400 || status > 599) status = defaultStatus;
  console.error(`[API ${status}]`, err?.message || err);
  if (err?.stack) console.error(err.stack);
  res.status(status).json({ error: defaultMessage });
}

type PatientDoc = Record<string, any>;

let geminiRequestCount = 0;

const env = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
};

const firebaseProjectId = env("FIREBASE_WEB_PROJECT_ID", "VITE_FIREBASE_PROJECT_ID");
const driveFolderId = env("DRIVE_FOLDER_ID", "GOOGLE_DRIVE_FOLDER_ID", "VITE_DRIVE_ROOT_FOLDER_ID");
const primaryGeminiKey = env("GEMINI_API_KEY_PRIMARY", "GEMINI_API_KEY");
const secondaryGeminiKey = env("GEMINI_API_KEY_SECONDARY");
const primaryGeminiModel = env("GEMINI_MODEL_PRIMARY") || "gemini-3.1-flash-lite";
const secondaryGeminiModel = env("GEMINI_MODEL_SECONDARY") || "gemini-3.1-flash-lite";

function parseServiceAccount(raw: string) {
  const readFromLocalEnvNew = () => {
    try {
      const file = fs.readFileSync(path.join(process.cwd(), ".env.clean"), "utf8");
      const match = file.match(/FIREBASE_SERVICE_ACCOUNT_JSON=(\{[\s\S]*?\n\})\n#/);
      return match?.[1] || "";
    } catch {
      return "";
    }
  };

  if (!raw || raw === "{") raw = readFromLocalEnvNew();
  if (!raw) return null;
  try {
    return JSON.parse(raw.replace(/\n/g, "\\n").replace(/\\n/g, "\n"));
  } catch {
    try {
      return JSON.parse(raw);
    } catch {
      const fallback = readFromLocalEnvNew();
      return fallback ? JSON.parse(fallback) : null;
    }
  }
}

const firebaseServiceAccount = parseServiceAccount(env("FIREBASE_SERVICE_ACCOUNT_JSON"));

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getGoogleAccessToken(scope: string) {
  if (!firebaseServiceAccount?.client_email || !firebaseServiceAccount?.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required for Firestore server access.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: firebaseServiceAccount.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${claim}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(firebaseServiceAccount.private_key);
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

async function getDriveAccessToken() {
  const refreshToken = env("GOOGLE_DRIVE_REFRESH_TOKEN");
  const clientId = env("GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = env("GOOGLE_DRIVE_CLIENT_SECRET");

  if (refreshToken && clientId && clientSecret) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) throw new Error(`Drive OAuth refresh failed: ${await response.text()}`);
    return (await response.json()).access_token as string;
  }

  return getGoogleAccessToken("https://www.googleapis.com/auth/drive");
}

function encodeFirestoreValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeFirestoreValue(v)])) } };
  }
  return { stringValue: String(value) };
}

function decodeFirestoreValue(value: any): any {
  if (!value) return "";
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ("mapValue" in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decodeFirestoreValue(v)]));
  }
  return "";
}

async function firestoreFetch(pathname: string, init: RequestInit = {}) {
  if (!firebaseProjectId) throw new Error("FIREBASE_WEB_PROJECT_ID or VITE_FIREBASE_PROJECT_ID is required.");
  const token = await getGoogleAccessToken("https://www.googleapis.com/auth/datastore");
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/${pathname}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok && response.status !== 404) throw new Error(await response.text());
  return response;
}

function firestoreDocToObject(doc: any): PatientDoc {
  const id = doc.name.split("/").pop();
  const data = Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, decodeFirestoreValue(v)]));
  return { ...data, id };
}

async function getFirestoreDoc(collection: string, id: string): Promise<PatientDoc | null> {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid document ID");
  const response = await firestoreFetch(`${collection}/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return firestoreDocToObject(data);
}

async function listCollection(collection: string): Promise<PatientDoc[]> {
  const documents: PatientDoc[] = [];
  let pageToken = "";
  do {
    const separator = collection.includes("?") ? "&" : "?";
    const response = await firestoreFetch(`${collection}${separator}pageSize=500${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
    if (response.status === 404) return documents;
    const data = await response.json();
    documents.push(...(data.documents || []).map(firestoreDocToObject));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function saveDocument(collection: string, id: string, data: Record<string, any>): Promise<Record<string, any>> {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encodeFirestoreValue(v)]));
  await firestoreFetch(`${collection}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
  return { ...data, id };
}

async function deleteDocument(collection: string, id: string) {
  await firestoreFetch(`${collection}/${id}`, { method: "DELETE" });
}

async function deleteDriveFile(fileId: string) {
  const token = await getDriveAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&supportsTeamDrives=true`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  // 204 No Content means success, 404 means already deleted
  if (response.status === 204 || response.status === 404) {
    console.log(`Successfully deleted Drive file: ${fileId}`);
    return;
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete Drive file ${fileId}: ${response.status} ${errorText}`);
  }
}

async function recursivelyDeleteDriveFolder(folderId: string, maxRetries = 3) {
  const token = await getDriveAccessToken();
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // First, verify the folder exists
      const verifyResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&supportsTeamDrives=true&fields=id,name,mimeType`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (verifyResponse.status === 404) {
        console.log(`Folder ${folderId} already deleted or doesn't exist`);
        return;
      }

      if (!verifyResponse.ok) {
        throw new Error(`Could not verify folder ${folderId}: ${verifyResponse.status}`);
      }

      // List all children of this folder
      const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
      const listResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&pageSize=100&supportsAllDrives=true&supportsTeamDrives=true&fields=files(id,mimeType,name)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!listResponse.ok) {
        console.warn(`Could not list contents of folder ${folderId}: ${listResponse.status}`);
        throw new Error(`Failed to list folder ${folderId}`);
      }

      const listData = await listResponse.json();
      const children = listData.files || [];

      console.log(`Folder ${folderId} has ${children.length} non-trashed children to delete`);

      // Recursively delete folders and all files sequentially (not in parallel to avoid API rate limits)
      for (const child of children) {
        try {
          if (child.mimeType === "application/vnd.google-apps.folder") {
            console.log(`  Recursing into subfolder: ${child.id}`);
            await recursivelyDeleteDriveFolder(child.id, maxRetries);
          } else {
            console.log(`  Deleting file: ${child.id}`);
            await deleteDriveFile(child.id);
          }
        } catch (e) {
          console.error(`  Failed to delete child ${child.id}:`, e);
          // Continue with other children instead of failing completely
        }
      }

      // Finally, delete the folder itself
      console.log(`Deleting folder: ${folderId}`);
      await deleteDriveFile(folderId);
      
      // Success - exit the retry loop
      console.log(`Successfully deleted folder ${folderId}`);
      return;
      
    } catch (e) {
      retryCount++;
      console.error(`Error deleting folder ${folderId} (attempt ${retryCount}/${maxRetries}):`, e);
      
      if (retryCount < maxRetries) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      } else {
        console.error(`Final failure deleting folder ${folderId} after ${maxRetries} attempts`);
        throw e;
      }
    }
  }
}

async function wipePatientAssets(patient: PatientDoc) {
  const files = (await listCollection("files")).filter((file: any) => file.patientId === patient.id);
  for (const file of files) {
    if (file.driveFileId) {
      try {
        await deleteDriveFile(file.driveFileId);
      } catch (e) {
        console.error(`Failed to delete Drive file ${file.driveFileId} for patient ${patient.id}:`, e);
      }
    }
    await deleteDocument("files", file.id);
  }

  if (patient.driveFolderId) {
    try {
      await deleteDriveFile(patient.driveFolderId);
    } catch (e) {
      console.error(`Failed to delete Drive folder for patient ${patient.id}:`, e);
    }
  }
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

async function discoverModelsViaRest(apiKey: string, apiVersion: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey}`
    );
    const data: any = await response.json();
    if (data.models && Array.isArray(data.models)) {
      return orderGeminiExtractionModels(
        data.models
          .filter(modelSupportsGenerateContent)
          .map((m: any) => m.name)
      );
    }
  } catch (_) {
    // REST discovery failed
  }
  return [];
}

const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-preview-09-2025",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash-lite-preview-09-2025",
  "gemini-2.5-pro",
  "gemini-2.5-pro-preview-06-05",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-flash-exp",
  "gemini-2.0-pro-exp",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash-exp",
  "gemini-1.5-pro",
  "gemini-1.5-pro-exp",
];

const NON_EXTRACTION_MODEL_PATTERN = /(embedding|embed|tts|live|image|imagen|veo|lyria|aqa|gemma|learnlm|banana|chirp|music|vision)/i;

function isUsableExtractionModelName(model: string) {
  const name = String(model || "").replace(/^models\//, "").toLowerCase();
  return name.startsWith("gemini-") && !NON_EXTRACTION_MODEL_PATTERN.test(name) && /(flash|pro)/.test(name);
}

function modelSupportsGenerateContent(model: any) {
  const methods = [
    ...(Array.isArray(model?.supportedMethods) ? model.supportedMethods : []),
    ...(Array.isArray(model?.supportedGenerationMethods) ? model.supportedGenerationMethods : []),
  ].map((method) => String(method));
  return methods.some((method) => method === "generateContent" || method === "generate_content");
}

function orderGeminiExtractionModels(models: string[]) {
  const seen = new Set<string>();
  const rank = new Map(FALLBACK_MODELS.map((model, index) => [model, index]));
  return models
    .map((model) => String(model || "").replace(/^models\//, ""))
    .filter((model) => {
      if (!isUsableExtractionModelName(model) || seen.has(model)) return false;
      seen.add(model);
      return true;
    })
    .sort((a, b) => {
      const rankA = rank.get(a) ?? 999;
      const rankB = rank.get(b) ?? 999;
      return rankA - rankB || a.localeCompare(b);
    });
}

function buildConfig(apiVersion: string, systemInstruction?: string, responseMimeType?: string) {
  const config: Record<string, any> = {};
  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (responseMimeType) config.responseMimeType = responseMimeType;
  return config;
}

async function runGemini(contents: any, systemInstruction?: string, responseMimeType?: string) {
  const attempts = [
    { key: primaryGeminiKey, model: primaryGeminiModel },
    { key: secondaryGeminiKey, model: secondaryGeminiModel },
  ].filter((x) => x.key);

  if (attempts.length === 0) {
    throw new Error("No Gemini API keys configured.");
  }

  const apiVersions = ["v1beta", "v1"];
  let lastError: any;

  // Phase 1: Try each configured model with v1beta then v1
  for (const attempt of attempts) {
    for (const apiVersion of apiVersions) {
      try {
        const ai = new GoogleGenAI({ apiKey: attempt.key, apiVersion });
        const modelName = attempt.model.replace(/^models\//, "");
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: buildConfig(apiVersion, systemInstruction, responseMimeType),
        });
        return response.text || "";
      } catch (error: any) {
        lastError = error;
      }
    }
  }

  // Phase 2: Discover models via REST API and try each
  for (const attempt of attempts) {
    for (const apiVersion of apiVersions) {
      const discovered = await discoverModelsViaRest(attempt.key, apiVersion);
      for (const model of discovered) {
        try {
          const ai = new GoogleGenAI({ apiKey: attempt.key, apiVersion });
          const response = await ai.models.generateContent({
            model,
            contents,
            config: buildConfig(apiVersion, systemInstruction, responseMimeType),
          });
          return response.text || "";
        } catch (error: any) {
          lastError = error;
        }
      }
    }
  }

  // Phase 3: Hardcoded comprehensive fallback list
  for (const attempt of attempts) {
    for (const apiVersion of apiVersions) {
      for (const model of FALLBACK_MODELS) {
        try {
          const ai = new GoogleGenAI({ apiKey: attempt.key, apiVersion });
          const response = await ai.models.generateContent({
            model,
            contents,
            config: buildConfig(apiVersion, systemInstruction, responseMimeType),
          });
          return response.text || "";
        } catch (error: any) {
          lastError = error;
        }
      }
    }
  }

  throw lastError || new Error("No usable Gemini models found.");
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1]);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("Gemini did not return a JSON object.");
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", expressAuth);

app.get("/api/analytics/catalog", (_req, res) => {
  res.json({ fields: getAnalyticsCatalog() });
});

app.post("/api/analytics/query", async (req, res) => {
  try {
    const user = expressUser(req);
    res.json(await runAnalyticsQuery(req.body, user.uid));
  } catch (error: any) {
    apiError(res, error, 400, "Analytics query failed.");
  }
});

app.post("/api/analytics/statistics", async (req, res) => {
  try {
    const user = expressUser(req);
    res.json(await runAdvancedStatistics(req.body, user.uid));
  } catch (error: any) {
    apiError(res, error, 400, "Statistical analysis failed.");
  }
});

app.post("/api/analytics/statistics/prompt", async (req, res) => {
  try {
    const user = expressUser(req);
    const plan = await generateStatisticalSpec(String(req.body?.prompt || ""));
    const spec = {
      ...plan.spec,
      dateFrom: req.body?.dateFrom || plan.spec.dateFrom,
      dateTo: req.body?.dateTo || plan.spec.dateTo,
      filters: [...plan.spec.filters, ...(Array.isArray(req.body?.filters) ? req.body.filters : [])],
    };
    res.json({ ...plan, spec, result: await runAdvancedStatistics(spec, user.uid) });
  } catch (error: any) {
    apiError(res, error, 400, "AI statistical analysis failed.");
  }
});

app.post("/api/analytics/prompt", async (req, res) => {
  try {
    res.json(await generateAnalyticsSpec(String(req.body?.prompt || "")));
  } catch (error: any) {
    apiError(res, error, 400, "Analytics prompt failed.");
  }
});

app.get("/api/analytics/dashboards", async (req, res) => {
  try {
    res.json(await listDashboards(expressUser(req).uid));
  } catch (error: any) {
    apiError(res, error, 500, "Could not load dashboards.");
  }
});

app.post("/api/analytics/dashboards", async (req, res) => {
  try {
    res.json(await saveDashboard(expressUser(req).uid, req.body));
  } catch (error: any) {
    apiError(res, error, 400, "Could not save dashboard.");
  }
});

app.delete("/api/analytics/dashboards/:id", async (req, res) => {
  try {
    await removeDashboard(expressUser(req).uid, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    apiError(res, error, 500, "Could not delete dashboard.");
  }
});

app.post(["/api/extract", "/api/document-fill"], async (req, res) => {
  try {
    const patientId = String(req.body?.patientId || "");
    if (patientId) {
      const patient = await getFirestoreDoc("patients", patientId);
      if (!patient) return res.status(404).json({ error: "Patient record not found." });
      if (patient.createdBy && patient.createdBy !== expressUser(req).uid && expressUser(req).role !== "admin") {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    const { runDocumentFill } = await import("./server-lib/document-fill.js");
    const result = await runDocumentFill(req.body || {});
    await logAudit(expressUser(req), "document.ai_fill", patientId || null, req.body?.fileName || "clinical-document");
    res.json(result);
  } catch (error: any) {
    apiError(res, error, error?.status || 500, error?.status ? error.message : "AI document understanding failed.");
  }
});

app.get("/api/patients/count", countPatients as any);

function parseSelectedPatientExportBody(body: any) {
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const mode: PatientExportMode = body?.mode === "table-row" ? "table-row" : "patient-wide";
  const columns = Array.isArray(body?.columns)
    ? body.columns.map((column: unknown) => String(column || "").trim()).filter(Boolean)
    : [];
  const rowSource = String(body?.rowSource || "").trim();
  return { mode, columns, rowSource };
}

async function listExportablePatients(req: any) {
  const user = expressUser(req);
  return (await listCollection("patients"))
    .filter((patient: any) => user.role === "admin" || !patient.createdBy || patient.createdBy === user.uid)
    .sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

app.get("/api/patients/export/columns", async (req, res) => {
  try {
    const patients = await listExportablePatients(req);
    return res.json(buildPatientExportColumnTree(patients));
  } catch (error: any) {
    apiError(res, error, 500, "Patient export columns failed.");
  }
});

app.post("/api/patients/export", async (req, res) => {
  try {
    const patients = await listExportablePatients(req);
    const selected = parseSelectedPatientExportBody(req.body || {});
    if (!selected.columns.length) {
      return res.status(400).json({ error: "Select at least one CSV column before exporting." });
    }
    if (selected.mode === "table-row" && !selected.rowSource) {
      return res.status(400).json({ error: "Select one repeatable table source for table-row CSV export." });
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${patientExportFileName("csv")}"`);
    return res.send(buildSelectedPatientCsv(patients, selected));
  } catch (error: any) {
    apiError(res, error, 500, "Selected patient export failed.");
  }
});

app.get("/api/patients/export", async (req, res) => {
  try {
    const patients = await listExportablePatients(req);
    const format = String(req.query.format || "csv").toLowerCase();

    if (format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${patientExportFileName("json")}"`);
      return res.send(JSON.stringify(patients, null, 2));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${patientExportFileName("csv")}"`);
    return res.send(buildPatientCsv(patients));
  } catch (error: any) {
    apiError(res, error, 500, "Patient export failed.");
  }
});

app.get("/api/patients", async (req, res) => {
  try {
    const includeDeleted = String(req.query.includeDeleted || "").toLowerCase() === "true" || String(req.query.includeDeleted || "").trim() === "1";
    const searchQuery = String(req.query.search || "").trim().toLowerCase();
    const isSearch = !!searchQuery;
    const oncologyFilter = String(req.query.oncology || "").trim();
    const bhtFilter = String(req.query.bht || "").trim();
    const statusFilter = String(req.query.status || "").trim();
    const hospitalFilter = String(req.query.hospital || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 5000);
    const patients = await listCollection("patients");
    const user = expressUser(req);

    let filteredPatients = (includeDeleted ? patients : patients.filter((p: any) => !p.isDeleted))
      .filter((p: any) => !p.createdBy || p.createdBy === user.uid || user.role === "admin");
    if (oncologyFilter) filteredPatients = filteredPatients.filter((p: any) => p.oncology === oncologyFilter);
    if (bhtFilter) filteredPatients = filteredPatients.filter((p: any) => p.bht === bhtFilter);
    if (statusFilter) filteredPatients = filteredPatients.filter((p: any) => p.status === statusFilter);
    if (hospitalFilter) filteredPatients = filteredPatients.filter((p: any) => p.hospital === hospitalFilter);

    if (isSearch) {
      const terms = searchQuery.split(/\s+/).filter(Boolean);
      const scored = filteredPatients.map((p: any) => {
        const textBlob = [
          p.title, p.first_name, p.last_name, p.initials,
          p.auto_id, p.nic, p.tp, p.bht, p.clinic, p.hospital, p.ward_no,
        ].filter(Boolean).map((v: any) => String(v).toLowerCase()).join(" ");
        const score = terms.filter((t: string) => textBlob.includes(t)).length;
        return { patient: p, score };
      });
      filteredPatients = scored.filter((s: any) => s.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .map((s: any) => s.patient)
        .slice(0, limit);
    } else {
      filteredPatients.sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
      filteredPatients = filteredPatients.slice(0, limit);
    }

    res.json(filteredPatients);
  } catch (error: any) {
    apiError(res, error);
  }
});

app.delete("/api/patients/:id/permanent", async (req, res) => {
  try {
    requireAdmin(expressUser(req));
    const id = req.params.id;
    const patient = await getFirestoreDoc("patients", id);
    if (!patient) return res.status(404).json({ error: "Patient not found." });
    if (!patient.isDeleted) return res.status(400).json({ error: "Patient must be moved to trash before permanent deletion." });
    if (patient.createdBy && patient.createdBy !== expressUser(req).uid && expressUser(req).role !== "admin") {
      return res.status(403).json({ error: "Access denied." });
    }

    await wipePatientAssets(patient);
    await deleteDocument("patients", id);
    await logAudit(expressUser(req), "patient.permanent_delete", id);
    await bumpAnalyticsVersion();
    res.json({ success: true });
  } catch (error: any) {
    apiError(res, error);
  }
});

app.post("/api/patients", (req, res, next) => {
  const len = parseInt(req.headers["content-length"] || "0", 10);
  if (len > 512_000) return res.status(413).json({ error: "Payload too large (max 500 KB)." });
  next();
}, async (req, res) => {
  try {
    const existing = await listCollection("patients");
    const safeBody = cleanBody(req.body);
    const parsed = patientSchema.parse(safeBody);
    const id = parsed.id || newId("pat");
    const now = new Date().toISOString();
    const record = {
      ...parsed,
      id,
      createdBy: expressUser(req).uid,
      auto_id: parsed.auto_id || `PT-${String(existing.length + 1).padStart(3, "0")}`,
      createdAt: parsed.createdAt || now,
      updatedAt: now,
    };
    record.driveFolderId = await ensureDriveFolder(record);
    const saved = await saveDocument("patients", id, record);
    await logAudit(expressUser(req), "patient.create", id);
    await bumpAnalyticsVersion();
    res.json(saved);
  } catch (error: any) {
    apiError(res, error);
  }
});

app.put("/api/patients/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await getFirestoreDoc("patients", id);
    if (existing?.createdBy && existing.createdBy !== expressUser(req).uid && expressUser(req).role !== "admin") {
      return res.status(403).json({ error: "Access denied." });
    }
    const safeBody = cleanBody(req.body);
    const parsed = patientSchema.parse(safeBody);
    const record = { ...parsed, id, createdBy: existing?.createdBy || expressUser(req).uid, updatedAt: new Date().toISOString() };
    record.driveFolderId = await ensureDriveFolder(record);
    const saved = await saveDocument("patients", id, record);
    await logAudit(expressUser(req), "patient.update", id);
    await bumpAnalyticsVersion();
    res.json(saved);
  } catch (error: any) {
    apiError(res, error);
  }
});

app.delete("/api/patients/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const patient = await getFirestoreDoc("patients", id);
    if (!patient) return res.status(404).json({ error: "Patient not found." });
    if (patient.createdBy && patient.createdBy !== expressUser(req).uid && expressUser(req).role !== "admin") {
      return res.status(403).json({ error: "Access denied." });
    }

    if (patient.isDeleted) {
      // Hard delete: Wipe everything related to this patient
      await wipePatientAssets(patient);
      await deleteDocument("patients", id);
      await logAudit(expressUser(req), "patient.permanent_delete", id);
      await bumpAnalyticsVersion();
      res.json({ success: true, permanent: true });
    } else {
      // Soft delete: Mark as deleted
      await saveDocument("patients", id, { 
        ...patient, 
        isDeleted: true, 
        updatedAt: new Date().toISOString() 
      });
      await logAudit(expressUser(req), "patient.soft_delete", id);
      await bumpAnalyticsVersion();
      res.json({ success: true, permanent: false });
    }
  } catch (error: any) {
    apiError(res, error);
  }
});

app.get("/api/patients/trash", async (req, res) => {
  try {
    const user = expressUser(req);
    const patients = await listCollection("patients");
    const deletedPatients = patients.filter((p: any) => 
      p.isDeleted && (!p.createdBy || p.createdBy === user.uid || user.role === "admin")
    );
    deletedPatients.sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    res.json(deletedPatients);
  } catch (error: any) {
    apiError(res, error);
  }
});

app.post("/api/patients/:id/restore", async (req, res) => {
  try {
    const id = req.params.id;
    const patient = await getFirestoreDoc("patients", id);
    if (!patient || !patient.isDeleted) return res.status(404).json({ error: "Deleted patient not found." });
    if (patient.createdBy && patient.createdBy !== expressUser(req).uid && expressUser(req).role !== "admin") {
      return res.status(403).json({ error: "Access denied." });
    }

    await saveDocument("patients", id, { ...patient, isDeleted: false, updatedAt: new Date().toISOString() });
    await logAudit(expressUser(req), "patient.restore", id);
    await bumpAnalyticsVersion();
    res.json({ success: true });
  } catch (error: any) {
    apiError(res, error);
  }
});

app.post("/api/patients/trash/clear", async (_req, res) => {
  try {
    requireAdmin(expressUser(_req));
    await logAudit(expressUser(_req), "trash.clear_all");
    const patients = await listCollection("patients");
    const deletedPatients = patients.filter((p: any) => p.isDeleted);

    for (const patient of deletedPatients) {
      await wipePatientAssets(patient);
      await deleteDocument("patients", patient.id);
    }

    await bumpAnalyticsVersion();
    res.json({ success: true });
  } catch (error: any) {
    apiError(res, error);
  }
});

app.get("/api/files", async (req, res) => {
  try {
    const user = expressUser(req);
    const files = await listCollection("files");
    const allPatients = await listCollection("patients");
    const visibleIds = new Set(
      allPatients
        .filter((p: any) => !p.createdBy || p.createdBy === user.uid || user.role === "admin")
        .map((p: any) => p.id)
    );
    return res.json(files.filter((f: any) => visibleIds.has(f.patientId)));
  } catch (error: any) {
    apiError(res, error);
  }
});

app.post("/api/files", async (req, res) => {
  try {
    const patients = await listCollection("patients");
    const patient = patients.find((p: any) => p.id === req.body.patientId);
    if (!patient) return res.status(404).json({ error: "Patient record not found." });
    if (patient.createdBy && patient.createdBy !== expressUser(req).uid && expressUser(req).role !== "admin") {
      return res.status(403).json({ error: "Access denied." });
    }
    const folderId = await ensureDriveFolder(patient);
    const driveFile = await uploadToDrive(req.body, folderId);
    const id = newId("file");
    const metadata = {
      id,
      patientId: req.body.patientId,
      name: req.body.name,
      mimeType: req.body.mimeType,
      size: Number(driveFile.size || req.body.size || 0),
      uploadDate: new Date().toISOString().split("T")[0],
      extracted: Boolean(req.body.extracted),
      driveFileId: driveFile.id,
      driveFolderId: folderId,
      webViewLink: driveFile.webViewLink || "",
      webContentLink: driveFile.webContentLink || "",
    };
    const savedFile = await saveDocument("files", id, metadata);
    await logAudit(expressUser(req), "file.upload", req.body.patientId, metadata.name);
    res.json(savedFile);
  } catch (error: any) {
    apiError(res, error);
  }
});

app.post("/api/wipe", async (_req, res) => {
  try {
    requireAdmin(expressUser(_req));
    await logAudit(expressUser(_req), "database.wipe");
    // Delete all file records and their Drive files
    const files = await listCollection("files");
    await Promise.all(files.map(async (file: any) => {
      if (file.driveFileId) {
        try {
          await deleteDriveFile(file.driveFileId);
        } catch (e) {
          console.error(`Failed to delete Drive file ${file.driveFileId}:`, e);
        }
      }
      await deleteDocument("files", file.id);
    }));

    // Delete all patient records and their Drive folders
    const patients = await listCollection("patients");
    await Promise.all(patients.map(async (patient: any) => {
      if (patient.driveFolderId) {
        try {
          await recursivelyDeleteDriveFolder(patient.driveFolderId);
        } catch (e) {
          console.error(`Failed to recursively delete Drive folder for patient ${patient.id}:`, e);
        }
      }
      await deleteDocument("patients", patient.id);
    }));

    // Additionally, recursively delete all orphaned patient folders directly from the root Drive folder
    // This catches folders created but not persisted to Firestore
    if (driveFolderId) {
      try {
        const token = await getDriveAccessToken();
        let pageToken = null;
        let totalDeleted = 0;

        do {
          const query = `'${driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`;
          const encodedQuery = encodeURIComponent(query);
          const pageTokenParam = pageToken ? `&pageToken=${pageToken}` : "";
          const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&spaces=drive&pageSize=100&fields=files(id,mimeType,name)${pageTokenParam}`;
          
          console.log(`Scanning root folder ${driveFolderId} for orphaned patient folders (page: ${pageToken || "first"})...`);
          const listResponse = await fetch(listUrl, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (!listResponse.ok) {
            console.error(`Failed to list root folder contents: ${listResponse.status} ${await listResponse.text()}`);
            break;
          }

          const listData = await listResponse.json();
          const rootChildren = listData.files || [];
          pageToken = listData.nextPageToken || null;
          
          console.log(`Found ${rootChildren.length} folders in this batch`);
          
          // Delete all remaining patient folders (identified as folders)
          for (const child of rootChildren) {
            try {
              console.log(`Deleting orphaned Drive folder: ${child.id}`);
              await recursivelyDeleteDriveFolder(child.id);
              totalDeleted++;
            } catch (e) {
              console.error(`Failed to delete orphaned folder ${child.id}:`, e);
            }
          }
        } while (pageToken);

        console.log(`Wipe complete: deleted ${totalDeleted} orphaned patient folders from Drive`);
      } catch (e) {
        console.error("Error cleaning up orphaned Drive folders:", e);
      }
    }

    await bumpAnalyticsVersion();
    res.json({ success: true });
  } catch (error: any) {
    apiError(res, error);
  }
});

app.get("/api/quota", (req, res) => {
  const user = expressUser(req);
  const configuredKeys = [primaryGeminiKey, secondaryGeminiKey].filter(Boolean).length;
  const info = {
    configuredKeys: user.role === "admin" ? configuredKeys : (configuredKeys ? 1 : 0),
    requestsMade: user.role === "admin" ? geminiRequestCount : undefined,
    quotaLimit: user.role === "admin" ? 1500 * Math.max(configuredKeys, 1) : undefined,
    quotaRemainingEstimate: user.role === "admin" ? Math.max(0, 1500 * Math.max(configuredKeys, 1) - geminiRequestCount) : undefined,
    resetDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: configuredKeys ? "Active" : "No Gemini key configured",
  };
  res.json(info);
});

app.post("/api/chat", async (req, res) => {
  // Accept either `patientRecord` (newer client) or `patientContext` (legacy) so both work.
  const { query, patientRecord, patientContext } = req.body || {};
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "Query is required" });
  }
  if (query.length > 2000) {
    return res.status(400).json({ error: "Query exceeds maximum length of 2000 characters." });
  }
  const cleanedQuery = query.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  if (cleanedQuery !== query) {
    return res.status(400).json({ error: "Query contains invalid control characters." });
  }
  const patient = patientRecord || patientContext || {};

  // Verify user has access to this patient and AI consent is given
  if (patient.id) {
    const fetched = await getFirestoreDoc("patients", patient.id);
    if (!fetched) return res.status(404).json({ error: "Patient not found." });
    const userInfo = expressUser(req);
    if (fetched.createdBy && fetched.createdBy !== userInfo.uid && userInfo.role !== "admin") {
      return res.status(403).json({ error: "Access denied to this patient's records." });
    }
    if (fetched.consent_ai_processing === false) {
      return res.status(403).json({ error: "Patient has not consented to AI data processing." });
    }
  }

  geminiRequestCount++;

  // Build a focused, clinically-structured summary of the patient record so the
  // model has the priority facts at a glance (demographics, dx, stage, IHC,
  // biomarkers, last treatments, problems) instead of one giant JSON blob.
  const pick = (v: any) => (v === undefined || v === null || v === "" ? "—" : String(v));
  const list = (arr: any[], map: (r: any) => string, max = 8) =>
    Array.isArray(arr) && arr.length
      ? arr.slice(0, max).map(map).filter(Boolean).join("\n")
      : "—";

  const demographics = [
    `Name: ${pick(patient.first_name)} ${pick(patient.last_name)}`,
    `Title: ${pick(patient.title)}`,
    `DOB: ${pick(patient.dob)}  Age: ${pick(patient.age)}  Sex: ${pick(patient.gender)}`,
    `NIC: ${pick(patient.nic)}  TP/Clinic: ${pick(patient.tp)}`,
    `Oncology: ${pick(patient.oncology)}${Array.isArray(patient.oncology_types) && patient.oncology_types.length ? "  (" + patient.oncology_types.join(", ") + ")" : ""}`,
    `Oncology other: ${pick(patient.oncology_other)}`,
  ].join("\n");

  const diagnosis = [
    `Provisional: ${pick(patient.provisional_diagnosis)}`,
    `Final: ${pick(patient.final_diagnosis)}`,
    `Overall stage: ${pick(patient.overall_stage)}`,
    `TNM: ${pick(patient.tnm_stage)}`,
  ].join("\n");

  const blood = list(patient.bloodTable, (r: any) =>
    `  - ${pick(r.blood_type)} ${pick(r.blood_purpose)}${r.blood_date ? " (" + r.blood_date + ")" : ""}: ${pick(r.blood_findings)}${r.blood_notes ? "  // " + r.blood_notes : ""}`);

  const tumorMarkers = list(patient.tumorMarkersTable, (r: any) =>
    `  - ${pick(r.marker_name)} = ${pick(r.marker_value)} ${pick(r.marker_unit)}${r.marker_date ? " (" + r.marker_date + ")" : ""}`);

  const imaging = list(patient.imagingTable, (r: any) => {
    const mass = [r.mass_present, r.mass_size, r.mass_location, r.calcifications].filter(Boolean).join(" / ");
    const ext = [r.lymph_nodes, r.metastasis, r.ascites, r.pv_status, r.sma_status].filter(Boolean).join(" | ");
    return `  - ${pick(r.imaging_type)} ${pick(r.imaging_purpose)} target ${pick(r.imaging_parameter)}: ${pick(r.imaging_findings)}${mass ? " | mass " + mass : ""}${ext ? " | " + ext : ""}`;
  });

  const biopsy = list(patient.biopsyTable, (r: any) => {
    const ext = [r.cell_type, r.margin_status, r.lvi, r.perineural_invasion, r.lymph_nodes, r.metastasis].filter(Boolean).join(", ");
    return `  - ${pick(r.biopsy_type)} ${pick(r.biopsy_purpose)} site ${pick(r.biopsy_parameter)}: ${pick(r.biopsy_findings)}  // ${ext}`;
  });

  const ihc = list(patient.immunohistochemistryTable, (r: any) =>
    `  - ${pick(r.ihc_marker)} [${pick(r.ihc_panel)}]: ${pick(r.ihc_result)} ${pick(r.ihc_intensity)} ${pick(r.ihc_percentage)} score=${pick(r.ihc_score)} pattern=${pick(r.ihc_pattern)} interp=${pick(r.ihc_interpretation)}`);

  const surgery = list(patient.surgeryTable, (r: any) => {
    const drains = [r.drain_status, r.drain_volume].filter(Boolean).join(" ");
    return `  - ${pick(r.surgery_name)} ${pick(r.surgery_date)} site ${pick(r.surgery_site)} approach ${pick(r.surgery_approach)}: ${pick(r.surgery_findings)}${drains ? "  drains: " + drains : ""}`;
  });

  const complications = list(patient.complicationTable, (r: any) =>
    `  - ${pick(r.complication)} @ ${pick(r.post_op_duration)}: ${pick(r.management)}${r.notes ? "  notes: " + r.notes : ""}`);

  const monitoring = list(patient.monitoringTable, (r: any) =>
    `  - ${pick(r.monitor_param)} ${pick(r.monitor_duration)}: ${pick(r.monitor_findings)}${r.monitor_notes ? "  notes: " + r.monitor_notes : ""}`);

  const icu = list(patient.icuTable, (r: any) =>
    `  - admitted ${pick(r.icu_date)}, stay ${pick(r.icu_stay)}d, exit ${pick(r.icu_exit)}: ${pick(r.icu_mgmt)}${r.icu_notes ? "  notes: " + r.icu_notes : ""}`);

  const ward = list(patient.wardTable, (r: any) =>
    `  - entered ${pick(r.ward_entry)}, stay ${pick(r.ward_stay)}d, exit ${pick(r.ward_exit)}: ${pick(r.ward_mgmt)}${r.ward_notes ? "  notes: " + r.ward_notes : ""}`);

  const chemo = list(patient.neoChemoTable, (r: any) =>
    `  - [Neo] ${pick(r.neo_chemo_drug)} ${pick(r.neo_chemo_dose)} ${pick(r.neo_chemo_freq)} ${pick(r.neo_chemo_route)} x${pick(r.neo_chemo_cycles)}  effects: ${pick(r.neo_chemo_effects)}`);

  const adjChemo = list(patient.adjChemoTable, (r: any) =>
    `  - [Adj] ${pick(r.neo_chemo_drug)} ${pick(r.neo_chemo_dose)} ${pick(r.neo_chemo_freq)} ${pick(r.neo_chemo_route)} x${pick(r.neo_chemo_cycles)}  effects: ${pick(r.neo_chemo_effects)}`);

  const radio = list(patient.neoRadioTable, (r: any) =>
    `  - [Neo] ${pick(r.neo_radio_comp)} ${pick(r.neo_radio_dose)}Gy ${pick(r.neo_radio_route)} x${pick(r.neo_radio_cycles)}  effects: ${pick(r.neo_radio_effects)}`);

  const adjRadio = list(patient.adjRadioTable, (r: any) =>
    `  - [Adj] ${pick(r.neo_radio_comp)} ${pick(r.neo_radio_dose)}Gy ${pick(r.neo_radio_route)} x${pick(r.neo_radio_cycles)}  effects: ${pick(r.neo_radio_effects)}`);

  const supplementary = list(patient.supplementaryDetailsTable, (r: any) =>
    `  - [${pick(r.detail_heading)}${r.detail_subheading ? " / " + r.detail_subheading : ""}] ${pick(r.detail_label)} = ${pick(r.detail_value)} ${pick(r.detail_unit)}${r.detail_date ? " (" + r.detail_date + ")" : ""}${r.detail_priority ? " [" + r.detail_priority + "]" : ""}`);

  const problems = list(patient.problemTable, (r: any) =>
    `  - ${pick(r.problem)}  plan: ${pick(r.management_plan)}`);

  const userPrompt = `PATIENT MEDICAL RECORD (structured summary):

== Demographics ==
${demographics}

== Diagnosis & Staging ==
${diagnosis}

== Comorbidities & History ==
${pick(patient.comorbidity)}
${pick(patient.allergy_history)}
${pick(patient.smoking_status)}
${pick(patient.alcohol_use)}
Family hx: ${pick(patient.family_history)}

== Blood / Labs ==
${blood}

== Tumor Markers ==
${tumorMarkers}

== Imaging ==
${imaging}

== Biopsy / Histopathology ==
${biopsy}

== Immunohistochemistry (IHC) ==
${ihc}

== Surgical Procedures ==
Procedure:
${surgery}

Post op complications:
${complications}

Post op monitoring:
${monitoring}

ICU admission after surgery (status: ${pick(patient.icu_done)}):
${icu}

Ward admission details after surgery / ICU:
${ward}

== Chemotherapy ==
Neo-adjuvant (status: ${pick(patient.neo_chemo_status)}):
${chemo}

Adjuvant (status: ${pick(patient.adj_chemo_status)}):
${adjChemo}

== Radiotherapy ==
Neo-adjuvant (status: ${pick(patient.neo_radio_status)}):
${radio}

Adjuvant (status: ${pick(patient.adj_radio_status)}):
${adjRadio}

== Supplementary / Additional Details ==
${supplementary}

== Active Problems / Plan ==
${problems}

== Care Notes ==
Follow-up: ${pick(patient.follow_up_notes)}
Performance / Vitals: ${pick(patient.general_notes)}

== Clinician question ==
${cleanedQuery}
== Answer requirements ==
- Ground every claim in the patient's record above. If data is missing, say "not on file" rather than guessing.
- When you reference a guideline, name the source and year (e.g. "NCCN 2024 breast cancer guidelines", "ESMO 2023", "ASCO 2022").
- **OUTPUT FORMAT (use markdown exactly as shown):**
  - Start with RED FLAGS section if any: "#" + "# RED FLAGS" then bullet points
  - Use "#" + "# Section Title" for major sections (Assessment, Management, Investigations, Therapy, Follow-up)
  - Use "#" + "## Subsection" for sub-sections
  - Bold key terms with "**term**"
  - Use bullet lists with "- " for scannable points
  - End with "#" + "# Suggested Follow-Up Questions" and numbered list "1. Question"
- Highlight RED FLAGS (e.g. rising tumor markers, new symptoms, treatment-stopping toxicity) at the top.
- At the end, list 2-4 SUGGESTED FOLLOW-UP QUESTIONS the clinician could ask next.
- Do NOT present autonomous treatment orders. Frame all suggestions as clinician-decision support.

== Output Example ==
#"# RED FLAGS
- **Rising CEA**: 12.4 \u2192 28.7 ng/mL over 3 months \u2014 suggests progression
- **New liver lesion** on imaging not previously documented

#"# Assessment
**Stage IV colorectal cancer** with liver metastases. ECOG 1.

### Key Findings
- **Tumor markers**: CEA rising (12.4 → 28.7 ng/mL)
- **Imaging**: 3 new liver lesions, largest 3.2 cm segment VII
- **Biopsy**: Adenocarcinoma, RAS wild-type (on file)

## Management
- **NCCN 2024**: FOLFOX + bevacizumab preferred first-line for RAS wild-type
- **ESMO 2023**: Consider liver-directed therapy if oligometastatic
- **Action**: MDT discussion for potential resection/ablation

## Suggested Follow-Up Questions
1. Should we obtain liquid biopsy for RAS status confirmation?
2. Is patient a candidate for clinical trial?
3. Should we refer for hepatic MDT evaluation?`;

  const systemInstruction = `You are a clinician-facing oncology AI co-pilot. You answer questions about a specific patient by combining the patient's record with current standard oncological guidelines (NCCN, ESMO, ASCO, ASTRO, AJCC 8th ed., etc.). Always cite guideline source + year. Be concise, scannable, and safety-first: if data is missing, prompt for it; if findings conflict, call it out. Never claim you have prescribed or treated the patient.`;

  try {
    const text = await runGemini(userPrompt, systemInstruction, undefined);
    // Return both `reply` (newer client) and `text` (legacy) for back-compat.
    return res.json({ reply: text, text });
  } catch (error: any) {
    apiError(res, error, 502, "AI chat failed.");
  }
});

export default app;

export async function startServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("/favicon.ico", (_req, res) => res.redirect("/favicon.svg"));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
  startServer();
}
