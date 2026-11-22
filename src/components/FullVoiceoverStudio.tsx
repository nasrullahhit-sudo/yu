import React, { useState, useEffect, useRef } from 'react';
import { DEFAULT_VOICE_CONTROLS, Episode, VoiceControls, VoicePersona } from '../types.ts';
import { AVAILABLE_VOICES, VOICE_STYLE_PRESETS } from '../data/episodes.ts';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  Sparkles,
  Loader2,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Headphones,
  Sliders,
  FileAudio,
  RefreshCw,
  Radio,
  Square,
  BarChart3,
  Film,
  Subtitles,
  Smartphone,
  Monitor,
  BookmarkPlus,
} from 'lucide-react';
import {
  generateSpeechWithProgress,
  downloadWav,
  TtsProgress,
  TtsUsageSummary,
  fetchTtsUsage,
  saveEpisodeFullAudio,
  loadEpisodeFullAudio,
} from '../services/ttsService.ts';
import { VoiceControlsPanel } from './VoiceControlsPanel.tsx';
import { SaveProjectInput } from '../services/projectLibraryService.ts';
import { SavedStudioProject } from '../types.ts';
import {
  buildSubtitleCuesFromText,
  DEFAULT_OUTRO_CONFIG,
  DEFAULT_VIDEO_STYLE,
  DEFAULT_WATERMARK_CONFIG,
  downloadSrtFile,
  exportReelsVideoWithSubtitles,
  OutroCardConfig,
  VideoAspect,
  VideoQualityPreset,
  VideoStyleConfig,
  WatermarkConfig,
} from '../services/subtitleAndVideoService.ts';
import { BackgroundPhotoItem, SlideDurationMode } from '../data/backgroundPacks.ts';
import { BgmMixConfig, DEFAULT_BGM_CONFIG, previewSfxOnce } from '../services/bgmAndSfxService.ts';
import { extractTimedSfxCuesFromScript, SCRIPT_CUE_TAGS } from '../services/scriptCueParser.ts';
import { VideoStudioOptionsPanel } from './VideoStudioOptionsPanel.tsx';
import { VideoLivePreviewModal } from './VideoLivePreviewModal.tsx';
import { ReadyExportVideo, VideoExportReadyModal } from './VideoExportReadyModal.tsx';
import { AiScriptWriterPanel } from './AiScriptWriterPanel.tsx';

interface FullVoiceoverStudioProps {
  episode: Episode;
  projectTitle: string;
  onChangeProjectTitle: (title: string) => void;
  isAmbientPlaying: boolean;
  onToggleAmbient: () => void;
  onUpdateEpisode: (updates: Partial<Episode>) => void;
  onSaveProject?: (input: SaveProjectInput) => Promise<boolean>;
  loadedProject?: SavedStudioProject | null;
  ownerId?: string;
  onOpenLibrary?: () => void;
}

