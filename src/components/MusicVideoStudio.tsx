import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Music,
  Upload,
  Sparkles,
  Play,
  Pause,
  Film,
  Image as ImageIcon,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Clock,
  Plus,
  Loader2,
  SlidersHorizontal,
  Palette,
  Type,
  Sparkle,
  Scissors,
  Volume2,
  VolumeX,
  Check,
  Wand2,
  AlertCircle,
  Layers,
  Subtitles,
} from 'lucide-react';
import {
  AtmosphereSeed,
  buildLyricsSrtContent,
  createAtmosphereSeeds,
  DEFAULT_MUSIC_VIDEO_CONFIG,
  exportMusicVideo,
  LoadedMusicClipAsset,
  MUSIC_ATMOSPHERE_OPTIONS,
  MUSIC_COLOR_GRADE_OPTIONS,
  MUSIC_TEMPLATE_OPTIONS,
  MusicLyricLine,
  MusicMediaClip,
  MusicTransitionId,
  MusicVideoAspect,
  MusicVideoConfig,
  renderMusicVideoFrame,
  splitManualLyricsEvenly,
} from '../services/musicVideoEngine.ts';
import {
  triggerBlobDownload,
  VIDEO_QUALITY_OPTIONS,
  VideoAspect,
  VideoQualityPreset,
} from '../services/subtitleAndVideoService.ts';
import { BACKGROUND_THEME_PACKS } from '../data/backgroundPacks.ts';
import { ReadyExportVideo, VideoExportReadyModal } from './VideoExportReadyModal.tsx';

interface MusicVideoStudioProps {
  projectTitle: string;
  onChangeProjectTitle: (title: string) => void;
  ownerId: string;
  onOpenLibrary: () => void;
}

type StyleTabId = 'template' | 'visual' | 'typography';

const LYRIC_COLOR_SWATCHES = [
  { label: 'শুদ্ধ সাদা', hex: '#ffffff' },
  { label: 'সফট ক্রিম', hex: '#fef3c7' },
  { label: 'আইস ব্লু', hex: '#e0f2fe' },
  { label: 'সফট রোজ', hex: '#ffe4e6' },
];

const ACCENT_COLOR_SWATCHES = [
  { label: 'গোল্ডেন', hex: '#fbbf24' },
  { label: 'রোজ পিঙ্ক', hex: '#fb7185' },
  { label: 'স্কাই নিয়ন', hex: '#38bdf8' },
  { label: 'এমেরাল্ড', hex: '#34d399' },
  { label: 'সফট ভায়োলেট', hex: '#c084fc' },
];

