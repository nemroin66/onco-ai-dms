import type { VercelRequest, VercelResponse } from "@vercel/node";
import { listCollection, deleteDocument } from "../firebase.js";
import { deleteDriveFile, recursivelyDeleteDriveFolder } from "../drive.js";
import { bumpAnalyticsVersion } from "../analytics.js";
import { vercelUser } from "../auth.js";
import { logAudit } from "../audit.js";

const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 200;

async function deleteWithRateLimit<T>(items: T[], fn: (item: T) => Promise<void>, label: string) {
  let count = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(fn));
    count += batch.length;
    console.log(`[wipe] ${label}: ${count}/${items.length}`);
    if (i + BATCH_SIZE < items.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = vercelUser(req);
    const files = await listCollection("files");
    await deleteWithRateLimit(files, async (file: any) => {
      if (file.driveFileId) {
        try {
          await deleteDriveFile(file.driveFileId);
        } catch (e) {
          console.error(`Failed to delete Drive file ${file.driveFileId}:`, e);
        }
      }
      await deleteDocument("files", file.id);
    }, "files");

    const patients = await listCollection("patients");
    await deleteWithRateLimit(patients, async (patient: any) => {
      if (patient.driveFolderId) {
        try {
          await recursivelyDeleteDriveFolder(patient.driveFolderId);
        } catch (e) {
          console.error(`Failed to recursively delete Drive folder for patient ${patient.id}:`, e);
        }
      }
      await deleteDocument("patients", patient.id);
    }, "patients");

    const driveFolderId = process.env.DRIVE_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.VITE_DRIVE_ROOT_FOLDER_ID;

    if (driveFolderId) {
      const { getDriveAccessToken } = await import("../drive.js");
      try {
        const token = await getDriveAccessToken();
        let pageToken: string | null = null;
        let totalDeleted = 0;

        do {
          const query = `'${driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`;
          const encodedQuery = encodeURIComponent(query);
          const pageTokenParam = pageToken ? `&pageToken=${pageToken}` : "";
          const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&spaces=drive&pageSize=100&fields=files(id,mimeType,name)${pageTokenParam}`;

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

          for (const child of rootChildren) {
            try {
              await recursivelyDeleteDriveFolder(child.id);
              totalDeleted++;
            } catch (e) {
              console.error(`Failed to delete orphaned folder ${child.id} (${child.name}):`, e);
            }
          }
        } while (pageToken);

        console.log(`Wipe complete: deleted ${totalDeleted} orphaned patient folders from Drive`);
      } catch (e) {
        console.error("Error cleaning up orphaned Drive folders:", e);
      }
    }

    await bumpAnalyticsVersion();
    await logAudit(user, "database.wipe");
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[handler] Error:", error?.message || error);
    if (error?.stack) console.error(error.stack);
    return res.status(500).json({ error: "Request failed." });
  }
}
