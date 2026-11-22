import { DialogueTimelineItem, SubtitleCue } from '../types.ts';
import {
  ActiveBgmHandle,
  BgmMixConfig,
  startBgmInContext,
  triggerSfxAt,
} from './bgmAndSfxService.ts';
import { stripScriptCueTags, TimedSfxCue } from './scriptCueParser.ts';

export type VideoAspect = '9:16' | '16:9';
export type SubtitleMode = 'karaoke' | 'classic' | 'none';
export type SubtitleSize = 'sm' | 'md' | 'lg';
export type SubtitlePosition = 'bottom' | 'center' | 'top';
export type WaveformStyle = 'bars' | 'circle' | 'none';
export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type ParticleEffectId = 'none' | 'rain' | 'embers' | 'fog' | 'snow' | 'sparkles';
export type VideoQualityPreset = '720p30' | '1080p30' | '1080p60';
export type RetentionBarPosition = 'top' | 'bottom';

export const VIDEO_QUALITY_OPTIONS: Array<{
  id: VideoQualityPreset;
  label: string;
  shortBadge: string;
  desc: string;
  fps: number;
  bitrateMbps: number;
}> = [
  {
    id: '720p30',
    label: '720p HD · 30 FPS',
    shortBadge: '720p',
    desc: 'দ্রুত এক্সপোর্ট ও ছোট ফাইল (3 Mbps)',
    fps: 30,
    bitrateMbps: 3,
  },
  {
    id: '1080p30',
    label: '1080p Full HD · 30 FPS',
    shortBadge: '1080p HD',
    desc: 'ক্রিস্টাল-ক্লিয়ার ফুল HD (6 Mbps)',
    fps: 30,
    bitrateMbps: 6,
  },
  {
    id: '1080p60',
    label: '1080p Full HD · 60 FPS',
    shortBadge: '1080p 60fps',
    desc: 'আল্ট্রা স্মুথ প্রো কোয়ালিটি (8 Mbps)',
    fps: 60,
    bitrateMbps: 8,
  },
];

export const VIRAL_HOOK_PRESETS: string[] = [
  'শেষ পর্যন্ত দেখুন!',
  'সতর্কতা: একা দেখবেন না!',
  'অবিশ্বাস্য সত্য ঘটনা!',
  'পর্ব ১ — মিস করবেন না!',
];

export const PARTICLE_EFFECT_OPTIONS: Array<{
  id: ParticleEffectId;
  label: string;
  desc: string;
}> = [
  { id: 'none', label: 'বন্ধ', desc: 'কোনো পার্টিকল ছাড়া' },
  { id: 'rain', label: 'বৃষ্টি (Rain)', desc: 'সিনেম্যাটিক বৃষ্টির ফোঁটা' },
  { id: 'embers', label: 'আগুনের স্ফুলিঙ্গ', desc: 'থানোস ও অ্যাকশন এম্বার' },
  { id: 'fog', label: 'ভুতুড়ে কুয়াশা', desc: 'হরর গল্পের ভাসমান ধোঁয়া' },
  { id: 'snow', label: 'তুষারপাত', desc: 'নরম বরফের কণা' },
  { id: 'sparkles', label: 'ম্যাজিক ঝিকিমিকি', desc: 'পরী ও ফ্যান্টাসি তারা' },
];

export interface VideoStyleConfig {
  subtitleMode: SubtitleMode;
  subtitleColor: string;
  subtitleSize: SubtitleSize;
  subtitlePosition: SubtitlePosition;
  waveformStyle: WaveformStyle;
  particleEffect: ParticleEffectId;
  qualityPreset?: VideoQualityPreset;
  cinematicShakeFlash?: boolean;
  showRetentionBar?: boolean;
  retentionBarPosition?: RetentionBarPosition;
  hookBannerEnabled?: boolean;
  hookBannerText?: string;
}

export const DEFAULT_VIDEO_STYLE: VideoStyleConfig = {
  subtitleMode: 'karaoke',
  subtitleColor: '#fbbf24',
  subtitleSize: 'md',
  subtitlePosition: 'bottom',
  waveformStyle: 'bars',
  particleEffect: 'none',
  qualityPreset: '1080p30',
  cinematicShakeFlash: true,
  showRetentionBar: true,
  retentionBarPosition: 'top',
  hookBannerEnabled: false,
  hookBannerText: 'শেষ পর্যন্ত দেখুন!',
};

export interface WatermarkConfig {
  text: string;
  logoUrl?: string | null;
  position: WatermarkPosition;
  opacity: number; // 0.2 to 1.0
}

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  text: '',
  logoUrl: null,
  position: 'top-right',
  opacity: 0.78,
};

export interface OutroCardConfig {
  enabled: boolean;
  headline: string;
  subtext: string;
  channelName: string;
  durationSec: number; // default 3 seconds at the end
}

export const DEFAULT_OUTRO_CONFIG: OutroCardConfig = {
  enabled: false,
  headline: 'ভিডিওটি ভালো লাগলে Like ও Subscribe করুন!',
  subtext: 'পরবর্তী পর্বের জন্য ফলো দিয়ে সাথেই থাকুন',
  channelName: 'Nasrullah Studio',
  durationSec: 3,
};

function formatSrtTimestamp(sec: number): string {
  const safe = Math.max(0, sec);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(Math.min(999, ms)).padStart(3, '0')}`;
}

/**
 * Splits a continuous script into balanced readable subtitle cues distributed proportionally across totalDurationSec.
 * Automatically strips inline [SFX] and [বিরতি] cue tags so subtitles remain spotless.
 */
export function buildSubtitleCuesFromText(text: string, totalDurationSec: number, maxWordsPerCue = 8): SubtitleCue[] {
  const cleaned = stripScriptCueTags(text).replace(/\s+/g, ' ').trim();
  if (!cleaned || totalDurationSec <= 0) return [];

  const rawSentences = (cleaned.match(/[^।!?\.\n]+[।!?\.]*/g) || [cleaned])
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of rawSentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length <= maxWordsPerCue) {
      chunks.push(sentence);
    } else {
      for (let i = 0; i < words.length; i += maxWordsPerCue) {
        chunks.push(words.slice(i, i + maxWordsPerCue).join(' '));
      }
    }
  }

  const weights = chunks.map((c) => Math.max(4, c.length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const cues: SubtitleCue[] = [];
  let cursor = 0;
  for (let i = 0; i < chunks.length; i++) {
    const dur = (weights[i] / totalWeight) * totalDurationSec;
    const startSec = cursor;
    const endSec = i === chunks.length - 1 ? totalDurationSec : Math.min(totalDurationSec, cursor + dur);
    cues.push({
      index: i + 1,
      startSec,
      endSec: Math.max(startSec + 0.2, endSec),
      text: chunks[i],
    });
    cursor = endSec;
  }
  return cues;
}

/**
 * Converts exact per-line dialogue timestamps into SubtitleCue[] (stripping inline cue tags).
 */
export function buildSubtitleCuesFromDialogue(timeline: DialogueTimelineItem[]): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  let idx = 1;
  for (const item of timeline) {
    const cleanText = stripScriptCueTags(item.text);
    const words = cleanText.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    if (words.length <= 10) {
      cues.push({
        index: idx++,
        startSec: item.startSec,
        endSec: item.endSec,
        text: cleanText,
        speaker: item.speakerName,
      });
    } else {
      const subParts: string[] = [];
      for (let i = 0; i < words.length; i += 8) {
        subParts.push(words.slice(i, i + 8).join(' '));
      }
      const totalChars = subParts.reduce((a, b) => a + b.length, 0) || 1;
      const span = Math.max(0.4, item.endSec - item.startSec);
      let cursor = item.startSec;
      for (let i = 0; i < subParts.length; i++) {
        const partDur = (subParts[i].length / totalChars) * span;
        const end = i === subParts.length - 1 ? item.endSec : cursor + partDur;
        cues.push({
          index: idx++,
          startSec: cursor,
          endSec: end,
          text: subParts[i],
          speaker: item.speakerName,
        });
        cursor = end;
      }
    }
  }
  return cues;
}

export function cuesToSrtString(cues: SubtitleCue[]): string {
  return cues
    .map((c, idx) => {
      const prefix = c.speaker ? `${c.speaker}: ` : '';
      return `${idx + 1}\n${formatSrtTimestamp(c.startSec)} --> ${formatSrtTimestamp(c.endSec)}\n${prefix}${c.text}`;
    })
    .join('\n\n');
}

export function downloadSrtFile(cues: SubtitleCue[], filename: string): void {
  const srt = cuesToSrtString(cues);
  const blob = new Blob(['\uFEFF' + srt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.srt') ? filename : `${filename}.srt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Deterministic particle seed so preview & exported video look smooth & consistent
