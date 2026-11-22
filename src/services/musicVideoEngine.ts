import { VideoQualityPreset } from './subtitleAndVideoService.ts';

export type MusicVideoAspect = '9:16' | '16:9' | '1:1';

export type MusicTemplateId =
  | 'aesthetic-minimal'
  | 'cinema-letterbox'
  | 'lyric-karaoke'
  | 'glass-card'
  | 'poetry-typewriter'
  | 'neon-beat';

export type MusicColorGradeId =
  | 'none'
  | 'moody-dark'
  | 'warm-golden'
  | 'cool-night'
  | 'vintage-sepia'
  | 'bw-noir';

export type MusicTransitionId = 'crossfade' | 'zoom-dissolve' | 'hard-cut';

export type MusicAtmosphereId = 'none' | 'film-grain' | 'rain' | 'bokeh' | 'embers' | 'snow';

export type MusicLyricPosition = 'center' | 'lower-third' | 'bottom';

export interface MusicLyricLine {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
  subText?: string;
}

export interface MusicMediaClip {
  id: string;
  kind: 'video' | 'image';
  name: string;
  url: string;
  durationSec?: number; // natural video duration if video
  customDurationSec?: number; // optional manual duration override (0 = auto)
  thumbUrl?: string;
  isObjectUrl?: boolean;
}

export interface MusicVideoConfig {
  aspect: MusicVideoAspect;
  template: MusicTemplateId;
  colorGrade: MusicColorGradeId;
  transition: MusicTransitionId;
  atmosphere: MusicAtmosphereId;
  lyricPosition: MusicLyricPosition;
  lyricColor: string;
  accentColor: string;
  fontSizeScale: number; // 0.8 to 1.35
  showTitleHeader: boolean;
  songTitle: string;
  artistName: string;
  watermarkText: string;
  showProgressBar: boolean;
  showAudioBars: boolean;
  beatZoom: boolean;
  clipDurationSec: number; // 0 = auto fit evenly across song
  qualityPreset: VideoQualityPreset;
}

export const DEFAULT_MUSIC_VIDEO_CONFIG: MusicVideoConfig = {
  aspect: '9:16',
  template: 'aesthetic-minimal',
  colorGrade: 'moody-dark',
  transition: 'crossfade',
  atmosphere: 'film-grain',
  lyricPosition: 'center',
  lyricColor: '#ffffff',
  accentColor: '#fbbf24',
  fontSizeScale: 1.0,
  showTitleHeader: true,
  songTitle: '',
  artistName: '',
  watermarkText: '',
  showProgressBar: true,
  showAudioBars: true,
  beatZoom: true,
  clipDurationSec: 0,
  qualityPreset: '1080p30',
};

export const MUSIC_TEMPLATE_OPTIONS: Array<{
  id: MusicTemplateId;
  label: string;
  desc: string;
}> = [
  {
    id: 'aesthetic-minimal',
    label: 'সিম্পল অ্যাসথেটিক',
    desc: 'সফট গ্লো সাদা লিরিক্স · ভাইরাল Shorts স্টাইল',
  },
  {
    id: 'cinema-letterbox',
    label: 'সিনেম্যাটিক মুভি',
    desc: 'ব্ল্যাক মুভি বার + নিচে ক্লিন ফিল্ম সাবটাইটেল',
  },
  {
    id: 'lyric-karaoke',
    label: 'কারাওকে লিরিক্স',
    desc: 'শব্দে-শব্দে হাইলাইট + আগের ও পরের লাইন প্রিভিউ',
  },
  {
    id: 'glass-card',
    label: 'মডার্ন গ্লাস কার্ড',
    desc: 'হালকা ব্লার গ্লাস বক্স + মিউজিক ওয়েভ বার',
  },
  {
    id: 'poetry-typewriter',
    label: 'কবিতা ও ইমোশনাল',
    desc: 'সফট ফেড-ইন পয়েট্রি লাইন + গোল্ডেন ডিভাইডার',
  },
  {
    id: 'neon-beat',
    label: 'বিট-রিঅ্যাক্টিভ ভাইব',
    desc: 'বোল্ড কাইনেটিক টেক্সট + বিট পালস গ্লো',
  },
];

export const MUSIC_COLOR_GRADE_OPTIONS: Array<{
  id: MusicColorGradeId;
  label: string;
}> = [
  { id: 'none', label: 'অরিজিনাল' },
  { id: 'moody-dark', label: 'মুডি ডার্ক' },
  { id: 'warm-golden', label: 'ওয়ার্ম গোল্ডেন' },
  { id: 'cool-night', label: 'কুল নাইট' },
  { id: 'vintage-sepia', label: 'ভিনটেজ ৩৫মিমি' },
  { id: 'bw-noir', label: 'সাদাকালো নয়ার' },
];

export const MUSIC_ATMOSPHERE_OPTIONS: Array<{
  id: MusicAtmosphereId;
  label: string;
}> = [
  { id: 'none', label: 'বন্ধ' },
  { id: 'film-grain', label: 'ফিল্ম গ্রেইন' },
  { id: 'rain', label: 'নরম বৃষ্টি' },
  { id: 'bokeh', label: 'সফট বোকেহ' },
  { id: 'embers', label: 'উষ্ণ স্ফুলিঙ্গ' },
  { id: 'snow', label: 'তুষার কণা' },
];