export const FullVoiceoverStudio: React.FC<FullVoiceoverStudioProps> = ({
  episode,
  projectTitle,
  onChangeProjectTitle,
  isAmbientPlaying,
  onToggleAmbient,
  onUpdateEpisode,
  onSaveProject,
  loadedProject,
  ownerId = 'local',
  onOpenLibrary,
}) => {
  // Combine all scenes into one continuous script
  const defaultFullScript = episode.scenes.map((s) => s.voiceoverText.trim()).join('\n\n');

  const [scriptText, setScriptText] = useState<string>(defaultFullScript);
  const [selectedVoice, setSelectedVoice] = useState<VoicePersona>('Fenrir');
  const [styleTone, setStyleTone] = useState<string>('গভীর, ভাবগম্ভীর ও সিনেম্যাটিক');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(80);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [genProgress, setGenProgress] = useState<TtsProgress | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isFreePreviewPlaying, setIsFreePreviewPlaying] = useState<boolean>(false);
  const [usageStats, setUsageStats] = useState<TtsUsageSummary | null>(null);
  const [voiceControls, setVoiceControls] = useState<VoiceControls>({ ...DEFAULT_VOICE_CONTROLS });
  const [videoAspect, setVideoAspect] = useState<VideoAspect>('9:16');
  const [showBrandTagOnVideo, setShowBrandTagOnVideo] = useState<boolean>(true);
  const [backgroundPhotos, setBackgroundPhotos] = useState<BackgroundPhotoItem[]>([]);
  const [slideDurationSec, setSlideDurationSec] = useState<SlideDurationMode>(0);
  const [backgroundVideoUrl, setBackgroundVideoUrl] = useState<string | null>(null);
  const [backgroundVideoName, setBackgroundVideoName] = useState<string | null>(null);
  const [readyExportVideo, setReadyExportVideo] = useState<ReadyExportVideo | null>(null);
  const [bgmConfig, setBgmConfig] = useState<BgmMixConfig>({ ...DEFAULT_BGM_CONFIG });
  const [styleConfig, setStyleConfig] = useState<VideoStyleConfig>({ ...DEFAULT_VIDEO_STYLE });
  const [watermark, setWatermark] = useState<WatermarkConfig>({ ...DEFAULT_WATERMARK_CONFIG });
  const [outro, setOutro] = useState<OutroCardConfig>({ ...DEFAULT_OUTRO_CONFIG });
  const [isLivePreviewOpen, setIsLivePreviewOpen] = useState<boolean>(false);
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const freePreviewActiveRef = useRef<boolean>(false);
  const scriptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!loadedProject) return;
    setScriptText(loadedProject.scriptText);
    setSelectedVoice(loadedProject.voiceName);
    setVoiceControls({
      pitch: loadedProject.voicePitch,
      speed: loadedProject.voiceSpeed,
      echo: loadedProject.voiceEcho,
      emotion: loadedProject.voiceEmotion,
    });
    setSuccessNotice(`লাইব্রেরি থেকে "${loadedProject.title}" লোড হয়েছে!`);
  }, [loadedProject]);

  const refreshUsage = async () => {
    const data = await fetchTtsUsage();
    if (data) setUsageStats(data);
  };

  useEffect(() => {
    refreshUsage();
  }, []);

  // Sync script text and auto-restore persisted audio from IndexedDB when active episode changes
  useEffect(() => {
    const combined = episode.scenes.map((s) => s.voiceoverText.trim()).join('\n\n');
    setScriptText(combined);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      freePreviewActiveRef.current = false;
      window.speechSynthesis.cancel();
      setIsFreePreviewPlaying(false);
    }

    if (!episode.fullAudioBlobUrl) {
      let cancelled = false;
      loadEpisodeFullAudio(episode.id).then((saved) => {
        if (cancelled || !saved) return;
        onUpdateEpisode({
          fullAudioBase64: saved.base64,
          fullAudioBlobUrl: saved.blobUrl,
        });
        setAudioDuration(Math.round(saved.duration || 80));
        setSuccessNotice('আগের তৈরি করা অডিও স্বয়ংক্রিয়ভাবে পুনরুদ্ধার হয়েছে (কোনো কোটা খরচ হয়নি)');
      });
      return () => {
        cancelled = true;
      };
    }
  }, [episode.id]);

  // Set up audio element
  useEffect(() => {
    const audio = new Audio();
    audioElementRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTimeSec(Math.round(audio.currentTime));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTimeSec(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Update audio source when episode has generated audio
  useEffect(() => {
    if (!audioElementRef.current) return;
    if (episode.fullAudioBlobUrl) {
      audioElementRef.current.src = episode.fullAudioBlobUrl;
      audioElementRef.current.playbackRate = playbackSpeed;
    }
  }, [episode.fullAudioBlobUrl]);

  // Update playback speed
  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Elapsed seconds counter while generating
  useEffect(() => {
    if (!episode.isGeneratingFullAudio) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [episode.isGeneratingFullAudio]);

  // Generate the entire 1m 20s voiceover with parallel chunk streaming & progress
  const handleGenerateFullVoiceover = async (forceRefresh = false) => {
    if (!scriptText.trim()) {
      setErrorMsg('দয়া করে ভয়েসওভার টেক্সট লিখুন বা নির্বাচন করুন।');
      return;
    }

    // Stop any currently playing audio cleanly before regenerating
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTimeSec(0);

    setErrorMsg(null);
    setSuccessNotice(null);
    setGenProgress({
      completed: 0,
      total: 1,
      percent: 5,
      message: forceRefresh ? 'নতুন করে সম্পূর্ণ ভয়েস তৈরি শুরু হচ্ছে...' : 'সার্ভারের সাথে সংযুক্ত হচ্ছে...',
    });
    onUpdateEpisode({ isGeneratingFullAudio: true });

    try {
      const res = await generateSpeechWithProgress({
        text: scriptText.trim(),
        voiceName: selectedVoice,
        style: `Solemn, deeply respectful, slow-paced cinematic Bengali narrator, ${styleTone}`,
        voiceControls,
        forceRefresh,
        onProgress: (p) => setGenProgress(p),
      });

      onUpdateEpisode({
        fullAudioBase64: res.base64,
        fullAudioBlobUrl: res.blobUrl,
        isGeneratingFullAudio: false,
      });
      setGenProgress(null);

      const finalDuration = Math.round(res.duration || 80);
      setAudioDuration(finalDuration);

      saveEpisodeFullAudio(episode.id, {
        base64: res.base64,
        duration: finalDuration,
        voiceName: selectedVoice,
      }).catch(() => {});

      if (audioElementRef.current) {
        audioElementRef.current.src = res.blobUrl;
        audioElementRef.current.load();
        audioElementRef.current.currentTime = 0;
      }

      if (res.usage) {
        setUsageStats(res.usage);
      } else {
        refreshUsage();
      }

      setSuccessNotice(
        `${forceRefresh ? 'পুনরায় নতুন ভয়েস তৈরি সম্পন্ন হয়েছে' : 'সম্পূর্ণ ভয়েস তৈরি সম্পন্ন হয়েছে'} (${finalDuration} সেকেন্ড · কণ্ঠ: ${selectedVoice}${res.modelUsed ? ` · ${res.modelUsed}` : ''})`
      );
    } catch (err: any) {
      console.error('Full TTS error:', err);
      onUpdateEpisode({ isGeneratingFullAudio: false });
      setGenProgress(null);
      refreshUsage();
      setErrorMsg(
        err?.message || 'সম্পূর্ণ ভয়েস তৈরিতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।'
      );
    }
  };

  // Play / Pause toggle
  const handleTogglePlay = () => {
    if (!audioElementRef.current) return;

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!episode.fullAudioBlobUrl) {
        handleGenerateFullVoiceover();
        return;
      }

      audioElementRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => {
          console.warn('Playback failed:', e);
          setIsPlaying(false);
        });
    }
  };

  // Seek
  const handleSeek = (newSec: number) => {
    if (!audioElementRef.current) return;
    const clamped = Math.max(0, Math.min(audioDuration, newSec));
    audioElementRef.current.currentTime = clamped;
    setCurrentTimeSec(clamped);
  };

  // Skip 10s
  const handleSkip = (delta: number) => {
    handleSeek(currentTimeSec + delta);
  };

  // Free unlimited zero-quota Bengali browser speech preview
  const handleToggleFreePreview = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setErrorMsg('আপনার ব্রাউজারে ফ্রি ব্রাউজার ভয়েস প্রিভিউ সমর্থিত নয়।');
      return;
    }

    if (isFreePreviewPlaying) {
      freePreviewActiveRef.current = false;
      window.speechSynthesis.cancel();
      setIsFreePreviewPlaying(false);
      return;
    }

    if (!scriptText.trim()) {
      setErrorMsg('প্রিভিউ শুনতে আগে স্ক্রিপ্ট লিখুন।');
      return;
    }

    // Pause studio WAV player if playing
    if (audioElementRef.current && isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }

    setErrorMsg(null);
    freePreviewActiveRef.current = false;
    window.speechSynthesis.cancel();

    const voices = window.speechSynthesis.getVoices();
    const preferredFemaleVoice =
      selectedVoice === 'BabyGirl' ||
      selectedVoice === 'Mishti' ||
      selectedVoice === 'Kore' ||
      selectedVoice === 'Zephyr'
        ? voices.find(
            (v) =>
              v.lang.toLowerCase().startsWith('bn') &&
              /female|tanishaa|nabanita|kalpana|heera|girl|woman/i.test(v.name)
          )
        : undefined;
    const bengaliVoice =
      preferredFemaleVoice ||
      voices.find((v) => v.lang.toLowerCase().startsWith('bn-bd')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('bn'));

    const sentences = (scriptText.trim().match(/[^।!?\.\n]+[।!?\.]*/g) || [scriptText.trim()])
      .map((s) => s.trim())
      .filter(Boolean);

    if (sentences.length === 0) return;

    freePreviewActiveRef.current = true;
    setIsFreePreviewPlaying(true);
    let idx = 0;

    const speakNext = () => {
      if (!freePreviewActiveRef.current || idx >= sentences.length) {
        freePreviewActiveRef.current = false;
        setIsFreePreviewPlaying(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(sentences[idx]);
      if (bengaliVoice) {
        utterance.voice = bengaliVoice;
        utterance.lang = bengaliVoice.lang;
      } else {
        utterance.lang = 'bn-BD';
      }
      utterance.rate =
        selectedVoice === 'Thanos' || selectedVoice === 'HorrorGhost'
          ? playbackSpeed * 0.80
          : selectedVoice === 'Grandfather'
          ? playbackSpeed * 0.86
          : selectedVoice === 'Commentator'
          ? playbackSpeed * 1.12
          : selectedVoice === 'Oggy'
          ? playbackSpeed * 0.98
          : selectedVoice === 'BabyGirl'
          ? playbackSpeed * 0.94
          : selectedVoice === 'Mishti'
          ? playbackSpeed * 0.96
          : playbackSpeed * 0.92;
      utterance.pitch =
        selectedVoice === 'Thanos'
          ? 0.50
          : selectedVoice === 'HorrorGhost'
          ? 0.65
          : selectedVoice === 'Grandfather'
          ? 0.78
          : selectedVoice === 'Oggy'
          ? 0.82
          : selectedVoice === 'BabyGirl'
          ? 1.55
          : selectedVoice === 'Mishti'
          ? 1.18
          : 0.92;
      utterance.onend = () => {
        if (!freePreviewActiveRef.current) return;
        idx += 1;
        speakNext();
      };
      utterance.onerror = () => {
        if (!freePreviewActiveRef.current) return;
        freePreviewActiveRef.current = false;
        setIsFreePreviewPlaying(false);
        if (!bengaliVoice) {
          setErrorMsg('আপনার ডিভাইস বা ব্রাউজারে বাংলা ভয়েস ইনস্টল করা নেই, তাই ফ্রি ব্রাউজার প্রিভিউ শোনা যাচ্ছে না।');
        }
      };
      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  };

  // Copy full script
  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Reset to default
  const handleResetScript = () => {
    const combined = episode.scenes.map((s) => s.voiceoverText.trim()).join('\n\n');
    setScriptText(combined);
  };

  const safeFileSlug = (raw: string) => {
    const cleaned = raw.trim().replace(/[^\w\u0980-\u09FF\u0900-\u097F-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
    return cleaned || `nasrullah_${selectedVoice.toLowerCase()}`;
  };

  const handleSaveToLibrary = async () => {
    if (!onSaveProject || !scriptText.trim()) return;
    setIsSavingCloud(true);
    setErrorMsg(null);
    try {
      const ok = await onSaveProject({
        projectType: 'voiceover',
        title: projectTitle.trim() || `ভয়েসওভার (${selectedVoice})`,
        voiceName: selectedVoice,
        scriptText: scriptText.trim(),
        voiceControls,
        language: 'bn',
        durationSec: audioDuration,
      });
      if (ok) {
        setSuccessNotice('প্রজেক্টটি সফলভাবে আপনার ক্লাউড লাইব্রেরিতে সেভ হয়েছে!');
      }
    } catch (err: any) {
      setErrorMsg('লাইব্রেরিতে সেভ করতে সমস্যা হয়েছে। গুগল লগইন চেক করে আবার চেষ্টা করুন।');
      console.error(err);
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleDownloadSrt = () => {
    const cues = buildSubtitleCuesFromText(scriptText, Math.max(2, audioDuration));
    if (cues.length === 0) return;
    downloadSrtFile(cues, `${safeFileSlug(projectTitle)}.srt`);
  };

  const handleExportReelsVideo = async (
    overrideQuality?: VideoQualityPreset,
    overrideAspect?: VideoAspect
  ) => {
    if (!episode.fullAudioBlobUrl) return;
    setErrorMsg(null);
    setIsExportingVideo(true);
    setExportProgress(2);
    const activeQuality: VideoQualityPreset = overrideQuality ?? styleConfig.qualityPreset ?? '1080p30';
    const activeAspect = overrideAspect ?? videoAspect;
    const activeStyle: VideoStyleConfig =
      overrideQuality ? { ...styleConfig, qualityPreset: overrideQuality } : styleConfig;
    if (overrideQuality) setStyleConfig(activeStyle);
    if (overrideAspect) setVideoAspect(overrideAspect);

    try {
      const cues = buildSubtitleCuesFromText(scriptText, Math.max(2, audioDuration));
      const timedSfxCues = extractTimedSfxCuesFromScript(scriptText, Math.max(2, audioDuration));
      const sceneImages = backgroundPhotos.map((p) => p.url);
      const blob = await exportReelsVideoWithSubtitles({
        audioBlobUrl: episode.fullAudioBlobUrl,
        cues,
        title: projectTitle.trim(),
        subtitleTag: showBrandTagOnVideo ? 'Nasrullah Studio' : '',
        aspect: activeAspect,
        imageUrls: sceneImages,
        backgroundVideoUrl,
        slideDurationSec,
        styleConfig: activeStyle,
        bgmConfig,
        watermark,
        outro,
        timedSfxCues,
        onProgress: (p) => setExportProgress(p),
      });
      setReadyExportVideo({
        blob,
        suggestedBaseName: `${safeFileSlug(projectTitle)}_${activeAspect === '9:16' ? 'reels' : 'video'}`,
        aspect: activeAspect,
        qualityPreset: activeQuality,
        durationSec: audioDuration,
        hasSubtitles: cues.length > 0,
      });
      setSuccessNotice(`ভিডিও তৈরি হয়েছে! এখন ডাউনলোড সেটিংস বেছে নিন বা লাইব্রেরিতে সেভ করুন।`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'ভিডিও এক্সপোর্ট করতে সমস্যা হয়েছে।');
    } finally {
      setIsExportingVideo(false);
      setExportProgress(0);
    }
  };

  const wordCount = scriptText.split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.round(wordCount * 0.58);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      
      {/* Hero Studio Banner */}
      <div className="bg-white dark:bg-gradient-to-b dark:from-[#111726] dark:to-[#0A0E17] border border-slate-200 dark:border-amber-900/30 rounded-2xl p-6 md:p-8 space-y-4 shadow-sm dark:shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs md:text-sm text-amber-600 dark:text-amber-400 font-semibold">
              <FileAudio className="w-4 h-4" />
              <span>এক ক্লিকে ফুল ভয়েসওভার স্টুডিও</span>
              <span aria-hidden="true">·</span>
              <span>১৩টি বিশেষ কণ্ঠ চরিত্র</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              একসাথে পুরো ১ মিনিট ২০ সেকেন্ডের অডিও তৈরি
            </h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
              আলাদা আলাদা দৃশ্য নয়, সম্পূর্ণ ভিডিওর ভয়েসওভার এক ক্লিকেই একটি মাত্র নির্বিঘ্ন হাই-কোয়ালিটি অডিও ফাইলে রূপান্তর ও ডাউনলোড করুন।
            </p>
          </div>

          {/* Quick Ambient BGM Toggle */}
          <button
            onClick={onToggleAmbient}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors self-start md:self-center shrink-0 cursor-pointer ${
              isAmbientPlaying
                ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/50'
                : 'bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isAmbientPlaying ? <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            <span>{isAmbientPlaying ? 'অ্যাম্বিয়েন্ট মিউজিক চালু' : 'অ্যাম্বিয়েন্ট মিউজিক যুক্ত করুন'}</span>
          </button>
        </div>

        {/* Audio Configuration Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-4 border-t border-slate-200 dark:border-slate-800/80 text-xs">
          
          {/* Voice Persona Dropdown */}
          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>ভয়েসওভার কণ্ঠ চরিত্র (Voice · {AVAILABLE_VOICES.length}টি):</span>
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => {
                const nextVoice = e.target.value as VoicePersona;
                setSelectedVoice(nextVoice);
                const matched = VOICE_STYLE_PRESETS.find((p) => p.voiceId === nextVoice);
                if (matched) setStyleTone(matched.value);
              }}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-amber-800 dark:text-amber-300 font-medium rounded-lg p-2 focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              {AVAILABLE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.banglaLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Narration Style — exact 1-to-1 match with all 13 voices */}
          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>কথন শৈলী ও আবহ (Style · {VOICE_STYLE_PRESETS.length}টি):</span>
            </label>
            <select
              value={styleTone}
              onChange={(e) => setStyleTone(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              {VOICE_STYLE_PRESETS.map((preset) => (
                <option key={preset.voiceId} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          {/* Timing & Word Meta */}
          <div className="space-y-1 bg-slate-50 dark:bg-slate-900/70 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>মোট শব্দ সংখ্যা:</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-200 font-bold">{wordCount} শব্দ</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>আনুমানিক ভয়েস দৈর্ঘ্য:</span>
              <span className="font-mono tabular-nums text-amber-600 dark:text-amber-400 font-bold">
                {formatTime(estimatedSeconds)}
              </span>
            </div>
          </div>

        </div>

        {/* Custom Voice Control Sliders (Pitch, Speed, Echo, Emotion) */}
        <VoiceControlsPanel value={voiceControls} onChange={setVoiceControls} compact />

      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl shadow-lg flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Big Master Audio Player Card (Active when generated) */}
      <div className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-amber-500/30 rounded-2xl p-6 md:p-8 space-y-5 shadow-sm dark:shadow-2xl relative">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                <span>{projectTitle.trim() || 'নতুন ভয়েস প্রজেক্ট'}</span>
                <span>·</span>
                <span>ভয়েস: {selectedVoice}</span>
              </div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {episode.fullAudioBlobUrl ? 'সম্পূর্ণ অডিও তৈরি সম্পন্ন' : 'ভয়েসওভার অডিও তৈরি করুন'}
              </h2>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Generate / Regenerate Full Audio Button */}
            <button
              type="button"
              onClick={() => handleGenerateFullVoiceover(Boolean(episode.fullAudioBlobUrl))}
              disabled={episode.isGeneratingFullAudio}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              {episode.isGeneratingFullAudio ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                  <span>পুরো অডিও তৈরি হচ্ছে (জেমিনাই TTS)...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-slate-950" />
                  <span>
                    {episode.fullAudioBlobUrl ? 'পুনরায় পুরো ভয়েস বানান' : 'এক ক্লিকে পুরো ১:২০ অডিও তৈরি করুন'}
                  </span>
                </>
              )}
            </button>

            {/* Download WAV + SRT buttons */}
            {episode.fullAudioBase64 && (
              <>
                <button
                  onClick={() =>
                    downloadWav(
                      episode.fullAudioBase64!,
                      `${safeFileSlug(projectTitle)}.wav`
                    )
                  }
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                  title="সম্পূর্ণ অডিও ফাইলটি WAV ফরম্যাটে ডাউনলোড করুন"
                >
                  <Download className="w-5 h-5" />
                  <span>অডিও (.WAV)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSrt}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm transition-colors cursor-pointer"
                  title="সাবটাইটেল (.SRT) ফাইল ডাউনলোড করুন"
                >
                  <Subtitles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>সাবটাইটেল (.SRT)</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Reels / Shorts Video Export Strip with Burned-in Subtitles & Custom Title */}
        {episode.fullAudioBlobUrl && (
          <div className="bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>অটো-সাবটাইটেলসহ Reels / Shorts ভিডিও তৈরি</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  ভিডিওর উপরে যে শিরোনাম দেখাতে চান তা নিচে লিখুন (খালি রাখলে উপরে কোনো শিরোনাম দেখাবে না)।
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setVideoAspect('9:16')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                      videoAspect === '9:16' ? 'bg-amber-400 text-slate-950' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>9:16 Reels</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoAspect('16:9')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                      videoAspect === '16:9' ? 'bg-amber-400 text-slate-950' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>16:9 Video</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleExportReelsVideo()}
                  disabled={isExportingVideo}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-60"
                >
                  {isExportingVideo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>রেন্ডার হচ্ছে ({exportProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4" />
                      <span>সাবটাইটেল ভিডিও তৈরি করুন</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center pt-2 border-t border-slate-200 dark:border-slate-800/70 text-xs">
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => onChangeProjectTitle(e.target.value)}
                maxLength={120}
                placeholder="ভিডিওর উপরের শিরোনাম লিখুন (যেমন: রাতের ভৌতিক গল্প)..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
              />
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={showBrandTagOnVideo}
                  onChange={(e) => setShowBrandTagOnVideo(e.target.checked)}
                  className="w-3.5 h-3.5 accent-amber-500 dark:accent-amber-400 rounded cursor-pointer"
                />
                <span>উপরে &ldquo;Nasrullah Studio&rdquo; দেখান</span>
              </label>
            </div>

            <VideoStudioOptionsPanel
              projectTitle={projectTitle}
              scriptText={scriptText}
              voiceName={selectedVoice}
              onOpenLivePreview={() => setIsLivePreviewOpen(true)}
              inlineSfxCueCount={extractTimedSfxCuesFromScript(scriptText, Math.max(2, audioDuration)).length}
              photos={backgroundPhotos}
              onChangePhotos={setBackgroundPhotos}
              slideDurationSec={slideDurationSec}
              onChangeSlideDurationSec={setSlideDurationSec}
              backgroundVideoUrl={backgroundVideoUrl}
              backgroundVideoName={backgroundVideoName}
              onChangeBackgroundVideo={(url, name) => {
                setBackgroundVideoUrl(url);
                setBackgroundVideoName(name);
              }}
              bgmConfig={bgmConfig}
              onChangeBgmConfig={setBgmConfig}
              styleConfig={styleConfig}
              onChangeStyleConfig={setStyleConfig}
              watermark={watermark}
              onChangeWatermark={setWatermark}
              outro={outro}
              onChangeOutro={setOutro}
            />

            <VideoLivePreviewModal
              isOpen={isLivePreviewOpen}
              onClose={() => setIsLivePreviewOpen(false)}
              audioBlobUrl={episode.fullAudioBlobUrl}
              cues={buildSubtitleCuesFromText(scriptText, Math.max(2, audioDuration))}
              title={projectTitle.trim()}
              subtitleTag={showBrandTagOnVideo ? 'Nasrullah Studio' : ''}
              aspect={videoAspect}
              imageUrls={backgroundPhotos.map((p) => p.url)}
              backgroundVideoUrl={backgroundVideoUrl}
              slideDurationSec={slideDurationSec}
              styleConfig={styleConfig}
              bgmConfig={bgmConfig}
              watermark={watermark}
              outro={outro}
              timedSfxCues={extractTimedSfxCuesFromScript(scriptText, Math.max(2, audioDuration))}
              onExportNow={() => handleExportReelsVideo()}
            />
          </div>
        )}

        {/* Live Progress Indicator while generating */}
        {episode.isGeneratingFullAudio && (
          <div className="bg-[#070B14] border border-amber-500/30 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>{genProgress?.message || 'ভয়েসওভার প্রস্তুত হচ্ছে...'}</span>
              </div>
              <div className="flex items-center gap-3 font-mono tabular-nums text-slate-300">
                <span className="text-slate-400">{elapsedSec}s</span>
                <span className="text-amber-400 font-bold">{genProgress?.percent ?? 10}%</span>
              </div>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 transition-all duration-300 ease-out"
                style={{ width: `${genProgress?.percent ?? 10}%` }}
              />
            </div>
          </div>
        )}

        {/* Success confirmation notice after fresh generation */}
        {!episode.isGeneratingFullAudio && successNotice && (
          <div className="bg-emerald-950/50 border border-emerald-700/50 rounded-xl px-4 py-2.5 text-xs text-emerald-200 flex items-center justify-between">
            <span>{successNotice}</span>
            <button
              type="button"
              onClick={() => setSuccessNotice(null)}
              className="text-emerald-400 hover:text-white font-bold ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {/* Real-time Waveform Visualizer & Playhead */}
        <div className="bg-slate-50 dark:bg-[#060911] border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-5 space-y-4">
          
          {/* Animated Waveform bars */}
          <div className="h-16 flex items-center justify-between gap-1 px-2 overflow-hidden">
            {Array.from({ length: 48 }).map((_, i) => {
              const played = (currentTimeSec / audioDuration) * 48 > i;
              const barHeight = isPlaying
                ? Math.max(15, Math.sin(i * 0.4 + currentTimeSec * 2) * 24 + 32)
                : Math.max(10, Math.sin(i * 0.3) * 18 + 24);

              return (
                <div
                  key={i}
                  className={`w-full rounded-full transition-all duration-150 cursor-pointer ${
                    played
                      ? 'bg-amber-500 dark:bg-amber-400 shadow-sm shadow-amber-400/30'
                      : 'bg-slate-300 dark:bg-slate-800 hover:bg-slate-400 dark:hover:bg-slate-700'
                  }`}
                  style={{ height: `${barHeight}px` }}
                  onClick={() => handleSeek((i / 48) * audioDuration)}
                />
              );
            })}
          </div>

          {/* Interactive Timeline Progress Slider */}
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={audioDuration}
              value={currentTimeSec}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              disabled={!episode.fullAudioBlobUrl}
              className="w-full h-2 accent-amber-500 dark:accent-amber-400 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span className="text-amber-600 dark:text-amber-400 font-bold">{formatTime(currentTimeSec)}</span>
              <span>মোট দৈর্ঘ্য: {formatTime(audioDuration)}</span>
            </div>
          </div>

          {/* Player Control Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            
            <div className="flex items-center gap-3">
              {/* Skip -10s */}
              <button
                onClick={() => handleSkip(-10)}
                disabled={!episode.fullAudioBlobUrl}
                className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
                title="১০ সেকেন্ড পেছনে যান"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Master Play/Pause */}
              <button
                onClick={handleTogglePlay}
                disabled={episode.isGeneratingFullAudio}
                className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-md shadow-amber-400/20 transition-all hover:scale-[1.02] cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-5 h-5 fill-slate-950" />
                    <span>থামান (Pause)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-slate-950" />
                    <span>{episode.fullAudioBlobUrl ? 'প্লে করুন' : 'ভয়েস বানিয়ে প্লে করুন'}</span>
                  </>
                )}
              </button>

              {/* Skip +10s */}
              <button
                onClick={() => handleSkip(10)}
                disabled={!episode.fullAudioBlobUrl}
                className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
                title="১০ সেকেন্ড সামনে যান"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Zero-Quota Unlimited Free Preview */}
              <button
                type="button"
                onClick={handleToggleFreePreview}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  isFreePreviewPlaying
                    ? 'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
                title="কোনো কোটা খরচ না করেই স্ক্রিপ্টের ফ্রি প্রিভিউ শুনুন"
              >
                {isFreePreviewPlaying ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-emerald-600 dark:fill-emerald-300" />
                    <span>প্রিভিউ থামান</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>ফ্রি প্রিভিউ (০ কোটা)</span>
                  </>
                )}
              </button>
            </div>

            {/* Playback Speed Switcher */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">গতি:</span>
              {[0.85, 1.0, 1.15].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-1 rounded-md font-mono tabular-nums transition-colors cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

          </div>

        </div>

      </div>

      {/* 1-Click AI Viral Story & Script Writer */}
      <AiScriptWriterPanel
        mode="monologue"
        onGeneratedMonologue={({ title, script }) => {
          onChangeProjectTitle(title);
          setScriptText(script);
          setSuccessNotice(`AI আপনার জন্য "${title}" স্ক্রিপ্ট লিখে দিয়েছে! এখন ভয়েস তৈরি করুন।`);
        }}
      />

      {/* Script Text Editor & Live Highlighter Card */}
      <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-4 shadow-sm dark:shadow-xl">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>সম্পূর্ণ ১:২০ ভয়েসওভার স্ক্রিপ্ট (সম্পাদনাযোগ্য)</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              আপনি প্রয়োজনমতো যেকোনো শব্দ পরিবর্তন করে আবার নতুন করে অডিও তৈরি করতে পারেন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSaveProject && (
              <button
                type="button"
                onClick={handleSaveToLibrary}
                disabled={isSavingCloud || !scriptText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-500/15 border border-amber-500/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                <span>{isSavingCloud ? 'সেভ হচ্ছে...' : 'লাইব্রেরিতে সেভ'}</span>
              </button>
            )}
            <button
              onClick={handleResetScript}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors cursor-pointer"
              title="মূল স্ক্রিপ্টে ফিরিয়ে নিন"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>রিসেট</span>
            </button>

            <button
              onClick={handleCopyScript}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'কপি হয়েছে' : 'টেক্সট কপি'}</span>
            </button>
          </div>
        </div>

        {/* 1-Click Inline SFX & Pause Cue Insert Bar */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-slate-950/75 border border-slate-200 dark:border-slate-800/90 rounded-xl px-3 py-2 text-[11px]">
          <span className="text-amber-700 dark:text-amber-300 font-bold mr-1">সাউন্ড / বিরতি ট্যাগ যোগ:</span>
          {SCRIPT_CUE_TAGS.map((cueDef) => (
            <button
              key={cueDef.tag}
              type="button"
              onClick={() => {
                if (cueDef.sfxId) previewSfxOnce(cueDef.sfxId);
                const el = scriptTextareaRef.current;
                const pos = el ? el.selectionStart ?? scriptText.length : scriptText.length;
                const before = scriptText.slice(0, pos);
                const after = scriptText.slice(pos);
                const spacerBefore = before && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : '';
                const spacerAfter = after && !after.startsWith(' ') && !after.startsWith('\n') ? ' ' : '';
                const inserted = `${before}${spacerBefore}${cueDef.tag}${spacerAfter}${after}`;
                setScriptText(inserted);
                setTimeout(() => {
                  if (el) {
                    const nextPos = pos + spacerBefore.length + cueDef.tag.length + spacerAfter.length;
                    el.focus();
                    el.setSelectionRange(nextPos, nextPos);
                  }
                }, 0);
              }}
              className={`px-2 py-1 rounded-lg border font-semibold cursor-pointer transition-colors ${
                cueDef.type === 'pause'
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200 hover:bg-cyan-500/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-amber-500 dark:hover:border-amber-400/60 hover:text-amber-800 dark:hover:text-amber-200'
              }`}
              title={`কার্সারের জায়গায় ${cueDef.tag} বসান (ভিডিওতে ঠিক এই মুহূর্তে বাজবে)`}
            >
              + {cueDef.label}
            </button>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          ref={scriptTextareaRef}
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          rows={10}
          className="w-full bg-slate-50 dark:bg-[#050811] border border-slate-300 dark:border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 rounded-xl p-4 md:p-5 text-slate-900 dark:text-slate-100 font-script text-base md:text-lg leading-loose resize-y transition-colors"
          placeholder="এখানে সম্পূর্ণ ১ মিনিট ২০ সেকেন্ডের বাংলা ভয়েসওভার লিখুন..."
        />

        {/* 5-Scene Breakdown Reference Bar */}
        <div className="pt-2">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">টাইমলাইন রেফারেন্স:</div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
            {episode.scenes.map((sc) => (
              <div
                key={sc.id}
                className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-lg space-y-1"
              >
                <div className="font-mono tabular-nums text-amber-600 dark:text-amber-400 font-semibold">
                  {sc.timestampLabel}
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-medium truncate">{sc.title}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Daily Usage & Model Quota Card */}
      {usageStats && (
        <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm dark:shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">আজকের ভয়েসওভার ব্যবহার (Usage)</h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  তারিখ: {usageStats.date} · আজ তৈরি: <span className="text-amber-700 dark:text-amber-300 font-semibold">{usageStats.totalVoiceovers} টি</span> · মোট অডিও: <span className="text-slate-800 dark:text-slate-200 font-mono">{formatTime(usageStats.totalAudioSeconds)}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={refreshUsage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors self-start sm:self-center cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>হালনাগাদ</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {usageStats.models.map((m) => {
              const isFreeUnlimited = m.id === 'free-neural-bn';
              const limitText = m.exhaustedToday
                ? `সার্ভার কোটা পূর্ণ (এই সেশনে: ${m.requestsToday})`
                : isFreeUnlimited
                  ? `আনলিমিটেড ফ্রি · ব্যবহৃত: ${m.requestsToday} বার`
                  : m.freeDailyLimit !== null
                    ? `এই সেশনে: ${m.requestsToday} / ${m.freeDailyLimit} বার`
                    : `এই সেশনে: ${m.requestsToday} বার`;
              return (
                <div
                  key={m.id}
                  className="bg-slate-50 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-900 dark:text-slate-200 font-semibold truncate">{m.label}</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                        m.exhaustedToday
                          ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60'
                          : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60'
                      }`}
                    >
                      {m.exhaustedToday ? 'কোটা পূর্ণ' : isFreeUnlimited ? 'আনলিমিটেড ফ্রি' : 'সক্রিয়'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                    <span className={m.exhaustedToday ? 'text-rose-600 dark:text-rose-300' : 'text-slate-800 dark:text-slate-200'}>{limitText}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {usageStats.models
            .filter((m) => m.id.startsWith('gemini-'))
            .every((m) => m.exhaustedToday) && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/40 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-200/90 leading-relaxed">
              জেমিনাই ফ্রি টিয়ারের আজকের কোটা পূর্ণ হওয়ায় এখন থেকে স্বয়ংক্রিয়ভাবে <strong>Bangla Neural TTS (Free)</strong> মডেল দিয়ে আনলিমিটেড বাংলা ভয়েসওভার ও `.WAV` ফাইল তৈরি হচ্ছে!
            </div>
          )}
        </div>
      )}

      <VideoExportReadyModal
        readyVideo={readyExportVideo}
        ownerId={ownerId}
        onClose={() => setReadyExportVideo(null)}
        onOpenLibrary={onOpenLibrary}
        onDownloadSrt={handleDownloadSrt}
        onReRenderWithQuality={(nextQ, nextAsp) => handleExportReelsVideo(nextQ, nextAsp)}
        isReRendering={isExportingVideo}
        reRenderProgress={exportProgress}
      />

    </div>
  );
};
