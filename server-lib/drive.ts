import path from "path";
import { getGoogleAccessToken, listCollection, deleteDocument, saveDocument } from "./firebase.js";

export async function getDriveAccessToken() {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

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

const ROOT_FOLDER_NAME = "ONCO_AI_DMS_PATIENTS";

async function getOrCreateRootFolder(token: string): Promise<string> {
  const q = encodeURIComponent(`name = '${ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const search = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!search.ok) throw new Error(`Drive root folder search failed: ${await search.text()}`);
  const data = await search.json();
  if (data.files?.length > 0) return data.files[0].id;

  const create = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: ROOT_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!create.ok) throw new Error(`Drive root folder create failed: ${await create.text()}`);
  return (await create.json()).id;
}

export async function ensureDriveFolder(patient: any) {
  if (patient.driveFolderId) return patient.driveFolderId;

  const token = await getDriveAccessToken();
  const rootId = await getOrCreateRootFolder(token);
  const patientName = [patient.last_name, patient.first_name, patient.initials].filter(Boolean).join("_") || patient.id;
  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: patientName.replace(/[^\w .-]/g, "_"),
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootId],
    }),
  });
  if (!response.ok) throw new Error(`Drive folder create failed: ${await response.text()}`);

  const folderId = (await response.json()).id;
  if (patient.id) {
    try {
      await saveDocument("patients", patient.id, { ...patient, driveFolderId: folderId, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.warn(`Could not persist driveFolderId for patient ${patient.id}:`, error);
    }
  }
  return folderId;
}

export async function uploadToDrive(payload: any, folderId: string) {
  const token = await getDriveAccessToken();
  const base64 = String(payload.contentBase64 || "").replace(/^data:.*?;base64,/, "");
  // File size check (10MB max)
  const fileBuffer = Buffer.from(base64, "base64");
  if (fileBuffer.length > 10 * 1024 * 1024) {
    throw new Error("File exceeds 10 MB size limit.");
  }

  // Magic byte validation — allow only medical document types
  const ALLOWED_MAGIC: Record<string, Uint8Array[]> = {
    "application/pdf": [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
    "image/jpeg": [new Uint8Array([0xFF, 0xD8, 0xFF])],
    "image/png": [new Uint8Array([0x89, 0x50, 0x4E, 0x47])],
    "image/tiff": [new Uint8Array([0x49, 0x49, 0x2A, 0x00]), new Uint8Array([0x4D, 0x4D, 0x00, 0x2A])],
    "image/bmp": [new Uint8Array([0x42, 0x4D])],
    "image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  };
  const sig = fileBuffer.slice(0, 4);
  const mime = payload.mimeType || (payload.name?.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
  const allowedMagic = Object.values(ALLOWED_MAGIC).some((magicList) =>
    magicList.some((m) => m.every((b, i) => sig[i] === b))
  );
  if (!allowedMagic) {
    throw new Error("File type not allowed. Only PDF, JPEG, PNG, TIFF, BMP, and WebP are accepted.");
  }

  // Filename sanitization — prevent path traversal
  const safeName = path
    .basename(payload.name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 200);

  const metadata = {
    name: safeName,
    mimeType: mime,
    parents: [folderId],
  };
  const boundary = `oncodb_${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${metadata.mimeType}\r\n\r\n`),
    Buffer.from(base64, "base64"),
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,mimeType,size", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!response.ok) throw new Error(`Drive upload failed: ${await response.text()}`);
  return response.json();
}

export async function deleteDriveFile(fileId: string) {
  const token = await getDriveAccessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&supportsTeamDrives=true`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (response.status === 204 || response.status === 404) {
    console.log(`Successfully deleted Drive file: ${fileId}`);
    return;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete Drive file ${fileId}: ${response.status} ${errorText}`);
  }
}

export async function recursivelyDeleteDriveFolder(folderId: string, maxRetries = 3) {
  const token = await getDriveAccessToken();
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
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
        }
      }

      console.log(`Deleting folder: ${folderId}`);
      await deleteDriveFile(folderId);

      console.log(`Successfully deleted folder ${folderId}`);
      return;

    } catch (e) {
      retryCount++;
      console.error(`Error deleting folder ${folderId} (attempt ${retryCount}/${maxRetries}):`, e);

      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      } else {
        console.error(`Final failure deleting folder ${folderId} after ${maxRetries} attempts`);
        throw e;
      }
    }
  }
}

export async function wipePatientAssets(patient: any) {
  let files: any[];
  try {
    // DB-level filter by patientId — requires composite index on files(patientId)
    files = await listCollection("files", {
      where: [{ field: "patientId", op: "==", value: patient.id }],
      select: ["id", "driveFileId"],
    });
  } catch {
    // Fallback: in-memory filter if index not yet created
    files = (await listCollection("files", { select: ["id", "driveFileId"] }))
      .filter((file: any) => file.patientId === patient.id);
  }
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