export interface LoadedMusicClipAsset {
  clip: MusicMediaClip;
  imageEl?: HTMLImageElement;
  videoEl?: HTMLVideoElement;
}

export interface AtmosphereSeed {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
  alpha: number;
}

export function createAtmosphereSeeds(count = 72): AtmosphereSeed[] {
  const seeds: AtmosphereSeed[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push({
      x: Math.random(),
      y: Math.random(),
      speed: 0.25 + Math.random() * 0.85,
      size: 0.5 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.18 + Math.random() * 0.55,
    });
  }
  return seeds;
}

export function getMusicCanvasDimensions(
  aspect: MusicVideoAspect,
  quality: VideoQualityPreset
): { width: number; height: number } {
  const isFullHd = quality === '1080p30' || quality === '1080p60';
  if (aspect === '16:9') {
    return isFullHd ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
  }
  if (aspect === '1:1') {
    return isFullHd ? { width: 1080, height: 1080 } : { width: 720, height: 720 };
  }
  return isFullHd ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
}

export function buildLyricsSrtContent(lines: MusicLyricLine[]): string {
  const fmt = (sec: number) => {
    const safe = Math.max(0, sec);
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = Math.floor(safe % 60);
    const ms = Math.round((safe - Math.floor(safe)) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(Math.min(999, ms)).padStart(3, '0')}`;
  };
  return lines
    .map((line, i) => {
      const textBlock = line.subText ? `${line.text}\n${line.subText}` : line.text;
      return `${i + 1}\n${fmt(line.startSec)} --> ${fmt(line.endSec)}\n${textBlock}`;
    })
    .join('\n\n');
}

export function splitManualLyricsEvenly(rawText: string, totalDurationSec: number): MusicLyricLine[] {
  const cleanedLines = rawText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (cleanedLines.length === 0) return [];
  const safeDur = Math.max(2, totalDurationSec);
  const weights = cleanedLines.map((l) => Math.max(6, l.length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let cursor = Math.min(0.8, safeDur * 0.04);
  const usableDur = Math.max(1, safeDur - cursor - Math.min(0.6, safeDur * 0.03));

  return cleanedLines.map((text, idx) => {
    const span = (weights[idx] / totalWeight) * usableDur;
    const startSec = Number(cursor.toFixed(2));
    const endSec = Number(Math.min(safeDur, cursor + span).toFixed(2));
    cursor = endSec;
    return {
      id: `manual_${idx + 1}_${Date.now()}`,
      startSec,
      endSec: Math.max(startSec + 0.4, endSec),
      text,
      subText: '',
    };
  });
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function drawMediaCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement,
  width: number,
  height: number,
  zoom: number,
  panXRatio: number,
  alpha: number
) {
  const srcW =
    source instanceof HTMLVideoElement
      ? source.videoWidth || 1280
      : source.naturalWidth || 1280;
  const srcH =
    source instanceof HTMLVideoElement
      ? source.videoHeight || 720
      : source.naturalHeight || 720;

  if (srcW <= 0 || srcH <= 0) return;

  const baseScale = Math.max(width / srcW, height / srcH);
  const drawW = srcW * baseScale * zoom;
  const drawH = srcH * baseScale * zoom;
  const maxOffsetX = Math.max(0, (drawW - width) / 2);
  const dx = (width - drawW) / 2 + panXRatio * maxOffsetX * 0.45;
  const dy = (height - drawH) / 2;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  try {
    ctx.drawImage(source, dx, dy, drawW, drawH);
  } catch {
    // Ignore transient video decode frame miss
  }
  ctx.restore();
}

function applyColorGradeOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  grade: MusicColorGradeId
) {
  if (grade === 'none') return;
  ctx.save();
  if (grade === 'moody-dark') {
    ctx.fillStyle = 'rgba(7, 11, 22, 0.34)';
    ctx.fillRect(0, 0, width, height);
    const vig = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      Math.min(width, height) * 0.18,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(2,4,10,0.62)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  } else if (grade === 'warm-golden') {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, 'rgba(245, 158, 11, 0.17)');
    grad.addColorStop(0.55, 'rgba(180, 83, 9, 0.08)');
    grad.addColorStop(1, 'rgba(28, 16, 8, 0.42)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (grade === 'cool-night') {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(14, 42, 84, 0.32)');
    grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.24)');
    grad.addColorStop(1, 'rgba(3, 8, 22, 0.58)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (grade === 'vintage-sepia') {
    ctx.fillStyle = 'rgba(112, 66, 20, 0.24)';
    ctx.fillRect(0, 0, width, height);
    const vig = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.22,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.7
    );
    vig.addColorStop(0, 'rgba(255,235,200,0.04)');
    vig.addColorStop(1, 'rgba(22,12,4,0.58)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  } else if (grade === 'bw-noir') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function drawAtmosphereOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  atmosphere: MusicAtmosphereId,
  seeds: AtmosphereSeed[]
) {
  if (atmosphere === 'none') return;
  ctx.save();

  if (atmosphere === 'film-grain') {
    // Subtle aesthetic organic film dust & gentle flicker particles (lightweight & crisp)
    const flicker = 0.03 + Math.sin(t * 24) * 0.012;
    ctx.fillStyle = `rgba(255, 248, 235, ${flicker})`;
    for (let i = 0; i < 42; i++) {
      const s = seeds[i % seeds.length];
      const gx = ((s.x * 137.3 + t * (19 + i)) % 1) * width;
      const gy = ((s.y * 293.7 + t * (13 + i * 0.7)) % 1) * height;
      ctx.fillRect(gx, gy, s.size * 2.1, s.size * 2.1);
    }
    // Delicate floating cinematic dust motes
    for (let i = 0; i < 20; i++) {
      const s = seeds[i];
      const px = ((s.x + Math.sin(t * 0.25 + s.phase) * 0.05 + 1) % 1) * width;
      const py = ((s.y - t * 0.018 * s.speed + 10) % 1) * height;
      ctx.beginPath();
      ctx.arc(px, py, s.size * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 250, 235, ${s.alpha * 0.35})`;
      ctx.fill();
    }
  } else if (atmosphere === 'rain') {
    ctx.strokeStyle = 'rgba(205, 230, 255, 0.32)';
    ctx.lineCap = 'round';
    for (const s of seeds) {
      const x = ((s.x + t * 0.05 * s.speed) % 1) * width;
      const y = ((s.y + t * 0.85 * s.speed) % 1) * height;
      const len = 18 + s.size * 18;
      ctx.lineWidth = Math.max(1, s.size * 1.1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.16, y + len);
      ctx.stroke();
    }
  } else if (atmosphere === 'bokeh') {
    for (let i = 0; i < 24; i++) {
      const s = seeds[i];
      const x = ((s.x + Math.sin(t * 0.22 + s.phase) * 0.06 + 1) % 1) * width;
      const y = ((s.y - t * 0.025 * s.speed + 10) % 1) * height;
      const r = (14 + s.size * 24) * (width / 1080);
      const pulse = 0.55 + 0.45 * Math.sin(t * 1.5 + s.phase);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255, 240, 200, ${0.22 * pulse})`);
      g.addColorStop(0.6, `rgba(251, 191, 36, ${0.09 * pulse})`);
      g.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (atmosphere === 'embers') {
    for (let i = 0; i < 48; i++) {
      const s = seeds[i % seeds.length];
      const x = ((s.x + Math.sin(t * 1.4 + s.phase) * 0.04 + 1) % 1) * width;
      const y = ((1 - ((s.y + t * 0.16 * s.speed) % 1)) + 1) % 1 * height;
      const r = Math.max(1.8, s.size * 3.1);
      ctx.fillStyle = i % 2 === 0 ? `rgba(251, 146, 60, ${s.alpha})` : `rgba(253, 224, 71, ${s.alpha * 0.9})`;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (atmosphere === 'snow') {
    for (const s of seeds) {
      const x = ((s.x + Math.sin(t * 0.9 + s.phase) * 0.03 + 1) % 1) * width;
      const y = ((s.y + t * 0.12 * s.speed) % 1) * height;
      const r = Math.max(1.5, s.size * 3.0);
      ctx.fillStyle = `rgba(241, 245, 249, ${s.alpha * 0.85})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export function renderMusicVideoFrame({
  ctx,
  width,
  height,
  t,
  totalDuration,
  assets,
  lyrics,
  freqData,
  config,
  seeds,
}: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  t: number;
  totalDuration: number;
  assets: LoadedMusicClipAsset[];
  lyrics: MusicLyricLine[];
  freqData?: Uint8Array;
  config: MusicVideoConfig;
  seeds: AtmosphereSeed[];
}) {
  const isPortrait = height > width;
  const isSquare = Math.abs(width - height) < 10;
  const safeDuration = Math.max(1, totalDuration);
  const progress = Math.max(0, Math.min(1, t / safeDuration));

  // Compute subtle bass energy for beat-reactive micro-zoom & equalizer
  let bassEnergy = 0;
  if (freqData && freqData.length > 8) {
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += freqData[i];
    bassEnergy = sum / (10 * 255);
  }
  const beatBoost = config.beatZoom ? bassEnergy * 0.035 : 0;

  ctx.save();
  ctx.fillStyle = '#05070e';
  ctx.fillRect(0, 0, width, height);

  // 1. Background Mixed Clips & Images Timeline with Smooth Transitions
  if (assets.length > 0) {
    const slotDur =
      config.clipDurationSec > 0
        ? config.clipDurationSec
        : Math.max(2.5, safeDuration / assets.length);
    const slotIdx = Math.floor(t / slotDur);
    const localProgress = (t % slotDur) / slotDur;

    const currIdx = slotIdx % assets.length;
    const nextIdx = (slotIdx + 1) % assets.length;
    const currAsset = assets[currIdx];
    const nextAsset = assets[nextIdx];

    const currSource = currAsset.videoEl || currAsset.imageEl;
    const nextSource = nextAsset.videoEl || nextAsset.imageEl;

    const baseZoom =
      config.transition === 'zoom-dissolve'
        ? 1.03 + 0.1 * localProgress + beatBoost
        : 1.02 + 0.06 * localProgress + beatBoost;
    const pan = (currIdx % 2 === 0 ? 1 : -1) * (localProgress * 2 - 1);

    if (currSource) {
      drawMediaCover(ctx, currSource, width, height, baseZoom, pan, 1);
    }

    // Smooth crossfade / zoom-dissolve into next clip/photo
    const fadeSec = config.transition === 'hard-cut' ? 0 : Math.min(0.9, slotDur * 0.24);
    const timeRemaining = (1 - localProgress) * slotDur;
    if (assets.length > 1 && nextSource && fadeSec > 0 && timeRemaining < fadeSec) {
      const fadeAlpha = 1 - timeRemaining / Math.max(0.05, fadeSec);
      const nextZoom =
        config.transition === 'zoom-dissolve'
          ? 1.12 - 0.08 * fadeAlpha + beatBoost
          : 1.02 + beatBoost;
      drawMediaCover(ctx, nextSource, width, height, nextZoom, -pan, fadeAlpha);
    }
  } else {
    // Rich moody aesthetic gradient fallback when no clip/photo added yet
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#090d1a');
    bg.addColorStop(0.5, '#171d32');
    bg.addColorStop(1, '#05070e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const orbX = width * (0.5 + 0.18 * Math.cos(t * 0.45));
    const orbY = height * (0.42 + 0.08 * Math.sin(t * 0.6));
    const glow = ctx.createRadialGradient(orbX, orbY, 20, orbX, orbY, width * 0.65);
    glow.addColorStop(0, `${config.accentColor}38`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Cinematic Color Grade LUT Overlay
  applyColorGradeOverlay(ctx, width, height, config.colorGrade);

  // Readability Gradient Scrim (ensures crisp 4.5:1+ contrast on every bright/dark clip)
  const scrim = ctx.createLinearGradient(0, 0, 0, height);
  scrim.addColorStop(0, 'rgba(4, 6, 12, 0.56)');
  scrim.addColorStop(0.35, 'rgba(4, 6, 12, 0.24)');
  scrim.addColorStop(0.68, 'rgba(4, 6, 12, 0.38)');
  scrim.addColorStop(1, 'rgba(4, 6, 12, 0.78)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, width, height);

  // 3. Atmospheric Overlay (Film Grain / Rain / Bokeh / Embers / Snow)
  drawAtmosphereOverlay(ctx, width, height, t, config.atmosphere, seeds);

  // 4. Optional Cinema Letterbox Bars (for cinema-letterbox template)
  if (config.template === 'cinema-letterbox') {
    const barH = Math.round(height * (isPortrait ? 0.11 : 0.12));
    ctx.fillStyle = '#030408';
    ctx.fillRect(0, 0, width, barH);
    ctx.fillRect(0, height - barH, width, barH);
  }

  // 5. Optional Subtle Song Title & Artist Header (viral Shorts aesthetic top tag)
  const cleanSongTitle = config.songTitle.trim();
  const cleanArtist = config.artistName.trim();
  if (config.showTitleHeader && (cleanSongTitle || cleanArtist)) {
    const scale = width / (isPortrait ? 1080 : isSquare ? 1080 : 1920);
    const headerY =
      config.template === 'cinema-letterbox'
        ? Math.round(height * 0.068)
        : Math.round(height * (isPortrait ? 0.085 : 0.095));

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (cleanSongTitle) {
      ctx.font = `600 ${Math.round((isPortrait ? 30 : 28) * scale)}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 12;
      ctx.fillText(cleanSongTitle.slice(0, 48), width / 2, headerY);
    }
    if (cleanArtist) {
      ctx.font = `500 ${Math.round((isPortrait ? 21 : 20) * scale)}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.68)';
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 8;
      ctx.fillText(cleanArtist.slice(0, 48), width / 2, headerY + Math.round(34 * scale));
    }
    ctx.restore();
  }

  // 6. Active Lyric Lookup & Smooth Entrance / Exit Opacity
  const activeIdx = lyrics.findIndex((l) => t >= l.startSec && t <= l.endSec);
  const activeLine = activeIdx >= 0 ? lyrics[activeIdx] : null;
  const prevLine = activeIdx > 0 ? lyrics[activeIdx - 1] : null;
  const nextLine = activeIdx >= 0 && activeIdx < lyrics.length - 1 ? lyrics[activeIdx + 1] : null;

  const baseScale = width / (isPortrait ? 1080 : isSquare ? 1080 : 1920);
  const userFontScale = Math.max(0.75, Math.min(1.4, config.fontSizeScale || 1));

  // Target Y anchor for lyrics
  let anchorY = height * 0.52;
  if (config.template === 'cinema-letterbox') {
    anchorY = height * (isPortrait ? 0.8 : 0.83);
  } else if (config.lyricPosition === 'lower-third') {
    anchorY = height * (isPortrait ? 0.72 : 0.76);
  } else if (config.lyricPosition === 'bottom') {
    anchorY = height * (isPortrait ? 0.82 : 0.85);
  } else {
    anchorY = height * 0.52;
  }

  if (activeLine) {
    const lineDur = Math.max(0.3, activeLine.endSec - activeLine.startSec);
    const localT = Math.max(0, t - activeLine.startSec);
    const remainT = Math.max(0, activeLine.endSec - t);
    const fadeIn = Math.min(1, localT / Math.min(0.32, lineDur * 0.3));
    const fadeOut = Math.min(1, remainT / Math.min(0.24, lineDur * 0.25));
    const easeAlpha = Math.max(0, Math.min(1, fadeIn * fadeOut));
    const slideUpY = (1 - fadeIn) * 22 * baseScale;
    const lineProgress = Math.max(0, Math.min(1, localT / lineDur));

    const maxTextW = width * (isPortrait ? 0.84 : 0.76);
    const mainFontSize = Math.round(
      (isPortrait ? 52 : isSquare ? 48 : 54) * baseScale * userFontScale
    );
    const subFontSize = Math.round(mainFontSize * 0.54);
    const lineHeight = Math.round(mainFontSize * 1.34);

    ctx.save();
    ctx.globalAlpha = easeAlpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Template-specific lyric rendering
    if (config.template === 'lyric-karaoke') {
      // Apple Music / Spotify / Viral Shorts 3-line focus view with word-by-word highlight
      ctx.font = `700 ${mainFontSize}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
      const wrapped = wrapTextLines(ctx, activeLine.text, maxTextW);
      const blockH = wrapped.length * lineHeight;
      const startY = anchorY - blockH / 2 + lineHeight / 2 + slideUpY;

      // Faded previous line above
      if (prevLine) {
        ctx.save();
        ctx.globalAlpha = easeAlpha * 0.32;
        ctx.font = `500 ${Math.round(mainFontSize * 0.68)}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.fillStyle = '#e2e8f0';
        const prevShort = wrapTextLines(ctx, prevLine.text, maxTextW * 0.9).slice(-1)[0] || '';
        ctx.fillText(prevShort, width / 2, startY - lineHeight * 1.25);
        ctx.restore();
      }

      // Word-by-word glowing highlight
      const allWords = activeLine.text.split(/\s+/).filter(Boolean);
      const activeWordCount = Math.max(1, Math.ceil(lineProgress * allWords.length));
      let globalWordIdx = 0;

      ctx.font = `700 ${mainFontSize}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
      wrapped.forEach((row, rIdx) => {
        const rowWords = row.split(/\s+/).filter(Boolean);
        const totalRowW = ctx.measureText(row).width;
        let curX = width / 2 - totalRowW / 2;
        const rowY = startY + rIdx * lineHeight;

        ctx.textAlign = 'left';
        rowWords.forEach((word, wIdx) => {
          const piece = wIdx < rowWords.length - 1 ? `${word} ` : word;
          const isLit = globalWordIdx < activeWordCount;
          const isCurrent = globalWordIdx === activeWordCount - 1;
          ctx.fillStyle = isCurrent
            ? config.accentColor
            : isLit
            ? config.lyricColor
            : 'rgba(255,255,255,0.36)';
          ctx.shadowColor = isCurrent ? config.accentColor : 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = isCurrent ? 22 : 12;
          ctx.fillText(piece, curX, rowY);
          curX += ctx.measureText(piece).width;
          globalWordIdx++;
        });
      });

      ctx.textAlign = 'center';
      if (activeLine.subText) {
        ctx.font = `italic 500 ${subFontSize}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(241, 245, 249, 0.84)';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 10;
        ctx.fillText(
          activeLine.subText,
          width / 2,
          startY + wrapped.length * lineHeight + Math.round(8 * baseScale)
        );
      }

      // Faded upcoming line below
      if (nextLine) {
        ctx.save();
        ctx.globalAlpha = easeAlpha * 0.3;
        ctx.font = `500 ${Math.round(mainFontSize * 0.68)}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.fillStyle = '#e2e8f0';
        const nextShort = wrapTextLines(ctx, nextLine.text, maxTextW * 0.9)[0] || '';
        const extraSub = activeLine.subText ? lineHeight * 0.72 : 0;
        ctx.fillText(nextShort, width / 2, startY + wrapped.length * lineHeight + extraSub + lineHeight * 0.55);
        ctx.restore();
      }
    } else if (config.template === 'glass-card') {
      // Frosted aesthetic translucent lyric glass box
      ctx.font = `700 ${mainFontSize}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
      const wrapped = wrapTextLines(ctx, activeLine.text, maxTextW * 0.88);
      const subLines = activeLine.subText
        ? wrapTextLines(ctx, activeLine.subText, maxTextW * 0.9)
        : [];
      const padX = Math.round(42 * baseScale);
      const padY = Math.round(30 * baseScale);
      const subGap = subLines.length > 0 ? Math.round(14 * baseScale) : 0;
      const boxH =
        padY * 2 +
        wrapped.length * lineHeight +
        subGap +
        subLines.length * Math.round(subFontSize * 1.35);
      const boxW = Math.min(
        width * 0.9,
        Math.max(
          width * 0.56,
          Math.max(...wrapped.map((l) => ctx.measureText(l).width), 200) + padX * 2
        )
      );
      const boxX = (width - boxW) / 2;
      const boxY = anchorY - boxH / 2 + slideUpY;

      ctx.fillStyle = 'rgba(10, 14, 24, 0.54)';
      drawRoundedRectPath(ctx, boxX, boxY, boxW, boxH, Math.round(28 * baseScale));
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = Math.max(1.5, 2 * baseScale);
      ctx.stroke();

      let cursorY = boxY + padY + lineHeight / 2;
      ctx.fillStyle = config.lyricColor;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 10;
      wrapped.forEach((row) => {
        ctx.fillText(row, width / 2, cursorY);
        cursorY += lineHeight;
      });

      if (subLines.length > 0) {
        cursorY += subGap - Math.round(6 * baseScale);
        ctx.font = `500 ${subFontSize}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.fillStyle = config.accentColor;
        subLines.forEach((row) => {
          ctx.fillText(row, width / 2, cursorY);
          cursorY += Math.round(subFontSize * 1.35);
        });
      }
    } else if (config.template === 'poetry-typewriter') {
      // Soft poetic reveal with gentle golden center divider
      ctx.font = `600 ${mainFontSize}px "Hind Siliguri", Georgia, serif`;
      const wrapped = wrapTextLines(ctx, activeLine.text, maxTextW);
      const blockH = wrapped.length * lineHeight;
      const startY = anchorY - blockH / 2 + lineHeight / 2 + slideUpY;

      // Delicate accent line above lyrics
      const ruleW = Math.round(88 * baseScale * Math.min(1, fadeIn * 1.2));
      ctx.fillStyle = config.accentColor;
      ctx.globalAlpha = easeAlpha * 0.85;
      ctx.fillRect(width / 2 - ruleW / 2, startY - lineHeight * 0.75, ruleW, Math.max(2, 3 * baseScale));
      ctx.globalAlpha = easeAlpha;

      ctx.fillStyle = config.lyricColor;
      ctx.shadowColor = 'rgba(0,0,0,0.92)';
      ctx.shadowBlur = 18;
      wrapped.forEach((row, idx) => {
        ctx.fillText(row, width / 2, startY + idx * lineHeight);
      });

      if (activeLine.subText) {
        ctx.font = `italic 500 ${subFontSize}px "Hind Siliguri", Georgia, serif`;
        ctx.fillStyle = 'rgba(253, 230, 138, 0.9)';
        ctx.fillText(
          activeLine.subText,
          width / 2,
          startY + wrapped.length * lineHeight + Math.round(10 * baseScale)
        );
      }
    } else if (config.template === 'neon-beat') {
      // Bold kinetic beat-reactive typography
      const pulseScale = 1 + bassEnergy * 0.06;
      ctx.translate(width / 2, anchorY + slideUpY);
      ctx.scale(pulseScale, pulseScale);
      ctx.font = `800 ${Math.round(mainFontSize * 1.06)}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
      const wrapped = wrapTextLines(ctx, activeLine.text, maxTextW);
      const blockH = wrapped.length * lineHeight;
      const startY = -blockH / 2 + lineHeight / 2;

      ctx.lineWidth = Math.max(3, 6 * baseScale);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowColor = config.accentColor;
      ctx.shadowBlur = 24;
      wrapped.forEach((row, idx) => {
        const y = startY + idx * lineHeight;
        ctx.strokeText(row, 0, y);
        ctx.fillStyle = idx === wrapped.length - 1 && wrapped.length > 1 ? config.accentColor : config.lyricColor;
        ctx.fillText(row, 0, y);
      });

      if (activeLine.subText) {
        ctx.shadowBlur = 10;
        ctx.font = `600 ${subFontSize}px "Hind Siliguri", system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
        ctx.fillText(activeLine.subText, 0, startY + wrapped.length * lineHeight + Math.round(8 * baseScale));
      }
    } else {
      // 'aesthetic-minimal' AND 'cinema-letterbox' — ultra-clean viral aesthetic soft-glow typography
      const isCinema = config.template === 'cinema-letterbox';
      const fSize = isCinema ? Math.round(mainFontSize * 0.88) : mainFontSize;
      const lHeight = Math.round(fSize * 1.32);

      ctx.font = `${isCinema ? '600' : '700'} ${fSize}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
      const wrapped = wrapTextLines(ctx, activeLine.text, maxTextW);
      const blockH = wrapped.length * lHeight;
      const startY = anchorY - blockH / 2 + lHeight / 2 + slideUpY;

      // Soft cinematic ambient shadow behind text (no ugly boxy background!)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
      ctx.shadowBlur = Math.round(22 * baseScale);
      ctx.shadowOffsetY = Math.round(3 * baseScale);
      ctx.fillStyle = config.lyricColor;

      wrapped.forEach((row, idx) => {
        ctx.fillText(row, width / 2, startY + idx * lHeight);
      });

      if (activeLine.subText) {
        ctx.shadowBlur = Math.round(14 * baseScale);
        ctx.font = `italic 500 ${subFontSize}px "Hind Siliguri", "Plus Jakarta Sans", system-ui, sans-serif`;
        ctx.fillStyle = isCinema ? config.accentColor : 'rgba(226, 232, 240, 0.82)';
        ctx.fillText(
          activeLine.subText,
          width / 2,
          startY + wrapped.length * lHeight + Math.round(8 * baseScale)
        );
      }
    }

    ctx.restore();
  }

  // 7. Sleek Minimal Audio Visualizer Bars (subtle aesthetic bottom equalizer)
  if (config.showAudioBars && config.template !== 'cinema-letterbox') {
    const barCount = isPortrait ? 24 : 32;
    const totalW = width * (isPortrait ? 0.36 : 0.26);
    const startX = (width - totalW) / 2;
    const gap = totalW / barCount;
    const barW = Math.max(2.5, gap * 0.45);
    const barBaseY = height * (isPortrait ? 0.915 : 0.92);
    const maxH = Math.round((isPortrait ? 42 : 34) * baseScale);

    ctx.save();
    for (let i = 0; i < barCount; i++) {
      const bin = freqData ? Math.min(freqData.length - 1, Math.floor((i / barCount) * 32)) : 0;
      const norm = freqData ? (freqData[bin] || 0) / 255 : 0;
      const waveFallback = 0.22 + 0.16 * Math.sin(t * 6 + i * 0.55);
      const h = Math.max(4 * baseScale, (norm > 0.02 ? norm : waveFallback) * maxH);
      const x = startX + i * gap;
      ctx.fillStyle = i % 3 === 0 ? config.accentColor : 'rgba(255,255,255,0.68)';
      drawRoundedRectPath(ctx, x, barBaseY - h / 2, barW, h, barW / 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 8. Subtle Creator Watermark (bottom-right or top-right)
  if (config.watermarkText.trim()) {
    ctx.save();
    ctx.font = `600 ${Math.round(22 * baseScale)}px "Hind Siliguri", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    const wmY =
      config.template === 'cinema-letterbox'
        ? height - Math.round(height * 0.048)
        : height - Math.round(44 * baseScale);
    ctx.fillText(config.watermarkText.trim().slice(0, 36), width / 2, wmY);
    ctx.restore();
  }

  // 9. Minimal Sleek Music Progress Line
  if (config.showProgressBar) {
    const barH = Math.max(4, Math.round(6 * baseScale));
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(0, 0, width, barH);
    const pGrad = ctx.createLinearGradient(0, 0, Math.max(10, width * progress), 0);
    pGrad.addColorStop(0, config.accentColor);
    pGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = pGrad;
    ctx.fillRect(0, 0, width * progress, barH);
    ctx.restore();
  }

  ctx.restore();
}

async function loadAllMediaClipAssets(clips: MusicMediaClip[]): Promise<LoadedMusicClipAsset[]> {
  const results = await Promise.all(
    clips.map(async (clip): Promise<LoadedMusicClipAsset | null> => {
      if (clip.kind === 'image') {
        return await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve({ clip, imageEl: img });
          img.onerror = () => resolve(null);
          img.src = clip.url;
        });
      }
      return await new Promise((resolve) => {
        const vid = document.createElement('video');
        vid.src = clip.url;
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.crossOrigin = 'anonymous';
        vid.preload = 'auto';
        const done = () => resolve({ clip, videoEl: vid });
        vid.onloadeddata = done;
        vid.onerror = () => resolve(null);
        setTimeout(() => {
          if (vid.readyState >= 2) done();
        }, 2500);
      });
    })
  );
  return results.filter((r): r is LoadedMusicClipAsset => r !== null);
}

function pickFastMusicVideoMime(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/mp4',
    'video/webm',
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
}

/**
 * Exports a smooth, high-bitrate, zero-freeze Music Video with mixed video clips/images,
 * aesthetic color grades, atmospheric overlays, synced lyrics, and trimmed or full song audio.
 */
export async function exportMusicVideo({
  audioUrl,
  trimStartSec,
  trimEndSec,
  clips,
  lyrics,
  config,
  onProgress,
}: {
  audioUrl: string;
  trimStartSec: number;
  trimEndSec: number;
  clips: MusicMediaClip[];
  lyrics: MusicLyricLine[];
  config: MusicVideoConfig;
  onProgress?: (percent: number) => void;
}): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('আপনার ব্রাউজারে ভিডিও এক্সপোর্ট সমর্থিত নয়।');
  }

  const { width, height } = getMusicCanvasDimensions(config.aspect, config.qualityPreset);
  const targetFps = config.qualityPreset === '1080p60' ? 60 : 30;
  const targetBitrate =
    config.qualityPreset === '1080p60'
      ? 8_000_000
      : config.qualityPreset === '1080p30'
      ? 6_000_000
      : 3_200_000;

  const [assets, audioEl] = await Promise.all([
    loadAllMediaClipAssets(clips),
    new Promise<HTMLAudioElement>((resolve, reject) => {
      const el = document.createElement('audio');
      el.src = audioUrl;
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.onloadedmetadata = () => resolve(el);
      el.onerror = () => reject(new Error('গানের অডিও লোড করা যায়নি।'));
    }),
  ]);

  const rawAudioDur = Math.max(1, audioEl.duration || 15);
  const safeStart = Math.max(0, Math.min(rawAudioDur - 1, trimStartSec || 0));
  const safeEnd =
    trimEndSec > safeStart + 0.8 ? Math.min(rawAudioDur, trimEndSec) : rawAudioDur;
  const totalDuration = Math.max(1, safeEnd - safeStart);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('ক্যানভাস তৈরি করা যায়নি।');

  // Mount hidden GPU-active canvas during capture so frames never stall
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '2px';
  canvas.style.height = '2px';
  canvas.style.opacity = '0.005';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '-1';
  document.body.appendChild(canvas);

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const sourceNode = audioCtx.createMediaElementSource(audioEl);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const dest = audioCtx.createMediaStreamDestination();
  sourceNode.connect(analyser);
  analyser.connect(dest);

  const seeds = createAtmosphereSeeds(72);

  // Start all background video clips playing silently in loop
  assets.forEach((a) => {
    if (a.videoEl) {
      a.videoEl.currentTime = 0;
      a.videoEl.play().catch(() => {});
    }
  });

  const renderAtRelTime = (relSec: number) => {
    const safeT = Math.max(0, Math.min(totalDuration, Number.isFinite(relSec) ? relSec : 0));
    onProgress?.(Math.min(99, Math.round((safeT / totalDuration) * 100)));
    analyser.getByteFrequencyData(freqData);
    renderMusicVideoFrame({
      ctx,
      width,
      height,
      t: safeT,
      totalDuration,
      assets,
      lyrics,
      freqData,
      config,
      seeds,
    });
  };

  renderAtRelTime(0);

  const canvasStream = canvas.captureStream(targetFps);
  const videoTrack = canvasStream.getVideoTracks()[0] as any;
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const chosenMime = pickFastMusicVideoMime();
  const recorder = new MediaRecorder(combinedStream, {
    mimeType: chosenMime,
    videoBitsPerSecond: targetBitrate,
    audioBitsPerSecond: 192_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  let running = false;
  let rafId = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastDrawMs = 0;
  const minIntervalMs = Math.max(12, Math.floor(1000 / targetFps) - 2);

  return await new Promise<Blob>((resolve, reject) => {
    let cleanedUp = false;
    let stopped = false;

    const cleanupAll = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      running = false;
      cancelAnimationFrame(rafId);
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      audioEl.pause();
      assets.forEach((a) => a.videoEl?.pause());
      canvasStream.getTracks().forEach((tr) => tr.stop());
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      audioCtx.close().catch(() => {});
    };

    const finishRecording = () => {
      if (stopped) return;
      stopped = true;
      renderAtRelTime(totalDuration);
      if (videoTrack && typeof videoTrack.requestFrame === 'function') {
        try {
          videoTrack.requestFrame();
        } catch {
          // ignore
        }
      }
      running = false;
      cancelAnimationFrame(rafId);
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      audioEl.pause();
      if (recorder.state !== 'inactive') {
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 160);
      }
    };

    const pushTick = () => {
      if (!running) return;
      const now = performance.now();
      if (now - lastDrawMs < minIntervalMs) return;
      lastDrawMs = now;
      try {
        const relT = Math.max(0, (audioEl.currentTime || safeStart) - safeStart);
        renderAtRelTime(relT);
        if (videoTrack && typeof videoTrack.requestFrame === 'function') {
          videoTrack.requestFrame();
        }
        if (relT >= totalDuration - 0.05 || audioEl.ended) {
          finishRecording();
        }
      } catch (err) {
        console.error('Music video frame error:', err);
      }
    };

    const rafLoop = () => {
      if (!running) return;
      pushTick();
      rafId = requestAnimationFrame(rafLoop);
    };

    recorder.onstop = () => {
      cleanupAll();
      onProgress?.(100);
      resolve(new Blob(chunks, { type: chosenMime }));
    };
    recorder.onerror = () => {
      cleanupAll();
      reject(new Error('মিউজিক ভিডিও রেন্ডার করতে সমস্যা হয়েছে।'));
    };
    audioEl.onended = finishRecording;

    audioCtx
      .resume()
      .then(() => {
        audioEl.currentTime = safeStart;
        recorder.start(250);
        running = true;
        pushTick();
        rafId = requestAnimationFrame(rafLoop);
        intervalId = setInterval(pushTick, Math.max(16, Math.round(1000 / Math.min(targetFps, 30))));

        audioEl.play().catch((err) => {
          cleanupAll();
          if (recorder.state !== 'inactive') recorder.stop();
          reject(new Error('অডিও প্লেব্যাক শুরু হয়নি: ' + (err?.message || 'Error')));
        });
      })
      .catch((err) => {
        cleanupAll();
        reject(new Error('অডিও ইঞ্জিন চালু করা যায়নি: ' + (err?.message || 'AudioContext error')));
      });
  });
}
