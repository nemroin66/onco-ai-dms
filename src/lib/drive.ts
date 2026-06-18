import { getAccessToken } from './auth';

export const createPatientFolder = async (patientName: string) => {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    const folderMetadata: any = {
        name: patientName,
        mimeType: 'application/vnd.google-apps.folder',
    };

    // Use environment variable if available
    const rootFolderId = import.meta.env.VITE_DRIVE_ROOT_FOLDER_ID || import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
    if (rootFolderId) {
        folderMetadata.parents = [rootFolderId];
    }

    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(folderMetadata)
    });

    if (!response.ok) {
        throw new Error('Failed to create folder');
    }

    return await response.json();
};
