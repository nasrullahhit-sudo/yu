import React, { useEffect, useRef, useState } from 'react';
import {
  Images,
  Music,
  Subtitles,
  Stamp,
  Palette,
  Play,
  Square,
  Upload,
  Volume2,
  Zap,
  X,
  Sparkles,
  Eye,
  Youtube,
  Film,
  Flame,
  Wand2,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { BackgroundPickerPanel } from './BackgroundPickerPanel.tsx';
import {
  BACKGROUND_THEME_PACKS,
  BackgroundPhotoItem,
  SlideDurationMode,
} from '../data/backgroundPacks.ts';
import {
  BGM_MOOD_OPTIONS,
  BgmMixConfig,
  BgmMoodId,
  previewSfxOnce,
  SFX_OPTIONS,
  SfxId,
  startBgmPreview,
  stopBgmPreview,
} from '../services/bgmAndSfxService.ts';
import {
  OutroCardConfig,
  PARTICLE_EFFECT_OPTIONS,
  ParticleEffectId,
  RetentionBarPosition,
  SubtitleMode,
  SubtitlePosition,
  SubtitleSize,
  VIDEO_QUALITY_OPTIONS,
  VideoQualityPreset,
  VideoStyleConfig,
  VIRAL_HOOK_PRESETS,
  WatermarkConfig,
  WatermarkPosition,
  WaveformStyle,
} from '../services/subtitleAndVideoService.ts';
import { ThumbnailMakerModal } from './ThumbnailMakerModal.tsx';

type CustomizerTab = 'bg' | 'bgm' | 'style' | 'watermark';

const SUBTITLE_COLOR_SWATCHES = [
  { hex: '#fbbf24', label: 'গোল্ডেন' },
  { hex: '#ffffff', label: 'সাদা' },
  { hex: '#22d3ee', label: 'সায়ান' },
  { hex: '#fb7185', label: 'লাল-গোলাপি' },
  { hex: '#a3e635', label: 'নিয়ন গ্রিন' },
];

interface StoryboardScenePlan {
  photoId: string;
  sceneTitle: string;
  reason?: string;
}

interface VideoStudioOptionsPanelProps {
  projectTitle: string;
  scriptText?: string;
  voiceName?: string;
  hideBackgroundTab?: boolean;
  onOpenLivePreview?: () => void;
  inlineSfxCueCount?: number;
  photos: BackgroundPhotoItem[];
  onChangePhotos: (photos: BackgroundPhotoItem[]) => void;
  slideDurationSec: SlideDurationMode;
  onChangeSlideDurationSec: (sec: SlideDurationMode) => void;
  backgroundVideoUrl: string | null;
  backgroundVideoName: string | null;
  onChangeBackgroundVideo: (url: string | null, name: string | null) => void;
  bgmConfig: BgmMixConfig;
  onChangeBgmConfig: (cfg: BgmMixConfig) => void;
  styleConfig: VideoStyleConfig;
  onChangeStyleConfig: (cfg: VideoStyleConfig) => void;
  watermark: WatermarkConfig;
  onChangeWatermark: (wm: WatermarkConfig) => void;
  outro: OutroCardConfig;
  onChangeOutro: (outro: OutroCardConfig) => void;
}

export const VideoStudioOptionsPanel: React.FC<VideoStudioOptionsPanelProps> = ({
  projectTitle,
  scriptText = '',
  voiceName = '',
  hideBackgroundTab = false,
  onOpenLivePreview,
  inlineSfxCueCount = 0,
  photos,
  onChangePhotos,
  slideDurationSec,
  onChangeSlideDurationSec,
  backgroundVideoUrl,
  backgroundVideoName,
  onChangeBackgroundVideo,
  bgmConfig,
  onChangeBgmConfig,
  styleConfig,
  onChangeStyleConfig,
  watermark,
  onChangeWatermark,
  outro,
  onChangeOutro,
}) => {
  const [activeTab, setActiveTab] = useState<CustomizerTab>(hideBackgroundTab ? 'bgm' : 'bg');
  const [isPreviewingBgm, setIsPreviewingBgm] = useState<boolean>(false);
  const [isThumbModalOpen, setIsThumbModalOpen] = useState<boolean>(false);
  const [isPlanningStoryboard, setIsPlanningStoryboard] = useState<boolean>(false);
  const [storyboardNotice, setStoryboardNotice] = useState<string | null>(null);
  const [storyboardScenes, setStoryboardScenes] = useState<StoryboardScenePlan[]>([]);

  const customBgmInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      stopBgmPreview();
    };
  }, []);

  const handleToggleBgmPreview = () => {
    if (isPreviewingBgm) {
      stopBgmPreview();
      setIsPreviewingBgm(false);
    } else {
      if (bgmConfig.mood === 'none') return;
      startBgmPreview(bgmConfig);
      setIsPreviewingBgm(true);
    }
  };

  const handleSelectBgmMood = (mood: BgmMixConfig['mood']) => {
    stopBgmPreview();
    setIsPreviewingBgm(false);
    onChangeBgmConfig({ ...bgmConfig, mood });
  };

  const handleCustomBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (bgmConfig.customBgmUrl && bgmConfig.customBgmUrl.startsWith('blob:')) {
      URL.revokeObjectURL(bgmConfig.customBgmUrl);
    }
    const url = URL.createObjectURL(file);
    stopBgmPreview();
    setIsPreviewingBgm(false);
    onChangeBgmConfig({
      ...bgmConfig,
      mood: 'custom',
      customBgmUrl: url,
      customBgmName: file.name,
    });
    e.target.value = '';
  };

  const handleToggleSfx = (sfx: SfxId) => {
    previewSfxOnce(sfx);
    const exists = bgmConfig.sfxList.includes(sfx);
    const next = exists
      ? bgmConfig.sfxList.filter((s) => s !== sfx)
      : [...bgmConfig.sfxList, sfx];
    onChangeBgmConfig({ ...bgmConfig, sfxList: next });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (watermark.logoUrl && watermark.logoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(watermark.logoUrl);
    }
    const url = URL.createObjectURL(file);
    onChangeWatermark({ ...watermark, logoUrl: url });
    e.target.value = '';
  };

  const handleClearLogo = () => {
    if (watermark.logoUrl && watermark.logoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(watermark.logoUrl);
    }
    onChangeWatermark({ ...watermark, logoUrl: null });
  };

  // Feature #5: Free AI Auto-Storyboard Scene Director
  const handleRunAiStoryboard = async () => {
    const textToAnalyze = scriptText.trim() || projectTitle.trim();
    if (!textToAnalyze) {
      setStoryboardNotice('আগে স্ক্রিপ্ট অথবা ভিডিওর নাম লিখুন, তারপর AI স্টোরিবোর্ড চালান।');
      return;
    }

    setIsPlanningStoryboard(true);
    setStoryboardNotice(null);

    try {
      const resp = await fetch('/api/storyboard/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText: textToAnalyze,
          title: projectTitle,
          voiceName,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || 'স্টোরিবোর্ড তৈরি করা যায়নি।');
      }

      const allPhotosMap = new Map<string, BackgroundPhotoItem>();
      BACKGROUND_THEME_PACKS.forEach((pack) => {
        pack.photos.forEach((p) => allPhotosMap.set(p.id, p));
      });

      const scenes: StoryboardScenePlan[] = Array.isArray(data.scenes) ? data.scenes : [];
      const mappedPhotos: BackgroundPhotoItem[] = scenes
        .map((sc, idx) => {
          const found = allPhotosMap.get(sc.photoId);
          if (!found) return null;
          return {
            ...found,
            id: `sb-${idx}-${found.id}`,
            label: sc.sceneTitle || found.label,
          };
        })
        .filter((x): x is BackgroundPhotoItem => Boolean(x));

      if (mappedPhotos.length > 0) {
        // Clear any looping video so the multi-scene storyboard shines
        if (backgroundVideoUrl) onChangeBackgroundVideo(null, null);
        onChangePhotos(mappedPhotos);
        onChangeSlideDurationSec((data.slideDurationSec as SlideDurationMode) ?? 0);
      }

      onChangeStyleConfig({
        ...styleConfig,
        particleEffect: (data.recommendedParticle as ParticleEffectId) || styleConfig.particleEffect,
        hookBannerEnabled: Boolean(data.suggestedHook),
        hookBannerText: data.suggestedHook || styleConfig.hookBannerText,
      });

      if (data.recommendedBgm && data.recommendedBgm !== 'none' && bgmConfig.mood === 'none') {
        onChangeBgmConfig({
          ...bgmConfig,
          mood: data.recommendedBgm as BgmMoodId,
        });
      }

      setStoryboardScenes(scenes);
      setStoryboardNotice(
        `AI গল্প বুঝে ${mappedPhotos.length}টি দৃশ্যের স্টোরিবোর্ড, ইফেক্ট ও ৩-সেকেন্ড ভাইরাল হুক সাজিয়ে দিয়েছে!`
      );
      setActiveTab('bg');
    } catch (err: any) {
      setStoryboardNotice(err?.message || 'AI স্টোরিবোর্ড তৈরি করতে সমস্যা হয়েছে।');
    } finally {
      setIsPlanningStoryboard(false);
    }
  };

  const bgSummaryCount = backgroundVideoUrl ? 'ভিডিও' : photos.length > 0 ? `${photos.length}` : '';
  const bgmActive = bgmConfig.mood !== 'none' || bgmConfig.sfxList.length > 0 || inlineSfxCueCount > 0;
  const fxActive =
    styleConfig.particleEffect !== 'none' ||
    Boolean(styleConfig.hookBannerEnabled) ||
    styleConfig.qualityPreset === '1080p60';
  const wmOrOutroActive = Boolean(watermark.text.trim() || watermark.logoUrl || outro.enabled);
  const currentQuality = styleConfig.qualityPreset || '1080p30';
  const qualityBadge =
    VIDEO_QUALITY_OPTIONS.find((q) => q.id === currentQuality)?.shortBadge || '1080p HD';

  return (
    <div className="space-y-3">
      {/* Unified Studio Customizer Tabs + AI Storyboard + Live Preview + Thumbnail Maker */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {!hideBackgroundTab && (
            <button
              type="button"
              onClick={() => setActiveTab('bg')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                activeTab === 'bg'
                  ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-800 dark:text-amber-200'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Images className="w-3.5 h-3.5" />
              <span>ছবি / ভিডিও</span>
              {bgSummaryCount && (
                <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                  {bgSummaryCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('bgm')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
              activeTab === 'bgm'
                ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-800 dark:text-amber-200'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>মিউজিক ও SFX</span>
            {bgmActive && <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('style')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
              activeTab === 'style'
                ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-800 dark:text-amber-200'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Subtitles className="w-3.5 h-3.5" />
            <span>কোয়ালিটি, FX ও সাবটাইটেল</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-amber-300 text-[10px] font-bold">
              {qualityBadge}
            </span>
            {fxActive && <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('watermark')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
              activeTab === 'watermark'
                ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-800 dark:text-amber-200'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Stamp className="w-3.5 h-3.5" />
            <span>লোগো ও আউটরো</span>
            {wmOrOutroActive && <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400" />}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!hideBackgroundTab && (
            <button
              type="button"
              onClick={handleRunAiStoryboard}
              disabled={isPlanningStoryboard}
              title="আপনার গল্পের দৃশ্য বুঝে AI অটোমেটিক ৩–৫টি ছবি, পার্টিকল ও ভাইরাল হুক সাজিয়ে দেবে"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/50 text-indigo-700 dark:text-indigo-200 font-bold text-xs cursor-pointer transition-colors disabled:opacity-60"
            >
              {isPlanningStoryboard ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              <span>{isPlanningStoryboard ? 'দৃশ্য সাজানো হচ্ছে...' : 'AI অটো-স্টোরিবোর্ড'}</span>
            </button>
          )}

          {onOpenLivePreview && !hideBackgroundTab && (
            <button
              type="button"
              onClick={onOpenLivePreview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/45 text-cyan-800 dark:text-cyan-200 font-bold text-xs cursor-pointer transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" />
              <span>লাইভ প্রিভিউ দেখুন</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsThumbModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-rose-500/20 hover:from-amber-500/30 hover:to-rose-500/30 border border-amber-500/45 text-amber-900 dark:text-amber-200 font-bold text-xs cursor-pointer transition-colors"
          >
            <Palette className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
            <span>থাম্বনেইল (PNG)</span>
          </button>
        </div>
      </div>

      {/* AI Storyboard Notice & Scene Timeline Preview */}
      {storyboardNotice && (
        <div className="rounded-xl border border-indigo-400/40 bg-indigo-50 dark:bg-indigo-950/40 px-3.5 py-2.5 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2 text-indigo-900 dark:text-indigo-200 font-semibold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              {storyboardNotice}
            </span>
            <button
              type="button"
              onClick={() => {
                setStoryboardNotice(null);
                setStoryboardScenes([]);
              }}
              className="text-indigo-500 hover:text-indigo-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {storyboardScenes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {storyboardScenes.map((sc, i) => (
                <span
                  key={`${sc.photoId}-${i}`}
                  className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 border border-indigo-300/60 dark:border-indigo-700/60 text-[11px] text-indigo-900 dark:text-indigo-200"
                >
                  দৃশ্য {i + 1}: {sc.sceneTitle}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Background Photos & Video Clip */}
      {!hideBackgroundTab && activeTab === 'bg' && (
        <BackgroundPickerPanel
          photos={photos}
          onChangePhotos={onChangePhotos}
          slideDurationSec={slideDurationSec}
          onChangeSlideDurationSec={onChangeSlideDurationSec}
          backgroundVideoUrl={backgroundVideoUrl}
          backgroundVideoName={backgroundVideoName}
          onChangeBackgroundVideo={onChangeBackgroundVideo}
        />
      )}

      {/* Tab 2: BGM & SFX Mixer */}
      {activeTab === 'bgm' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#070B14]/90 p-3.5 space-y-3.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <Music className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              <span>ব্যাকগ্রাউন্ড মিউজিক (ভিডিওতে সরাসরি মিক্স হবে)</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={customBgmInputRef}
                type="file"
                accept="audio/*"
                onChange={handleCustomBgmUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => customBgmInputRef.current?.click()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-[11px] cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>নিজের MP3 মিউজিক</span>
              </button>

              {bgmConfig.mood !== 'none' && (
                <button
                  type="button"
                  onClick={handleToggleBgmPreview}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 dark:bg-amber-400/20 hover:bg-amber-500/25 border border-amber-500/40 text-amber-800 dark:text-amber-200 font-bold text-[11px] cursor-pointer"
                >
                  {isPreviewingBgm ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>থামান</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>শুনুন</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {BGM_MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectBgmMood(opt.id)}
                title={opt.desc}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                  bgmConfig.mood === opt.id
                    ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
            {bgmConfig.customBgmUrl && (
              <button
                type="button"
                onClick={() => handleSelectBgmMood('custom')}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                  bgmConfig.mood === 'custom'
                    ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                কাস্টম: {(bgmConfig.customBgmName || 'MP3').slice(0, 18)}
              </button>
            )}
          </div>

          {bgmConfig.mood !== 'none' && (
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
              <Volume2 className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
              <span className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                মিউজিক ভলিউম: {Math.round(bgmConfig.volume * 100)}%
              </span>
              <input
                type="range"
                min={0.05}
                max={0.75}
                step={0.05}
                value={bgmConfig.volume}
                onChange={(e) =>
                  onChangeBgmConfig({ ...bgmConfig, volume: parseFloat(e.target.value) })
                }
                className="flex-1 accent-amber-500 dark:accent-amber-400 cursor-pointer"
              />
            </div>
          )}

          {/* SFX Selector */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                সাউন্ড ইফেক্ট (SFX) — ক্লিক করে শুনুন ও ভিডিওতে যোগ করুন:
              </span>
              {inlineSfxCueCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  স্ক্রিপ্টে {inlineSfxCueCount}টি টাইমড SFX ট্যাগ পাওয়া গেছে!
                </span>
              )}
              {bgmConfig.sfxList.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeBgmConfig({ ...bgmConfig, sfxList: [] })}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
                >
                  SFX বন্ধ করুন
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SFX_OPTIONS.map((sfx) => {
                const active = bgmConfig.sfxList.includes(sfx.id);
                return (
                  <button
                    key={sfx.id}
                    type="button"
                    onClick={() => handleToggleSfx(sfx.id)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                      active
                        ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {sfx.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Quality (1080p/60fps), Camera Shake & Flash FX, Viral 3s Hook, Particles & Subtitles */}
      {activeTab === 'style' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#070B14]/90 p-3.5 space-y-4 text-xs">
          {/* Feature #3: Video Export Quality (720p / 1080p Full HD / 1080p 60 FPS) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" />
              ভিডিও এক্সপোর্ট কোয়ালিটি ও FPS (ইউটিউব ও রিলসের জন্য আল্ট্রা ক্লিয়ার)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {VIDEO_QUALITY_OPTIONS.map((q) => {
                const active = currentQuality === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() =>
                      onChangeStyleConfig({
                        ...styleConfig,
                        qualityPreset: q.id as VideoQualityPreset,
                      })
                    }
                    className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/15 text-amber-950 dark:text-amber-100'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-[11px]">{q.label}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {q.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feature #2 + #4: Sound-Synced Screen Shake/Lightning FX & Retention Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200 dark:border-slate-800/80">
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={styleConfig.cinematicShakeFlash !== false}
                onChange={(e) =>
                  onChangeStyleConfig({
                    ...styleConfig,
                    cinematicShakeFlash: e.target.checked,
                  })
                }
                className="w-4 h-4 mt-0.5 accent-amber-500 rounded cursor-pointer"
              />
              <div>
                <div className="font-bold text-[11px] text-slate-800 dark:text-slate-100 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>সাউন্ড-সিঙ্কড ক্যামেরা শেক, বজ্রপাত ফ্ল্যাশ ও হরর গ্লিচ</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  স্ক্রিপ্টে [বজ্রপাত], [ড্রাম বুম] বা [হরর স্টিং] বাজলে স্ক্রিন নিজেই কাঁপবে ও ফ্ল্যাশ/গ্লিচ হবে।
                </p>
              </div>
            </label>

            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-[11px] text-slate-800 dark:text-slate-100">
                  <input
                    type="checkbox"
                    checked={styleConfig.showRetentionBar !== false}
                    onChange={(e) =>
                      onChangeStyleConfig({
                        ...styleConfig,
                        showRetentionBar: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                  <span>নিয়ন রিটেনশন প্রোগ্রেস বার</span>
                </label>

                {styleConfig.showRetentionBar !== false && (
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'top', label: 'উপরে' },
                        { id: 'bottom', label: 'নিচে' },
                      ] as Array<{ id: RetentionBarPosition; label: string }>
                    ).map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() =>
                          onChangeStyleConfig({
                            ...styleConfig,
                            retentionBarPosition: pos.id,
                          })
                        }
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer ${
                          (styleConfig.retentionBarPosition || 'top') === pos.id
                            ? 'border-cyan-500 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                ভিডিওর অগ্রগতি দেখানো গ্লোয়িং বার দর্শককে শেষ পর্যন্ত ধরে রাখে।
              </p>
            </div>
          </div>

          {/* Feature #4: Viral 3-Second Hook Banner */}
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-[11px] text-rose-700 dark:text-rose-300">
              <input
                type="checkbox"
                checked={Boolean(styleConfig.hookBannerEnabled)}
                onChange={(e) =>
                  onChangeStyleConfig({
                    ...styleConfig,
                    hookBannerEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>ভাইরাল ৩-সেকেন্ড হুক ব্যানার (ভিডিওর শুরুতে অ্যানিমেটেড পপ-আপ ব্যাজ)</span>
            </label>

            {styleConfig.hookBannerEnabled && (
              <div className="space-y-2 pl-1">
                <div className="flex flex-wrap gap-1.5">
                  {VIRAL_HOOK_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        onChangeStyleConfig({ ...styleConfig, hookBannerText: preset })
                      }
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                        styleConfig.hookBannerText === preset
                          ? 'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-200'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={styleConfig.hookBannerText || ''}
                  onChange={(e) =>
                    onChangeStyleConfig({ ...styleConfig, hookBannerText: e.target.value })
                  }
                  maxLength={55}
                  placeholder="নিজের হুক ব্যানার লিখুন (যেমন: শেষ পর্যন্ত না দেখলে মিস করবেন!)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-rose-500 rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Feature #1: Cinematic Particle & Weather Effects */}
          <div className="space-y-1.5 pt-2.5 border-t border-slate-200 dark:border-slate-800/80">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              সিনেম্যাটিক পার্টিকল ও আবহাওয়া ইফেক্ট (ভিডিওর উপরে লাইভ অ্যানিমেশন)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PARTICLE_EFFECT_OPTIONS.map((fx) => (
                <button
                  key={fx.id}
                  type="button"
                  title={fx.desc}
                  onClick={() =>
                    onChangeStyleConfig({
                      ...styleConfig,
                      particleEffect: fx.id as ParticleEffectId,
                    })
                  }
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                    styleConfig.particleEffect === fx.id
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {fx.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            {/* Subtitle Mode */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                সাবটাইটেল স্টাইল
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'karaoke' as SubtitleMode, label: 'ক্যারওকে হাইলাইট' },
                  { id: 'classic' as SubtitleMode, label: 'ক্লাসিক বক্স' },
                  { id: 'none' as SubtitleMode, label: 'বন্ধ' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeStyleConfig({ ...styleConfig, subtitleMode: m.id })}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                      styleConfig.subtitleMode === m.id
                        ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Waveform Style */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                অডিও ওয়েভফর্ম স্টাইল
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'bars' as WaveformStyle, label: 'বার স্পেকট্রাম' },
                  { id: 'circle' as WaveformStyle, label: 'গোল পালস রিং' },
                  { id: 'none' as WaveformStyle, label: 'লুকানো' },
                ].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onChangeStyleConfig({ ...styleConfig, waveformStyle: w.id })}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                      styleConfig.waveformStyle === w.id
                        ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            {/* Highlight Color */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                হাইলাইট ও ওয়েভ রঙ
              </span>
              <div className="flex items-center gap-2">
                {SUBTITLE_COLOR_SWATCHES.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => onChangeStyleConfig({ ...styleConfig, subtitleColor: c.hex })}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                      styleConfig.subtitleColor === c.hex
                        ? 'border-slate-900 dark:border-white scale-110'
                        : 'border-slate-300 dark:border-slate-700 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Subtitle Size */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                ফন্ট সাইজ
              </span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'sm' as SubtitleSize, label: 'ছোট' },
                  { id: 'md' as SubtitleSize, label: 'মাঝারি' },
                  { id: 'lg' as SubtitleSize, label: 'বড়' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChangeStyleConfig({ ...styleConfig, subtitleSize: s.id })}
                    className={`py-1 rounded-md border text-[11px] font-semibold cursor-pointer ${
                      styleConfig.subtitleSize === s.id
                        ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subtitle Position */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                সাবটাইটেলের অবস্থান
              </span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'bottom' as SubtitlePosition, label: 'নিচে' },
                  { id: 'center' as SubtitlePosition, label: 'মাঝে' },
                  { id: 'top' as SubtitlePosition, label: 'উপরে' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChangeStyleConfig({ ...styleConfig, subtitlePosition: p.id })}
                    className={`py-1 rounded-md border text-[11px] font-semibold cursor-pointer ${
                      styleConfig.subtitlePosition === p.id
                        ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Channel Logo / Watermark + Animated Outro End-Card */}
      {activeTab === 'watermark' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#070B14]/90 p-3.5 space-y-3.5 text-xs">
          {/* Watermark Controls */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                চ্যানেলের নাম / হ্যান্ডেল (ভিডিওর কোণায় দেখাবে)
              </label>
              <input
                type="text"
                value={watermark.text}
                onChange={(e) => {
                  onChangeWatermark({ ...watermark, text: e.target.value });
                  if (e.target.value.trim()) {
                    onChangeOutro({ ...outro, channelName: e.target.value.trim() });
                  }
                }}
                maxLength={40}
                placeholder="যেমন: @NasrullahStudio"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                চ্যানেল লোগো (PNG/JPG)
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                {watermark.logoUrl && (
                  <div className="relative w-9 h-9 rounded-lg overflow-hidden border border-amber-400/50">
                    <img src={watermark.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleClearLogo}
                      className="absolute -top-1 -right-1 p-0.5 rounded-full bg-slate-950 text-rose-400 cursor-pointer"
                      title="লোগো সরান"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-[11px] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>{watermark.logoUrl ? 'লোগো বদলান' : 'লোগো আপলোড'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 items-center">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                ওয়াটারমার্কের অবস্থান
              </span>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'top-left' as WatermarkPosition, label: 'উপর-বাম' },
                  { id: 'top-right' as WatermarkPosition, label: 'উপর-ডান' },
                  { id: 'bottom-left' as WatermarkPosition, label: 'নিচ-বাম' },
                  { id: 'bottom-right' as WatermarkPosition, label: 'নিচ-ডান' },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => onChangeWatermark({ ...watermark, position: pos.id })}
                    className={`py-1 rounded-md border text-[10px] font-semibold cursor-pointer ${
                      watermark.position === pos.id
                        ? 'border-amber-500 dark:border-amber-400 bg-amber-500/15 dark:bg-amber-400/20 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                স্বচ্ছতা (Opacity): {Math.round(watermark.opacity * 100)}%
              </span>
              <input
                type="range"
                min={0.25}
                max={1.0}
                step={0.05}
                value={watermark.opacity}
                onChange={(e) =>
                  onChangeWatermark({ ...watermark, opacity: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-500 dark:accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Animated Outro / Subscribe End-Card */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-rose-700 dark:text-rose-200">
                <input
                  type="checkbox"
                  checked={outro.enabled}
                  onChange={(e) => onChangeOutro({ ...outro, enabled: e.target.checked })}
                  className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
                />
                <Youtube className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                <span>অ্যানিমেটেড আউটরো / Subscribe এন্ড-কার্ড (শেষ ৩ সেকেন্ডে)</span>
              </label>

              {outro.enabled && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">সময়:</span>
                  {[2, 3, 4].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onChangeOutro({ ...outro, durationSec: sec })}
                      className={`px-2 py-0.5 rounded border font-bold cursor-pointer ${
                        outro.durationSec === sec
                          ? 'border-rose-500 dark:border-rose-400 bg-rose-500/15 text-rose-800 dark:text-rose-200'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {sec} সে.
                    </button>
                  ))}
                </div>
              )}
            </div>

            {outro.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                <input
                  type="text"
                  value={outro.headline}
                  onChange={(e) => onChangeOutro({ ...outro, headline: e.target.value })}
                  placeholder="মূল লেখা (যেমন: ভিডিওটি ভালো লাগলে Like ও Subscribe করুন!)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-rose-500 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
                <input
                  type="text"
                  value={outro.subtext}
                  onChange={(e) => onChangeOutro({ ...outro, subtext: e.target.value })}
                  placeholder="নিচের লাইন (যেমন: পরবর্তী পর্বের জন্য ফলো দিয়ে সাথেই থাকুন)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-rose-500 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1-Click Thumbnail Maker Modal */}
      <ThumbnailMakerModal
        isOpen={isThumbModalOpen}
        onClose={() => setIsThumbModalOpen(false)}
        initialTitle={projectTitle}
        availablePhotos={photos}
        initialChannelTag={watermark.text}
        initialLogoUrl={watermark.logoUrl}
      />
    </div>
  );
};
