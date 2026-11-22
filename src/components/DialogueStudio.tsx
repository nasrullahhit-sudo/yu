import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Sparkles,
  Play,
  Pause,
  Download,
  Plus,
  Trash2,
  Loader2,
  Film,
  Subtitles,
  ArrowUpDown,
  Smartphone,
  Monitor,
  BookmarkPlus,
} from 'lucide-react';
import {
  DialogueLine,
  DialogueTimelineItem,
  SavedStudioProject,
  VoiceEmotion,
  VoicePersona,
} from '../types.ts';
import { SaveProjectInput } from '../services/projectLibraryService.ts';
import { AVAILABLE_VOICES, DIALOGUE_TEMPLATES } from '../data/episodes.ts';
import {
  downloadWav,
  generateDialogueWithProgress,
  TtsProgress,
} from '../services/ttsService.ts';
import {
  buildSubtitleCuesFromDialogue,
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
import { BgmMixConfig, DEFAULT_BGM_CONFIG } from '../services/bgmAndSfxService.ts';
import { extractTimedSfxCuesFromScript } from '../services/scriptCueParser.ts';
import { VideoStudioOptionsPanel } from './VideoStudioOptionsPanel.tsx';
import { VideoLivePreviewModal } from './VideoLivePreviewModal.tsx';
import { ReadyExportVideo, VideoExportReadyModal } from './VideoExportReadyModal.tsx';
import { AiScriptWriterPanel } from './AiScriptWriterPanel.tsx';

const EMOTION_LABELS: Array<{ id: VoiceEmotion; label: string }> = [
  { id: 'auto', label: 'স্বাভাবিক' },
  { id: 'happy', label: 'হাসিখুশি' },
  { id: 'angry', label: 'রাগান্বিত' },
  { id: 'scary', label: 'ভয়ংকর' },
  { id: 'sad', label: 'দুঃখী' },
  { id: 'whisper', label: 'ফিসফিসানি' },
  { id: 'excited', label: 'উত্তেজিত' },
];

interface DialogueStudioProps {
  projectTitle: string;
  onChangeProjectTitle: (title: string) => void;
  onSaveProject?: (input: SaveProjectInput) => Promise<boolean>;
  loadedProject?: SavedStudioProject | null;
  ownerId?: string;
  onOpenLibrary?: () => void;
}

export const DialogueStudio: React.FC<DialogueStudioProps> = ({
  projectTitle,
  onChangeProjectTitle,
  onSaveProject,
  loadedProject,
  ownerId = 'local',
  onOpenLibrary,
}) => {
  const initialTpl = DIALOGUE_TEMPLATES[0];

  const [speaker1Name, setSpeaker1Name] = useState<string>(initialTpl.speaker1Name);
  const [speaker1Voice, setSpeaker1Voice] = useState<VoicePersona>(initialTpl.speaker1Voice);
  const [speaker2Name, setSpeaker2Name] = useState<string>(initialTpl.speaker2Name);
  const [speaker2Voice, setSpeaker2Voice] = useState<VoicePersona>(initialTpl.speaker2Voice);
  const [pauseMs, setPauseMs] = useState<number>(280);

  const [lines, setLines] = useState<DialogueLine[]>(() =>
    initialTpl.lines.map((l, idx) => ({
      id: `dl-${idx + 1}`,
      speaker: l.speaker,
      text: l.text,
      emotion: l.emotion,
    }))
  );

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<TtsProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [timeline, setTimeline] = useState<DialogueTimelineItem[]>([]);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const [videoAspect, setVideoAspect] = useState<VideoAspect>('9:16');
  const [showBrandTagOnVideo, setShowBrandTagOnVideo] = useState<boolean>(true);
  const [backgroundPhotos, setBackgroundPhotos] = useState<BackgroundPhotoItem[]>([]);
  const [slideDurationSec, setSlideDurationSec] = useState<SlideDurationMode>(0);
  const [backgroundVideoUrl, setBackgroundVideoUrl] = useState<string | null>(null);
  const [backgroundVideoName, setBackgroundVideoName] = useState<string | null>(null);
  const [bgmConfig, setBgmConfig] = useState<BgmMixConfig>({ ...DEFAULT_BGM_CONFIG });
  const [styleConfig, setStyleConfig] = useState<VideoStyleConfig>({ ...DEFAULT_VIDEO_STYLE });
  const [watermark, setWatermark] = useState<WatermarkConfig>({ ...DEFAULT_WATERMARK_CONFIG });
  const [outro, setOutro] = useState<OutroCardConfig>({ ...DEFAULT_OUTRO_CONFIG });
  const [isLivePreviewOpen, setIsLivePreviewOpen] = useState<boolean>(false);
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [readyExportVideo, setReadyExportVideo] = useState<ReadyExportVideo | null>(null);
  const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!loadedProject) return;
    onChangeProjectTitle(loadedProject.title);
    setSpeaker1Name(loadedProject.speaker1Name || 'চরিত্র ১');
    setSpeaker1Voice(loadedProject.voiceName);
    setSpeaker2Name(loadedProject.speaker2Name || 'চরিত্র ২');
    if (loadedProject.secondaryVoiceName) {
      setSpeaker2Voice(loadedProject.secondaryVoiceName as VoicePersona);
    }
    if (loadedProject.dialogueLines && loadedProject.dialogueLines.length > 0) {
      setLines(loadedProject.dialogueLines);
    }
    setSuccessNotice(`লাইব্রেরি থেকে "${loadedProject.title}" লোড হয়েছে!`);
  }, [loadedProject]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onMeta = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDurationSec(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onMeta);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onMeta);
    };
  }, []);

  const applyTemplate = (tplId: string) => {
    const tpl = DIALOGUE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    onChangeProjectTitle(tpl.title);
    setSpeaker1Name(tpl.speaker1Name);
    setSpeaker1Voice(tpl.speaker1Voice);
    setSpeaker2Name(tpl.speaker2Name);
    setSpeaker2Voice(tpl.speaker2Voice);
    setLines(
      tpl.lines.map((l, idx) => ({
        id: `dl-${Date.now()}-${idx}`,
        speaker: l.speaker,
        text: l.text,
        emotion: l.emotion,
      }))
    );
    setAudioBase64(null);
    setAudioBlobUrl(null);
    setTimeline([]);
    setSuccessNotice(null);
    setErrorMsg(null);
  };

  const handleAddLine = (speaker: 1 | 2) => {
    setLines((prev) => [
      ...prev,
      {
        id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        speaker,
        text: '',
        emotion: 'auto',
      },
    ]);
  };

  const handleUpdateLine = (id: string, patch: Partial<DialogueLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleDeleteLine = (id: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  };

  const handleSwapSpeakers = () => {
    setSpeaker1Name(speaker2Name);
    setSpeaker2Name(speaker1Name);
    setSpeaker1Voice(speaker2Voice);
    setSpeaker2Voice(speaker1Voice);
  };

  const handleSaveToLibrary = async () => {
    if (!onSaveProject) return;
    const nonEmpty = lines.filter((l) => l.text.trim().length > 0);
    if (nonEmpty.length === 0) return;
    setIsSavingCloud(true);
    setErrorMsg(null);
    try {
      const formattedScript = nonEmpty
        .map((l) => `${l.speaker === 1 ? speaker1Name : speaker2Name}: ${l.text.trim()}`)
        .join('\n');
      const ok = await onSaveProject({
        projectType: 'dialogue',
        title: projectTitle.trim() || `${speaker1Name} ও ${speaker2Name}`,
        voiceName: speaker1Voice,
        secondaryVoiceName: speaker2Voice,
        speaker1Name: speaker1Name.trim() || 'চরিত্র ১',
        speaker2Name: speaker2Name.trim() || 'চরিত্র ২',
        scriptText: formattedScript,
        dialogueLines: nonEmpty,
        language: 'bn',
        durationSec: Math.round(durationSec || 0),
      });
      if (ok) {
        setSuccessNotice('সংলাপ প্রজেক্টটি আপনার ক্লাউড লাইব্রেরিতে সেভ হয়েছে!');
      }
    } catch (err) {
      setErrorMsg('সংলাপ লাইব্রেরিতে সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      console.error(err);
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleGenerateDialogue = async () => {
    const nonEmpty = lines.filter((l) => l.text.trim().length > 0);
    if (nonEmpty.length === 0) {
      setErrorMsg('অনুগ্রহ করে অন্তত একটি সংলাপের লাইন লিখুন।');
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setErrorMsg(null);
    setSuccessNotice(null);
    setIsGenerating(true);
    setProgress({ completed: 0, total: nonEmpty.length, percent: 5, message: 'সংলাপ স্টুডিও প্রস্তুত হচ্ছে...' });

    try {
      const res = await generateDialogueWithProgress({
        speaker1: { name: speaker1Name.trim() || 'চরিত্র ১', voiceName: speaker1Voice },
        speaker2: { name: speaker2Name.trim() || 'চরিত্র ২', voiceName: speaker2Voice },
        lines: nonEmpty,
        pauseMs,
        onProgress: (p) => setProgress(p),
      });

      setAudioBase64(res.base64);
      setAudioBlobUrl(res.blobUrl);
      setDurationSec(res.duration);
      setTimeline(res.timeline);
      setModelUsed(res.modelUsed || null);

      if (audioRef.current) {
        audioRef.current.src = res.blobUrl;
        audioRef.current.load();
      }

      setSuccessNotice(
        `২ চরিত্রের সম্পূর্ণ সংলাপ তৈরি হয়েছে (${Math.round(res.duration)} সেকেন্ড · ${res.timeline.length} লাইন${res.modelUsed ? ` · ${res.modelUsed}` : ''})`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'সংলাপ তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleTogglePlay = () => {
    if (!audioRef.current || !audioBlobUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (sec: number) => {
    if (!audioRef.current || !audioBlobUrl) return;
    audioRef.current.currentTime = Math.max(0, Math.min(durationSec, sec));
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleDownloadSrt = () => {
    if (timeline.length === 0) return;
    const cues = buildSubtitleCuesFromDialogue(timeline);
    downloadSrtFile(cues, `dialogue_${Date.now()}.srt`);
  };

  const handleExportVideo = async (
    overrideQuality?: VideoQualityPreset,
    overrideAspect?: VideoAspect
  ) => {
    if (!audioBlobUrl || timeline.length === 0) return;
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
      const cues = buildSubtitleCuesFromDialogue(timeline);
      const combinedDialogueText = lines.map((l) => l.text).join(' ');
      const timedSfxCues = extractTimedSfxCuesFromScript(combinedDialogueText, Math.max(2, durationSec));
      const blob = await exportReelsVideoWithSubtitles({
        audioBlobUrl,
        cues,
        title: projectTitle.trim(),
        subtitleTag: showBrandTagOnVideo ? 'Nasrullah Studio' : '',
        aspect: activeAspect,
        imageUrls: backgroundPhotos.map((p) => p.url),
        backgroundVideoUrl,
        slideDurationSec,
        styleConfig: activeStyle,
        bgmConfig,
        watermark,
        outro,
        timedSfxCues,
        onProgress: (p) => setExportProgress(p),
      });
      const safeTitle = (projectTitle.trim() || `${speaker1Name}_${speaker2Name}`)
        .replace(/[^\w\u0980-\u09FF\u0900-\u097F-]+/g, '_')
        .slice(0, 44);
      setReadyExportVideo({
        blob,
        suggestedBaseName: `${safeTitle || 'dialogue'}_${activeAspect === '9:16' ? 'reels' : 'video'}`,
        aspect: activeAspect,
        qualityPreset: activeQuality,
        durationSec,
        hasSubtitles: cues.length > 0,
      });
      setSuccessNotice('সংলাপ ভিডিও তৈরি হয়েছে! এখন ডাউনলোড সেটিংস বেছে নিন বা লাইব্রেরিতে সেভ করুন।');
    } catch (err: any) {
      setErrorMsg(err?.message || 'ভিডিও এক্সপোর্ট করতে সমস্যা হয়েছে।');
    } finally {
      setIsExportingVideo(false);
      setExportProgress(0);
    }
  };

  const activeTimelineItem = timeline.find(
    (item) => currentTime >= item.startSec && currentTime <= item.endSec + 0.15
  );

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-gradient-to-b dark:from-[#111726] dark:to-[#0A0E17] border border-slate-200 dark:border-amber-900/30 rounded-2xl p-6 md:p-8 space-y-5 shadow-lg dark:shadow-2xl transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs md:text-sm text-amber-600 dark:text-amber-400 font-medium">
              <Users className="w-4 h-4" />
              <span>২ চরিত্রের সংলাপ / কার্টুন ও পডকাস্ট স্টুডিও</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              মাল্টি-ক্যারেক্টার ডায়ালগ মেকার
            </h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
              দুটি আলাদা ভয়েস মডেল (যেমন Pari বনাম Thanos বা Oggy ও Mishti) বেছে নিন—এক ক্লিকেই পুরো নাটক বা পডকাস্ট অডিও ও সাবটাইটেল ভিডিও বানান।
            </p>
          </div>
        </div>

        {/* Custom Video/Project Title Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">ভিডিওর উপরের শিরোনাম (খালি রাখলে কোনো শিরোনাম দেখাবে না):</label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => onChangeProjectTitle(e.target.value)}
            maxLength={120}
            placeholder="যেমন: পরী বনাম থ্যানোস — মজার সংলাপ..."
            className="w-full bg-slate-50 dark:bg-slate-950/90 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
          />
        </div>

        {/* 1-Click AI 2-Character Dialogue Writer */}
        <AiScriptWriterPanel
          mode="dialogue"
          speaker1Name={speaker1Name}
          speaker2Name={speaker2Name}
          onGeneratedDialogue={({ title, lines: aiLines }) => {
            onChangeProjectTitle(title);
            if (aiLines.length > 0) setLines(aiLines);
            setAudioBase64(null);
            setAudioBlobUrl(null);
            setTimeline([]);
            setSuccessNotice(`AI আপনার জন্য "${title}" সংলাপ লিখে দিয়েছে (${aiLines.length} লাইন)!`);
          }}
        />

        {/* Ready-Made Templates */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">রেডিমেড মজার টেমপ্লেট (১-ক্লিকে লোড করুন):</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {DIALOGUE_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl.id)}
                className="text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 hover:bg-amber-50/70 dark:hover:bg-slate-800/90 border border-slate-200 dark:border-slate-800 hover:border-amber-500/60 transition-all cursor-pointer"
              >
                <div className="text-xs font-bold text-amber-700 dark:text-amber-300">{tpl.title}</div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{tpl.subtitle}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Character 1 & Character 2 Setup */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center pt-2">
          {/* Speaker 1 */}
          <div className="bg-amber-50/50 dark:bg-slate-900/80 border border-amber-300/70 dark:border-amber-500/30 rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-800 dark:text-amber-300">চরিত্র ১ (Speaker 1)</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px]">বাম পাশ</span>
            </div>
            <input
              type="text"
              value={speaker1Name}
              onChange={(e) => setSpeaker1Name(e.target.value)}
              placeholder="চরিত্র ১-এর নাম..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-amber-500 focus:outline-none"
            />
            <select
              value={speaker1Voice}
              onChange={(e) => setSpeaker1Voice(e.target.value as VoicePersona)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-amber-800 dark:text-amber-200 font-medium cursor-pointer"
            >
              {AVAILABLE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.banglaLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Swap button */}
          <button
            type="button"
            onClick={handleSwapSpeakers}
            title="চরিত্র অদল-বদল করুন"
            className="mx-auto p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-300 hover:border-amber-500/50 transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          {/* Speaker 2 */}
          <div className="bg-cyan-50/50 dark:bg-slate-900/80 border border-cyan-300/70 dark:border-cyan-500/30 rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-800 dark:text-cyan-300">চরিত্র ২ (Speaker 2)</span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 text-[10px]">ডান পাশ</span>
            </div>
            <input
              type="text"
              value={speaker2Name}
              onChange={(e) => setSpeaker2Name(e.target.value)}
              placeholder="চরিত্র ২-এর নাম..."
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
            />
            <select
              value={speaker2Voice}
              onChange={(e) => setSpeaker2Voice(e.target.value as VoicePersona)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-cyan-800 dark:text-cyan-200 font-medium cursor-pointer"
            >
              {AVAILABLE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.banglaLabel}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error & Success Notices */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs rounded-xl flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-white ml-2 cursor-pointer">
            ✕
          </button>
        </div>
      )}
      {successNotice && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center justify-between">
          <span>{successNotice}</span>
          <button onClick={() => setSuccessNotice(null)} className="font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white ml-2 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Dialogue Script Editor */}
      <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg dark:shadow-xl transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">সংলাপের লাইনগুলো সাজান ({lines.length} লাইন)</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">প্রতিটি লাইনে কে কথা বলবে এবং কী আবেগে বলবে তা বেছে নিন।</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {onSaveProject && (
              <button
                type="button"
                onClick={handleSaveToLibrary}
                disabled={isSavingCloud}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-800 dark:text-amber-300 font-semibold cursor-pointer disabled:opacity-50"
              >
                {isSavingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                <span>{isSavingCloud ? 'সেভ হচ্ছে...' : 'লাইব্রেরিতে সেভ'}</span>
              </button>
            )}
            <span className="text-slate-600 dark:text-slate-400">মাঝের বিরতি:</span>
            <select
              value={pauseMs}
              onChange={(e) => setPauseMs(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value={150}>দ্রুত (0.15s)</option>
              <option value={280}>স্বাভাবিক (0.28s)</option>
              <option value={500}>নাটকীয় (0.50s)</option>
              <option value={800}>ধীর (0.80s)</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => {
            const isSpk1 = line.speaker === 1;
            const isCurrentlySpeaking = activeTimelineItem?.id === line.id;
            return (
              <div
                key={line.id}
                className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                  isCurrentlySpeaking
                    ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-500 dark:border-amber-400 shadow-md shadow-amber-500/10'
                    : isSpk1
                    ? 'bg-amber-50/40 dark:bg-slate-900/70 border-amber-200 dark:border-amber-500/25'
                    : 'bg-cyan-50/40 dark:bg-slate-900/70 border-cyan-200 dark:border-cyan-500/25'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-500">#{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateLine(line.id, { speaker: isSpk1 ? 2 : 1 })}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                        isSpk1
                          ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/60 dark:border-amber-500/40'
                          : 'bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-400/60 dark:border-cyan-500/40'
                      }`}
                      title="চরিত্র পরিবর্তন করতে ক্লিক করুন"
                    >
                      {isSpk1 ? `${speaker1Name} (${speaker1Voice})` : `${speaker2Name} (${speaker2Voice})`}
                    </button>

                    <select
                      value={line.emotion}
                      onChange={(e) => handleUpdateLine(line.id, { emotion: e.target.value as VoiceEmotion })}
                      className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {EMOTION_LABELS.map((em) => (
                        <option key={em.id} value={em.id}>
                          আবেগ: {em.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteLine(line.id)}
                    disabled={lines.length <= 1}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-30 cursor-pointer"
                    title="লাইন মুছুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={line.text}
                  onChange={(e) => handleUpdateLine(line.id, { text: e.target.value })}
                  placeholder={`${isSpk1 ? speaker1Name : speaker2Name}-এর সংলাপ লিখুন...`}
                  className="w-full bg-white dark:bg-[#050811] border border-slate-200 dark:border-slate-800 focus:border-amber-500 rounded-lg p-3 text-sm text-slate-900 dark:text-slate-100 leading-relaxed resize-y focus:outline-none"
                />
              </div>
            );
          })}
        </div>

        {/* Add Line + Generate Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddLine(1)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{speaker1Name}-এর লাইন যোগ</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddLine(2)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-800 dark:text-cyan-300 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{speaker2Name}-এর লাইন যোগ</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleGenerateDialogue}
            disabled={isGenerating}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-60"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                <span>সংলাপ তৈরি হচ্ছে ({progress?.percent ?? 10}%)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-slate-950" />
                <span>পুরো সংলাপ অডিও তৈরি করুন</span>
              </>
            )}
          </button>
        </div>

        {isGenerating && progress && (
          <div className="bg-amber-50 dark:bg-[#070B14] border border-amber-300 dark:border-amber-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-800 dark:text-amber-300 font-medium">{progress.message}</span>
              <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">{progress.percent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300"
                style={{ width: `${Math.max(5, progress.percent)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Synced Dialogue Audio Player + Reels Video & SRT Export */}
      {audioBlobUrl && audioBase64 && (
        <div className="bg-white dark:bg-[#0D121F] border border-amber-400/50 dark:border-amber-500/35 rounded-2xl p-6 space-y-5 shadow-xl dark:shadow-2xl transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                {speaker1Name} ও {speaker2Name} · মোট {formatTime(durationSec)}
                {modelUsed ? ` · ${modelUsed}` : ''}
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">সংলাপ অডিও প্রস্তুত!</h3>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => downloadWav(audioBase64, `dialogue_${Date.now()}.wav`)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>অডিও (.WAV)</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSrt}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs cursor-pointer"
              >
                <Subtitles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>সাবটাইটেল (.SRT)</span>
              </button>
            </div>
          </div>

          {/* Player Controls */}
          <div className="bg-slate-50 dark:bg-[#060911] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shrink-0 cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950" />}
                <span>{isPlaying ? 'থামান' : 'সংলাপ শুনুন'}</span>
              </button>
              <div className="flex-1 space-y-1">
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, durationSec)}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-2 accent-amber-500 dark:accent-amber-400 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span className="text-amber-600 dark:text-amber-400">{formatTime(currentTime)}</span>
                  <span>{formatTime(durationSec)}</span>
                </div>
              </div>
            </div>

            {activeTimelineItem && (
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900/90 border border-amber-400/50 dark:border-amber-500/30 text-sm">
                <span className="text-amber-700 dark:text-amber-400 font-bold mr-2">{activeTimelineItem.speakerName}:</span>
                <span className="text-slate-900 dark:text-white">{activeTimelineItem.text}</span>
              </div>
            )}
          </div>

          {/* Reels / Shorts Video Export Bar */}
          <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>অটো-সাবটাইটেলসহ Reels / Shorts ভিডিও এক্সপোর্ট</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  দুই চরিত্রের নাম, ব্যাকগ্রাউন্ড স্লাইডশো ছবি, লাইভ ওয়েভফর্ম ও বাংলা সাবটাইটেলসহ সরাসরি ভিডিও তৈরি করুন।
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
                  onClick={() => handleExportVideo()}
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

            <div className="flex items-center justify-end pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-600 dark:text-slate-300">
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
              scriptText={lines.map((l) => l.text).join('\n')}
              voiceName={`${speaker1Voice} + ${speaker2Voice}`}
              onOpenLivePreview={() => setIsLivePreviewOpen(true)}
              inlineSfxCueCount={extractTimedSfxCuesFromScript(lines.map((l) => l.text).join(' '), Math.max(2, durationSec)).length}
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
              audioBlobUrl={audioBlobUrl}
              cues={buildSubtitleCuesFromDialogue(timeline)}
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
              timedSfxCues={extractTimedSfxCuesFromScript(lines.map((l) => l.text).join(' '), Math.max(2, durationSec))}
              onExportNow={() => handleExportVideo()}
            />
          </div>
        </div>
      )}

      <VideoExportReadyModal
        readyVideo={readyExportVideo}
        ownerId={ownerId}
        onClose={() => setReadyExportVideo(null)}
        onOpenLibrary={onOpenLibrary}
        onDownloadSrt={handleDownloadSrt}
        onReRenderWithQuality={(nextQ, nextAsp) => handleExportVideo(nextQ, nextAsp)}
        isReRendering={isExportingVideo}
        reRenderProgress={exportProgress}
      />
    </div>
  );
};
