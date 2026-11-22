import { clearGoogleDriveAccessToken } from '../firebase.ts';
import {
  detectCategory,
  formatAspectRatio,
  formatResolutionLabel,
  VaultFileMeta,
} from './mediaVaultService.ts';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const STUDIO_FOLDER_NAME = 'Nasrullah Studio Library';

export interface DriveStorageQuotaInfo {
  limitBytes: number;
  usageBytes: number;
  usageInDriveBytes: number;
  availableBytes: number;
  usedPercent: number;
  email?: string;
}

export interface DriveVaultFileMeta extends VaultFileMeta {
  source: 'drive';
  driveFileId: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

function handleDriveResponseStatus(res: Response): void {
  if (res.status === 401) {
    clearGoogleDriveAccessToken();
    throw new Error('Google Drive সেশনের মেয়াদ শেষ হয়েছে। অনুগ্রহ করে আবার Google দিয়ে কানেক্ট করুন।');
  }
}

export async function ensureStudioDriveFolder(accessToken: string): Promise<string> {
  const query = `name='${STUDIO_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const listUrl = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=5`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  handleDriveResponseStatus(listRes);
  if (!listRes.ok) {
    throw new Error('Google Drive ফোল্ডার যাচাই করা যায়নি।');
  }
  const listData = await listRes.json();
  if (Array.isArray(listData.files) && listData.files.length > 0 && listData.files[0].id) {
    return listData.files[0].id as string;
  }

  // Create dedicated folder inside user's Google Drive
  const createRes = await fetch(`${DRIVE_API_BASE}/files?fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: STUDIO_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  handleDriveResponseStatus(createRes);
  if (!createRes.ok) {
    throw new Error('Google Drive-এ লাইব্রেরি ফোল্ডার তৈরি করা যায়নি।');
  }
  const created = await createRes.json();
  return created.id as string;
}

function mapDriveFileToMeta(f: any, ownerId: string): DriveVaultFileMeta {
  const name = String(f.name || 'Untitled');
  const mimeType = String(f.mimeType || 'application/octet-stream');
  const sizeBytes = Number(f.size) || 0;
  const category = detectCategory({ type: mimeType, name });

  const width =
    Number(f.videoMediaMetadata?.width) ||
    Number(f.imageMediaMetadata?.width) ||
    undefined;
  const height =
    Number(f.videoMediaMetadata?.height) ||
    Number(f.imageMediaMetadata?.height) ||
    undefined;
  const durationMs = Number(f.videoMediaMetadata?.durationMillis);
  const durationSec = Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : undefined;

  const createdAtMs = f.createdTime ? Date.parse(f.createdTime) || Date.now() : Date.now();

  return {
    id: `drive_${f.id}`,
    driveFileId: String(f.id),
    source: 'drive',
    ownerId,
    name,
    mimeType,
    sizeBytes,
    category,
    width,
    height,
    aspectRatioLabel: formatAspectRatio(width, height),
    resolutionLabel: formatResolutionLabel(width, height),
    durationSec,
    thumbDataUrl: f.thumbnailLink || undefined,
    thumbnailLink: f.thumbnailLink || undefined,
    webViewLink: f.webViewLink || undefined,
    createdAtMs,
  };
}

export async function listGoogleDriveStudioFiles(
  accessToken: string,
  ownerId: string
): Promise<DriveVaultFileMeta[]> {
  const folderId = await ensureStudioDriveFolder(accessToken);
  const query = `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`;
  const fields =
    'files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink,videoMediaMetadata(width,height,durationMillis),imageMediaMetadata(width,height))';
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&pageSize=100&fields=${encodeURIComponent(fields)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  handleDriveResponseStatus(res);
  if (!res.ok) {
    throw new Error('Google Drive থেকে ফাইল তালিকা লোড করা যায়নি।');
  }
  const data = await res.json();
  const files = Array.isArray(data.files) ? data.files : [];
  return files.map((f: any) => mapDriveFileToMeta(f, ownerId));
}

export async function getGoogleDriveStorageQuota(
  accessToken: string
): Promise<DriveStorageQuotaInfo | null> {
  const res = await fetch(`${DRIVE_API_BASE}/about?fields=storageQuota,user(emailAddress)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  handleDriveResponseStatus(res);
  if (!res.ok) return null;
  const data = await res.json();
  const q = data?.storageQuota;
  if (!q) return null;
  const limitBytes = Number(q.limit) || 0;
  const usageBytes = Number(q.usage) || 0;
  const usageInDriveBytes = Number(q.usageInDrive) || 0;
  const availableBytes = Math.max(0, limitBytes - usageBytes);
  const usedPercent = limitBytes > 0 ? Math.min(100, (usageBytes / limitBytes) * 100) : 0;

  return {
    limitBytes,
    usageBytes,
    usageInDriveBytes,
    availableBytes,
    usedPercent,
    email: data?.user?.emailAddress || undefined,
  };
}

/**
 * Uploads any Blob or File in 100% original untouched quality to the user's Google Drive
 * "Nasrullah Studio Library" folder using Google Drive Resumable Upload API.
 */
export async function uploadBlobToGoogleDrive(
  accessToken: string,
  blob: Blob,
  fileName: string,
  ownerId: string,
  onProgress?: (percent: number) => void
): Promise<DriveVaultFileMeta> {
  const folderId = await ensureStudioDriveFolder(accessToken);
  const mimeType = blob.type || 'application/octet-stream';
  const fields =
    'id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink,videoMediaMetadata(width,height,durationMillis),imageMediaMetadata(width,height)';

  // Step 1: Initiate resumable upload session
  const initUrl = `${DRIVE_UPLOAD_BASE}/files?uploadType=resumable&fields=${encodeURIComponent(fields)}`;
  const initRes = await fetch(initUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(blob.size),
    },
    body: JSON.stringify({
      name: fileName,
      mimeType,
      parents: [folderId],
    }),
  });
  handleDriveResponseStatus(initRes);
  if (!initRes.ok) {
    throw new Error('Google Drive আপলোড শুরু করা যায়নি। ড্রাইভে পর্যাপ্ত খালি জায়গা আছে কিনা দেখুন।');
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('Google Drive আপলোড সেশন পাওয়া যায়নি।');
  }

