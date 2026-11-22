import React, { useEffect, useState } from 'react';
import {
  X,
  Download,
  Maximize2,
  ZoomIn,
  ZoomOut,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  File,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import {
  formatFileSize,
  getVaultFileBlob,
  VaultFileMeta,
} from '../services/mediaVaultService.ts';
import { fetchGoogleDriveFileBlob } from '../services/googleDriveVaultService.ts';
import { triggerBlobDownload } from '../services/subtitleAndVideoService.ts';

export type ViewableVaultFile = VaultFileMeta & {
  source?: 'local' | 'drive';
  driveFileId?: string;
  webViewLink?: string;
};

interface MediaVaultViewerModalProps {
  file: ViewableVaultFile | null;
  driveAccessToken?: string | null;
  onClose: () => void;
}

export const MediaVaultViewerModal: React.FC<MediaVaultViewerModalProps> = ({
  file,
  driveAccessToken,
  onClose,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<boolean>(false);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setRawBlob(null);
      setTextPreview(null);
      setZoomed(false);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    setTextPreview(null);
    setZoomed(false);

    const loadOriginalBlob = async (): Promise<Blob | null> => {
      if (file.source === 'drive' && file.driveFileId) {
        if (!driveAccessToken) {
          throw new Error('Google Drive থেকে ফাইল দেখতে আবার Google দিয়ে কানেক্ট করুন।');
        }
        return await fetchGoogleDriveFileBlob(driveAccessToken, file.driveFileId);
      }
      const res = await getVaultFileBlob(file.id);
      return res ? res.blob : null;
    };

    loadOriginalBlob()
      .then(async (blob) => {
        if (cancelled) return;
        if (!blob) {
          setError('ফাইলটি পাওয়া যায়নি।');
          setLoading(false);
          return;
        }
        setRawBlob(blob);
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);

        // If plain text/subtitle/json/md file, decode preview text too
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (
          file.category === 'other' &&
          (file.mimeType.startsWith('text/') ||
            ['txt', 'srt', 'vtt', 'json', 'md', 'csv'].includes(ext)) &&
          file.sizeBytes < 1024 * 1024
        ) {
          try {
            const txt = await blob.text();
            if (!cancelled) setTextPreview(txt.slice(0, 12000));
          } catch {
            // ignore text preview failure
          }
        }
        setLoading(false);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || 'ফাইল লোড করতে সমস্যা হয়েছে।');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file?.id, file?.source, file?.driveFileId, driveAccessToken]);

  // Close on Escape
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [file, onClose]);

  if (!file) return null;

  const handleDownloadOriginal = () => {
    if (!rawBlob) return;
    triggerBlobDownload(rawBlob, file.name);
  };

  const categoryIcon = () => {
    if (file.category === 'video') return <Film className="w-4 h-4 text-amber-500" />;
    if (file.category === 'image') return <ImageIcon className="w-4 h-4 text-cyan-500" />;
    if (file.category === 'pdf') return <FileText className="w-4 h-4 text-rose-500" />;
    if (file.category === 'audio') return <Music className="w-4 h-4 text-emerald-500" />;
    return <File className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[94vh] bg-white dark:bg-[#0D1321] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Metadata & Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D17]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center shrink-0">
              {categoryIcon()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {file.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                {file.source === 'drive' && (
                  <>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      Google Drive · সব ডিভাইসে
                    </span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                {file.resolutionLabel && (
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    {file.resolutionLabel}
                  </span>
                )}
                {file.width && file.height && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {file.width}×{file.height}
                    </span>
                  </>
                )}
                {file.aspectRatioLabel && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                      {file.aspectRatioLabel}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{formatFileSize(file.sizeBytes)}</span>
                <span aria-hidden="true">·</span>
                <span>১০০% অরিজিনাল কোয়ালিটি</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {file.category === 'image' && (
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer"
                title={zoomed ? 'স্ক্রিনে ফিট করুন' : 'জুম করে দেখুন'}
              >
                {zoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{zoomed ? 'ফিট করুন' : 'জুম'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadOriginal}
              disabled={!rawBlob}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>অরিজিনাল ডাউনলোড</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Native Aspect-Preserving Preview Viewport */}
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-[#050810] flex items-center justify-center p-3 sm:p-5 min-h-[340px]">
          {loading ? (
            <div className="text-center space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-amber-500 mx-auto" />
              <p className="text-xs text-slate-600 dark:text-slate-400">
                অরিজিনাল ফাইল লোড হচ্ছে...
              </p>
            </div>
          ) : error ? (
            <div className="text-sm text-rose-600 dark:text-rose-300 font-semibold">{error}</div>
          ) : !objectUrl ? null : file.category === 'video' ? (
            <div className="w-full h-full flex items-center justify-center">
              <video
                src={objectUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[75vh] max-w-full w-auto h-auto rounded-xl shadow-2xl bg-black object-contain"
              />
            </div>
          ) : file.category === 'image' ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto">
              <img
                src={objectUrl}
                alt={file.name}
                className={
                  zoomed
                    ? 'max-w-none w-auto h-auto rounded-lg shadow-2xl cursor-zoom-out'
                    : 'max-h-[75vh] max-w-full w-auto h-auto object-contain rounded-xl shadow-2xl cursor-zoom-in'
                }
                onClick={() => setZoomed((z) => !z)}
              />
            </div>
          ) : file.category === 'pdf' ? (
            <div className="w-full h-[75vh] flex flex-col gap-2">
              <iframe
                src={objectUrl}
                title={file.name}
                className="w-full flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 px-1">
                <span>PDF-টি সরাসরি ওয়েবের ভেতরেই পড়তে পারবেন।</span>
                <a
                  href={objectUrl}
                  download={file.name}
                  className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>অরিজিনাল PDF সেভ করুন</span>
                </a>
              </div>
            </div>
          ) : file.category === 'audio' ? (
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-lg">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Music className="w-8 h-8" />
              </div>
              <div className="font-bold text-slate-900 dark:text-white text-sm break-all">
                {file.name}
              </div>
              <audio src={objectUrl} controls autoPlay className="w-full" />
            </div>
          ) : textPreview !== null ? (
            <pre className="w-full max-h-[72vh] overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {textPreview}
            </pre>
          ) : (
            <div className="max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-lg">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300">
                <Maximize2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-900 dark:text-white break-all">
                  {file.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {file.mimeType} · {formatFileSize(file.sizeBytes)}
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                এই ফাইল ফরম্যাটটি হুবহু অরিজিনাল অবস্থায় সংরক্ষিত আছে। নিচের বাটনে চাপলেই মূল ফাইল ডাউনলোড হবে।
              </p>
              <button
                type="button"
                onClick={handleDownloadOriginal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>অরিজিনাল ফাইল ডাউনলোড করুন</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
