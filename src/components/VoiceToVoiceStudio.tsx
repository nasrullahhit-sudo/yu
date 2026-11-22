import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_VOICE_CONTROLS, VoiceControls, VoicePersona } from '../types.ts';
import { AVAILABLE_VOICES } from '../data/episodes.ts';
import {
  Upload,
  Video,
  Mic,
  Square,
  Sparkles,
  Loader2,
  Play,
  Pause,
  Download,
  RefreshCw,
  Volume2,
  VolumeX,
  Headphones,
  Globe,
  FileAudio,
  Film,
  Check,
  Copy,
  Trash2,
  Subtitles,
  BookmarkPlus,
} from 'lucide-react';
import {
  extractAudioForTranscription,
  transcribeMediaForVoiceToVoice,
  translateTranscriptForVoiceToVoice,
  exportVideoWithNewVoice,
  DubbingTargetLanguage,
} from '../services/voiceToVoiceService.ts';
import {
  generateSpeechWithProgress,
  downloadWav,
  TtsProgress,
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
  exportDubbedVideoWithSubtitles,
  exportReelsVideoWithSubtitles,
  OutroCardConfig,
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

interface VoiceToVoiceStudioProps {
  projectTitle: string;
  onChangeProjectTitle: (title: string) => void;
  onSaveProject?: (input: SaveProjectInput) => Promise<boolean>;
  loadedProject?: SavedStudioProject | null;
  ownerId?: string;
  onOpenLibrary?: () => void;
}

export const VoiceToVoiceStudio: React.FC<VoiceToVoiceStudioProps> = ({
  projectTitle,
  onChangeProjectTitle,
  onSaveProject,
  loadedProject,
  ownerId = 'local',
  onOpenLibrary,
}) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isVideoFile, setIsVideoFile] = useState<boolean>(false);
  const [mediaDurationSec, setMediaDurationSec] = useState<number>(0);

  const [selectedVoice, setSelectedVoice] = useState<VoicePersona>('Fenrir');
  const [targetLanguage, setTargetLanguage] = useState<DubbingTargetLanguage>('bn');
  const [matchOriginalDuration, setMatchOriginalDuration] = useState<boolean>(true);
  const [burnSubtitlesOnExport, setBurnSubtitlesOnExport] = useState<boolean>(true);
  const [voiceControls, setVoiceControls] = useState<VoiceControls>({ ...DEFAULT_VOICE_CONTROLS });
  const [detectedScriptLang, setDetectedScriptLang] = useState<'bn' | 'hi' | 'en' | null>(null);

  const [transcript, setTranscript] = useState<string>('');
  const [transcribeModelUsed, setTranscribeModelUsed] = useState<string | null>(null);
  const [ttsModelUsed, setTtsModelUsed] = useState<string | null>(null);

  const [generatedBase64, setGeneratedBase64] = useState<string | null>(null);
  const [generatedBlobUrl, setGeneratedBlobUrl] = useState<string | null>(null);
  const [generatedDurationSec, setGeneratedDurationSec] = useState<number>(0);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const [previewMode, setPreviewMode] = useState<'ai' | 'original'>('ai');
  const [originalMixVolume, setOriginalMixVolume] = useState<number>(0);
  const [isSyncedPlaying, setIsSyncedPlaying] = useState<boolean>(false);

  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [readyExportVideo, setReadyExportVideo] = useState<ReadyExportVideo | null>(null);
  const [backgroundPhotos, setBackgroundPhotos] = useState<BackgroundPhotoItem[]>([]);
  const [slideDurationSec, setSlideDurationSec] = useState<SlideDurationMode>(0);
  const [backgroundVideoUrl, setBackgroundVideoUrl] = useState<string | null>(null);
  const [backgroundVideoName, setBackgroundVideoName] = useState<string | null>(null);
  const [bgmConfig, setBgmConfig] = useState<BgmMixConfig>({ ...DEFAULT_BGM_CONFIG });
  const [styleConfig, setStyleConfig] = useState<VideoStyleConfig>({ ...DEFAULT_VIDEO_STYLE });
  const [watermark, setWatermark] = useState<WatermarkConfig>({ ...DEFAULT_WATERMARK_CONFIG });
  const [outro, setOutro] = useState<OutroCardConfig>({ ...DEFAULT_OUTRO_CONFIG });
  const [isLivePreviewOpen, setIsLivePreviewOpen] = useState<boolean>(false);
  const [showBrandTagOnVideo, setShowBrandTagOnVideo] = useState<boolean>(true);

  const [isRecordingMic, setIsRecordingMic] = useState<boolean>(false);
  const [recordingSec, setRecordingSec] = useState<number>(0);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);
  const [isSavingCloud, setIsSavingCloud] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loadedProject) return;
    setTranscript(loadedProject.scriptText);
    setSelectedVoice(loadedProject.voiceName);
    setTargetLanguage(loadedProject.language);
    setVoiceControls({
      pitch: loadedProject.voicePitch,
      speed: loadedProject.voiceSpeed,
      echo: loadedProject.voiceEcho,
      emotion: loadedProject.voiceEmotion,
    });
    setSuccessNotice(`লাইব্রেরি থেকে "${loadedProject.title}" লোড হয়েছে!`);
  }, [loadedProject]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const aiAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micChunksRef = useRef<BlobPart[]>([]);
  const micTimerRef = useRef<number | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      if (micTimerRef.current) window.clearInterval(micTimerRef.current);
    };
  }, [mediaUrl]);

  // Keep video muted/volume synced with preview mode
  useEffect(() => {
    if (!videoRef.current) return;
    if (previewMode === 'ai' && generatedBlobUrl) {
      videoRef.current.muted = originalMixVolume <= 0.01;
      videoRef.current.volume = originalMixVolume;
    } else {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
    }
  }, [previewMode, originalMixVolume, generatedBlobUrl]);

  const loadFile = (file: File) => {
    const isVid =
      file.type.startsWith('video/') ||
      /\.(mp4|webm|mov|mkv|m4v|avi|3gp|flv|mpeg|mpg|ts|ogv)$/i.test(file.name);
    const isAud =
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|ogg|aac|flac|opus|wma|webm)$/i.test(file.name);

    if (!isVid && !isAud) {
      setErrorMsg('দয়া করে একটি সঠিক ভিডিও (MP4, WebM, MOV) বা অডিও (MP3, WAV, M4A) ফাইল আপলোড করুন।');
      return;
    }

    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    const nextUrl = URL.createObjectURL(file);

    setUploadedFile(file);
    setMediaUrl(nextUrl);
    setIsVideoFile(isVid);
    setMediaDurationSec(0);
    setTranscript('');
    setGeneratedBase64(null);
    setGeneratedBlobUrl(null);
    setGeneratedDurationSec(0);
    setTranscribeModelUsed(null);
    setTtsModelUsed(null);
    setPreviewMode('ai');
    setIsSyncedPlaying(false);
    setErrorMsg(null);
    setSuccessNotice(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const handleClearMedia = () => {
    stopSyncedPlayback();
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setUploadedFile(null);
    setMediaUrl(null);
    setIsVideoFile(false);
    setTranscript('');
    setGeneratedBase64(null);
    setGeneratedBlobUrl(null);
    setErrorMsg(null);
    setSuccessNotice(null);
  };

  // Microphone recording for direct Voice-to-Voice conversion
  const handleToggleMicRecord = async () => {
    if (isRecordingMic) {
      mediaRecorderRef.current?.stop();
      setIsRecordingMic(false);
      if (micTimerRef.current) {
        window.clearInterval(micTimerRef.current);
        micTimerRef.current = null;
      }
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('আপনার ব্রাউজারে মাইক্রোফোন রেকর্ডিং সমর্থিত নয়।');
      return;
    }

    try {
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      micChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) micChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(micChunksRef.current, { type: mimeType || 'audio/webm' });
        const recordedFile = new File([blob], `mic-voice-${Date.now()}.webm`, {
          type: blob.type || 'audio/webm',
        });
        loadFile(recordedFile);
        setSuccessNotice('আপনার কণ্ঠ রেকর্ড হয়েছে! এখন "১-ক্লিকে ভয়েস পরিবর্তন করুন" বাটনে ক্লিক করুন।');
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingMic(true);
      setRecordingSec(0);
      micTimerRef.current = window.setInterval(() => {
        setRecordingSec((prev) => prev + 1);
      }, 1000);
    } catch {
      setErrorMsg('মাইক্রোফোন ব্যবহারের অনুমতি পাওয়া যায়নি। ব্রাউজার সেটিংস থেকে মাইক্রোফোন চালু করুন।');
    }
  };

  const synthesizeFromScript = async (
    textToSpeak: string,
    voice: VoicePersona,
    forceRefresh = true,
    exactTargetSec?: number
  ) => {
    const syncSec =
      matchOriginalDuration && exactTargetSec && exactTargetSec >= 2 ? exactTargetSec : undefined;

    const ttsRes = await generateSpeechWithProgress({
      text: textToSpeak.trim(),
      voiceName: voice,
      voiceControls,
      forceRefresh,
      targetDurationSec: syncSec,
      onProgress: (p: TtsProgress) => {
        const mapped = 48 + Math.round((p.percent / 100) * 50);
        setProgressPercent(Math.min(99, mapped));
        setProcessingStage(p.message || 'নতুন মডেলের ভয়েস তৈরি হচ্ছে...');
      },
    });

    setGeneratedBase64(ttsRes.base64);
    setGeneratedBlobUrl(ttsRes.blobUrl);
    setGeneratedDurationSec(Math.round(ttsRes.duration || 0));
    setTtsModelUsed(ttsRes.modelUsed || null);
    setPreviewMode('ai');

    return ttsRes;
  };

  // Full 1-click Voice-to-Voice pipeline: Video/Audio -> Extract Audio -> Transcribe/Adapt -> Synthesize with Selected Voice
  const handleRunFullVoiceToVoice = async () => {
    if (!uploadedFile) {
      setErrorMsg('প্রথমে একটি ভিডিও বা অডিও ফাইল আপলোড করুন (অথবা মাইকে রেকর্ড করুন)।');
      return;
    }

    stopSyncedPlayback();
    setErrorMsg(null);
    setSuccessNotice(null);
    setIsProcessing(true);
    setProgressPercent(8);
    setProcessingStage('ভিডিও/অডিও থেকে সাউন্ড ট্র্যাক আলাদা করা হচ্ছে...');

    try {
      const extracted = await extractAudioForTranscription(uploadedFile);
      const exactDur = extracted.durationSec > 0 ? extracted.durationSec : mediaDurationSec;
      if (exactDur > 0) {
        setMediaDurationSec(Math.round(exactDur));
      }

      setProgressPercent(26);
      setProcessingStage(
        targetLanguage === 'hi'
          ? 'কথা শনাক্ত করে হিন্দিতে ডাবিং স্ক্রিপ্ট তৈরি হচ্ছে...'
          : targetLanguage === 'en'
          ? 'কথা শনাক্ত করে ইংরেজিতে ডাবিং স্ক্রিপ্ট তৈরি হচ্ছে...'
          : targetLanguage === 'bn'
          ? 'ভিডিওর কথা শুনে বাংলা ডাবিং স্ক্রিপ্ট তৈরি হচ্ছে...'
          : 'ভিডিও/অডিওর কথা শনাক্ত করা হচ্ছে...'
      );

      const transRes = await transcribeMediaForVoiceToVoice({
        mediaBase64: extracted.base64,
        mimeType: extracted.mimeType,
        targetLanguage,
      });

      setTranscript(transRes.transcript);
      setDetectedScriptLang(transRes.detectedLanguage);
      setTranscribeModelUsed(transRes.modelUsed);

      setProgressPercent(48);
      setProcessingStage(`${selectedVoice} মডেলের কণ্ঠে নতুন ভয়েস তৈরি হচ্ছে...`);

      const ttsRes = await synthesizeFromScript(
        transRes.transcript,
        selectedVoice,
        true,
        exactDur > 0 ? exactDur : undefined
      );
      setProgressPercent(100);

      const langName =
        transRes.detectedLanguage === 'hi'
          ? 'হিন্দি'
          : transRes.detectedLanguage === 'en'
          ? 'ইংরেজি'
          : 'বাংলা';

      setSuccessNotice(
        `ভয়েস-টু-ভয়েস সম্পন্ন হয়েছে! ভাষা: ${langName} · কণ্ঠ: ${selectedVoice} · দৈর্ঘ্য: ${Math.round(ttsRes.duration || 0)} সেকেন্ড${ttsRes.modelUsed ? ` · ${ttsRes.modelUsed}` : ''}`
      );
    } catch (err: any) {
      console.error('Voice-to-Voice error:', err);
      setErrorMsg(err?.message || 'ভয়েস-টু-ভয়েস তৈরিতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setIsProcessing(false);
    }
  };

  // Regenerate voice when user changes voice model, dubbing language, or edits transcript
  const handleRegenerateVoiceOnly = async () => {
    if (!transcript.trim()) {
      setErrorMsg('আগে ভিডিও আপলোড করে কথা শনাক্ত করুন অথবা নিচের বক্সে কথা লিখুন।');
      return;
    }

    stopSyncedPlayback();
    setErrorMsg(null);
    setSuccessNotice(null);
    setIsProcessing(true);
    setProgressPercent(22);

    try {
      let textForTts = transcript.trim();
      let activeLang = detectedScriptLang;

      // If user changed targetLanguage (e.g. Bengali -> Hindi), translate script first!
      if (targetLanguage !== 'original' && targetLanguage !== detectedScriptLang) {
        setProcessingStage(
          targetLanguage === 'hi'
            ? 'স্ক্রিপ্ট হিন্দি ভাষায় অনুবাদ করা হচ্ছে...'
            : targetLanguage === 'en'
            ? 'স্ক্রিপ্ট ইংরেজি ভাষায় অনুবাদ করা হচ্ছে...'
            : 'স্ক্রিপ্ট বাংলা ভাষায় অনুবাদ করা হচ্ছে...'
        );
        const trRes = await translateTranscriptForVoiceToVoice({
          text: textForTts,
          targetLanguage,
        });
        textForTts = trRes.transcript;
        activeLang = trRes.detectedLanguage;
        setTranscript(trRes.transcript);
        setDetectedScriptLang(trRes.detectedLanguage);
      }

      setProgressPercent(48);
      setProcessingStage(`${selectedVoice} কণ্ঠে নতুন ভয়েস তৈরি হচ্ছে...`);

      const ttsRes = await synthesizeFromScript(
        textForTts,
        selectedVoice,
        true,
        mediaDurationSec > 0 ? mediaDurationSec : undefined
      );
      setProgressPercent(100);
      const langName =
        activeLang === 'hi' ? 'হিন্দি' : activeLang === 'en' ? 'ইংরেজি' : 'বাংলা';
      setSuccessNotice(
        `নতুন কণ্ঠে (${selectedVoice} · ${langName}) ভয়েস আপডেট হয়েছে (${Math.round(ttsRes.duration || 0)} সেকেন্ড${ttsRes.modelUsed ? ` · ${ttsRes.modelUsed}` : ''})`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'ভয়েস তৈরিতে সমস্যা হয়েছে।');
    } finally {
      setIsProcessing(false);
    }
  };

  // Synced Video + New AI Voice playback controls
  const stopSyncedPlayback = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (aiAudioRef.current) {
      aiAudioRef.current.pause();
    }
    setIsSyncedPlaying(false);
  };

  const handleToggleSyncedPlay = async () => {
    if (isSyncedPlaying) {
      stopSyncedPlayback();
      return;
    }

    try {
      if (isVideoFile && videoRef.current) {
        if (videoRef.current.ended) {
          videoRef.current.currentTime = 0;
        }
        if (previewMode === 'ai' && generatedBlobUrl && aiAudioRef.current) {
          videoRef.current.muted = originalMixVolume <= 0.01;
          videoRef.current.volume = originalMixVolume;
          aiAudioRef.current.currentTime = Math.min(
            videoRef.current.currentTime,
            Math.max(0, (aiAudioRef.current.duration || 0) - 0.1)
          );
          await Promise.all([videoRef.current.play(), aiAudioRef.current.play()]);
        } else {
          videoRef.current.muted = false;
          videoRef.current.volume = 1;
          await videoRef.current.play();
        }
        setIsSyncedPlaying(true);
      } else if (aiAudioRef.current && generatedBlobUrl) {
        if (aiAudioRef.current.ended) aiAudioRef.current.currentTime = 0;
        await aiAudioRef.current.play();
        setIsSyncedPlaying(true);
      }
    } catch (e) {
      console.warn('Synced playback error:', e);
      setIsSyncedPlaying(false);
    }
  };

  const handleVideoSeeked = () => {
    if (!videoRef.current || !aiAudioRef.current || previewMode !== 'ai' || !generatedBlobUrl) return;
    if (aiAudioRef.current.duration && !isNaN(aiAudioRef.current.duration)) {
      aiAudioRef.current.currentTime = Math.min(videoRef.current.currentTime, aiAudioRef.current.duration);
    }
  };

  const handleVideoEnded = () => {
    if (aiAudioRef.current) aiAudioRef.current.pause();
    setIsSyncedPlaying(false);
  };

  const handleDownloadSrt = () => {
    if (!transcript.trim()) return;
    const dur = Math.max(2, generatedDurationSec || mediaDurationSec || 10);
    const cues = buildSubtitleCuesFromText(transcript, dur);
    const baseName = (uploadedFile?.name || 'dubbed-subtitles').replace(/\.[^.]+$/, '');
    downloadSrtFile(cues, `${baseName}-${selectedVoice}.srt`);
  };

  const handleDownloadVideoWithNewVoice = async (overrideQuality?: VideoQualityPreset) => {
    if (!generatedBlobUrl) return;

    stopSyncedPlayback();
    setIsExportingVideo(true);
    setExportProgress(2);
    setErrorMsg(null);
    const activeQuality: VideoQualityPreset = overrideQuality ?? styleConfig.qualityPreset ?? '1080p30';
    const activeStyle: VideoStyleConfig =
      overrideQuality ? { ...styleConfig, qualityPreset: overrideQuality } : styleConfig;
    if (overrideQuality) setStyleConfig(activeStyle);

    try {
      const dur = Math.max(2, generatedDurationSec || mediaDurationSec || 10);
      const cues = buildSubtitleCuesFromText(transcript, dur);
      const baseName = (uploadedFile?.name || 'dubbed-video').replace(/\.[^.]+$/, '');

      let webmBlob: Blob;
      if (isVideoFile && mediaUrl) {
        const hasOverlayOrBgm =
          (burnSubtitlesOnExport && cues.length > 0) ||
          Boolean(watermark.text.trim() || watermark.logoUrl) ||
          bgmConfig.mood !== 'none' ||
          activeStyle.particleEffect !== 'none' ||
          activeStyle.showRetentionBar ||
          activeStyle.hookBannerEnabled ||
          activeStyle.qualityPreset !== '720p30' ||
          outro.enabled;
        if (hasOverlayOrBgm) {
          webmBlob = await exportDubbedVideoWithSubtitles(
            mediaUrl,
            generatedBlobUrl,
            cues,
            burnSubtitlesOnExport,
            (p) => setExportProgress(p),
            activeStyle,
            watermark,
            bgmConfig,
            outro
          );
        } else {
          webmBlob = await exportVideoWithNewVoice({
            videoUrl: mediaUrl,
            audioBlobUrl: generatedBlobUrl,
            originalAudioVolume: originalMixVolume,
            onProgress: (p) => setExportProgress(p),
          });
        }
      } else {
        const timedSfxCues = extractTimedSfxCuesFromScript(transcript, dur);
        webmBlob = await exportReelsVideoWithSubtitles({
          audioBlobUrl: generatedBlobUrl,
          cues,
          title: projectTitle.trim(),
          subtitleTag: showBrandTagOnVideo ? 'Nasrullah Studio' : '',
          aspect: '9:16',
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
      }

      setReadyExportVideo({
        blob: webmBlob,
        suggestedBaseName: `${baseName}-${selectedVoice}${burnSubtitlesOnExport ? '-subtitled' : ''}`,
        aspect: isVideoFile ? undefined : '9:16',
        qualityPreset: activeQuality,
        durationSec: dur,
        hasSubtitles: cues.length > 0,
      });
      setSuccessNotice('ভিডিও তৈরি সম্পন্ন হয়েছে! এখন ডাউনলোড সেটিংস বেছে নিন বা লাইব্রেরিতে সেভ করুন।');
    } catch (err: any) {
      console.error('Export video error:', err);
      setErrorMsg(err?.message || 'ভিডিও এক্সপোর্ট করতে সমস্যা হয়েছে। আপনি সরাসরি .WAV ভয়েস ডাউনলোড করতে পারেন।');
    } finally {
      setIsExportingVideo(false);
    }
  };

  const handleCopyTranscript = () => {
    if (!transcript.trim()) return;
    navigator.clipboard.writeText(transcript).then(() => {
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
    });
  };

  const handleSaveToLibrary = async () => {
    if (!onSaveProject || !transcript.trim()) return;
    setIsSavingCloud(true);
    setErrorMsg(null);
    try {
      const baseTitle =
        projectTitle.trim() ||
        (uploadedFile?.name
          ? uploadedFile.name.replace(/\.[^.]+$/, '')
          : `ডাবিং প্রজেক্ট (${selectedVoice})`);
      const ok = await onSaveProject({
        projectType: 'dubbing',
        title: baseTitle,
        voiceName: selectedVoice,
        scriptText: transcript.trim(),
        voiceControls,
        language: targetLanguage,
        durationSec: generatedDurationSec || mediaDurationSec || 0,
      });
      if (ok) {
        setSuccessNotice('ডাবিং প্রজেক্টটি আপনার ক্লাউড লাইব্রেরিতে সেভ হয়েছে!');
      }
    } catch (err) {
      setErrorMsg('লাইব্রেরিতে সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      console.error(err);
    } finally {
      setIsSavingCloud(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Hidden audio player used for synced AI voiceover playback */}
      <audio
        ref={aiAudioRef}
        src={generatedBlobUrl || undefined}
        onEnded={() => {
          if (!isVideoFile) setIsSyncedPlaying(false);
        }}
        className="hidden"
      />

      {/* Hero Header Card */}
      <div className="bg-white dark:bg-gradient-to-b dark:from-[#111726] dark:to-[#0A0E17] border border-slate-200 dark:border-amber-900/30 rounded-2xl p-6 md:p-8 space-y-5 shadow-lg dark:shadow-2xl relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs md:text-sm text-amber-600 dark:text-amber-400 font-medium">
              <Video className="w-4 h-4" />
              <span>ভয়েস-টু-ভয়েস (ভিডিও ডাবিং ও কণ্ঠ পরিবর্তন)</span>
              <span aria-hidden="true">·</span>
              <span>ভিডিও / অডিও / মাইক</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              যেকোনো ভিডিও আপলোড করে মডেল ভয়েস তৈরি করুন
            </h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
              ভিডিও বা অডিও আপলোড করলেই AI তার কথা শুনে আপনার পছন্দের কণ্ঠে (Fenrir, Pari, Thanos, Oggy ইত্যাদি) নতুন ভয়েসওভার ও ডাবিং ভিডিও তৈরি করে দেবে।
            </p>
          </div>

          {/* Direct Mic Record Button */}
          <button
            type="button"
            onClick={handleToggleMicRecord}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all self-start md:self-center shrink-0 cursor-pointer ${
              isRecordingMic
                ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/60 animate-pulse'
                : 'bg-amber-50 dark:bg-slate-900/80 text-amber-800 dark:text-amber-300 border-amber-400/50 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-950/30'
            }`}
          >
            {isRecordingMic ? (
              <>
                <Square className="w-4 h-4 fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400" />
                <span>রেকর্ডিং থামান ({formatTime(recordingSec)})</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>মাইক দিয়ে কণ্ঠ রেকর্ড করুন</span>
              </>
            )}
          </button>
        </div>

        {/* Upload Dropzone */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,.mp4,.webm,.mov,.mkv,.mp3,.wav,.m4a,.ogg"
          onChange={handleFileChange}
          className="hidden"
        />

        {!uploadedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 md:p-10 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10'
                : 'border-slate-300 dark:border-slate-700/90 bg-slate-50 dark:bg-slate-950/60 hover:border-amber-500/60 hover:bg-amber-50/40 dark:hover:bg-slate-900/60'
            }`}
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3">
              <Upload className="w-7 h-7" />
            </div>
            <p className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
              এখানে ভিডিও বা অডিও ফাইল ড্র্যাগ করুন অথবা ক্লিক করে বাছাই করুন
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              সমর্থিত ফরম্যাট: MP4, WebM, MOV, MP3, WAV, M4A (সর্বোচ্চ ৪ মিনিট পর্যন্ত অডিও স্বয়ংক্রিয়ভাবে আলাদা হবে)
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                {isVideoFile ? <Film className="w-5 h-5" /> : <FileAudio className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{uploadedFile.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                  {mediaDurationSec > 0 ? ` · দৈর্ঘ্য: ${formatTime(mediaDurationSec)}` : ''}
                  {' · '}
                  {isVideoFile ? 'ভিডিও ফাইল' : 'অডিও ফাইল'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-amber-500/50 cursor-pointer"
              >
                অন্য ফাইল দিন
              </button>
              <button
                type="button"
                onClick={handleClearMedia}
                title="ফাইল সরান"
                className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/50 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Voice & Language Configuration Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2 text-xs">
          {/* Target Voice Model Selector */}
          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
              <Headphones className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>কোন মডেলের কণ্ঠে রূপান্তর করবেন:</span>
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value as VoicePersona)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-amber-800 dark:text-amber-300 font-medium rounded-lg p-2.5 focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              {AVAILABLE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.banglaLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Output Language / Dubbing Mode */}
          <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>ডাবিং ও ভাষার ধরন:</span>
            </label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value as DubbingTargetLanguage)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg p-2.5 focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="bn">বাংলায় ডাবিং (যেকোনো ভাষার ভিডিও → বাংলা ভয়েস)</option>
              <option value="original">মূল ভাষা রাখুন (একই ভাষায় শুধু কণ্ঠ বদলান)</option>
              <option value="hi">হিন্দিতে ডাবিং (Hindi Dubbing · हिन्दी)</option>
              <option value="en">ইংরেজিতে ডাবিং (English Dubbing)</option>
            </select>
          </div>
        </div>

        {/* Exact Duration Auto-Sync + Burned-in Subtitles Checkboxes */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={matchOriginalDuration}
              onChange={(e) => setMatchOriginalDuration(e.target.checked)}
              className="w-4 h-4 accent-amber-500 dark:accent-amber-400 rounded cursor-pointer"
            />
            <span>
              মূল ভিডিও/অডিওর সমান দৈর্ঘ্য রাখুন (অটো টাইম-সিঙ্ক
              {mediaDurationSec > 0 ? ` · লক্ষ্য: ${mediaDurationSec} সেকেন্ড` : ''})
            </span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none w-fit">
            <input
              type="checkbox"
              checked={burnSubtitlesOnExport}
              onChange={(e) => setBurnSubtitlesOnExport(e.target.checked)}
              className="w-4 h-4 accent-amber-500 dark:accent-amber-400 rounded cursor-pointer"
            />
            <span>ভিডিও এক্সপোর্টে অটো-সাবটাইটেল বসিয়ে দিন (Burned-in Captions)</span>
          </label>
        </div>

        {/* Custom Voice Control Sliders */}
        <VoiceControlsPanel value={voiceControls} onChange={setVoiceControls} compact />

        {/* Primary Action CTA */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={handleRunFullVoiceToVoice}
            disabled={isProcessing || !uploadedFile}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                <span>প্রসেসিং চলছে ({progressPercent}%)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-slate-950" />
                <span>১-ক্লিকে ভয়েস পরিবর্তন করুন (Voice-to-Voice)</span>
              </>
            )}
          </button>

          {transcript.trim() && (
            <button
              type="button"
              onClick={handleRegenerateVoiceOnly}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-slate-900 border border-amber-300 dark:border-slate-700 hover:border-amber-500/50 text-amber-800 dark:text-amber-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              <span>অন্য কণ্ঠে শুধু ভয়েস বদলান ({selectedVoice})</span>
            </button>
          )}
        </div>

        {/* Live Progress Bar */}
        {isProcessing && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-700 dark:text-amber-300 font-medium">{processingStage}</span>
              <span className="font-mono text-amber-700 dark:text-amber-400 font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-300 dark:border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all duration-300"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error & Success Banners */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs rounded-xl shadow-sm dark:shadow-lg flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-white font-bold ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {successNotice && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl shadow-sm dark:shadow-lg flex items-center justify-between">
          <span>{successNotice}</span>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white font-bold ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Video Preview + Synced New AI Voice Studio Card */}
      {(mediaUrl || generatedBlobUrl) && (
        <div className="bg-white dark:bg-[#0D121F] border border-amber-400/50 dark:border-amber-500/30 rounded-2xl p-6 md:p-7 space-y-5 shadow-xl dark:shadow-2xl transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Headphones className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <span>{isVideoFile ? 'ভিডিও প্রিভিউ ও নতুন AI ভয়েস' : 'নতুন AI ভয়েস প্রিভিউ'}</span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {generatedBlobUrl
                  ? `তৈরি ভয়েস: ${selectedVoice} (${formatTime(generatedDurationSec)})${ttsModelUsed ? ` · ইঞ্জিন: ${ttsModelUsed}` : ''}`
                  : 'উপরে "১-ক্লিকে ভয়েস পরিবর্তন করুন" চাপলে নতুন কণ্ঠ এখানে যুক্ত হবে'}
              </p>
            </div>

            {/* A/B Switch: New AI Voice vs Original Sound */}
            {isVideoFile && generatedBlobUrl && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => {
                    stopSyncedPlayback();
                    setPreviewMode('ai');
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    previewMode === 'ai'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  নতুন AI ভয়েস ({selectedVoice})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopSyncedPlayback();
                    setPreviewMode('original');
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    previewMode === 'original'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  আসল সাউন্ড
                </button>
              </div>
            )}
          </div>

          {/* Video Player if Video File */}
          {isVideoFile && mediaUrl && (
            <div className="relative rounded-xl overflow-hidden bg-black border border-slate-300 dark:border-slate-800">
              <video
                ref={videoRef}
                src={mediaUrl}
                playsInline
                onClick={handleToggleSyncedPlay}
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  if (dur && !isNaN(dur)) setMediaDurationSec(Math.round(dur));
                }}
                onSeeked={handleVideoSeeked}
                onEnded={handleVideoEnded}
                className="w-full max-h-[420px] object-contain mx-auto cursor-pointer"
              />
            </div>
          )}

          {/* Direct Standalone Audio Player for the newly generated AI voice */}
          {generatedBlobUrl && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span>শুধু নতুন AI ভয়েস শুনুন ({selectedVoice})</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">{formatTime(generatedDurationSec)}</span>
              </div>
              <audio src={generatedBlobUrl} controls className="w-full h-9" />
            </div>
          )}

          {/* Synced Controls & Original Audio Mix Slider */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleToggleSyncedPlay}
                disabled={!isVideoFile && !generatedBlobUrl}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer disabled:opacity-40"
              >
                {isSyncedPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>
                  {isSyncedPlaying
                    ? 'থামান'
                    : isVideoFile && generatedBlobUrl && previewMode === 'ai'
                    ? 'নতুন AI ভয়েসসহ ভিডিও প্লে করুন'
                    : 'প্লে করুন'}
                </span>
              </button>

              {isVideoFile && generatedBlobUrl && previewMode === 'ai' && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300">
                  {originalMixVolume > 0.01 ? (
                    <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                  <span className="whitespace-nowrap">আসল ব্যাকগ্রাউন্ড: {Math.round(originalMixVolume * 100)}%</span>
                  <input
                    type="range"
                    min="0"
                    max="0.4"
                    step="0.05"
                    value={originalMixVolume}
                    onChange={(e) => setOriginalMixVolume(parseFloat(e.target.value))}
                    className="w-20 accent-amber-500 dark:accent-amber-400 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Download Buttons */}
            {generatedBase64 && generatedBlobUrl && (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const baseName = (uploadedFile?.name || 'voice-to-voice').replace(/\.[^.]+$/, '');
                    downloadWav(generatedBase64, `${baseName}-${selectedVoice}.wav`);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/20 hover:bg-emerald-500/25 dark:hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>অডিও (.WAV)</span>
                </button>

                {transcript.trim() && (
                  <button
                    type="button"
                    onClick={handleDownloadSrt}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Subtitles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>সাবটাইটেল (.SRT)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDownloadVideoWithNewVoice()}
                  disabled={isExportingVideo}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 hover:bg-amber-500/25 dark:hover:bg-amber-500/30 border border-amber-500/50 text-amber-800 dark:text-amber-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-60"
                >
                  {isExportingVideo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>ভিডিও তৈরি হচ্ছে ({exportProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4" />
                      <span>
                        {isVideoFile
                          ? burnSubtitlesOnExport
                            ? 'সাবটাইটেলসহ ডাবিং ভিডিও তৈরি করুন'
                            : 'নতুন ভয়েসসহ ভিডিও তৈরি করুন'
                          : 'Reels সাবটাইটেল ভিডিও তৈরি করুন'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Unified Pro Video Customizer (BGM/SFX, Viral Subtitles, Watermark, Thumbnail + BG for Audio-Only) */}
          {generatedBlobUrl && (
            <div className="pt-2 space-y-2 border-t border-slate-200 dark:border-slate-800/70">
              {!isVideoFile && (
                <div className="flex items-center justify-end">
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
              )}
              <VideoStudioOptionsPanel
                projectTitle={projectTitle}
                scriptText={transcript}
                voiceName={selectedVoice}
                hideBackgroundTab={isVideoFile}
                onOpenLivePreview={!isVideoFile ? () => setIsLivePreviewOpen(true) : undefined}
                inlineSfxCueCount={extractTimedSfxCuesFromScript(transcript, Math.max(2, generatedDurationSec || mediaDurationSec || 10)).length}
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

              {!isVideoFile && (
                <VideoLivePreviewModal
                  isOpen={isLivePreviewOpen}
                  onClose={() => setIsLivePreviewOpen(false)}
                  audioBlobUrl={generatedBlobUrl}
                  cues={buildSubtitleCuesFromText(transcript, Math.max(2, generatedDurationSec || mediaDurationSec || 10))}
                  title={projectTitle.trim()}
                  subtitleTag={showBrandTagOnVideo ? 'Nasrullah Studio' : ''}
                  aspect="9:16"
                  imageUrls={backgroundPhotos.map((p) => p.url)}
                  backgroundVideoUrl={backgroundVideoUrl}
                  slideDurationSec={slideDurationSec}
                  styleConfig={styleConfig}
                  bgmConfig={bgmConfig}
                  watermark={watermark}
                  outro={outro}
                  timedSfxCues={extractTimedSfxCuesFromScript(transcript, Math.max(2, generatedDurationSec || mediaDurationSec || 10))}
                  onExportNow={() => handleDownloadVideoWithNewVoice()}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Extracted & Editable Transcript Card */}
      <div className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3 shadow-lg dark:shadow-xl transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              ভিডিও/অডিও থেকে পাওয়া স্ক্রিপ্ট (প্রয়োজনে এডিট করে আবার ভয়েস বানাতে পারবেন)
            </h3>
            {transcribeModelUsed && (
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                শনাক্তকরণ মডেল: {transcribeModelUsed}
              </p>
            )}
          </div>

          {transcript.trim() && (
            <div className="flex items-center gap-2">
              {onSaveProject && (
                <button
                  type="button"
                  onClick={handleSaveToLibrary}
                  disabled={isSavingCloud}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-200 cursor-pointer disabled:opacity-50"
                >
                  {isSavingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                  <span>{isSavingCloud ? 'সেভ হচ্ছে...' : 'লাইব্রেরিতে সেভ'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyTranscript}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white cursor-pointer"
              >
                {copiedTranscript ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTranscript ? 'কপি হয়েছে' : 'স্ক্রিপ্ট কপি'}</span>
              </button>
            </div>
          )}
        </div>

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={5}
          placeholder="ভিডিও আপলোড করে '১-ক্লিকে ভয়েস পরিবর্তন করুন' বাটনে চাপলে ভিডিওর কথা এখানে চলে আসবে। চাইলে আপনি কোনো শব্দ সংশোধন করে 'অন্য কণ্ঠে শুধু ভয়েস বদলান' বাটনে ক্লিক করতে পারেন..."
          className="w-full bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-sm text-slate-900 dark:text-slate-100 leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y"
        />
      </div>
      <VideoExportReadyModal
        readyVideo={readyExportVideo}
        ownerId={ownerId}
        onClose={() => setReadyExportVideo(null)}
        onOpenLibrary={onOpenLibrary}
        onDownloadSrt={handleDownloadSrt}
        onReRenderWithQuality={(nextQ) => handleDownloadVideoWithNewVoice(nextQ)}
        isReRendering={isExportingVideo}
        reRenderProgress={exportProgress}
      />
    </div>
  );
};
