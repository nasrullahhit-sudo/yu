import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Download,
  FolderPlus,
  Check,
  Loader2,
  Film,
  HardDrive,
  Subtitles,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  CloudUpload,
} from 'lucide-react';
import {
  formatAspectRatio,
  formatFileSize,
  formatResolutionLabel,
  getStorageQuotaInfo,
  saveBlobToVault,
  StorageQuotaInfo,
} from '../services/mediaVaultService.ts';
import {
  convertVideoBlobToMp4,
  triggerBlobDownload,
  VIDEO_QUALITY_OPTIONS,
  VideoAspect,
  VideoQualityPreset,
} from '../services/subtitleAndVideoService.ts';
import { connectGoogleDrive } from '../firebase.ts';
import { uploadBlobToGoogleDrive } from '../services/googleDriveVaultService.ts';

export interface ReadyExportVideo {
  blob: Blob;
  suggestedBaseName: string;
  aspect?: VideoAspect;
  qualityPreset: VideoQualityPreset;
  durationSec?: number;
  hasSubtitles?: boolean;
}

interface VideoExportReadyModalProps {
  readyVideo: ReadyExportVideo | null;
  ownerId: string;
  onClose: () => void;
  onOpenLibrary?: () => void;
  onDownloadSrt?: () => void;
  onReRenderWithQuality?: (nextQuality: VideoQualityPreset, nextAspect?: VideoAspect) => void;
  isReRendering?: boolean;
  reRenderProgress?: number;
}