function formatClock(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPreciseSec(sec: number): string {
  return Math.max(0, Number.isFinite(sec) ? sec : 0).toFixed(1);
}

export const MusicVideoStudio: React.FC<MusicVideoStudioProps> = ({
  projectTitle,
  onChangeProjectTitle,
  ownerId,
  onOpenLibrary,
}) => {
  // Audio source & trim state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDurationSec, setAudioDurationSec] = useState<number>(0);
  const [trimStartSec, setTrimStartSec] = useState<number>(0);
  const [trimEndSec, setTrimEndSec] = useState<number>(0);

  // Mixed video clips & photos state
  const [clips, setClips] = useState<MusicMediaClip[]>([]);
  const [showStockPicker, setShowStockPicker] = useState<boolean>(false);
  const [activeStockPackId, setActiveStockPackId] = useState<string>(BACKGROUND_THEME_PACKS[3]?.id || 'nature');

  // Lyrics & AI Sync state
  const [lyrics, setLyrics] = useState<MusicLyricLine[]>([]);
  const [lyricLang, setLyricLang] = useState<'auto' | 'bn' | 'hi' | 'ar' | 'en'>('auto');
  const [includeTranslation, setIncludeTranslation] = useState<boolean>(false);
  const [manualLyricsDraft, setManualLyricsDraft] = useState<string>('');
  const [showManualBox, setShowManualBox] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcribeInfo, setTranscribeInfo] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // Aesthetic & Config state
  const [config, setConfig] = useState<MusicVideoConfig>(() => ({
    ...DEFAULT_MUSIC_VIDEO_CONFIG,
    songTitle: projectTitle || '',
  }));
  const [styleTab, setStyleTab] = useState<StyleTabId>('template');

  // Live Preview Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [previewRelSec, setPreviewRelSec] = useState<number>(0);

  // Export & Modal state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [readyVideo, setReadyVideo] = useState<ReadyExportVideo | null>(null);

  // Refs for audio, canvas, clips, and real-time preview rendering
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const loadedAssetsRef = useRef<LoadedMusicClipAsset[]>([]);
  const seedsRef = useRef<AtmosphereSeed[]>(createAtmosphereSeeds(72));
  const audioGraphRef = useRef<{
    ctx: AudioContext;
    analyser: AnalyserNode;
    freqData: Uint8Array<ArrayBuffer>;
    el: HTMLAudioElement;
  } | null>(null);

  // Keep latest values in refs for zero-stale rAF preview loop
  const configRef = useRef(config);
  const lyricsRef = useRef(lyrics);
  const isPlayingRef = useRef(isPlaying);
  const previewRelSecRef = useRef(previewRelSec);

  const activeDurationSec = useMemo(() => {
    if (audioDurationSec <= 0) return 18;
    const end = trimEndSec > trimStartSec + 0.8 ? Math.min(audioDurationSec, trimEndSec) : audioDurationSec;
    return Math.max(1, end - Math.max(0, trimStartSec));
  }, [audioDurationSec, trimStartSec, trimEndSec]);

  const activeDurationRef = useRef(activeDurationSec);
  const trimStartRef = useRef(trimStartSec);

  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    lyricsRef.current = lyrics;
  }, [lyrics]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    previewRelSecRef.current = previewRelSec;
  }, [previewRelSec]);
  useEffect(() => {
    activeDurationRef.current = activeDurationSec;
  }, [activeDurationSec]);
  useEffect(() => {
    trimStartRef.current = trimStartSec;
  }, [trimStartSec]);

  // Sync top navbar projectTitle into songTitle if songTitle is empty
  useEffect(() => {
    if (projectTitle && !config.songTitle) {
      setConfig((prev) => ({ ...prev, songTitle: projectTitle }));
    }
  }, [projectTitle]);

  // Cleanup created object URLs on unmount
  const latestAudioUrlRef = useRef<string | null>(null);
  const latestClipsRef = useRef<MusicMediaClip[]>([]);
  useEffect(() => {
    latestAudioUrlRef.current = audioUrl;
  }, [audioUrl]);
  useEffect(() => {
    latestClipsRef.current = clips;
  }, [clips]);

  useEffect(() => {
    return () => {
      if (latestAudioUrlRef.current) URL.revokeObjectURL(latestAudioUrlRef.current);
      latestClipsRef.current.forEach((c) => {
        if (c.isObjectUrl) URL.revokeObjectURL(c.url);
      });
      loadedAssetsRef.current.forEach((a) => a.videoEl?.pause());
      if (audioGraphRef.current) {
        audioGraphRef.current.ctx.close().catch(() => {});
      }
    };
  }, []);

  // Load DOM Image / Video elements whenever clips list changes
  const [assetsVersion, setAssetsVersion] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const prevAssets = loadedAssetsRef.current;

    const loadClips = async () => {
      const nextLoaded: LoadedMusicClipAsset[] = [];
      for (const clip of clips) {
        const existing = prevAssets.find((a) => a.clip.id === clip.id && a.clip.url === clip.url);
        if (existing) {
          nextLoaded.push({ ...existing, clip });
          continue;
        }
        if (clip.kind === 'image') {
          const loaded = await new Promise<LoadedMusicClipAsset | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve({ clip, imageEl: img });
            img.onerror = () => resolve(null);
            img.src = clip.url;
          });
          if (loaded) nextLoaded.push(loaded);
        } else {
          const loaded = await new Promise<LoadedMusicClipAsset | null>((resolve) => {
            const vid = document.createElement('video');
            vid.src = clip.url;
            vid.muted = true;
            vid.loop = true;
            vid.playsInline = true;
            vid.crossOrigin = 'anonymous';
            vid.preload = 'auto';
            const finish = () => resolve({ clip, videoEl: vid });
            vid.onloadeddata = finish;
            vid.onerror = () => resolve(null);
            setTimeout(() => {
              if (vid.readyState >= 2) finish();
            }, 2200);
          });
          if (loaded) nextLoaded.push(loaded);
        }
      }

      if (cancelled) return;
      // Pause removed video elements
      prevAssets.forEach((old) => {
        if (old.videoEl && !nextLoaded.some((n) => n.videoEl === old.videoEl)) {
          old.videoEl.pause();
        }
      });
      loadedAssetsRef.current = nextLoaded;
      if (isPlayingRef.current) {
        nextLoaded.forEach((a) => a.videoEl?.play().catch(() => {}));
      }
      setAssetsVersion((v) => v + 1);
    };

    loadClips();
    return () => {
      cancelled = true;
    };
  }, [clips]);

  // Preview canvas intrinsic dimensions (crisp & fast for live preview)
  const previewDims = useMemo(() => {
    if (config.aspect === '16:9') return { width: 960, height: 540 };
    if (config.aspect === '1:1') return { width: 680, height: 680 };
    return { width: 540, height: 960 };
  }, [config.aspect]);

  // Helper to paint a single live preview frame
  const drawLivePreview = (relSec: number, freqData?: Uint8Array) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderMusicVideoFrame({
      ctx,
      width: canvas.width,
      height: canvas.height,
      t: relSec,
      totalDuration: activeDurationRef.current,
      assets: loadedAssetsRef.current,
      lyrics: lyricsRef.current,
      freqData,
      config: configRef.current,
      seeds: seedsRef.current,
    });
  };

  // Re-render paused preview immediately on any config, lyric, seek, or clip change
  useEffect(() => {
    if (!isPlaying) {
      drawLivePreview(previewRelSec);
    }
  }, [config, lyrics, previewRelSec, activeDurationSec, assetsVersion, previewDims, isPlaying]);

  // Continuous live preview animation loop while playing
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastUiSync = 0;

    const tick = () => {
      const audioEl = previewAudioRef.current;
      let relT = previewRelSecRef.current;
      if (audioEl && audioUrl) {
        relT = Math.max(0, audioEl.currentTime - trimStartRef.current);
        if (relT >= activeDurationRef.current - 0.04 || audioEl.ended) {
          audioEl.pause();
          audioEl.currentTime = trimStartRef.current;
          loadedAssetsRef.current.forEach((a) => a.videoEl?.pause());
          setIsPlaying(false);
          setPreviewRelSec(0);
          drawLivePreview(0);
          return;
        }
      } else {
        relT = (previewRelSecRef.current + 1 / 60) % activeDurationRef.current;
      }

      previewRelSecRef.current = relT;
      const now = performance.now();
      if (now - lastUiSync > 90) {
        lastUiSync = now;
        setPreviewRelSec(relT);
      }

      let freq: Uint8Array | undefined;
      if (audioGraphRef.current) {
        audioGraphRef.current.analyser.getByteFrequencyData(audioGraphRef.current.freqData);
        freq = audioGraphRef.current.freqData;
      }
      drawLivePreview(relT, freq);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, audioUrl]);

  const ensureAudioAnalyser = () => {
    const el = previewAudioRef.current;
    if (!el) return;
    if (audioGraphRef.current && audioGraphRef.current.el === el) {
      if (audioGraphRef.current.ctx.state === 'suspended') {
        audioGraphRef.current.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioGraphRef.current = { ctx, analyser, freqData, el };
    } catch {
      // Fallback safely if analyser cannot attach
    }
  };

  const handleTogglePlay = async () => {
    const el = previewAudioRef.current;
    if (isPlaying) {
      el?.pause();
      loadedAssetsRef.current.forEach((a) => a.videoEl?.pause());
      setIsPlaying(false);
      return;
    }

    if (el && audioUrl) {
      ensureAudioAnalyser();
      const targetAbs = trimStartSec + previewRelSec;
      if (targetAbs >= trimStartSec + activeDurationSec - 0.1 || targetAbs < trimStartSec) {
        el.currentTime = trimStartSec;
        setPreviewRelSec(0);
        previewRelSecRef.current = 0;
      } else {
        el.currentTime = targetAbs;
      }
      el.muted = isMuted;
      try {
        await el.play();
      } catch {
        // ignore autoplay warning
      }
    }
    loadedAssetsRef.current.forEach((a) => a.videoEl?.play().catch(() => {}));
    setIsPlaying(true);
  };

  const handleSeekPreview = (nextRel: number) => {
    const clamped = Math.max(0, Math.min(activeDurationSec, nextRel));
    setPreviewRelSec(clamped);
    previewRelSecRef.current = clamped;
    const el = previewAudioRef.current;
    if (el && audioUrl) {
      el.currentTime = trimStartSec + clamped;
    }
    drawLivePreview(clamped);
  };

  // Handle Song / Audio file selection
  const handleSelectAudioFile = (file: File | null | undefined) => {
    if (!file) return;
    if (isPlaying) {
      previewAudioRef.current?.pause();
      setIsPlaying(false);
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);

    const nextUrl = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioUrl(nextUrl);
    setPreviewRelSec(0);
    setTranscribeInfo(null);
    setTranscribeError(null);
    setExportError(null);

    const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (cleanName && !config.songTitle) {
      setConfig((prev) => ({ ...prev, songTitle: cleanName.slice(0, 48) }));
    }
    if (cleanName && !projectTitle) {
      onChangeProjectTitle(cleanName.slice(0, 60));
    }

    // Probe real audio duration immediately
    const probe = document.createElement('audio');
    probe.src = nextUrl;
    probe.onloadedmetadata = () => {
      const dur = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 30;
      setAudioDurationSec(dur);
      setTrimStartSec(0);
      setTrimEndSec(dur);
    };
  };

  // Handle Mixed Video Clips & Images Upload
  const handleUploadClips = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: MusicMediaClip[] = [];
    Array.from(files).forEach((file, idx) => {
      const isVid = file.type.startsWith('video/');
      const isImg = file.type.startsWith('image/');
      if (!isVid && !isImg) return;
      const objUrl = URL.createObjectURL(file);
      added.push({
        id: `clip_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        kind: isVid ? 'video' : 'image',
        name: file.name,
        url: objUrl,
        isObjectUrl: true,
      });
    });
    if (added.length > 0) {
      setClips((prev) => [...prev, ...added]);
    }
  };

  const handleAddStockScene = (photo: { id: string; url: string; label: string }) => {
    setClips((prev) => [
      ...prev,
      {
        id: `stock_${photo.id}_${Date.now()}`,
        kind: 'image',
        name: photo.label,
        url: photo.url,
        isObjectUrl: false,
      },
    ]);
  };

  const handleMoveClip = (index: number, dir: -1 | 1) => {
    setClips((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const handleRemoveClip = (id: string) => {
    setClips((prev) => {
      const found = prev.find((c) => c.id === id);
      if (found?.isObjectUrl) URL.revokeObjectURL(found.url);
      return prev.filter((c) => c.id !== id);
    });
  };

  // AI Auto-Transcribe & Sync Lyrics from Uploaded Music
  const handleAiAutoLyrics = async () => {
    if (!audioFile) {
      setTranscribeError('প্রথমে একটি গান বা অডিও ফাইল আপলোড করুন।');
      return;
    }
    setIsTranscribing(true);
    setTranscribeError(null);
    setTranscribeInfo(null);

    try {
      const params = new URLSearchParams({
        startSec: String(trimStartSec.toFixed(2)),
        endSec: String((trimEndSec > trimStartSec ? trimEndSec : audioDurationSec).toFixed(2)),
        durationSec: String(activeDurationSec.toFixed(2)),
        language: lyricLang,
        includeTranslation: includeTranslation ? 'true' : 'false',
      });

      const headers: Record<string, string> = {
        'Content-Type': audioFile.type || 'audio/mpeg',
      };
      if (manualLyricsDraft.trim()) {
        headers['x-lyrics-hint'] = encodeURIComponent(manualLyricsDraft.trim().slice(0, 3500));
      }

      const res = await fetch(`/api/music/transcribe-lyrics?${params.toString()}`, {
        method: 'POST',
        headers,
        body: audioFile,
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'লিরিক্স বিশ্লেষণ করা যায়নি।');
      }

      const lines: MusicLyricLine[] = Array.isArray(data.lines) ? data.lines : [];
      if (lines.length === 0) {
        setTranscribeInfo(
          data.isInstrumental
            ? 'এই অডিওটি মূলত ইন্সট্রুমেন্টাল (কোনো গানের কথা পাওয়া যায়নি)। চাইলে নিচে নিজের লেখা কবিতা বা উক্তি যোগ করতে পারেন।'
            : 'কোনো স্পষ্ট লিরিক্স শনাক্ত হয়নি। চাইলে নিজের লিরিক্স পেস্ট করে বসাতে পারেন।'
        );
      } else {
        setLyrics(lines);
        setTranscribeInfo(
          `${lines.length}টি লিরিক্স লাইন অটো-সিঙ্ক হয়েছে${data.detectedLanguage ? ` (${data.detectedLanguage})` : ''}।`
        );
        if (data.suggestedTitle && !config.songTitle.trim()) {
          setConfig((prev) => ({ ...prev, songTitle: String(data.suggestedTitle).slice(0, 48) }));
        }
      }
    } catch (err: any) {
      setTranscribeError(err?.message || 'AI লিরিক্স তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleApplyManualLyricsEvenly = () => {
    if (!manualLyricsDraft.trim()) {
      setTranscribeError('আগে বক্সে আপনার গানের লাইন বা কবিতা লিখুন বা পেস্ট করুন।');
      return;
    }
    const generated = splitManualLyricsEvenly(manualLyricsDraft, activeDurationSec);
    setLyrics(generated);
    setTranscribeError(null);
    setTranscribeInfo(`${generated.length}টি লাইন সমান সময়ে বসানো হয়েছে। প্রিভিউ চালিয়ে চাইলে প্রতিটি লাইনের সময় ঠিক করে নিতে পারেন।`);
  };

  // Lyric line editing helpers
  const updateLyricLine = (id: string, patch: Partial<MusicLyricLine>) => {
    setLyrics((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const snapLineStartToCurrentTime = (index: number) => {
    const nowT = Number(previewRelSecRef.current.toFixed(2));
    setLyrics((prev) =>
      prev.map((line, idx) => {
        if (idx === index) {
          const nextEnd = line.endSec <= nowT + 0.4 ? Number(Math.min(activeDurationSec, nowT + 3.2).toFixed(2)) : line.endSec;
          return { ...line, startSec: nowT, endSec: nextEnd };
        }
        if (idx === index - 1 && line.endSec > nowT) {
          return { ...line, endSec: Math.max(line.startSec + 0.3, nowT) };
        }
        return line;
      })
    );
  };

  const handleAddNewLyricLine = () => {
    const last = lyrics[lyrics.length - 1];
    const startSec = last ? Number(Math.min(activeDurationSec - 0.5, last.endSec).toFixed(2)) : Number(previewRelSec.toFixed(2));
    const endSec = Number(Math.min(activeDurationSec, startSec + 3.5).toFixed(2));
    setLyrics((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        startSec: Math.max(0, startSec),
        endSec: Math.max(startSec + 0.5, endSec),
        text: 'নতুন লিরিক্স লাইন লিখুন...',
        subText: '',
      },
    ]);
  };

  const handleDeleteLyricLine = (id: string) => {
    setLyrics((prev) => prev.filter((l) => l.id !== id));
  };

  const handleDownloadSrt = () => {
    if (lyrics.length === 0) return;
    const srt = buildLyricsSrtContent(lyrics);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const base = (config.songTitle || projectTitle || 'music_lyrics').trim().replace(/\s+/g, '_');
    triggerBlobDownload(blob, `${base}.srt`);
  };

  // Export Music Video -> Opens VideoExportReadyModal
  const runExport = async (overrideQuality?: VideoQualityPreset, overrideAspect?: VideoAspect) => {
    if (!audioUrl) {
      setExportError('ভিডিও তৈরি করতে প্রথমে একটি গান বা অডিও আপলোড করুন।');
      return;
    }

    // Pause live preview cleanly before recording
    if (isPlaying) {
      previewAudioRef.current?.pause();
      loadedAssetsRef.current.forEach((a) => a.videoEl?.pause());
      setIsPlaying(false);
    }

    const effectiveConfig: MusicVideoConfig = {
      ...config,
      qualityPreset: overrideQuality || config.qualityPreset,
      aspect: overrideAspect || config.aspect,
    };

    if (overrideQuality || overrideAspect) {
      setConfig(effectiveConfig);
    }

    setIsExporting(true);
    setExportProgress(1);
    setExportError(null);

    try {
      const blob = await exportMusicVideo({
        audioUrl,
        trimStartSec,
        trimEndSec: trimEndSec > trimStartSec ? trimEndSec : audioDurationSec,
        clips,
        lyrics,
        config: effectiveConfig,
        onProgress: (pct) => setExportProgress(pct),
      });

      const baseName = (effectiveConfig.songTitle || projectTitle || 'nasrullah_music_video')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '_');

      setReadyVideo({
        blob,
        suggestedBaseName: `${baseName}_${effectiveConfig.aspect.replace(':', 'x')}`,
        aspect: effectiveConfig.aspect === '1:1' ? undefined : effectiveConfig.aspect,
        qualityPreset: effectiveConfig.qualityPreset,
        durationSec: activeDurationSec,
        hasSubtitles: lyrics.length > 0,
      });
    } catch (err: any) {
      setExportError(err?.message || 'মিউজিক ভিডিও তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsExporting(false);
    }
  };

  // Current active lyric line for preview indicator
  const activeLyricId = useMemo(() => {
    const found = lyrics.find((l) => previewRelSec >= l.startSec && previewRelSec <= l.endSec);
    return found?.id || null;
  }, [lyrics, previewRelSec]);

  const activeStockPack =
    BACKGROUND_THEME_PACKS.find((p) => p.id === activeStockPackId) || BACKGROUND_THEME_PACKS[0];

  return (
    <div className="space-y-6 pb-8">
      {/* Hidden live audio player */}
      <audio
        ref={previewAudioRef}
        src={audioUrl || undefined}
        crossOrigin="anonymous"
        preload="auto"
        className="hidden"
      />

      {/* Hidden file inputs */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={(e) => {
          handleSelectAudioFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={mediaInputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleUploadClips(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Clean Editorial Studio Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Music className="w-4 h-4" />
            <span>লিরিক মিউজিক ভিডিও মেকার</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            মিউজিক ও অটো-সাবটাইটেল ভিডিও স্টুডিও
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            ছোট বা বড় যেকোনো গান, নাশিদ বা অডিও এবং আপনার পছন্দের ভিডিও ক্লিপ বা ছবি আপলোড করুন—অ্যাসথেটিক সাবটাইটেল ও স্মুথ ট্রানজিশনসহ প্রো মিউজিক ভিডিও বানান।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
          <span>{audioFile ? `অডিও: ${formatClock(activeDurationSec)}` : 'অডিও বাকি'}</span>
          <span aria-hidden="true">·</span>
          <span>ক্লিপ/ছবি: {clips.length}টি</span>
          <span aria-hidden="true">·</span>
          <span>লিরিক্স: {lyrics.length} লাইন</span>
        </div>
      </div>

      {/* Main 12-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT 7 COLS: 4-Step Creation Workspace */}
        <div className="lg:col-span-7 space-y-5">
          {/* STEP 1: SONG / AUDIO UPLOAD + TRIM */}
          <section className="rounded-2xl bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center tabular-nums">
                  ১
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    গান বা অডিও আপলোড করুন
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    MP3, WAV, M4A বা ভিডিও থেকে অডিও (১৫ সে., ৩০–৩৫ সে., ১ মিনিট বা পূর্ণ গান—সব চলবে)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{audioFile ? 'অডিও বদলান' : 'গান বাছাই করুন'}</span>
              </button>
            </div>

            {!audioFile ? (
              <div
                onClick={() => audioInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleSelectAudioFile(e.dataTransfer.files?.[0]);
                }}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500/80 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/70 dark:bg-slate-950/40"
              >
                <Music className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  এখানে ক্লিক করুন বা আপনার গান / নাশিদ / অডিও ফাইল ড্র্যাগ করে ছাড়ুন
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ৩০–৩৫ সেকেন্ডের ছোট রিলস অডিও অথবা বড় পূর্ণাঙ্গ গান — সবই সাপোর্ট করে
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Music className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {audioFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        মোট দৈর্ঘ্য: {formatClock(audioDurationSec)} · নির্বাচিত ভিডিও দৈর্ঘ্য: {activeDurationSec.toFixed(1)} সে. ({formatClock(activeDurationSec)})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlaying) {
                        previewAudioRef.current?.pause();
                        setIsPlaying(false);
                      }
                      if (audioUrl) URL.revokeObjectURL(audioUrl);
                      setAudioFile(null);
                      setAudioUrl(null);
                      setAudioDurationSec(0);
                      setTrimStartSec(0);
                      setTrimEndSec(0);
                      setPreviewRelSec(0);
                    }}
                    title="অডিও সরান"
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Flexible Audio Trim Range: Any duration (15s, 30s, 35s, 45s, 60s, custom, or full song) */}
                {audioDurationSec > 2 && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <Scissors className="w-3.5 h-3.5 text-amber-500" />
                        <span>ভিডিওর দৈর্ঘ্য ও অংশ বাছাই করুন</span>
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setTrimStartSec(0);
                            setTrimEndSec(audioDurationSec);
                            handleSeekPreview(0);
                          }}
                          className={`px-2 py-1 rounded-md border font-semibold transition-colors cursor-pointer ${
                            trimStartSec < 0.2 && Math.abs((trimEndSec || audioDurationSec) - audioDurationSec) < 0.4
                              ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          পুরো অডিও
                        </button>
                        {[15, 30, 35, 45, 60]
                          .filter((sec) => audioDurationSec > sec + 0.5)
                          .map((sec) => {
                            const isActiveLen = Math.abs(activeDurationSec - sec) < 0.4;
                            return (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => {
                                  const nextStart =
                                    trimStartSec + sec <= audioDurationSec
                                      ? trimStartSec
                                      : Math.max(0, audioDurationSec - sec);
                                  setTrimStartSec(Number(nextStart.toFixed(1)));
                                  setTrimEndSec(Number(Math.min(audioDurationSec, nextStart + sec).toFixed(1)));
                                  handleSeekPreview(0);
                                }}
                                className={`px-2 py-1 rounded-md border font-semibold tabular-nums transition-colors cursor-pointer ${
                                  isActiveLen
                                    ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {sec} সে.
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {/* Sliders */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <label className="space-y-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          শুরু ({formatClock(trimStartSec)})
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, audioDurationSec - 1)}
                          step={0.5}
                          value={trimStartSec}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTrimStartSec(val);
                            if (trimEndSec <= val + 1) {
                              setTrimEndSec(Math.min(audioDurationSec, val + 30));
                            }
                            handleSeekPreview(0);
                          }}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          শেষ ({formatClock(trimEndSec || audioDurationSec)})
                        </span>
                        <input
                          type="range"
                          min={Math.min(audioDurationSec, trimStartSec + 1)}
                          max={audioDurationSec}
                          step={0.5}
                          value={trimEndSec || audioDurationSec}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTrimEndSec(Math.max(trimStartSec + 1, val));
                          }}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Exact Numeric Start / Duration / End Inputs */}
                    <div className="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
                      <label className="space-y-1">
                        <span className="text-slate-500 dark:text-slate-400 block">শুরু (সে.)</span>
                        <input
                          type="number"
                          min={0}
                          max={Math.max(0, Number((audioDurationSec - 1).toFixed(1)))}
                          step={0.5}
                          value={Number(trimStartSec.toFixed(1))}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(audioDurationSec - 1, parseFloat(e.target.value) || 0));
                            setTrimStartSec(val);
                            if (trimEndSec <= val + 1) {
                              setTrimEndSec(Math.min(audioDurationSec, val + 30));
                            }
                            handleSeekPreview(0);
                          }}
                          className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-slate-500 dark:text-slate-400 block">দৈর্ঘ্য (সে.)</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, Number(audioDurationSec.toFixed(1)))}
                          step={1}
                          value={Number(activeDurationSec.toFixed(1))}
                          onChange={(e) => {
                            const desired = Math.max(1, Math.min(audioDurationSec, parseFloat(e.target.value) || 30));
                            const nextStart =
                              trimStartSec + desired <= audioDurationSec
                                ? trimStartSec
                                : Math.max(0, audioDurationSec - desired);
                            setTrimStartSec(Number(nextStart.toFixed(1)));
                            setTrimEndSec(Number(Math.min(audioDurationSec, nextStart + desired).toFixed(1)));
                            handleSeekPreview(0);
                          }}
                          className="w-full rounded-lg bg-white dark:bg-slate-900 border border-amber-500/60 px-2 py-1.5 font-bold text-amber-700 dark:text-amber-300 focus:outline-none focus:border-amber-500"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-slate-500 dark:text-slate-400 block">শেষ (সে.)</span>
                        <input
                          type="number"
                          min={Math.min(audioDurationSec, Number((trimStartSec + 1).toFixed(1)))}
                          max={Number(audioDurationSec.toFixed(1))}
                          step={0.5}
                          value={Number((trimEndSec || audioDurationSec).toFixed(1))}
                          onChange={(e) => {
                            const val = Math.max(
                              trimStartSec + 1,
                              Math.min(audioDurationSec, parseFloat(e.target.value) || audioDurationSec)
                            );
                            setTrimEndSec(val);
                          }}
                          className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* STEP 2: MIXED VIDEO CLIPS & IMAGES */}
          <section className="rounded-2xl bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center tabular-nums">
                  ২
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    ভিডিও ক্লিপ ও ছবি যোগ করুন
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    একাধিক ভিডিও ক্লিপ বা ছবি একসাথে দিন—স্মুথলি একটার পর একটা চলবে
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowStockPicker((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  <span>স্টুডিও সিন</span>
                </button>
                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>ক্লিপ / ছবি আপলোড</span>
                </button>
              </div>
            </div>

            {/* Optional Studio Built-in Local Scenes Picker */}
            {showStockPicker && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    স্টুডিওর ফ্রি অ্যাসথেটিক সিন (ক্লিক করে যোগ করুন)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {BACKGROUND_THEME_PACKS.map((pack) => (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => setActiveStockPackId(pack.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                          activeStockPackId === pack.id
                            ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {pack.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {activeStockPack.photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => handleAddStockScene(photo)}
                      className="group relative aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-amber-500 transition-all cursor-pointer"
                    >
                      <img src={photo.url} alt={photo.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1 text-[10px] font-semibold text-white truncate">
                        + {photo.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Uploaded Clips & Photos Strip */}
            {clips.length === 0 ? (
              <div
                onClick={() => mediaInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleUploadClips(e.dataTransfer.files);
                }}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-50/70 dark:bg-slate-950/40"
              >
                <div className="flex items-center justify-center gap-3 text-amber-500 mb-2">
                  <Film className="w-6 h-6" />
                  <ImageIcon className="w-6 h-6" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  ভিডিও ক্লিপ বা ছবি যোগ করুন (না দিলেও ডার্ক অ্যাসথেটিক ব্যাকগ্রাউন্ড থাকবে)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  একাধিক ফাইল একসাথে সিলেক্ট করা যাবে · ভিডিওর অরিজিনাল সাউন্ড অটো মিউট হয়ে গান বাজবে
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {clips.map((clip, idx) => (
                    <div
                      key={clip.id}
                      className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 aspect-[4/3]"
                    >
                      {clip.kind === 'video' ? (
                        <video
                          src={clip.url}
                          muted
                          playsInline
                          className="w-full h-full object-cover opacity-90"
                        />
                      ) : (
                        <img
                          src={clip.url}
                          alt={clip.name}
                          className="w-full h-full object-cover opacity-90"
                        />
                      )}

                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-bold text-white tabular-nums">
                        <span>{idx + 1}</span>
                        <span>·</span>
                        <span>{clip.kind === 'video' ? 'ভিডিও' : 'ছবি'}</span>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-1.5 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveClip(idx, -1)}
                            title="আগে নিন"
                            className="p-1 rounded bg-white/15 hover:bg-white/30 text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === clips.length - 1}
                            onClick={() => handleMoveClip(idx, 1)}
                            title="পরে নিন"
                            className="p-1 rounded bg-white/15 hover:bg-white/30 text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveClip(clip.id)}
                          title="মুছে ফেলুন"
                          className="p-1 rounded bg-rose-500/80 hover:bg-rose-500 text-white cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Clip Change Speed */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    দৃশ্য পরিবর্তনের সময়:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { val: 0, label: 'অটো সমান ভাগ' },
                      { val: 3, label: '৩ সেকেন্ড' },
                      { val: 5, label: '৫ সেকেন্ড' },
                      { val: 8, label: '৮ সেকেন্ড' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, clipDurationSec: opt.val }))}
                        className={`px-2.5 py-1 rounded-lg border font-semibold transition-colors cursor-pointer ${
                          config.clipDurationSec === opt.val
                            ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* STEP 3: AI AUTO-SYNC LYRICS & INTERACTIVE EDITOR */}
          <section className="rounded-2xl bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center tabular-nums">
                  ৩
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    অটো সাবটাইটেল ও লিরিক্স সিঙ্ক
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    AI সরাসরি গান শুনে লাইন-বাই-লাইন টাইমিং বানাবে, অথবা নিজের লিরিক্স পেস্ট করে সিঙ্ক করুন
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowManualBox((v) => !v)}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                {showManualBox ? 'লিরিক্স বক্স লুকান' : '+ নিজের লিরিক্স পেস্ট করুন'}
              </button>
            </div>

            {/* Language + Translation Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">গানের ভাষা</label>
                <select
                  value={lyricLang}
                  onChange={(e) => setLyricLang(e.target.value as any)}
                  className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="auto">অটো ডিটেক্ট (বাংলা / হিন্দি / আরবি / ইংরেজি)</option>
                  <option value="bn">বাংলা (Bangla)</option>
                  <option value="hi">হিন্দি / উর্দু (Hindi / Urdu)</option>
                  <option value="ar">আরবি / নাশিদ (Arabic)</option>
                  <option value="en">ইংরেজি (English)</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTranslation}
                    onChange={(e) => setIncludeTranslation(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    নিচে বাংলা অর্থ দেখাও (Translation)
                  </span>
                </label>
              </div>
            </div>

            {/* Optional Manual Lyrics Paste / Hint Box */}
            {showManualBox && (
              <div className="space-y-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  নিজের গানের কথা বা কবিতা (প্রতি লাইনে একটি করে লিখুন)
                </label>
                <textarea
                  rows={4}
                  value={manualLyricsDraft}
                  onChange={(e) => setManualLyricsDraft(e.target.value)}
                  placeholder={'তুমি রবে নীরবে হৃদয়ে মম\nনিবিড় নিভৃত পূর্ণিমা নিশীথিনী-সম...'}
                  className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>এখানে লিরিক্স থাকলে AI ঠিক এই শব্দগুলোই গানের তালে তালে সিঙ্ক করবে।</span>
                  <button
                    type="button"
                    onClick={handleApplyManualLyricsEvenly}
                    className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
                  >
                    AI ছাড়া সমান ভাগে বসাও
                  </button>
                </div>
              </div>
            )}

            {/* Primary AI Auto-Sync Action */}
            <button
              type="button"
              onClick={handleAiAutoLyrics}
              disabled={!audioFile || isTranscribing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-sm shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI গান শুনে অটো লিরিক্স ও টাইমিং বানাচ্ছে...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>
                    {manualLyricsDraft.trim()
                      ? 'AI দিয়ে পেস্ট করা লিরিক্স গানের সাথে সিঙ্ক করুন'
                      : 'AI দিয়ে গান শুনে অটো লিরিক্স ও সাবটাইটেল বানান'}
                  </span>
                </>
              )}
            </button>

            {transcribeInfo && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                <Check className="w-4 h-4 shrink-0" />
                <span>{transcribeInfo}</span>
              </div>
            )}

            {transcribeError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transcribeError}</span>
              </div>
            )}

            {/* Synced Lyrics Timeline List */}
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  লিরিক্স টাইমলাইন ({lyrics.length} লাইন)
                </span>
                <div className="flex items-center gap-2">
                  {lyrics.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadSrt}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-amber-500 cursor-pointer"
                    >
                      <Subtitles className="w-3 h-3 text-amber-500" />
                      <span>.SRT</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddNewLyricLine}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold hover:bg-amber-500/25 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>লাইন যোগ করুন</span>
                  </button>
                </div>
              </div>

              {lyrics.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-3 text-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  উপরের বাটনে ক্লিক করে অটো লিরিক্স বানান অথবা “লাইন যোগ করুন” দিয়ে নিজে লিখুন।
                </p>
              ) : (
                <div className="max-h-[310px] overflow-y-auto space-y-2 pr-1">
                  {lyrics.map((line, idx) => {
                    const isCurrent = line.id === activeLyricId;
                    return (
                      <div
                        key={line.id}
                        className={`rounded-xl border p-2.5 space-y-2 transition-colors ${
                          isCurrent
                            ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-500/10'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
                            <button
                              type="button"
                              onClick={() => handleSeekPreview(line.startSec + 0.05)}
                              title="এই লাইনে প্রিভিউ নিন"
                              className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-amber-500 hover:text-slate-950 transition-colors cursor-pointer"
                            >
                              #{idx + 1}
                            </button>
                            <input
                              type="number"
                              step={0.1}
                              min={0}
                              value={line.startSec}
                              onChange={(e) =>
                                updateLyricLine(line.id, {
                                  startSec: Math.max(0, parseFloat(e.target.value) || 0),
                                })
                              }
                              className="w-16 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 text-slate-900 dark:text-white"
                            />
                            <span className="text-slate-400">–</span>
                            <input
                              type="number"
                              step={0.1}
                              min={0}
                              value={line.endSec}
                              onChange={(e) =>
                                updateLyricLine(line.id, {
                                  endSec: Math.max(line.startSec + 0.2, parseFloat(e.target.value) || 0),
                                })
                              }
                              className="w-16 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 text-slate-900 dark:text-white"
                            />
                            <span className="text-slate-400">সে.</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => snapLineStartToCurrentTime(idx)}
                              title="প্রিভিউ যে সেকেন্ডে আছে সেখানে এই লাইন শুরু করুন"
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-200/80 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-[10px] font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            >
                              <Clock className="w-3 h-3" />
                              <span>এখন ({formatPreciseSec(previewRelSec)}s)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLyricLine(line.id)}
                              title="লাইন মুছুন"
                              className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={line.text}
                          onChange={(e) => updateLyricLine(line.id, { text: e.target.value })}
                          placeholder="মূল লিরিক্স লাইন..."
                          className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />

                        {(includeTranslation || line.subText) && (
                          <input
                            type="text"
                            value={line.subText || ''}
                            onChange={(e) => updateLyricLine(line.id, { subText: e.target.value })}
                            placeholder="অনুবাদ বা দ্বিতীয় লাইন (ঐচ্ছিক)..."
                            className="w-full rounded-lg bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none focus:border-amber-500"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* STEP 4: AESTHETIC TEMPLATES, COLOR GRADE, EFFECTS & QUALITY */}
          <section className="rounded-2xl bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center tabular-nums">
                  ৪
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    স্টাইল, কালার ও ভিডিও সেটিংস
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ভাইরাল Shorts / Reels-এর মতো মিনিমাল, সিনেম্যাটিক বা কারাওকে লুক বেছে নিন
                  </p>
                </div>
              </div>

              {/* Clean Segmented Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                {[
                  { id: 'template' as StyleTabId, label: 'টেমপ্লেট', icon: Sparkle },
                  { id: 'visual' as StyleTabId, label: 'কালার ও ইফেক্ট', icon: Palette },
                  { id: 'typography' as StyleTabId, label: 'টেক্সট ও কোয়ালিটি', icon: Type },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStyleTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        styleTab === tab.id
                          ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TAB A: TEMPLATES & ASPECT RATIO */}
            {styleTab === 'template' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {MUSIC_TEMPLATE_OPTIONS.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, template: tpl.id }))}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        config.template === tpl.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/15'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 hover:border-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{tpl.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{tpl.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Aspect Ratio & Lyric Position */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div className="space-y-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                      ভিডিও সাইজ (Aspect Ratio)
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: '9:16', label: '9:16 Shorts' },
                          { id: '16:9', label: '16:9 YouTube' },
                          { id: '1:1', label: '1:1 Square' },
                        ] as Array<{ id: MusicVideoAspect; label: string }>
                      ).map((asp) => (
                        <button
                          key={asp.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, aspect: asp.id }))}
                          className={`py-2 px-2 rounded-lg border font-bold transition-colors cursor-pointer ${
                            config.aspect === asp.id
                              ? 'border-amber-500 bg-amber-500 text-slate-950'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {asp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                      সাবটাইটেল অবস্থান
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'center', label: 'মাঝখানে' },
                          { id: 'lower-third', label: 'নিচের অংশে' },
                          { id: 'bottom', label: 'একদম নিচে' },
                        ] as const
                      ).map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, lyricPosition: pos.id }))}
                          className={`py-2 px-2 rounded-lg border font-semibold transition-colors cursor-pointer ${
                            config.lyricPosition === pos.id
                              ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB B: COLOR GRADE, TRANSITION & ATMOSPHERE */}
            {styleTab === 'visual' && (
              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                    সিনেম্যাটিক কালার গ্রেড (Filter)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {MUSIC_COLOR_GRADE_OPTIONS.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, colorGrade: g.id }))}
                        className={`py-2 px-3 rounded-xl border font-semibold transition-colors cursor-pointer ${
                          config.colorGrade === g.id
                            ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                    আবহ ইফেক্ট (Overlay)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {MUSIC_ATMOSPHERE_OPTIONS.map((at) => (
                      <button
                        key={at.id}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, atmosphere: at.id }))}
                        className={`py-2 px-3 rounded-xl border font-semibold transition-colors cursor-pointer ${
                          config.atmosphere === at.id
                            ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {at.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                    ক্লিপ ট্রানজিশন
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'crossfade', label: 'সফট ক্রসফেড' },
                        { id: 'zoom-dissolve', label: 'জুম ডিজলভ' },
                        { id: 'hard-cut', label: 'শার্প কাট' },
                      ] as Array<{ id: MusicTransitionId; label: string }>
                    ).map((tr) => (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, transition: tr.id }))}
                        className={`py-2 px-2.5 rounded-xl border font-semibold transition-colors cursor-pointer ${
                          config.transition === tr.id
                            ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {tr.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {[
                    { key: 'beatZoom' as const, label: 'বিট-রিঅ্যাক্টিভ জুম' },
                    { key: 'showAudioBars' as const, label: 'মিউজিক ওয়েভ বার' },
                    { key: 'showProgressBar' as const, label: 'টপ প্রগ্রেস লাইন' },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={config[item.key]}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, [item.key]: e.target.checked }))
                        }
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* TAB C: TYPOGRAPHY, HEADER, WATERMARK & QUALITY */}
            {styleTab === 'typography' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                      সাবটাইটেল রঙ
                    </span>
                    <div className="flex items-center gap-2">
                      {LYRIC_COLOR_SWATCHES.map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, lyricColor: sw.hex }))}
                          title={sw.label}
                          className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform ${
                            config.lyricColor === sw.hex
                              ? 'border-amber-500 scale-110'
                              : 'border-slate-400/50'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                      হাইলাইট / অ্যাকসেন্ট রঙ
                    </span>
                    <div className="flex items-center gap-2">
                      {ACCENT_COLOR_SWATCHES.map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, accentColor: sw.hex }))}
                          title={sw.label}
                          className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform ${
                            config.accentColor === sw.hex
                              ? 'border-white ring-2 ring-amber-500 scale-110'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: sw.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <label className="block space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      লিরিক্স ফন্ট সাইজ
                    </span>
                    <span className="tabular-nums font-bold text-amber-600 dark:text-amber-400">
                      {Math.round(config.fontSizeScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={1.35}
                    step={0.05}
                    value={config.fontSizeScale}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, fontSizeScale: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">গানের নাম</label>
                    <input
                      type="text"
                      value={config.songTitle}
                      onChange={(e) => setConfig((prev) => ({ ...prev, songTitle: e.target.value }))}
                      placeholder="যেমন: ভালোবাসি তোমায়"
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">শিল্পী / ক্রেডিট</label>
                    <input
                      type="text"
                      value={config.artistName}
                      onChange={(e) => setConfig((prev) => ({ ...prev, artistName: e.target.value }))}
                      placeholder="ঐচ্ছিক..."
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">চ্যানেল ওয়াটারমার্ক</label>
                    <input
                      type="text"
                      value={config.watermarkText}
                      onChange={(e) => setConfig((prev) => ({ ...prev, watermarkText: e.target.value }))}
                      placeholder="@yourchannel"
                      className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.showTitleHeader}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showTitleHeader: e.target.checked }))
                    }
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    ভিডিওর উপরে গানের নাম ও শিল্পী দেখাও
                  </span>
                </label>

                <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                    <span>এক্সপোর্ট কোয়ালিটি</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {VIDEO_QUALITY_OPTIONS.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, qualityPreset: q.id }))}
                        className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          config.qualityPreset === q.id
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="font-bold">
                          {q.id === '720p30'
                            ? '720p HD · 30fps'
                            : q.id === '1080p30'
                            ? '1080p Full HD · 30fps'
                            : '1080p Pro · 60fps'}
                        </div>
                        <div className="text-[11px] opacity-75 tabular-nums">{q.bitrateMbps} Mbps</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT 5 COLS: STICKY LIVE CINEMA PREVIEW & EXPORT */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
          <div className="rounded-2xl bg-white dark:bg-[#0E1422] border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Film className="w-4 h-4 text-amber-500" />
                <span>লাইভ প্রিভিউ</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {config.aspect} · {config.qualityPreset === '1080p60' ? '1080p 60fps' : config.qualityPreset === '1080p30' ? '1080p 30fps' : '720p 30fps'}
              </span>
            </div>

            {/* Canvas Stage */}
            <div className="relative rounded-xl bg-black border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center p-2 min-h-[300px]">
              <canvas
                ref={previewCanvasRef}
                width={previewDims.width}
                height={previewDims.height}
                className={`rounded-lg shadow-xl object-contain ${
                  config.aspect === '9:16'
                    ? 'max-h-[470px] w-auto max-w-full'
                    : config.aspect === '1:1'
                    ? 'max-h-[380px] w-auto max-w-full'
                    : 'w-full h-auto max-h-[340px]'
                }`}
              />

              {isExporting && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Loader2 className="w-9 h-9 text-amber-400 animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">
                      মিউজিক ভিডিও রেন্ডার হচ্ছে ({exportProgress}%)
                    </p>
                    <p className="text-xs text-slate-400">
                      ট্যাবটি খোলা রাখুন—শেষ হলে প্রিভিউ ও MP4 / Google Drive অপশন আসবে
                    </p>
                  </div>
                  <div className="w-full max-w-[240px] h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-200"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Transport & Timeline Scrubber */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  disabled={isExporting}
                  className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                  title={isPlaying ? 'থামান' : 'প্লে করুন'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>

                <input
                  type="range"
                  min={0}
                  max={Math.max(1, activeDurationSec)}
                  step={0.05}
                  value={Math.min(activeDurationSec, previewRelSec)}
                  onChange={(e) => handleSeekPreview(parseFloat(e.target.value))}
                  className="flex-1 accent-amber-500 cursor-pointer"
                />

                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                  {formatClock(previewRelSec)} / {formatClock(activeDurationSec)}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    const next = !isMuted;
                    setIsMuted(next);
                    if (previewAudioRef.current) previewAudioRef.current.muted = next;
                  }}
                  title={isMuted ? 'সাউন্ড চালু' : 'মিউট'}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-amber-500 cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {exportError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{exportError}</span>
              </div>
            )}

            {/* Primary Export CTA */}
            <button
              type="button"
              onClick={() => runExport()}
              disabled={!audioFile || isExporting}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>তৈরি হচ্ছে ({exportProgress}%)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>মিউজিক ভিডিও তৈরি করুন</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
              তৈরি হওয়ার পর প্রিভিউ দেখে আসল .MP4 ডাউনলোড বা Google Drive-এ সেভ করতে পারবেন।
            </p>
          </div>
        </div>
      </div>

      {/* Export Ready Modal (MP4 / WebM / SRT / Google Drive / Local Vault) */}
      <VideoExportReadyModal
        readyVideo={readyVideo}
        ownerId={ownerId}
        onClose={() => setReadyVideo(null)}
        onOpenLibrary={onOpenLibrary}
        onDownloadSrt={lyrics.length > 0 ? handleDownloadSrt : undefined}
        onReRenderWithQuality={(nextQuality, nextAspect) => runExport(nextQuality, nextAspect)}
        isReRendering={isExporting}
        reRenderProgress={exportProgress}
      />
    </div>
  );
};
