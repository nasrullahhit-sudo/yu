import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, RotateCcw, FastForward, Eye, Film } from 'lucide-react';
import { SubtitleCue } from '../types.ts';
import {
  ActiveBgmHandle,
  BgmMixConfig,
  startBgmInContext,
  triggerSfxAt,
} from '../services/bgmAndSfxService.ts';
import {
  createParticleSeeds,
  loadOptionalImages,
  loadOptionalSingleImage,
  OutroCardConfig,
  renderVideoFrame,
  VideoAspect,
  VideoStyleConfig,
  WatermarkConfig,
} from '../services/subtitleAndVideoService.ts';
import { TimedSfxCue } from '../services/scriptCueParser.ts';

interface VideoLivePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBlobUrl: string;
  cues: SubtitleCue[];
  title: string;
  subtitleTag: string;
  aspect: VideoAspect;
  imageUrls: string[];
  backgroundVideoUrl: string | null;
  slideDurationSec: number;
  styleConfig: VideoStyleConfig;
  bgmConfig: BgmMixConfig;
  watermark: WatermarkConfig;
  outro: OutroCardConfig;
  timedSfxCues: TimedSfxCue[];
  onExportNow?: () => void;
}

export const VideoLivePreviewModal: React.FC<VideoLivePreviewModalProps> = ({
  isOpen,
  onClose,
  audioBlobUrl,
  cues,
  title,
  subtitleTag,
  aspect,
  imageUrls,
  backgroundVideoUrl,
  slideDurationSec,
  styleConfig,
  bgmConfig,
  watermark,
  outro,
  timedSfxCues,
  onExportNow,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const bgVideoElRef = useRef<HTMLVideoElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(64)));
  const bgmHandleRef = useRef<ActiveBgmHandle | null>(null);
  const firedCueIdxRef = useRef<Set<number>>(new Set());

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(10);
  const [isLoadingAssets, setIsLoadingAssets] = useState<boolean>(true);

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const seedsRef = useRef(createParticleSeeds(96));

  const isPortrait = aspect === '9:16';
  const width = isPortrait ? 720 : 1280;
  const height = isPortrait ? 1280 : 720;

  // Load images, logo, audio, and optional background video when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoadingAssets(true);
    setIsPlaying(false);
    setCurrentTime(0);
    firedCueIdxRef.current.clear();

    const audio = new Audio(audioBlobUrl);
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audioElRef.current = audio;

    let bgVid: HTMLVideoElement | null = null;
    if (backgroundVideoUrl) {
      bgVid = document.createElement('video');
      bgVid.src = backgroundVideoUrl;
      bgVid.muted = true;
      bgVid.loop = true;
      bgVid.playsInline = true;
      bgVid.crossOrigin = 'anonymous';
      bgVideoElRef.current = bgVid;
    } else {
      bgVideoElRef.current = null;
    }

    const onLoadedMeta = () => {
      if (!cancelled && audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      if (!cancelled) {
        setIsPlaying(false);
        if (bgmHandleRef.current) {
          bgmHandleRef.current.stop();
          bgmHandleRef.current = null;
        }
        if (bgVideoElRef.current) bgVideoElRef.current.pause();
      }
    };
    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('ended', onEnded);

    Promise.all([
      backgroundVideoUrl ? Promise.resolve([]) : loadOptionalImages(imageUrls),
      loadOptionalSingleImage(watermark?.logoUrl),
    ]).then(([imgs, logo]) => {
      if (cancelled) return;
      imagesRef.current = imgs;
      logoImgRef.current = logo;
      setIsLoadingAssets(false);
    });

    return () => {
      cancelled = true;
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMeta);
      audio.removeEventListener('ended', onEnded);
      if (bgVid) bgVid.pause();
      if (bgmHandleRef.current) {
        bgmHandleRef.current.stop();
        bgmHandleRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [isOpen, audioBlobUrl, backgroundVideoUrl, imageUrls.join('|'), watermark?.logoUrl]);

  // Continuous 30-60fps live canvas renderer while modal is open
  useEffect(() => {
    if (!isOpen) return;
    let rafId = 0;

    const tick = () => {
      const canvas = canvasRef.current;
      const audio = audioElRef.current;
      if (canvas) {
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const t = audio ? audio.currentTime || 0 : currentTime;
          const totalDur = audio && audio.duration && !isNaN(audio.duration) ? audio.duration : duration;
          if (audio && !audio.paused) {
            setCurrentTime(t);
            // Fire any inline [SFX] cues live as playback crosses their timestamp!
            if (audioCtxRef.current && timedSfxCues.length > 0) {
              timedSfxCues.forEach((cue, idx) => {
                if (!firedCueIdxRef.current.has(idx) && t >= cue.timeSec && t < cue.timeSec + 0.35) {
                  firedCueIdxRef.current.add(idx);
                  triggerSfxAt(
                    audioCtxRef.current!,
                    audioCtxRef.current!.destination,
                    cue.sfxId,
                    audioCtxRef.current!.currentTime + 0.01,
                    0.6
                  );
                }
              });
            }
          }

          if (analyserRef.current && audio && !audio.paused) {
            analyserRef.current.getByteFrequencyData(freqDataRef.current);
          } else {
            // Subtle idle preview pulse when paused so waveform is visible
            for (let i = 0; i < freqDataRef.current.length; i++) {
              freqDataRef.current[i] = Math.round(
                55 + 40 * Math.sin(performance.now() * 0.004 + i * 0.35)
              );
            }
          }

          renderVideoFrame({
            ctx,
            width,
            height,
            isPortrait,
            t,
            totalDuration: Math.max(1, totalDur),
            images: imagesRef.current,
            bgVideoEl: bgVideoElRef.current,
            logoImg: logoImgRef.current,
            slideDurationSec,
            title,
            subtitleTag,
            cues,
            freqData: freqDataRef.current,
            styleConfig,
            watermark,
            outro,
            particleSeeds: seedsRef.current,
            timedSfxCues,
          });
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    isOpen,
    width,
    height,
    isPortrait,
    duration,
    slideDurationSec,
    title,
    subtitleTag,
    cues,
    styleConfig,
    watermark,
    outro,
    timedSfxCues,
  ]);

  const ensureAudioGraph = () => {
    const audio = audioElRef.current;
    if (!audio) return;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  };

  const handleTogglePlay = async () => {
    const audio = audioElRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      if (bgVideoElRef.current) bgVideoElRef.current.pause();
      if (bgmHandleRef.current) {
        bgmHandleRef.current.stop();
        bgmHandleRef.current = null;
      }
      setIsPlaying(false);
    } else {
      ensureAudioGraph();
      if (audio.ended || audio.currentTime >= Math.max(0.5, duration - 0.15)) {
        audio.currentTime = 0;
        firedCueIdxRef.current.clear();
      }
      if (bgmConfig.mood !== 'none' && audioCtxRef.current) {
        if (bgmHandleRef.current) bgmHandleRef.current.stop();
        bgmHandleRef.current = startBgmInContext(
          audioCtxRef.current,
          audioCtxRef.current.destination,
          bgmConfig
        );
      }
      if (bgVideoElRef.current) {
        bgVideoElRef.current.play().catch(() => {});
      }
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (sec: number) => {
    const audio = audioElRef.current;
    const clamped = Math.max(0, Math.min(duration, sec));
    setCurrentTime(clamped);
    if (audio) audio.currentTime = clamped;
    // Allow future SFX cues after the new seek time to fire again
    const nextFired = new Set<number>();
    timedSfxCues.forEach((c, idx) => {
      if (c.timeSec < clamped) nextFired.add(idx);
    });
    firedCueIdxRef.current = nextFired;
  };

  const handleJumpToOutro = () => {
    const dur = Math.max(1.5, outro.durationSec || 3);
    handleSeek(Math.max(0, duration - dur + 0.5));
  };

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#0B101D] border border-amber-500/35 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Eye className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                ভিডিও লাইভ প্রিভিউ ({aspect === '9:16' ? '9:16 Reels' : '16:9 Video'})
              </h2>
              <p className="text-[11px] text-slate-400">
                ডাউনলোডের আগেই দেখে নিন ছবি, পার্টিকল ইফেক্ট, ক্যারওকে সাবটাইটেল, মিউজিক ও আউটরো কার্ড ঠিকমতো বসেছে কি না।
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

        {/* Live Canvas Viewport */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-center min-h-[300px] relative">
            <canvas
              ref={canvasRef}
              className={`rounded-lg shadow-2xl border border-slate-800 ${
                isPortrait ? 'max-h-[440px] w-auto' : 'w-full max-h-[390px] object-contain'
              }`}
            />
            {isLoadingAssets && (
              <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-xs text-amber-300 font-semibold rounded-xl">
                প্রিভিউ প্রস্তুত হচ্ছে...
              </div>
            )}
          </div>

          {/* Scrubber & Playback Controls */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-amber-400 w-10">{formatSec(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(1, duration)}
                step={0.1}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="flex-1 h-2 accent-amber-400 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono text-slate-400 w-10 text-right">
                {formatSec(duration)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-slate-950" />
                      <span>থামান</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>প্রিভিউ প্লে করুন</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSeek(0)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>শুরু থেকে</span>
                </button>

                {outro.enabled && (
                  <button
                    type="button"
                    onClick={handleJumpToOutro}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold cursor-pointer"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>আউটরো কার্ড দেখুন</span>
                  </button>
                )}
              </div>

              {onExportNow && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onExportNow();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs cursor-pointer"
                >
                  <Film className="w-4 h-4" />
                  <span>এখনই ভিডিও ডাউনলোড করুন</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