export interface ParticleSeed {
  x: number; // 0..1
  y: number; // 0..1
  size: number;
  speed: number;
  phase: number;
  huePick: number;
}

export function createParticleSeeds(count = 96): ParticleSeed[] {
  const seeds: ParticleSeed[] = [];
  let s = 1337;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < count; i++) {
    seeds.push({
      x: rand(),
      y: rand(),
      size: 0.4 + rand() * 1.1,
      speed: 0.5 + rand() * 0.9,
      phase: rand() * Math.PI * 2,
      huePick: rand(),
    });
  }
  return seeds;
}

function drawParticleOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  effect: ParticleEffectId,
  seeds: ParticleSeed[]
) {
  if (!effect || effect === 'none') return;

  ctx.save();
  if (effect === 'rain') {
    ctx.strokeStyle = 'rgba(203, 224, 255, 0.42)';
    ctx.lineCap = 'round';
    for (let i = 0; i < seeds.length; i++) {
      const p = seeds[i];
      const y = ((p.y + t * (1.15 * p.speed)) % 1.15) * height - height * 0.08;
      const x = ((p.x + t * 0.14 * p.speed) % 1.1) * width - width * 0.05;
      const len = 18 + p.size * 22;
      ctx.lineWidth = 1 + p.size * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * 0.22, y + len);
      ctx.stroke();
    }
  } else if (effect === 'embers') {
    const count = Math.min(60, seeds.length);
    for (let i = 0; i < count; i++) {
      const p = seeds[i];
      const y = (1 - ((p.y + t * 0.16 * p.speed) % 1.08)) * height;
      const x = ((p.x + Math.sin(t * 1.6 + p.phase) * 0.045) * width + width) % width;
      const r = 2 + p.size * 3.6;
      const flicker = 0.5 + 0.5 * Math.sin(t * 7 + p.phase);
      const color =
        p.huePick > 0.6
          ? `rgba(251, 191, 36, ${0.45 + flicker * 0.5})`
          : p.huePick > 0.25
          ? `rgba(249, 115, 22, ${0.45 + flicker * 0.5})`
          : `rgba(244, 63, 94, ${0.4 + flicker * 0.45})`;
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (effect === 'fog') {
    const cloudCount = 12;
    for (let i = 0; i < cloudCount; i++) {
      const p = seeds[i];
      const cx = (((p.x + t * 0.025 * (i % 2 === 0 ? 1 : -0.7)) % 1.4) + 1.4) % 1.4 * width - width * 0.2;
      const cy = height * (0.48 + p.y * 0.48);
      const rad = width * (0.28 + p.size * 0.2);
      const g = ctx.createRadialGradient(cx, cy, rad * 0.1, cx, cy, rad);
      g.addColorStop(0, 'rgba(186, 206, 226, 0.15)');
      g.addColorStop(0.55, 'rgba(148, 163, 184, 0.07)');
      g.addColorStop(1, 'rgba(148, 163, 184, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
  } else if (effect === 'snow') {
    const count = Math.min(76, seeds.length);
    for (let i = 0; i < count; i++) {
      const p = seeds[i];
      const y = ((p.y + t * 0.12 * p.speed) % 1.06) * height - height * 0.03;
      const x = ((p.x + Math.sin(t * 1.1 + p.phase) * 0.035) * width + width) % width;
      const r = 1.8 + p.size * 3.2;
      ctx.fillStyle = `rgba(241, 245, 249, ${0.38 + p.size * 0.32})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (effect === 'sparkles') {
    const count = Math.min(54, seeds.length);
    for (let i = 0; i < count; i++) {
      const p = seeds[i];
      const y = (1 - ((p.y + t * 0.08 * p.speed) % 1.05)) * height;
      const x = ((p.x + Math.cos(t * 0.9 + p.phase) * 0.025) * width + width) % width;
      const twinkle = Math.max(0, Math.sin(t * 4.5 + p.phase));
      const r = (2 + p.size * 3.8) * (0.5 + twinkle * 0.8);
      const color =
        p.huePick > 0.65
          ? `rgba(253, 224, 71, ${0.3 + twinkle * 0.7})`
          : p.huePick > 0.35
          ? `rgba(244, 114, 182, ${0.3 + twinkle * 0.7})`
          : `rgba(125, 211, 252, ${0.3 + twinkle * 0.7})`;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      // 4-point star sparkle
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.8);
      ctx.quadraticCurveTo(x, y, x + r * 1.8, y);
      ctx.quadraticCurveTo(x, y, x, y + r * 1.8);
      ctx.quadraticCurveTo(x, y, x - r * 1.8, y);
      ctx.quadraticCurveTo(x, y, x, y - r * 1.8);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSubtitleOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cue: SubtitleCue | undefined,
  isPortrait: boolean,
  currentTimeSec: number,
  style: VideoStyleConfig = DEFAULT_VIDEO_STYLE
) {
  if (style.subtitleMode === 'none' || !cue || !cue.text.trim()) return;

  const sizeScale = style.subtitleSize === 'sm' ? 0.84 : style.subtitleSize === 'lg' ? 1.18 : 1.0;
  const baseFont = isPortrait ? width * 0.052 : height * 0.048;
  const fontSize = Math.round(baseFont * sizeScale);
  const maxTextWidth = width * 0.86;
  ctx.font = `700 ${fontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';

  const lines = wrapCanvasLines(ctx, cue.text, maxTextWidth);
  const lineHeight = fontSize * 1.38;
  const padX = Math.round(fontSize * 0.72);
  const padY = Math.round(fontSize * 0.44);
  const speakerHeight = cue.speaker ? Math.round(fontSize * 0.92) : 0;

  let maxLineW = 0;
  for (const line of lines) {
    maxLineW = Math.max(maxLineW, ctx.measureText(line).width);
  }
  const boxW = Math.min(width * 0.92, Math.max(maxLineW + padX * 2, width * 0.36));
  const boxH = lines.length * lineHeight + padY * 2 + speakerHeight;
  const boxX = (width - boxW) / 2;

  let boxY: number;
  if (style.subtitlePosition === 'top') {
    boxY = isPortrait ? height * 0.21 : height * 0.16;
  } else if (style.subtitlePosition === 'center') {
    boxY = (height - boxH) / 2 + (isPortrait ? height * 0.08 : height * 0.06);
  } else {
    const bottomMargin = isPortrait ? height * 0.15 : height * 0.08;
    boxY = height - bottomMargin - boxH;
  }

  ctx.save();
  ctx.fillStyle = 'rgba(7, 10, 18, 0.80)';
  ctx.strokeStyle = style.subtitleColor;
  ctx.globalAlpha = 0.96;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 16);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;

  let yCursor = boxY + padY;

  if (cue.speaker) {
    const spkFont = Math.round(fontSize * 0.65);
    ctx.font = `700 ${spkFont}px "Hind Siliguri", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = style.subtitleColor;
    ctx.fillText(cue.speaker, width / 2, yCursor + speakerHeight * 0.42);
    yCursor += speakerHeight;
  }

  ctx.font = `700 ${fontSize}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
  ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.12));
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';

  if (style.subtitleMode === 'karaoke') {
    const allWords = lines.flatMap((line) => line.split(/\s+/).filter(Boolean));
    const cueDur = Math.max(0.15, cue.endSec - cue.startSec);
    const cueProgress = Math.max(0, Math.min(0.999, (currentTimeSec - cue.startSec) / cueDur));
    const activeGlobalWordIdx = Math.floor(cueProgress * allWords.length);

    let globalIdx = 0;
    const spaceW = ctx.measureText(' ').width;
    ctx.textAlign = 'left';

    for (let li = 0; li < lines.length; li++) {
      const words = lines[li].split(/\s+/).filter(Boolean);
      const wordWidths = words.map((w) => ctx.measureText(w).width);
      const totalLineW =
        wordWidths.reduce((a, b) => a + b, 0) + Math.max(0, words.length - 1) * spaceW;
      let wx = (width - totalLineW) / 2;
      const ly = yCursor + li * lineHeight + lineHeight * 0.5;

      for (let wi = 0; wi < words.length; wi++) {
        const isCurrent = globalIdx === activeGlobalWordIdx;
        const isPast = globalIdx < activeGlobalWordIdx;

        ctx.save();
        if (isCurrent) {
          ctx.shadowColor = style.subtitleColor;
          ctx.shadowBlur = 16;
          ctx.fillStyle = style.subtitleColor;
        } else if (isPast) {
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
        }
        ctx.strokeText(words[wi], wx, ly);
        ctx.fillText(words[wi], wx, ly);
        ctx.restore();

        wx += wordWidths[wi] + spaceW;
        globalIdx++;
      }
    }
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = style.subtitleColor === '#ffffff' ? '#ffffff' : '#f8fafc';
    for (let i = 0; i < lines.length; i++) {
      const ly = yCursor + i * lineHeight + lineHeight * 0.5;
      ctx.strokeText(lines[i], width / 2, ly);
      ctx.fillText(lines[i], width / 2, ly);
    }
  }
  ctx.restore();
}

function drawWatermarkOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isPortrait: boolean,
  watermark: WatermarkConfig | undefined,
  logoImg: HTMLImageElement | null
) {
  if (!watermark) return;
  const text = (watermark.text || '').trim();
  if (!text && !logoImg) return;

  const pad = isPortrait ? 24 : 28;
  const logoSize = isPortrait ? 42 : 40;
  const fontSize = isPortrait ? 21 : 20;

  ctx.save();
  ctx.globalAlpha = Math.max(0.2, Math.min(1, watermark.opacity ?? 0.78));
  ctx.font = `700 ${fontSize}px "Hind Siliguri", system-ui, sans-serif`;

  const textW = text ? ctx.measureText(text).width : 0;
  const gap = logoImg && text ? 10 : 0;
  const pillW = (logoImg ? logoSize : 0) + gap + textW + 24;
  const pillH = Math.max(logoImg ? logoSize : 0, fontSize + 10) + 14;

  let x = pad;
  let y = pad;
  if (watermark.position === 'top-right') {
    x = width - pad - pillW;
    y = pad;
  } else if (watermark.position === 'bottom-left') {
    x = pad;
    y = height - pad - pillH - 12;
  } else if (watermark.position === 'bottom-right') {
    x = width - pad - pillW;
    y = height - pad - pillH - 12;
  }

  ctx.fillStyle = 'rgba(7, 10, 18, 0.52)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, pillW, pillH, 12);
  ctx.fill();
  ctx.stroke();

  let cursorX = x + 12;
  const centerY = y + pillH / 2;

  if (logoImg) {
    ctx.save();
    drawRoundedRect(ctx, cursorX, centerY - logoSize / 2, logoSize, logoSize, 8);
    ctx.clip();
    ctx.drawImage(logoImg, cursorX, centerY - logoSize / 2, logoSize, logoSize);
    ctx.restore();
    cursorX += logoSize + gap;
  }

  if (text) {
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 6;
    ctx.fillText(text, cursorX, centerY + 1);
  }

  ctx.restore();
}

function drawOutroEndCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isPortrait: boolean,
  t: number,
  totalDuration: number,
  outro: OutroCardConfig | undefined,
  logoImg: HTMLImageElement | null,
  accentColor: string
) {
  if (!outro || !outro.enabled) return;
  const dur = Math.max(1.5, Math.min(6, outro.durationSec || 3));
  const startSec = Math.max(0, totalDuration - dur);
  if (t < startSec) return;

  const localT = t - startSec;
  const alpha = Math.min(1, localT / 0.45);
  const pulse = 1 + 0.045 * Math.sin(localT * 6.5);

  ctx.save();
  ctx.globalAlpha = alpha;

  // Deep cinematic glass overlay
  ctx.fillStyle = 'rgba(5, 8, 16, 0.86)';
  ctx.fillRect(0, 0, width, height);

  // Center card frame
  const cardW = isPortrait ? width * 0.86 : width * 0.68;
  const cardH = isPortrait ? height * 0.44 : height * 0.66;
  const cardX = (width - cardW) / 2;
  const cardY = (height - cardH) / 2;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, 'rgba(17, 24, 39, 0.96)');
  cardGrad.addColorStop(1, 'rgba(9, 13, 24, 0.96)');
  ctx.fillStyle = cardGrad;
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fill();
  ctx.stroke();

  let cursorY = cardY + (isPortrait ? 58 : 48);

  // Optional logo circle
  if (logoImg) {
    const logoR = isPortrait ? 48 : 40;
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, cursorY + logoR, logoR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, width / 2 - logoR, cursorY, logoR * 2, logoR * 2);
    ctx.restore();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, cursorY + logoR, logoR, 0, Math.PI * 2);
    ctx.stroke();
    cursorY += logoR * 2 + 28;
  } else {
    cursorY += 16;
  }

  // Channel name
  const chName = (outro.channelName || 'Nasrullah Studio').trim();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accentColor;
  ctx.font = `800 ${isPortrait ? 30 : 28}px "Hind Siliguri", system-ui, sans-serif`;
  ctx.fillText(chName, width / 2, cursorY);
  cursorY += isPortrait ? 56 : 48;

  // Headline
  const headline = (outro.headline || 'ভিডিওটি ভালো লাগলে Like ও Subscribe করুন!').trim();
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${isPortrait ? 38 : 34}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
  const hLines = wrapCanvasLines(ctx, headline, cardW * 0.86).slice(0, 2);
  hLines.forEach((line, idx) => {
    ctx.fillText(line, width / 2, cursorY + idx * (isPortrait ? 46 : 40));
  });
  cursorY += hLines.length * (isPortrait ? 46 : 40) + 18;

  // Subtext
  const sub = (outro.subtext || '').trim();
  if (sub) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 ${isPortrait ? 24 : 22}px "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif`;
    ctx.fillText(sub, width / 2, cursorY);
    cursorY += isPortrait ? 60 : 52;
  } else {
    cursorY += 24;
  }

  // Pulsing Red YouTube/Reels Subscribe CTA pill
  ctx.save();
  ctx.translate(width / 2, Math.min(cardY + cardH - 54, cursorY + 12));
  ctx.scale(pulse, pulse);
  const btnW = isPortrait ? 310 : 290;
  const btnH = isPortrait ? 64 : 56;
  ctx.fillStyle = '#e11d48';
  ctx.shadowColor = 'rgba(225, 29, 72, 0.55)';
  ctx.shadowBlur = 20;
  drawRoundedRect(ctx, -btnW / 2, -btnH / 2, btnW, btnH, 32);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${isPortrait ? 26 : 24}px "Hind Siliguri", system-ui, sans-serif`;
  ctx.fillText('▶  LIKE · SUBSCRIBE', 0, 2);
  ctx.restore();

  ctx.restore();
}

export async function loadOptionalImages(urls: string[]): Promise<HTMLImageElement[]> {
  const loaded: HTMLImageElement[] = [];
  for (const url of urls) {
    if (!url) continue;
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image load failed'));
        el.src = url;
      });
      loaded.push(img);
    } catch {
      // Skip unavailable images gracefully
    }
  }
  return loaded;
}

export async function loadOptionalSingleImage(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  const res = await loadOptionalImages([url]);
  return res[0] || null;
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  zoom: number,
  panXFactor: number,
  alpha: number
) {
  const imgRatio = img.width / Math.max(1, img.height);
  const canvasRatio = width / Math.max(1, height);
  let drawW = width * zoom;
  let drawH = height * zoom;
  if (imgRatio > canvasRatio) {
    drawW = drawH * imgRatio;
  } else {
    drawH = drawW / imgRatio;
  }
  const extraX = Math.max(0, drawW - width);
  const offsetX = (width - drawW) / 2 + panXFactor * Math.min(extraX * 0.25, width * 0.03);
  const offsetY = (height - drawH) / 2;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  ctx.restore();
}

function drawCoverVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number
) {
  const vw = video.videoWidth || width;
  const vh = video.videoHeight || height;
  const vidRatio = vw / Math.max(1, vh);
  const canvasRatio = width / Math.max(1, height);
  let drawW = width;
  let drawH = height;
  if (vidRatio > canvasRatio) {
    drawW = drawH * vidRatio;
  } else {
    drawH = drawW / vidRatio;
  }
  ctx.drawImage(video, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
}

export interface RenderVideoFrameParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  isPortrait: boolean;
  t: number;
  totalDuration: number;
  images: HTMLImageElement[];
  bgVideoEl: HTMLVideoElement | null;
  logoImg: HTMLImageElement | null;
  slideDurationSec: number;
  title: string;
  subtitleTag?: string;
  cues: SubtitleCue[];
  freqData: Uint8Array;
  styleConfig: VideoStyleConfig;
  watermark?: WatermarkConfig;
  outro?: OutroCardConfig;
  particleSeeds: ParticleSeed[];
  timedSfxCues?: TimedSfxCue[];
}

function drawViralHookBanner(
  ctx: CanvasRenderingContext2D,
  width: number,
  isPortrait: boolean,
  t: number,
  styleConfig: VideoStyleConfig
): void {
  if (!styleConfig.hookBannerEnabled) return;
  const text = (styleConfig.hookBannerText || '').trim();
  if (!text) return;
  const startT = 0.12;
  const endT = 3.55;
  if (t < startT || t > endT) return;

  const enterP = Math.min(1, (t - startT) / 0.28);
  const exitP = t > endT - 0.35 ? Math.max(0, (endT - t) / 0.35) : 1;
  const alpha = Math.min(enterP, exitP);
  const popScale = 0.88 + 0.12 * Math.sin((enterP * Math.PI) / 2);

  ctx.save();
  ctx.globalAlpha = alpha;
  const fontSize = isPortrait ? 24 : 21;
  ctx.font = `800 ${fontSize}px "Hind Siliguri", system-ui, sans-serif`;
  const textW = ctx.measureText(text).width;
  const padX = 24;
  const pillW = Math.min(width * 0.88, textW + padX * 2 + 18);
  const pillH = isPortrait ? 52 : 46;
  const cx = width / 2;
  const cy = isPortrait ? 236 : 154;

  ctx.translate(cx, cy);
  ctx.scale(popScale, popScale);

  // Outer red-amber viral banner glow
  ctx.shadowColor = 'rgba(239, 68, 68, 0.55)';
  ctx.shadowBlur = 22;
  const grad = ctx.createLinearGradient(-pillW / 2, 0, pillW / 2, 0);
  grad.addColorStop(0, 'rgba(220, 38, 38, 0.94)');
  grad.addColorStop(1, 'rgba(234, 88, 12, 0.94)');
  ctx.fillStyle = grad;
  drawRoundedRect(ctx, -pillW / 2, -pillH / 2, pillW, pillH, 14);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, -pillW / 2, -pillH / 2, pillW, pillH, 14);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}

function drawCinematicReactionFx(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  timedSfxCues: TimedSfxCue[] | undefined,
  enabled: boolean | undefined
): { shakeX: number; shakeY: number; zoomBoost: number; overlayDraw: () => void } {
  if (enabled === false || !timedSfxCues || timedSfxCues.length === 0) {
    return { shakeX: 0, shakeY: 0, zoomBoost: 1, overlayDraw: () => {} };
  }

  let shakeMag = 0;
  let zoomBoost = 1;
  let flashAlpha = 0;
  let glitchIntensity = 0;
  let redPulseAlpha = 0;

  for (const cue of timedSfxCues) {
    const dt = t - cue.timeSec;
    if (dt < 0 || dt > 0.75) continue;
    const decay = Math.max(0, 1 - dt / 0.7);
    if (cue.sfxId === 'thunder') {
      shakeMag = Math.max(shakeMag, 14 * decay);
      // Classic double-strike sky lightning flash
      const strike1 = dt < 0.14 ? 0.78 * (1 - dt / 0.14) : 0;
      const strike2 = dt >= 0.18 && dt < 0.36 ? 0.56 * (1 - (dt - 0.18) / 0.18) : 0;
      flashAlpha = Math.max(flashAlpha, strike1, strike2);
    } else if (cue.sfxId === 'epic_boom') {
      shakeMag = Math.max(shakeMag, 12 * decay);
      zoomBoost = Math.max(zoomBoost, 1 + 0.045 * decay);
    } else if (cue.sfxId === 'suspense_sting' || cue.sfxId === 'ghost_whoosh') {
      shakeMag = Math.max(shakeMag, 9 * decay);
      glitchIntensity = Math.max(glitchIntensity, decay);
      redPulseAlpha = Math.max(redPulseAlpha, 0.28 * decay);
    } else if (cue.sfxId === 'heartbeat') {
      zoomBoost = Math.max(zoomBoost, 1 + 0.025 * decay);
      redPulseAlpha = Math.max(redPulseAlpha, 0.16 * decay);
    } else if (cue.sfxId === 'sparkle') {
      zoomBoost = Math.max(zoomBoost, 1 + 0.02 * decay);
      flashAlpha = Math.max(flashAlpha, 0.22 * decay);
    }
  }

  const shakeX = shakeMag > 0.2 ? Math.sin(t * 78) * shakeMag : 0;
  const shakeY = shakeMag > 0.2 ? Math.cos(t * 92) * shakeMag * 0.75 : 0;

  const overlayDraw = () => {
    if (flashAlpha > 0.02) {
      ctx.save();
      ctx.fillStyle = `rgba(232, 245, 255, ${flashAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    if (redPulseAlpha > 0.01) {
      ctx.save();
      const vig = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.22,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );
      vig.addColorStop(0, 'rgba(220, 38, 38, 0)');
      vig.addColorStop(1, `rgba(220, 38, 38, ${redPulseAlpha.toFixed(3)})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    if (glitchIntensity > 0.05) {
      ctx.save();
      const slices = 7;
      for (let i = 0; i < slices; i++) {
        const y = ((Math.sin(t * 53 + i * 19.7) * 0.5 + 0.5) * height) | 0;
        const h = Math.max(4, Math.round((8 + (i % 3) * 10) * glitchIntensity));
        const shift = Math.sin(t * 91 + i * 7.3) * 28 * glitchIntensity;
        ctx.fillStyle = i % 2 === 0
          ? `rgba(34, 211, 238, ${(0.22 * glitchIntensity).toFixed(3)})`
          : `rgba(244, 63, 94, ${(0.24 * glitchIntensity).toFixed(3)})`;
        ctx.fillRect(shift, y, width, h);
      }
      ctx.restore();
    }
  };

  return { shakeX, shakeY, zoomBoost, overlayDraw };
}

/**
 * Shared 100% pixel-identical frame renderer used by BOTH Live Video Preview AND Exported .WebM Video.
 * Scales seamlessly from 720p to native 1080p Full HD with razor-sharp vector typography and overlays.
 */
export function renderVideoFrame({
  ctx,
  width: physicalWidth,
  height: physicalHeight,
  isPortrait,
  t,
  totalDuration,
  images,
  bgVideoEl,
  logoImg,
  slideDurationSec,
  title,
  subtitleTag,
  cues,
  freqData,
  styleConfig,
  watermark,
  outro,
  particleSeeds,
  timedSfxCues,
}: RenderVideoFrameParams): void {
  const width = isPortrait ? 720 : 1280;
  const height = isPortrait ? 1280 : 720;
  const scaleX = physicalWidth / width;
  const scaleY = physicalHeight / height;
  const progress = Math.min(1, Math.max(0, t / Math.max(0.5, totalDuration)));

  ctx.save();
  ctx.scale(scaleX, scaleY);

  // Compute sound-synced camera shake, lightning flash & horror RGB glitch
  const reactionFx = drawCinematicReactionFx(
    ctx,
    width,
    height,
    t,
    timedSfxCues,
    styleConfig.cinematicShakeFlash
  );

  // Apply camera shake / zoom punch to scene canvas
  ctx.save();
  if (reactionFx.shakeX !== 0 || reactionFx.shakeY !== 0 || reactionFx.zoomBoost !== 1) {
    ctx.translate(width / 2 + reactionFx.shakeX, height / 2 + reactionFx.shakeY);
    ctx.scale(reactionFx.zoomBoost, reactionFx.zoomBoost);
    ctx.translate(-width / 2, -height / 2);
  }

  // 1. Background: looping video clip OR multi-image crossfade slideshow OR dark studio gradient
  if (bgVideoEl && bgVideoEl.readyState >= 2) {
    ctx.fillStyle = '#070A12';
    ctx.fillRect(0, 0, width, height);
    drawCoverVideo(ctx, bgVideoEl, width, height);

    const vig = ctx.createLinearGradient(0, 0, 0, height);
    vig.addColorStop(0, 'rgba(6, 9, 17, 0.64)');
    vig.addColorStop(0.5, 'rgba(6, 9, 17, 0.28)');
    vig.addColorStop(1, 'rgba(6, 9, 17, 0.84)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  } else if (images.length > 0) {
    const effectiveSlideDur =
      slideDurationSec && slideDurationSec > 0
        ? slideDurationSec
        : totalDuration / images.length;
    const rawSlidePos = effectiveSlideDur > 0 ? t / effectiveSlideDur : 0;
    const slideSlot = Math.floor(rawSlidePos);
    const localProgress = rawSlidePos - slideSlot;
    const currIdx =
      slideDurationSec && slideDurationSec > 0
        ? slideSlot % images.length
        : Math.min(images.length - 1, slideSlot);
    const nextIdx =
      slideDurationSec && slideDurationSec > 0
        ? (slideSlot + 1) % images.length
        : Math.min(images.length - 1, currIdx + 1);

    const currZoom = 1.04 + 0.08 * localProgress;
    const currPan = (currIdx % 2 === 0 ? 1 : -1) * (localProgress * 2 - 1);

    ctx.fillStyle = '#070A12';
    ctx.fillRect(0, 0, width, height);
    drawCoverImage(ctx, images[currIdx], width, height, currZoom, currPan, 1);

    const fadeDurationSec = Math.min(0.85, effectiveSlideDur * 0.25);
    const timeRemainingInSlide = (1 - localProgress) * effectiveSlideDur;
    if (images.length > 1 && nextIdx !== currIdx && timeRemainingInSlide < fadeDurationSec) {
      const fadeAlpha = 1 - timeRemainingInSlide / Math.max(0.05, fadeDurationSec);
      const nextPan = (nextIdx % 2 === 0 ? 1 : -1) * -1;
      drawCoverImage(ctx, images[nextIdx], width, height, 1.04, nextPan, fadeAlpha);
    }

    const vig = ctx.createLinearGradient(0, 0, 0, height);
    vig.addColorStop(0, 'rgba(6, 9, 17, 0.72)');
    vig.addColorStop(0.45, 'rgba(6, 9, 17, 0.34)');
    vig.addColorStop(1, 'rgba(6, 9, 17, 0.88)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#090D18');
    bgGrad.addColorStop(0.5, '#131B2E');
    bgGrad.addColorStop(1, '#070A12');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const orbX = width * (0.5 + 0.2 * Math.cos(t * 0.5));
    const orbY = height * (0.38 + 0.08 * Math.sin(t * 0.7));
    const radial = ctx.createRadialGradient(orbX, orbY, 20, orbX, orbY, width * 0.6);
    radial.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
    radial.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Cinematic Weather / Particle Effect Overlay
  drawParticleOverlay(ctx, width, height, t, styleConfig.particleEffect, particleSeeds);

  // 3. Top Brand & Custom Title Header
  const cleanTag = (subtitleTag || '').trim();
  const cleanTitle = (title || '').trim();
  if (cleanTag || cleanTitle) {
    const topY = isPortrait ? 92 : 58;
    ctx.save();
    ctx.textAlign = 'center';
    let titleStartY = topY;
    if (cleanTag) {
      ctx.fillStyle = styleConfig.subtitleColor || '#f59e0b';
      ctx.font = `700 ${isPortrait ? 24 : 20}px "Hind Siliguri", system-ui, sans-serif`;
      ctx.fillText(cleanTag, width / 2, topY);
      titleStartY = topY + (isPortrait ? 44 : 38);
    }
    if (cleanTitle) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = `700 ${isPortrait ? 34 : 30}px "Hind Siliguri", system-ui, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 12;
      const titleLines = wrapCanvasLines(ctx, cleanTitle, width * 0.86).slice(0, 2);
      titleLines.forEach((line, i) => {
        ctx.fillText(line, width / 2, titleStartY + i * (isPortrait ? 42 : 36));
      });
    }
    ctx.restore();
  }

  // 4. Live reactive audio spectrum visualizer (bars / circular pulse ring / hidden)
  if (styleConfig.waveformStyle !== 'none') {
    const accent = styleConfig.subtitleColor || '#f59e0b';

    if (styleConfig.waveformStyle === 'circle') {
      const cx = width / 2;
      const cy = isPortrait ? height * 0.46 : height * 0.47;
      const baseR = isPortrait ? 95 : 78;
      const spokes = 48;

      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineCap = 'round';
      ctx.shadowColor = accent;
      ctx.shadowBlur = 14;
      for (let i = 0; i < spokes; i++) {
        const angle = (i / spokes) * Math.PI * 2 - Math.PI / 2;
        const bin = Math.min(freqData.length - 1, Math.floor((i / spokes) * 36));
        const norm = (freqData[bin] || 0) / 255;
        const len = 14 + norm * (isPortrait ? 78 : 56);
        const x1 = cx + Math.cos(angle) * baseR;
        const y1 = cy + Math.sin(angle) * baseR;
        const x2 = cx + Math.cos(angle) * (baseR + len);
        const y2 = cy + Math.sin(angle) * (baseR + len);
        ctx.lineWidth = isPortrait ? 5 : 4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      const barCount = isPortrait ? 32 : 44;
      const waveWidth = width * 0.76;
      const startX = (width - waveWidth) / 2;
      const barGap = waveWidth / barCount;
      const barW = Math.max(4, barGap * 0.56);
      const centerY = isPortrait ? height * 0.5 : height * 0.48;
      const maxBarH = isPortrait ? 190 : 130;

      ctx.save();
      for (let i = 0; i < barCount; i++) {
        const binIdx = Math.min(freqData.length - 1, Math.floor((i / barCount) * 40));
        const norm = (freqData[binIdx] || 0) / 255;
        const barH = Math.max(12, norm * maxBarH + Math.sin(t * 5 + i * 0.4) * 8 + 10);
        const x = startX + i * barGap;
        const y = centerY - barH / 2;
        const barGrad = ctx.createLinearGradient(0, y, 0, y + barH);
        barGrad.addColorStop(0, '#ffffff');
        barGrad.addColorStop(0.35, accent);
        barGrad.addColorStop(1, accent);
        ctx.fillStyle = barGrad;
        drawRoundedRect(ctx, x, y, barW, barH, barW / 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // 5. Burned-in active subtitle caption (Karaoke or Classic)
  const activeCue = cues.find((c) => t >= c.startSec && t <= c.endSec);
  drawSubtitleOverlay(ctx, width, height, activeCue, isPortrait, t, styleConfig);

  // 6. Optional Channel Logo / Watermark Overlay
  drawWatermarkOverlay(ctx, width, height, isPortrait, watermark, logoImg);

  // Close camera shake transform before HUD/Flash/Outro layers
  ctx.restore();

  // 6b. Sound-Synced Lightning Flash & Horror RGB Glitch Overlay
  reactionFx.overlayDraw();

  // 6c. Viral 3-Second Animated Hook Banner
  drawViralHookBanner(ctx, width, isPortrait, t, styleConfig);

  // 7. Animated Outro / Subscribe End-Card (final N seconds)
  drawOutroEndCard(
    ctx,
    width,
    height,
    isPortrait,
    t,
    totalDuration,
    outro,
    logoImg,
    styleConfig.subtitleColor || '#f59e0b'
  );

  // 8. Glowing Neon Retention Progress Bar (top or bottom)
  if (styleConfig.showRetentionBar !== false) {
    const barH = 9;
    const barY = styleConfig.retentionBarPosition === 'bottom' ? height - barH : 0;
    const accent = styleConfig.subtitleColor || '#f59e0b';
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(0, barY, width, barH);
    const barGrad = ctx.createLinearGradient(0, barY, Math.max(20, width * progress), barY);
    barGrad.addColorStop(0, accent);
    barGrad.addColorStop(1, '#ffffff');
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, barY, width * progress, barH);
    ctx.restore();
  }

  ctx.restore();
}

function pickBestRealtimeVideoMime(): string {
  // Prioritize fast real-time H.264 (native MP4 or WebM) and VP8 over slow software VP9.
  // Software VP9 at 1080p frequently stalls real-time MediaRecorder and drops frames down to 1-2 frames!
  const mimeCandidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/mp4',
    'video/webm',
  ];
  return mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';
}

function mountHiddenExportCanvas(canvas: HTMLCanvasElement): () => void {
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.width = '2px';
  canvas.style.height = '2px';
  canvas.style.opacity = '0.005';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '-1';
  document.body.appendChild(canvas);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    try {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    } catch {
      // Ignore cleanup error
    }
  };
}

function createReliableFramePump(targetFps: number, onTick: () => void) {
  let running = false;
  let rafId = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let lastDrawMs = 0;
  const minIntervalMs = Math.max(12, Math.floor(1000 / Math.max(15, targetFps)) - 2);

  const safeTick = () => {
    if (!running) return;
    const now = performance.now();
    if (now - lastDrawMs < minIntervalMs) return;
    lastDrawMs = now;
    try {
      onTick();
    } catch (err) {
      console.error('Export frame render error:', err);
    }
  };

  const rafLoop = () => {
    if (!running) return;
    safeTick();
    rafId = requestAnimationFrame(rafLoop);
  };

  return {
    start() {
      if (running) return;
      running = true;
      lastDrawMs = 0;
      safeTick();
      rafId = requestAnimationFrame(rafLoop);
      // Fallback interval keeps frames pumping reliably even if tab loses focus or rAF throttles
      intervalId = setInterval(safeTick, Math.max(16, Math.round(1000 / Math.min(targetFps, 30))));
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}

/**
 * Renders a ready-to-upload Shorts/Reels (9:16) or YouTube (16:9) video with all pro effects,
 * timed inline SFX cues, BGM, particles, karaoke subtitles, watermark, and animated Outro End-Card.
 */
export async function exportReelsVideoWithSubtitles({
  audioBlobUrl,
  cues,
  title,
  subtitleTag,
  aspect = '9:16',
  imageUrls = [],
  backgroundVideoUrl = null,
  slideDurationSec = 0,
  styleConfig = DEFAULT_VIDEO_STYLE,
  bgmConfig,
  watermark,
  outro,
  timedSfxCues = [],
  onProgress,
}: {
  audioBlobUrl: string;
  cues: SubtitleCue[];
  title: string;
  subtitleTag?: string;
  aspect?: VideoAspect;
  imageUrls?: string[];
  backgroundVideoUrl?: string | null;
  slideDurationSec?: number;
  styleConfig?: VideoStyleConfig;
  bgmConfig?: BgmMixConfig;
  watermark?: WatermarkConfig;
  outro?: OutroCardConfig;
  timedSfxCues?: TimedSfxCue[];
  onProgress?: (percent: number) => void;
}): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('আপনার ব্রাউজারে ভিডিও এক্সপোর্ট (MediaRecorder) সমর্থিত নয়।');
  }

  const isPortrait = aspect === '9:16';
  const quality = styleConfig.qualityPreset || '1080p30';
  const isFullHd = quality === '1080p30' || quality === '1080p60';
  const targetFps = quality === '1080p60' ? 60 : 30;
  const targetBitrate =
    quality === '1080p60'
      ? 8_000_000
      : quality === '1080p30'
      ? 6_000_000
      : isPortrait
      ? 2_800_000
      : 3_200_000;
  const width = isPortrait ? (isFullHd ? 1080 : 720) : isFullHd ? 1920 : 1280;
  const height = isPortrait ? (isFullHd ? 1920 : 1280) : isFullHd ? 1080 : 720;

  const [images, logoImg] = await Promise.all([
    backgroundVideoUrl ? Promise.resolve([]) : loadOptionalImages(imageUrls),
    loadOptionalSingleImage(watermark?.logoUrl),
  ]);

  let bgVideoEl: HTMLVideoElement | null = null;
  if (backgroundVideoUrl) {
    bgVideoEl = document.createElement('video');
    bgVideoEl.src = backgroundVideoUrl;
    bgVideoEl.muted = true;
    bgVideoEl.loop = true;
    bgVideoEl.playsInline = true;
    bgVideoEl.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      bgVideoEl!.onloadeddata = () => resolve();
      bgVideoEl!.onerror = () => {
        bgVideoEl = null;
        resolve();
      };
    });
  }

  const audioEl = document.createElement('audio');
  audioEl.src = audioBlobUrl;
  audioEl.crossOrigin = 'anonymous';
  audioEl.preload = 'auto';

  await new Promise<void>((resolve, reject) => {
    audioEl.onloadedmetadata = () => resolve();
    audioEl.onerror = () => reject(new Error('অডিও ফাইল লোড করা যায়নি।'));
  });

  const totalDuration = Math.max(1, audioEl.duration || 10);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('ক্যানভাস তৈরি করা যায়নি।');

  // Keep canvas GPU-mounted during capture so Chromium/Android never suspend frame push
  const unmountCanvas = mountHiddenExportCanvas(canvas);

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const sourceNode = audioCtx.createMediaElementSource(audioEl);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 128;
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  const dest = audioCtx.createMediaStreamDestination();
  sourceNode.connect(analyser);
  analyser.connect(dest);

  let bgmHandle: ActiveBgmHandle | null = null;
  const particleSeeds = createParticleSeeds(96);

  const renderAtTime = (tSec: number) => {
    const safeT = Math.max(0, Math.min(totalDuration, Number.isFinite(tSec) ? tSec : 0));
    const progress = Math.min(1, safeT / totalDuration);
    onProgress?.(Math.min(99, Math.round(progress * 100)));
    analyser.getByteFrequencyData(freqData);

    renderVideoFrame({
      ctx,
      width,
      height,
      isPortrait,
      t: safeT,
      totalDuration,
      images,
      bgVideoEl,
      logoImg,
      slideDurationSec,
      title,
      subtitleTag,
      cues,
      freqData,
      styleConfig,
      watermark,
      outro,
      particleSeeds,
      timedSfxCues,
    });
  };

  // Pre-draw Frame 0 before starting captureStream & MediaRecorder so t=0 keyframe is instant
  renderAtTime(0);

  const canvasStream = canvas.captureStream(targetFps);
  const videoTrack = canvasStream.getVideoTracks()[0] as any;
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const chosenMime = pickBestRealtimeVideoMime();

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: chosenMime,
    videoBitsPerSecond: targetBitrate,
    audioBitsPerSecond: 192_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const pushFrame = (forcedTime?: number) => {
    renderAtTime(forcedTime !== undefined ? forcedTime : audioEl.currentTime || 0);
    if (videoTrack && typeof videoTrack.requestFrame === 'function') {
      try {
        videoTrack.requestFrame();
      } catch {
        // Ignore if track already stopped
      }
    }
  };

  const framePump = createReliableFramePump(targetFps, () => pushFrame());

  return await new Promise<Blob>((resolve, reject) => {
    let cleanedUp = false;
    const cleanupAll = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      framePump.stop();
      audioEl.pause();
      if (bgVideoEl) bgVideoEl.pause();
      if (bgmHandle) {
        bgmHandle.stop();
        bgmHandle = null;
      }
      canvasStream.getTracks().forEach((tr) => tr.stop());
      unmountCanvas();
      audioCtx.close().catch(() => {});
    };

    recorder.onstop = () => {
      cleanupAll();
      onProgress?.(100);
      resolve(new Blob(chunks, { type: chosenMime }));
    };
    recorder.onerror = () => {
      cleanupAll();
      reject(new Error('ভিডিও রেন্ডার করতে সমস্যা হয়েছে।'));
    };
    audioEl.onended = () => {
      pushFrame(totalDuration);
      if (recorder.state !== 'inactive') {
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 160);
      }
    };

    audioCtx
      .resume()
      .then(() => {
        // 1. Start BGM bed
        if (bgmConfig && bgmConfig.mood !== 'none') {
          bgmHandle = startBgmInContext(audioCtx, dest, bgmConfig);
        }

        // 2. Schedule exact inline script [SFX] cues at their exact spoken moments
        if (timedSfxCues && timedSfxCues.length > 0) {
          timedSfxCues.forEach((cue) => {
            const delay = Math.max(0.08, Math.min(totalDuration - 0.5, cue.timeSec));
            triggerSfxAt(audioCtx, dest, cue.sfxId, audioCtx.currentTime + delay, 0.58);
          });
        }

        // 3. Schedule general SFX accents selected in the BGM/SFX mixer tab
        if (bgmConfig?.sfxList && bgmConfig.sfxList.length > 0) {
          const sfxCount = bgmConfig.sfxList.length;
          bgmConfig.sfxList.forEach((sfx, idx) => {
            const delaySec =
              idx === 0
                ? 0.35
                : Math.min(totalDuration - 1.2, (totalDuration / (sfxCount + 0.5)) * (idx + 0.35));
            if (delaySec >= 0) {
              triggerSfxAt(audioCtx, dest, sfx, audioCtx.currentTime + delaySec, 0.5);
            }
          });
        }

        recorder.start(250);
        pushFrame(0);
        framePump.start();

        if (bgVideoEl) {
          bgVideoEl.currentTime = 0;
          bgVideoEl.play().catch(() => {});
        }
        audioEl.play().catch((err) => {
          cleanupAll();
          if (recorder.state !== 'inactive') recorder.stop();
          reject(new Error('ভিডিও এক্সপোর্ট শুরু করা যায়নি: ' + (err?.message || 'Playback error')));
        });
      })
      .catch((err) => {
        cleanupAll();
        reject(new Error('অডিও ইঞ্জিন চালু করা যায়নি: ' + (err?.message || 'AudioContext error')));
      });
  });
}