  // Step 2: Upload raw original bytes via XMLHttpRequest to emit smooth real-time progress
  const uploadedFile = await new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', mimeType);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress?.(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 401) {
        clearGoogleDriveAccessToken();
        reject(new Error('Google Drive সেশনের মেয়াদ শেষ হয়েছে। আবার কানেক্ট করুন।'));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('আপলোড হয়েছে কিন্তু ফাইল তথ্য পড়া যায়নি।'));
        }
      } else {
        reject(new Error(`Google Drive আপলোড ব্যর্থ হয়েছে (কোড ${xhr.status})।`));
      }
    };

    xhr.onerror = () => reject(new Error('ইন্টারনেট সংযোগের কারণে Google Drive আপলোড ব্যাহত হয়েছে।'));
    xhr.send(blob);
  });

  return mapDriveFileToMeta(uploadedFile, ownerId);
}

/**
 * Fetches the 100% original untouched file bytes from Google Drive for in-app viewing or download.
 */
export async function fetchGoogleDriveFileBlob(
  accessToken: string,
  driveFileId: string
): Promise<Blob> {
  const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(driveFileId)}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  handleDriveResponseStatus(res);
  if (!res.ok) {
    throw new Error('Google Drive থেকে অরিজিনাল ফাইল ডাউনলোড করা যায়নি।');
  }
  return await res.blob();
}

/**
 * Permanently deletes a file created by this app from Google Drive.
 * MUST ONLY be called after explicit user confirmation in the UI!
 */
export async function deleteGoogleDriveFile(
  accessToken: string,
  driveFileId: string
): Promise<void> {
  const url = `${DRIVE_API_BASE}/files/${encodeURIComponent(driveFileId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  handleDriveResponseStatus(res);
  if (!res.ok && res.status !== 204) {
    throw new Error('Google Drive থেকে ফাইল মুছতে সমস্যা হয়েছে।');
  }
}
