import React, { useRef, useState } from 'react';
import {
  ImagePlus,
  Images,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Sparkles,
  Video,
} from 'lucide-react';
import {
  BACKGROUND_THEME_PACKS,
  BackgroundPhotoItem,
  SlideDurationMode,
} from '../data/backgroundPacks.ts';

interface BackgroundPickerPanelProps {
  photos: BackgroundPhotoItem[];
  onChangePhotos: (photos: BackgroundPhotoItem[]) => void;
  slideDurationSec: SlideDurationMode;
  onChangeSlideDurationSec: (sec: SlideDurationMode) => void;
  backgroundVideoUrl?: string | null;
  backgroundVideoName?: string | null;
  onChangeBackgroundVideo?: (url: string | null, name: string | null) => void;
}

const SLIDE_TIMING_OPTIONS: { value: SlideDurationMode; label: string }[] = [
  { value: 0, label: 'অটো (সমান ভাগে)' },
  { value: 3, label: 'প্রতি ৩ সেকেন্ড' },
  { value: 5, label: 'প্রতি ৫ সেকেন্ড' },
  { value: 8, label: 'প্রতি ৮ সেকেন্ড' },
];

export const BackgroundPickerPanel: React.FC<BackgroundPickerPanelProps> = ({
  photos,
  onChangePhotos,
  slideDurationSec,
  onChangeSlideDurationSec,
  backgroundVideoUrl = null,
  backgroundVideoName = null,
  onChangeBackgroundVideo,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clearVideoIfAny = () => {
    if (backgroundVideoUrl && backgroundVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(backgroundVideoUrl);
    }
    onChangeBackgroundVideo?.(null, null);
  };

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const firstVideo = arr.find((f) => f.type.startsWith('video/'));
    if (firstVideo && onChangeBackgroundVideo) {
      clearVideoIfAny();
      onChangeBackgroundVideo(URL.createObjectURL(firstVideo), firstVideo.name);
      return;
    }

    const imgList = arr.filter((f) => f.type.startsWith('image/'));
    if (imgList.length === 0) return;

    if (backgroundVideoUrl) clearVideoIfAny();

    const newItems: BackgroundPhotoItem[] = imgList.map((file, idx) => ({
      id: `custom-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      url: URL.createObjectURL(file),
      label: file.name.replace(/\.[^.]+$/, '').slice(0, 24) || `ছবি ${photos.length + idx + 1}`,
      isCustom: true,
    }));

    onChangePhotos([...photos, ...newItems]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onChangeBackgroundVideo) {
      clearVideoIfAny();
      onChangeBackgroundVideo(URL.createObjectURL(file), file.name);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleSelectPack = (packId: string) => {
    const pack = BACKGROUND_THEME_PACKS.find((p) => p.id === packId);
    if (!pack) return;
    if (backgroundVideoUrl) clearVideoIfAny();
    const cloned = pack.photos.map((p, idx) => ({
      ...p,
      id: `${pack.id}-${Date.now()}-${idx}`,
    }));
    onChangePhotos(cloned);
  };

  const handleClearAll = () => {
    clearVideoIfAny();
    photos.forEach((p) => {
      if (p.isCustom && p.url.startsWith('blob:')) {
        URL.revokeObjectURL(p.url);
      }
    });
    onChangePhotos([]);
  };

  const handleRemovePhoto = (id: string) => {
    const target = photos.find((p) => p.id === id);
    if (target?.isCustom && target.url.startsWith('blob:')) {
      URL.revokeObjectURL(target.url);
    }
    onChangePhotos(photos.filter((p) => p.id !== id));
  };

  const handleMovePhoto = (index: number, direction: -1 | 1) => {
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= photos.length) return;
    const copy = [...photos];
    const [moved] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, moved);
    onChangePhotos(copy);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
        isDragging
          ? 'border-amber-400 bg-amber-500/10'
          : 'border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#070B14]/90'
      }`}
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Images className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          <span>ব্যাকগ্রাউন্ড ছবি বা ভিডিও ক্লিপ</span>
          <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
            {backgroundVideoUrl
              ? '— ব্যাকগ্রাউন্ড ভিডিও ক্লিপ চালু (অটো লুপ)'
              : photos.length === 0
              ? '— ক্লিন ডার্ক ব্যাকগ্রাউন্ড চালু'
              : `— ${photos.length}টি ছবি (স্মুথ ফেড স্লাইডশো)`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/20 hover:bg-amber-500/25 dark:hover:bg-amber-500/30 border border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold text-xs cursor-pointer transition-colors"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span>নিজের ছবি (একাধিক)</span>
          </button>

          {onChangeBackgroundVideo && (
            <>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-800 dark:text-cyan-300 font-bold text-xs cursor-pointer transition-colors"
              >
                <Video className="w-3.5 h-3.5" />
                <span>ভিডিও ক্লিপ (.MP4)</span>
              </button>
            </>
          )}

          {(photos.length > 0 || backgroundVideoUrl) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500/40 text-slate-700 dark:text-slate-300 hover:text-rose-700 dark:hover:text-rose-200 text-[11px] font-semibold cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>সব মুছুন</span>
            </button>
          )}
        </div>
      </div>

      {/* 1-Click Ready Theme Packs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-600 dark:text-slate-400 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
          রেডি প্যাক:
        </span>
        <button
          type="button"
          onClick={handleClearAll}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
            photos.length === 0 && !backgroundVideoUrl
              ? 'border-amber-500 bg-amber-400/20 text-amber-900 dark:text-amber-200'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          ক্লিন ডার্ক
        </button>

        {BACKGROUND_THEME_PACKS.map((pack) => (
          <button
            key={pack.id}
            type="button"
            onClick={() => handleSelectPack(pack.id)}
            title={pack.shortDesc}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors bg-slate-900/90 dark:bg-transparent ${pack.accentClass}`}
          >
            {pack.name} ({pack.photos.length})
          </button>
        ))}
      </div>

      {/* Active Background Video Clip Preview */}
      {backgroundVideoUrl ? (
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-300 dark:border-cyan-500/40">
          <video
            src={backgroundVideoUrl}
            muted
            loop
            autoPlay
            playsInline
            className="w-24 h-16 rounded-lg object-cover border border-slate-300 dark:border-slate-700 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-cyan-900 dark:text-cyan-200 truncate">
              {backgroundVideoName || 'ব্যাকগ্রাউন্ড ভিডিও ক্লিপ'}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              এই ভিডিও ক্লিপটি ব্যাকগ্রাউন্ডে মিউট অবস্থায় লুপ হবে এবং এর উপরে আপনার ভয়েস, ওয়েভফর্ম ও সাবটাইটেল বসবে।
            </p>
          </div>
          <button
            type="button"
            onClick={clearVideoIfAny}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer shrink-0"
            title="ভিডিও ক্লিপ সরান"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : photos.length > 0 ? (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {photos.map((photo, idx) => (
              <div
                key={photo.id}
                className="relative group shrink-0 w-24 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700/90 bg-slate-900"
              >
                <img
                  src={photo.url}
                  alt={photo.label}
                  className="w-24 h-20 object-cover block"
                />
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-950/85 border border-amber-500/40 text-[10px] font-bold text-amber-300 leading-none">
                  {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(photo.id)}
                  className="absolute top-1 right-1 p-0.5 rounded bg-slate-950/85 text-slate-300 hover:text-rose-400 cursor-pointer"
                  title="ছবিটি মুছুন"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="flex items-center justify-between px-1 py-1 bg-slate-950/90 text-[10px] text-slate-300">
                  <button
                    type="button"
                    onClick={() => handleMovePhoto(idx, -1)}
                    disabled={idx === 0}
                    className="p-0.5 text-slate-400 hover:text-amber-300 disabled:opacity-25 cursor-pointer"
                    title="বামে সরান"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span className="truncate max-w-[52px] text-center" title={photo.label}>
                    {photo.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleMovePhoto(idx, 1)}
                    disabled={idx === photos.length - 1}
                    className="p-0.5 text-slate-400 hover:text-amber-300 disabled:opacity-25 cursor-pointer"
                    title="ডানে সরান"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-20 h-[102px] rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/60 bg-slate-50 dark:bg-slate-900/50 hover:bg-amber-50 dark:hover:bg-amber-500/5 flex flex-col items-center justify-center gap-1 text-slate-500 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 text-[10px] font-semibold cursor-pointer transition-colors"
            >
              <ImagePlus className="w-4 h-4" />
              <span>আরও ছবি</span>
            </button>
          </div>

          {photos.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-800/70">
              <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                ছবি পরিবর্তনের সময়:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {SLIDE_TIMING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChangeSlideDurationSec(opt.value)}
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                      slideDurationSec === opt.value
                        ? 'border-amber-500 bg-amber-400/20 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          টিপস: নিজের একাধিক ছবি বা একটি শর্ট ভিডিও ক্লিপ (.MP4) আপলোড করুন, অথবা উপরের যেকোনো রেডি প্যাক বেছে নিন।
        </p>
      )}
    </div>
  );
};