/**
 * Renders an uploaded video merged with the new dubbed AI audio, optional burned-in subtitles,
 * particles, BGM, watermark, and Outro End-Card!
 */
export async function exportDubbedVideoWithSubtitles(
  videoUrl: string,
  dubbedAudioUrl: string,
  cues: SubtitleCue[],
  includeSubtitles: boolean,
  onProgress?: (percent: number) => void,
  styleConfig: VideoStyleConfig = DEFAULT_VIDEO_STYLE,
  watermark?: WatermarkConfig,
  bgmConfig?: BgmMixConfig,
  outro?: OutroCardConfig
): Promise<Blob> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('আপনার ব্রাউজারে ভিডিও এক্সপোর্ট সমর্থিত নয়।');
  }

  const logoImg = await loadOptionalSingleImage(watermark?.logoUrl);

  const videoEl = document.createElement('video');
  videoEl.src = videoUrl;
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.crossOrigin = 'anonymous';

  const audioEl = document.createElement('audio');
  audioEl.src = dubbedAudioUrl;
  audioEl.crossOrigin = 'anonymous';

  await Promise.all([
    new Promise<void>((resolve, reject) => {
      videoEl.onloadedmetadata = () => resolve();
      videoEl.onerror = () => reject(new Error('ভিডিও লোড করা যায়নি।'));
    }),
    new Promise<void>((resolve, reject) => {
      audioEl.onloadedmetadata = () => resolve();
      audioEl.onerror = () => reject(new Error('ডাবিং অডিও লোড করা যায়নি।'));
    }),
  ]);

  const quality = styleConfig.qualityPreset || '1080p30';
  const maxDim = quality === '720p30' ? 1280 : 1920;
  const rawW = videoEl.videoWidth || 1280;
  const rawH = videoEl.videoHeight || 720;
  const downScale = Math.min(1, maxDim / Math.max(rawW, rawH));
  const width = Math.max(2, Math.round((rawW * downScale) / 2) * 2);
  const height = Math.max(2, Math.round((rawH * downScale) / 2) * 2);
  const isPortrait = height > width;
  const targetFps = quality === '1080p60' ? 60 : 30;
  const targetBitrate = quality === '1080p60' ? 8_000_000 : quality === '1080p30' ? 6_000_000 : 3_000_000;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('ক্যানভাস তৈরি করা যায়নি।');

  const unmountCanvas = mountHiddenExportCanvas(canvas);

  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const audioSource = audioCtx.createMediaElementSource(audioEl);
  const audioDest = audioCtx.createMediaStreamDestination();
  audioSource.connect(audioDest);

  let bgmHandle: ActiveBgmHandle | null = null;
  const particleSeeds = createParticleSeeds(96);
  const targetDuration = Math.max(audioEl.duration || 1, videoEl.duration || 1);

  const drawDubbedAt = (forcedTime?: number) => {
    try {
      ctx.drawImage(videoEl, 0, 0, width, height);
    } catch {
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, width, height);
    }
    const rawT = forcedTime !== undefined ? forcedTime : audioEl.currentTime || videoEl.currentTime || 0;
    const t = Math.max(0, Math.min(targetDuration, Number.isFinite(rawT) ? rawT : 0));
    drawParticleOverlay(ctx, width, height, t, styleConfig.particleEffect, particleSeeds);
    if (includeSubtitles && cues.length > 0) {
      const activeCue = cues.find((c) => t >= c.startSec && t <= c.endSec);
      drawSubtitleOverlay(ctx, width, height, activeCue, isPortrait, t, styleConfig);
    }
    drawWatermarkOverlay(ctx, width, height, isPortrait, watermark, logoImg);
    drawOutroEndCard(
      ctx,
      width,
      height,
      isPortrait,
      t,
      targetDuration,
      outro,
      logoImg,
      styleConfig.subtitleColor || '#f59e0b'
    );
    onProgress?.(Math.min(99, Math.round((t / targetDuration) * 100)));
  };

  drawDubbedAt(0);

  const canvasStream = canvas.captureStream(targetFps);
  const videoTrack = canvasStream.getVideoTracks()[0] as any;
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  const chosenMime = pickBestRealtimeVideoMime();

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: chosenMime,
    videoBitsPerSecond: targetBitrate,
    audioBitsPerSecond: 192_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const pushDubbedFrame = (forcedTime?: number) => {
    drawDubbedAt(forcedTime);
    if (videoTrack && typeof videoTrack.requestFrame === 'function') {
      try {
        videoTrack.requestFrame();
      } catch {
        // Ignore if track stopped
      }
    }
  };

  const framePump = createReliableFramePump(targetFps, () => pushDubbedFrame());

  return await new Promise<Blob>((resolve, reject) => {
    let finished = false;
    const cleanupResources = () => {
      framePump.stop();
      videoEl.pause();
      audioEl.pause();
      if (bgmHandle) {
        bgmHandle.stop();
        bgmHandle = null;
      }
      canvasStream.getTracks().forEach((tr) => tr.stop());
      unmountCanvas();
      audioCtx.close().catch(() => {});
    };

    const stopAll = () => {
      if (finished) return;
      finished = true;
      pushDubbedFrame(targetDuration);
      framePump.stop();
      videoEl.pause();
      audioEl.pause();
      if (bgmHandle) {
        bgmHandle.stop();
        bgmHandle = null;
      }
      if (recorder.state !== 'inactive') {
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 160);
      }
    };

    recorder.onstop = () => {
      cleanupResources();
      onProgress?.(100);
      resolve(new Blob(chunks, { type: chosenMime }));
    };
    recorder.onerror = () => {
      cleanupResources();
      reject(new Error('ভিডিও এক্সপোর্ট করতে সমস্যা হয়েছে।'));
    };

    audioEl.onended = stopAll;
    videoEl.onended = () => {
      if (audioEl.ended || audioEl.currentTime >= (audioEl.duration || 0) - 0.25) {
        stopAll();
      }
    };

    audioCtx
      .resume()
      .then(() => {
        if (bgmConfig && bgmConfig.mood !== 'none') {
          bgmHandle = startBgmInContext(audioCtx, audioDest, bgmConfig);
        }
        recorder.start(250);
        pushDubbedFrame(0);
        framePump.start();
        Promise.all([videoEl.play(), audioEl.play()]).catch((err) => {
          stopAll();
          reject(new Error('ভিডিও প্লেব্যাক শুরু হয়নি: ' + (err?.message || 'Error')));
        });
      })
      .catch((err) => {
        cleanupResources();
        reject(new Error('অডিও ইঞ্জিন চালু করা যায়নি: ' + (err?.message || 'AudioContext error')));
      });
  });
}

/**
 * Converts a WebM (or other browser-recorded) video Blob into a genuine universal H.264 + AAC .MP4
 * via the server's FFmpeg route. If the input blob is already native video/mp4, returns it directly.
 */
export async function convertVideoBlobToMp4(blob: Blob, fps: number = 30): Promise<Blob> {
  if ((blob.type || '').toLowerCase().includes('mp4')) {
    return blob;
  }
  const safeFps = fps === 60 ? 60 : 30;
  const resp = await fetch(`/api/video/convert-mp4?fps=${safeFps}`, {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'video/webm',
    },
    body: blob,
  });
  if (!resp.ok) {
    let errMsg = 'MP4 কনভার্ট করতে সমস্যা হয়েছে।';
    try {
      const data = await resp.json();
      if (data?.error) errMsg = data.error;
    } catch {
      // Ignore parse error
    }
    throw new Error(errMsg);
  }
  const arrayBuf = await resp.arrayBuffer();
  return new Blob([arrayBuf], { type: 'video/mp4' });
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
