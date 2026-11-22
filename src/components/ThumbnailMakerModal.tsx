import React, { useEffect, useRef, useState } from 'react';
import { X, Download, ImagePlus, Smartphone, Monitor, Palette } from 'lucide-react';
import {
  renderThumbnailToCanvas,
  THUMBNAIL_THEMES,
  ThumbnailAspect,
  ThumbnailThemeId,
} from '../services/thumbnailService.ts';
import { BACKGROUND_THEME_PACKS, BackgroundPhotoItem } from '../data/backgroundPacks.ts';

interface ThumbnailMakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle: string;
  availablePhotos: BackgroundPhotoItem[];
  initialChannelTag?: string;
  initialLogoUrl?: string | null;
}

export const ThumbnailMakerModal: React.FC<ThumbnailMakerModalProps> = ({
  isOpen,
  onClose,
  initialTitle,
  availablePhotos,
  initialChannelTag = '',
  initialLogoUrl = null,
}) => {
  const [aspect, setAspect] = useState<ThumbnailAspect>('16:9');
  const [theme, setTheme] = useState<ThumbnailThemeId>('gold');
  const [title, setTitle] = useState<string>(initialTitle || 'নতুন ভিডিওর শিরোনাম');
  const [badgeText, setBadgeText] = useState<string>('নতুন ভিডিও');
  const [channelTag, setChannelTag] = useState<string>(initialChannelTag || 'Nasrullah Studio');
  const [bgUrl, setBgUrl] = useState<string | null>(
    availablePhotos[0]?.url || BACKGROUND_THEME_PACKS[0].photos[0].url
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTitle.trim()) setTitle(initialTitle.trim());
    if (availablePhotos[0]?.url) setBgUrl(availablePhotos[0].url);
    if (initialChannelTag) setChannelTag(initialChannelTag);
    if (initialLogoUrl) setLogoUrl(initialLogoUrl);
  }, [isOpen, initialTitle, availablePhotos, initialChannelTag, initialLogoUrl]);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    renderThumbnailToCanvas(canvasRef.current, {
      aspect,
      theme,
      title,
      badgeText,
      channelTag,
      backgroundUrl: bgUrl,
      logoUrl,
    });
  }, [isOpen, aspect, theme, title, badgeText, channelTag, bgUrl, logoUrl]);

  if (!isOpen) return null;

  const handleUploadBg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBgUrl(url);
    e.target.value = '';
  };

  const handleDownload = (format: 'png' | 'jpeg') => {
    if (!canvasRef.current) return;
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const dataUrl = canvasRef.current.toDataURL(mime, 0.94);
    const a = document.createElement('a');
    a.href = dataUrl;
    const slug = (title || 'thumbnail')
      .trim()
      .replace(/[^\w\u0980-\u09FF-]+/g, '_')
      .slice(0, 40);
    a.download = `${slug || 'thumbnail'}_${aspect === '9:16' ? 'reels' : 'youtube'}.${format === 'png' ? 'png' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Combine user's slideshow photos + sample pack thumbnails
  const quickBackgrounds: BackgroundPhotoItem[] = [
    ...availablePhotos,
    ...BACKGROUND_THEME_PACKS.map((p) => p.photos[0]),
  ].slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0B101D] border border-amber-500/35 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white">১-ক্লিক YouTube / Reels থাম্বনেইল মেকার</h2>
              <p className="text-[11px] text-slate-400">
                হাই-রেজোলিউশন থাম্বনেইল প্রিভিউ দেখে সরাসরি PNG বা JPG ডাউনলোড করুন।
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-5 items-start">
          {/* Live Preview Canvas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">লাইভ থাম্বনেইল প্রিভিউ</span>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAspect('16:9')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    aspect === '16:9' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>16:9 YouTube</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAspect('9:16')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    aspect === '9:16' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>9:16 Reels</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-center min-h-[260px]">
              <canvas
                ref={canvasRef}
                className={`rounded-lg shadow-xl border border-slate-800 ${
                  aspect === '9:16' ? 'max-h-[400px] w-auto' : 'w-full h-auto'
                }`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleDownload('png')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>HD থাম্বনেইল ডাউনলোড (.PNG)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownload('jpeg')}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold text-xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>.JPG</span>
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">থাম্বনেইলের বড় শিরোনাম</label>
              <textarea
                rows={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="আকর্ষণীয় শিরোনাম লিখুন..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl p-2.5 text-sm text-white focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">উপরের ব্যাজ (খালি রাখলে বন্ধ)</label>
                <input
                  type="text"
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  placeholder="যেমন: ভৌতিক গল্প"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold">চ্যানেলের নাম</label>
                <input
                  type="text"
                  value={channelTag}
                  onChange={(e) => setChannelTag(e.target.value)}
                  placeholder="@YourChannel"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            {/* Theme Templates */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold">কালার থিম</label>
              <div className="grid grid-cols-2 gap-2">
                {THUMBNAIL_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left font-semibold cursor-pointer transition-colors ${
                      theme === t.id
                        ? 'border-amber-400 bg-amber-400/15 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.accent }}
                    />
                    <span className="truncate">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Background Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-semibold">ব্যাকগ্রাউন্ড ছবি</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={bgFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadBg}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bgFileRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>নিজের ছবি</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgUrl(null)}
                    className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    ছবি ছাড়া
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {quickBackgrounds.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBgUrl(item.url)}
                    className={`relative rounded-lg overflow-hidden border-2 h-14 cursor-pointer ${
                      bgUrl === item.url ? 'border-amber-400' : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