export const VideoExportReadyModal: React.FC<VideoExportReadyModalProps> = ({
  readyVideo,
  ownerId,
  onClose,
  onOpenLibrary,
  onDownloadSrt,
  onReRenderWithQuality,
  isReRendering = false,
  reRenderProgress = 0,
}) => {
  const [fileNameBase, setFileNameBase] = useState<string>('');
  const [fileExt, setFileExt] = useState<'webm' | 'mp4'>('mp4');
  const [includeSrtWithDownload, setIncludeSrtWithDownload] = useState<boolean>(false);
  const [selectedQuality, setSelectedQuality] = useState<VideoQualityPreset>('1080p30');
  const [selectedAspect, setSelectedAspect] = useState<VideoAspect>('9:16');
  const [videoMeta, setVideoMeta] = useState<{ width?: number; height?: number; duration?: number }>({});

  const [cachedMp4Blob, setCachedMp4Blob] = useState<Blob | null>(null);
  const [isConvertingMp4, setIsConvertingMp4] = useState<boolean>(false);
  const [downloadedOk, setDownloadedOk] = useState<boolean>(false);
  const [isSavingVault, setIsSavingVault] = useState<boolean>(false);
  const [savedToVaultOk, setSavedToVaultOk] = useState<boolean>(false);
  const [isSavingDrive, setIsSavingDrive] = useState<boolean>(false);
  const [driveUploadPct, setDriveUploadPct] = useState<number>(0);
  const [savedToDriveOk, setSavedToDriveOk] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageQuotaInfo | null>(null);

  const previewUrl = useMemo(() => {
    if (!readyVideo) return null;
    return URL.createObjectURL(readyVideo.blob);
  }, [readyVideo]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!readyVideo) return;
    setFileNameBase(readyVideo.suggestedBaseName || `nasrullah_video_${Date.now()}`);
    const isNativeMp4 = (readyVideo.blob.type || '').toLowerCase().includes('mp4');
    setFileExt('mp4');
    setCachedMp4Blob(isNativeMp4 ? readyVideo.blob : null);
    setIsConvertingMp4(false);
    setSelectedQuality(readyVideo.qualityPreset);
    if (readyVideo.aspect) setSelectedAspect(readyVideo.aspect);
    setDownloadedOk(false);
    setSavedToVaultOk(false);
    setIsSavingDrive(false);
    setDriveUploadPct(0);
    setSavedToDriveOk(false);
    setSaveError(null);
    setVideoMeta({});

    getStorageQuotaInfo(0).then(setStorageInfo).catch(() => {});
  }, [readyVideo]);

  if (!readyVideo || !previewUrl) return null;

  const isNativeMp4Blob = (readyVideo.blob.type || '').toLowerCase().includes('mp4');
  const qualityObj = VIDEO_QUALITY_OPTIONS.find((q) => q.id === readyVideo.qualityPreset);

  const cleanFileName = (extOverride?: 'webm' | 'mp4') => {
    const useExt = extOverride || fileExt;
    const trimmed = fileNameBase
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\.(webm|mp4)$/i, '');
    const base = trimmed || `nasrullah_video_${Date.now()}`;
    return `${base}.${useExt}`;
  };

  const resolveBlobForSelectedFormat = async (): Promise<{ blob: Blob; actualExt: 'webm' | 'mp4' }> => {
    if (fileExt === 'webm' && !isNativeMp4Blob) {
      return { blob: readyVideo.blob, actualExt: 'webm' };
    }
    if (cachedMp4Blob) {
      return { blob: cachedMp4Blob, actualExt: 'mp4' };
    }
    setIsConvertingMp4(true);
    try {
      const mp4 = await convertVideoBlobToMp4(readyVideo.blob, qualityObj?.fps || 30);
      setCachedMp4Blob(mp4);
      return { blob: mp4, actualExt: 'mp4' };
    } finally {
      setIsConvertingMp4(false);
    }
  };

  const handleDownloadNow = async () => {
    if (isConvertingMp4 || isReRendering) return;
    setSaveError(null);
    try {
      const { blob, actualExt } = await resolveBlobForSelectedFormat();
      const fullName = cleanFileName(actualExt);
      triggerBlobDownload(blob, fullName);
      if (includeSrtWithDownload && onDownloadSrt) {
        setTimeout(() => onDownloadSrt(), 250);
      }
      setDownloadedOk(true);
    } catch (err: any) {
      setSaveError(err?.message || 'MP4 কনভার্ট করতে সমস্যা হয়েছে। চাইলে .WebM ফরম্যাটে ডাউনলোড করতে পারেন।');
    }
  };

  const handleSaveToLibrary = async () => {
    if (isSavingVault || savedToVaultOk || isConvertingMp4 || isSavingDrive || isReRendering) return;
    setIsSavingVault(true);
    setSaveError(null);
    try {
      const { blob, actualExt } = await resolveBlobForSelectedFormat();
      const fullName = cleanFileName(actualExt);
      await saveBlobToVault(blob, fullName, ownerId);
      setSavedToVaultOk(true);
      getStorageQuotaInfo(blob.size).then(setStorageInfo).catch(() => {});
    } catch (err: any) {
      setSaveError(err?.message || 'লাইব্রেরিতে সেভ করতে সমস্যা হয়েছে। পর্যাপ্ত স্টোরেজ আছে কিনা চেক করুন।');
    } finally {
      setIsSavingVault(false);
    }
  };

  const handleSaveToGoogleDrive = async () => {
    if (isSavingDrive || savedToDriveOk || isConvertingMp4 || isSavingVault || isReRendering) return;
    setIsSavingDrive(true);
    setDriveUploadPct(0);
    setSaveError(null);
    try {
      const token = await connectGoogleDrive();
      const { blob, actualExt } = await resolveBlobForSelectedFormat();
      const fullName = cleanFileName(actualExt);
      await uploadBlobToGoogleDrive(token, blob, fullName, ownerId, (pct) => setDriveUploadPct(pct));
      setSavedToDriveOk(true);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setSaveError(err?.message || 'Google Drive-এ সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      }
    } finally {
      setIsSavingDrive(false);
    }
  };

  const qualityChanged =
    selectedQuality !== readyVideo.qualityPreset ||
    (readyVideo.aspect !== undefined && selectedAspect !== readyVideo.aspect);

  const aspectLabel =
    formatAspectRatio(videoMeta.width, videoMeta.height) || readyVideo.aspect || '';
  const resLabel = formatResolutionLabel(videoMeta.width, videoMeta.height);
  const durSec = videoMeta.duration || readyVideo.durationSec || 0;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isReRendering) onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Film className="w-4 h-4 shrink-0" />
              <span>ভিডিও তৈরি সম্পন্ন হয়েছে</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate mt-0.5">
              ডাউনলোড সেটিংস ও লাইব্রেরি সেভ
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isReRendering}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer disabled:opacity-40"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: 2-column Preview + Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
          {/* Left: Native Aspect Preview */}
          <div className="lg:col-span-6 flex flex-col space-y-2.5">
            <div className="relative rounded-xl bg-black border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center min-h-[260px] max-h-[420px]">
              <video
                src={previewUrl}
                controls
                playsInline
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  setVideoMeta({
                    width: v.videoWidth || undefined,
                    height: v.videoHeight || undefined,
                    duration: isFinite(v.duration) ? v.duration : undefined,
                  });
                }}
                className="max-h-[400px] w-full object-contain"
              />
            </div>

            {/* Clean Unboxed Specs Metadata */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums px-1">
              {videoMeta.width && videoMeta.height ? (
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {videoMeta.width}×{videoMeta.height}
                  {resLabel ? ` (${resLabel})` : ''}
                </span>
              ) : (
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {qualityObj?.label || 'Full HD'}
                </span>
              )}
              {aspectLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{aspectLabel}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{qualityObj?.fps || 30} FPS</span>
              {durSec > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatTime(durSec)}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                {formatFileSize(readyVideo.blob.size)}
              </span>
            </div>
          </div>

          {/* Right: Download Settings & Save Actions */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* File Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ভিডিওর ফাইলের নাম (File Name)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={fileNameBase}
                    onChange={(e) => {
                      setFileNameBase(e.target.value);
                      setDownloadedOk(false);
                    }}
                    placeholder="ভিডিওর নাম লিখুন..."
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none"
                  />
                  <span className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                    .{fileExt}
                  </span>
                </div>
              </div>

              {/* Format Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ডাউনলোড ফরম্যাট (Format)
                </label>
                <div className={`grid ${isNativeMp4Blob ? 'grid-cols-1' : 'grid-cols-2'} gap-2 text-xs`}>
                  <button
                    type="button"
                    disabled={isConvertingMp4 || isReRendering}
                    onClick={() => {
                      setFileExt('mp4');
                      setDownloadedOk(false);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-60 ${
                      fileExt === 'mp4'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-bold">.MP4 (আসল H.264 · রেকমেন্ডেড)</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      মোবাইল, Facebook, YouTube, WhatsApp সর্বত্র চলবে
                    </div>
                  </button>
                  {!isNativeMp4Blob && (
                    <button
                      type="button"
                      disabled={isConvertingMp4 || isReRendering}
                      onClick={() => {
                        setFileExt('webm');
                        setDownloadedOk(false);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer disabled:opacity-60 ${
                        fileExt === 'webm'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="font-bold">.WebM (তাৎক্ষণিক অরিজিনাল)</div>
                      <div className="text-[11px] opacity-80 mt-0.5">কনভার্ট ছাড়াই সাথে সাথে ডাউনলোড</div>
                    </button>
                  )}
                </div>
              </div>

              {/* Optional SRT Subtitle Toggle */}
              {onDownloadSrt && readyVideo.hasSubtitles && (
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeSrtWithDownload}
                    onChange={(e) => setIncludeSrtWithDownload(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <Subtitles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>ভিডিওর সাথে আলাদা সাবটাইটেল ফাইল (.SRT)-ও ডাউনলোড করুন</span>
                </label>
              )}

              {/* Optional Quality / Aspect Change & Re-render */}
              {onReRenderWithQuality && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>কোয়ালিটি বা অনুপাত পরিবর্তন করতে চান?</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px]">
                    {VIDEO_QUALITY_OPTIONS.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        disabled={isReRendering}
                        onClick={() => setSelectedQuality(q.id)}
                        className={`px-2.5 py-2 rounded-lg border font-semibold transition-colors cursor-pointer ${
                          selectedQuality === q.id
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div>{q.id === '720p30' ? '720p · 30fps' : q.id === '1080p30' ? '1080p · 30fps' : '1080p · 60fps'}</div>
                        <div className="text-[10px] opacity-75">{q.bitrateMbps} Mbps</div>
                      </button>
                    ))}
                  </div>

                  {readyVideo.aspect && (
                    <div className="flex items-center gap-2 text-xs pt-0.5">
                      <span className="text-slate-500 dark:text-slate-400">অনুপাত:</span>
                      {(['9:16', '16:9'] as const).map((asp) => (
                        <button
                          key={asp}
                          type="button"
                          disabled={isReRendering}
                          onClick={() => setSelectedAspect(asp)}
                          className={`px-2.5 py-1 rounded-lg border font-semibold cursor-pointer ${
                            selectedAspect === asp
                              ? 'border-amber-500 bg-amber-400 text-slate-950'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {asp === '9:16' ? '9:16 Reels' : '16:9 YouTube'}
                        </button>
                      ))}
                    </div>
                  )}

                  {qualityChanged && (
                    <button
                      type="button"
                      disabled={isReRendering}
                      onClick={() => onReRenderWithQuality(selectedQuality, readyVideo.aspect ? selectedAspect : undefined)}
                      className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                    >
                      {isReRendering ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>নতুন কোয়ালিটিতে তৈরি হচ্ছে ({reRenderProgress}%)...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>এই সেটিংসে পুনরায় ভিডিও তৈরি করুন</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Live Storage Remaining Hint */}
              {storageInfo?.supported && (
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 tabular-nums">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                    <span>লাইব্রেরিতে খালি জায়গা:</span>
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatFileSize(storageInfo.availableBytes)} / {formatFileSize(storageInfo.quotaBytes)}
                  </span>
                </div>
              )}

              {saveError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs">
                  {saveError}
                </div>
              )}
            </div>

            {/* Primary Actions: Download, Google Drive (All Devices), and Local Vault */}
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadNow}
                  disabled={isReRendering || isConvertingMp4 || isSavingDrive}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-60"
                >
                  {isConvertingMp4 ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>আসল MP4 তৈরি হচ্ছে...</span>
                    </>
                  ) : downloadedOk ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>ডাউনলোড হয়েছে ✓</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>ডিভাইসে ডাউনলোড</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSaveToGoogleDrive}
                  disabled={isSavingDrive || savedToDriveOk || isReRendering || isConvertingMp4 || isSavingVault}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-extrabold text-xs sm:text-sm transition-colors cursor-pointer disabled:cursor-default ${
                    savedToDriveOk
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-600/15 dark:bg-blue-500/20 hover:bg-blue-600/25 border border-blue-500/50 text-blue-800 dark:text-blue-200'
                  }`}
                >
                  {isSavingDrive ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {isConvertingMp4
                          ? 'MP4 তৈরি হচ্ছে...'
                          : `Drive-এ আপলোড (${driveUploadPct}%)...`}
                      </span>
                    </>
                  ) : savedToDriveOk ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Google Drive-এ সেভ হয়েছে</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      <span>Google Drive-এ সেভ (সব ডিভাইসে)</span>
                    </>
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={handleSaveToLibrary}
                disabled={isSavingVault || savedToVaultOk || isReRendering || isConvertingMp4 || isSavingDrive}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:cursor-default ${
                  savedToVaultOk
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-500/10 dark:bg-emerald-500/15 hover:bg-emerald-500/20 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                }`}
              >
                {isSavingVault ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isConvertingMp4 ? 'MP4 তৈরি হচ্ছে...' : 'লোকাল লাইব্রেরিতে সেভ হচ্ছে...'}</span>
                  </>
                ) : savedToVaultOk ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>এই ডিভাইসের লাইব্রেরিতেও সেভ হয়েছে</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>এই ডিভাইসের লোকাল ভল্টে সেভ করুন</span>
                  </>
                )}
              </button>

              {(savedToVaultOk || savedToDriveOk) && onOpenLibrary && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLibrary();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>লাইব্রেরিতে গিয়ে ভিডিওটি দেখুন</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
