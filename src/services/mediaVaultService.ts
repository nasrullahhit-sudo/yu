export type VaultFileCategory = 'video' | 'image' | 'pdf' | 'audio' | 'other';

export interface VaultFileMeta {
  id: string;
  ownerId: string; // user.uid or 'local'
  name: string;
  mimeType: string;
  sizeBytes: number;
  category: VaultFileCategory;
  width?: number;
  height?: number;
  aspectRatioLabel?: string; // e.g. "16:9", "9:16", "4:3", "1:1"
  resolutionLabel?: string; // e.g. "4K UHD", "1080p HD", "720p HD"
  durationSec?: number;
  thumbDataUrl?: string; // Lightweight card preview ONLY; original blob is untouched!
  createdAtMs: number;
}

interface StoredVaultRecord extends VaultFileMeta {
  blob: Blob;
}

const DB_NAME = 'nasrullah_media_vault_v1';
const STORE_NAME = 'files';
const DB_VERSION = 1;

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('ownerId', 'ownerId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('মিডিয়া ভল্ট ডেটাবেজ খোলা যায়নি।'));
  });
}

export function detectCategory(file: { type?: string; name?: string }): VaultFileCategory {
  const mime = (file.type || '').toLowerCase();
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi'].includes(ext)) {
    return 'video';
  }
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'svg'].includes(ext)
  ) {
    return 'image';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
    return 'audio';
  }
  return 'other';
}

export function formatAspectRatio(w?: number, h?: number): string | undefined {
  if (!w || !h || w <= 0 || h <= 0) return undefined;
  const ratio = w / h;
  const known: Array<[number, string]> = [
    [16 / 9, '16:9'],
    [9 / 16, '9:16'],
    [4 / 3, '4:3'],
    [3 / 4, '3:4'],
    [1, '1:1'],
    [21 / 9, '21:9'],
    [3 / 2, '3:2'],
    [2 / 3, '2:3'],
    [4 / 5, '4:5'],
  ];
  for (const [target, label] of known) {
    if (Math.abs(ratio - target) < 0.045) return label;
  }
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(Math.round(w), Math.round(h)) || 1;
  const rw = Math.round(w / d);
  const rh = Math.round(h / d);
  if (rw <= 32 && rh <= 32) return `${rw}:${rh}`;
  return `${ratio.toFixed(2)}:1`;
}

export function formatResolutionLabel(w?: number, h?: number): string | undefined {
  if (!w || !h) return undefined;
  const shortSide = Math.min(w, h);
  const longSide = Math.max(w, h);
  if (shortSide >= 2100 || longSide >= 3800) return '4K UHD';
  if (shortSide >= 1400 || longSide >= 2500) return '2K QHD';
  if (shortSide >= 1040 || longSide >= 1900) return '1080p Full HD';
  if (shortSide >= 700 || longSide >= 1240) return '720p HD';
  return `${w}×${h}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function probeImageMeta(file: File): Promise<{
  width?: number;
  height?: number;
  thumbDataUrl?: string;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      let thumbDataUrl: string | undefined;
      try {
        const maxSide = 480;
        const scale = Math.min(1, maxSide / Math.max(width || 1, height || 1));
        const cw = Math.max(1, Math.round(width * scale));
        const ch = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, cw, ch);
          thumbDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        }
      } catch {
        thumbDataUrl = undefined;
      }
      URL.revokeObjectURL(url);
      resolve({ width, height, thumbDataUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({});
    };
    img.src = url;
  });
}

async function probeVideoMeta(file: File): Promise<{
  width?: number;
  height?: number;
  durationSec?: number;
  thumbDataUrl?: string;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let done = false;
    const finish = (meta: {
      width?: number;
      height?: number;
      durationSec?: number;
      thumbDataUrl?: string;
    }) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(meta);
    };

    const timer = setTimeout(() => {
      finish({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        durationSec: isFinite(video.duration) ? video.duration : undefined,
      });
    }, 4500);

    video.onloadedmetadata = () => {
      const targetTime = Math.min(1.0, Math.max(0.05, (video.duration || 0) * 0.15));
      try {
        video.currentTime = targetTime;
      } catch {
        clearTimeout(timer);
        finish({
          width: video.videoWidth || undefined,
          height: video.videoHeight || undefined,
          durationSec: isFinite(video.duration) ? video.duration : undefined,
        });
      }
    };

    video.onseeked = () => {
      clearTimeout(timer);
      const width = video.videoWidth || undefined;
      const height = video.videoHeight || undefined;
      const durationSec = isFinite(video.duration) ? video.duration : undefined;
      let thumbDataUrl: string | undefined;
      try {
        if (width && height) {
          const maxSide = 480;
          const scale = Math.min(1, maxSide / Math.max(width, height));
          const cw = Math.max(1, Math.round(width * scale));
          const ch = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, cw, ch);
            thumbDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          }
        }
      } catch {
        thumbDataUrl = undefined;
      }
      finish({ width, height, durationSec, thumbDataUrl });
    };

    video.onerror = () => {
      clearTimeout(timer);
      finish({});
    };

    video.src = url;
  });
}

/**
 * Stores ANY file (4K/1080p 16:9 or 9:16 video, image, PDF, audio, document)
 * bit-for-bit identically in IndexedDB without any compression or cropping.
 */
export async function saveFileToVault(file: File, ownerId: string): Promise<VaultFileMeta> {
  const category = detectCategory(file);
  let width: number | undefined;
  let height: number | undefined;
  let durationSec: number | undefined;
  let thumbDataUrl: string | undefined;

  if (category === 'image') {
    const meta = await probeImageMeta(file);
    width = meta.width;
    height = meta.height;
    thumbDataUrl = meta.thumbDataUrl;
  } else if (category === 'video') {
    const meta = await probeVideoMeta(file);
    width = meta.width;
    height = meta.height;
    durationSec = meta.durationSec;
    thumbDataUrl = meta.thumbDataUrl;
  }

  const record: StoredVaultRecord = {
    id: `vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ownerId,
    name: file.name,
    mimeType: file.type || (category === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
    sizeBytes: file.size,
    category,
    width,
    height,
    aspectRatioLabel: formatAspectRatio(width, height),
    resolutionLabel: formatResolutionLabel(width, height),
    durationSec,
    thumbDataUrl,
    createdAtMs: Date.now(),
    // Store the exact untouched original File/Blob!
    blob: file,
  };

  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('ফাইল সেভ করা যায়নি।'));
  });
  db.close();

  const { blob: _omit, ...metaOnly } = record;
  return metaOnly;
}

