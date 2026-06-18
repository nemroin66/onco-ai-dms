import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, getGoogleAccessToken } from "../firebase.js";

const SAMPLE_SIZE = 20;
const GB = 1_073_741_824;
const PROJECT_ID = process.env.FIREBASE_WEB_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "ai-dms-2-ac2f5";

async function fetchRealStorage(): Promise<number | null> {
  try {
    const token = await getGoogleAccessToken("https://www.googleapis.com/auth/monitoring.read");
    const end = new Date().toISOString();
    const start = new Date(Date.now() - 86400_000).toISOString();

    console.error(`[storage] Project: ${PROJECT_ID}, range: ${start} → ${end}`);

    const url =
      `https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}/timeSeries` +
      `?filter=${encodeURIComponent('metric.type="firestore.googleapis.com/document/storage"')}` +
      `&interval.startTime=${start}&interval.endTime=${end}` +
      `&aggregation.alignmentPeriod=86400s&aggregation.perSeriesAligner=ALIGN_MEAN`;

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const respBody = await resp.text();
    if (!resp.ok) {
      console.error(`[storage] Monitoring API ${resp.status}: ${respBody.slice(0, 600)}`);
      return null;
    }

    const data = JSON.parse(respBody);
    const points = data.timeSeries?.[0]?.points;
    if (!points?.length) {
      console.error(`[storage] No points. timeSeries count: ${data.timeSeries?.length || 0}`);
      if (data.timeSeries?.[0]) {
        console.error(`[storage] timeSeries[0] keys: ${Object.keys(data.timeSeries[0])}`);
        console.error(`[storage] metric: ${JSON.stringify(data.timeSeries[0].metric)}`);
        console.error(`[storage] resource: ${JSON.stringify(data.timeSeries[0].resource)}`);
      }
      return null;
    }
    return Number(points[points.length - 1]?.value?.double || 0);
  } catch (err: any) {
    console.error("[storage] fetchRealStorage exception:", err?.message || err);
    return null;
  }
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const col = db().collection("patients");
    const countSnap = await col.count().get();
    const totalDocs = countSnap.data().count;

    let usedBytes = await fetchRealStorage();
    let source: string;

    if (usedBytes !== null) {
      source = "real";
    } else {
      let avgBytes = 8_000;
      if (totalDocs > 0) {
        try {
          const sample = await col.limit(SAMPLE_SIZE).get();
          let totalBytes = 0;
          let sampled = 0;
          sample.forEach(doc => {
            totalBytes += Buffer.byteLength(JSON.stringify(doc.data()), "utf8");
            sampled++;
          });
          if (sampled > 0) avgBytes = Math.round(totalBytes / sampled);
        } catch { }
      }
      usedBytes = totalDocs * avgBytes;
      source = "estimated";
    }

    const quotaBytes = GB;

    return res.json({
      usedBytes,
      quotaBytes,
      usedFormatted: formatBytes(usedBytes),
      quotaFormatted: formatBytes(quotaBytes),
      percentUsed: Math.min(100, +((usedBytes / quotaBytes) * 100).toFixed(2)),
      totalDocuments: totalDocs,
      source,
    });
  } catch (error: any) {
    console.error("[storage] Error:", error?.message || error);
    return res.status(500).json({ error: "Storage estimate failed." });
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= GB) return (bytes / GB).toFixed(2) + " GB";
  if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + " MB";
  if (bytes >= 1_024) return (bytes / 1_024).toFixed(1) + " KB";
  return bytes + " B";
}