export async function listVaultFiles(ownerId: string): Promise<VaultFileMeta[]> {
  const db = await openVaultDb();
  const rows = await new Promise<VaultFileMeta[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result || []) as StoredVaultRecord[];
      // Include files saved under this user OR local guest files so nothing ever disappears after sign-in
      const filtered = all
        .filter((r) => r.ownerId === ownerId || r.ownerId === 'local')
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .map(({ blob: _omit, ...meta }) => meta);
      resolve(filtered);
    };
    req.onerror = () => reject(req.error || new Error('ভল্ট ফাইল লোড করা যায়নি।'));
  });
  db.close();
  return rows;
}

export async function getVaultFileBlob(id: string): Promise<{ blob: Blob; meta: VaultFileMeta } | null> {
  const db = await openVaultDb();
  const record = await new Promise<StoredVaultRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as StoredVaultRecord | undefined);
    req.onerror = () => reject(req.error || new Error('ফাইল পড়া যায়নি।'));
  });
  db.close();
  if (!record) return null;
  const { blob, ...meta } = record;
  return { blob, meta };
}

export async function deleteVaultFile(id: string): Promise<void> {
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('ফাইল মুছা যায়নি।'));
  });
  db.close();
}

export async function saveBlobToVault(
  blob: Blob,
  fileName: string,
  ownerId: string
): Promise<VaultFileMeta> {
  const safeName = fileName.trim() || `nasrullah-video-${Date.now()}.webm`;
  const file = new File([blob], safeName, {
    type: blob.type || 'video/webm',
    lastModified: Date.now(),
  });
  return saveFileToVault(file, ownerId);
}

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  availableBytes: number;
  usedPercent: number;
  vaultUsedBytes: number;
  isPersisted: boolean;
  supported: boolean;
}

export async function getStorageQuotaInfo(vaultUsedBytes = 0): Promise<StorageQuotaInfo> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const usageBytes = Math.max(vaultUsedBytes, est.usage || 0);
      const quotaBytes = est.quota || 0;
      const availableBytes = quotaBytes > 0 ? Math.max(0, quotaBytes - usageBytes) : 0;
      const usedPercent = quotaBytes > 0 ? Math.min(100, (usageBytes / quotaBytes) * 100) : 0;
      let isPersisted = false;
      try {
        if (navigator.storage.persisted) {
          isPersisted = await navigator.storage.persisted();
        }
      } catch {
        isPersisted = false;
      }
      return {
        usageBytes,
        quotaBytes,
        availableBytes,
        usedPercent,
        vaultUsedBytes,
        isPersisted,
        supported: quotaBytes > 0,
      };
    }
  } catch {
    // Fallback if StorageManager API is unavailable
  }
  return {
    usageBytes: vaultUsedBytes,
    quotaBytes: 0,
    availableBytes: 0,
    usedPercent: 0,
    vaultUsedBytes,
    isPersisted: false,
    supported: false,
  };
}

