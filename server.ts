import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { MPEGDecoder } from 'mpg123-decoder';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePort(): number {
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = Number(process.argv[portArgIndex + 1]);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const envPort = Number(process.env.PORT);
  const nginxPort = Number(process.env.NGINX_PORT);

  // In dev mode, never collide with the container's nginx reverse-proxy port (e.g. 8080).
  if (!isProd && envPort && envPort === nginxPort) {
    return Number(process.env.DEFAULT_APP_PORT) || 3000;
  }

  return envPort || Number(process.env.DEFAULT_APP_PORT) || 3000;
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = resolvePort();

  app.use(express.json({ limit: '25mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  // Track temporary 429 quota cooldowns per TTS model so subsequent calls skip rate-limited models immediately
  const modelCooldowns: Record<string, number> = {};

  const TTS_MODEL_META: Array<{ id: string; label: string; freeDailyLimit: number | null }> = [
    { id: 'gemini-3.8-flash-tts', label: 'Gemini 3.8 Flash TTS', freeDailyLimit: 10 },
    { id: 'gemini-3.8-flash-lite-tts', label: 'Gemini 3.8 Flash Lite TTS', freeDailyLimit: null },
    { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS', freeDailyLimit: null },
    { id: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS', freeDailyLimit: null },
    { id: 'free-neural-bn', label: 'Bangla Neural TTS (Free)', freeDailyLimit: null },
  ];

  interface DailyModelUsage {
    requests: number;
    exhaustedToday: boolean;
    lastSuccessAt?: string;
    lastError?: string;
  }

  interface DailyUsageStore {
    date: string;
    totalVoiceovers: number;
    totalAudioSeconds: number;
    totalCharacters: number;
    lastModelUsed?: string;
    lastUpdatedAt?: string;
    models: Record<string, DailyModelUsage>;
  }

  const USAGE_FILE = path.join(os.tmpdir(), 'kasasul_tts_usage.json');

  function createEmptyUsage(date: string): DailyUsageStore {
    const models: Record<string, DailyModelUsage> = {};
    for (const m of TTS_MODEL_META) {
      models[m.id] = { requests: 0, exhaustedToday: false };
    }
    return {
      date,
      totalVoiceovers: 0,
      totalAudioSeconds: 0,
      totalCharacters: 0,
      models,
    };
  }

  function loadDailyUsage(): DailyUsageStore {
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (fs.existsSync(USAGE_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
        if (parsed && parsed.date === today) {
          for (const m of TTS_MODEL_META) {
            if (!parsed.models[m.id]) {
              parsed.models[m.id] = { requests: 0, exhaustedToday: false };
            }
          }
          return parsed;
        }
      }
    } catch {
      // Ignore corrupt usage file and start fresh for today
    }
    return createEmptyUsage(today);
  }

  let dailyUsage: DailyUsageStore = loadDailyUsage();

  function getCurrentDailyUsage(): DailyUsageStore {
    const today = new Date().toISOString().slice(0, 10);
    if (dailyUsage.date !== today) {
      dailyUsage = createEmptyUsage(today);
    }
    return dailyUsage;
  }

  function persistDailyUsage() {
    try {
      fs.writeFileSync(USAGE_FILE, JSON.stringify(dailyUsage, null, 2), 'utf8');
    } catch {
      // Ignore non-critical disk write failure
    }
  }

  function recordModelRequestSuccess(modelId: string) {
    const store = getCurrentDailyUsage();
    if (!store.models[modelId]) {
      store.models[modelId] = { requests: 0, exhaustedToday: false };
    }
    store.models[modelId].requests += 1;
    store.models[modelId].exhaustedToday = false;
    store.models[modelId].lastSuccessAt = new Date().toISOString();
    store.lastModelUsed = modelId;
    store.lastUpdatedAt = new Date().toISOString();
    persistDailyUsage();
  }

  function recordModelQuotaExhausted(modelId: string, reason?: string) {
    const store = getCurrentDailyUsage();
    if (!store.models[modelId]) {
      store.models[modelId] = { requests: 0, exhaustedToday: true, lastError: reason };
    } else {
      store.models[modelId].exhaustedToday = true;
      if (reason) store.models[modelId].lastError = reason;
    }
    store.lastUpdatedAt = new Date().toISOString();
    persistDailyUsage();
  }

  function recordVoiceoverCompleted(durationSec: number, charCount: number) {
    const store = getCurrentDailyUsage();
    store.totalVoiceovers += 1;
    store.totalAudioSeconds += Math.max(0, Math.round(durationSec));
    store.totalCharacters += Math.max(0, charCount);
    store.lastUpdatedAt = new Date().toISOString();
    persistDailyUsage();
  }

  function buildUsagePayload() {
    const store = getCurrentDailyUsage();
    const now = Date.now();
    return {
      date: store.date,
      totalVoiceovers: store.totalVoiceovers,
      totalAudioSeconds: store.totalAudioSeconds,
      totalCharacters: store.totalCharacters,
      lastModelUsed: store.lastModelUsed,
      lastUpdatedAt: store.lastUpdatedAt,
      models: TTS_MODEL_META.map((m) => {
        const stat = store.models[m.id] || { requests: 0, exhaustedToday: false };
        const inCooldown = now < (modelCooldowns[m.id] || 0);
        return {
          id: m.id,
          label: m.label,
          requestsToday: stat.requests,
          freeDailyLimit: m.freeDailyLimit,
          exhaustedToday: stat.exhaustedToday || inCooldown,
          lastSuccessAt: stat.lastSuccessAt,
          lastError: stat.lastError,
        };
      }),
    };
  }

  // Daily TTS Usage endpoint
  app.get('/api/tts/usage', (req, res) => {
    res.json(buildUsagePayload());
  });

  function isQuotaError(err: any): boolean {
    const msg = err?.message || '';
    return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || err?.status === 429;
  }

  function parseRetryDelaySeconds(err: any): number | null {
    const msg = String(err?.message || '');
    const match = msg.match(/retryDelay["']?\s*:\s*["']?(\d+(?:\.\d+)?)s/i) || msg.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
    if (match) {
      const sec = Math.ceil(parseFloat(match[1]));
      return Number.isFinite(sec) ? sec : null;
    }
    return null;
  }

  function parseSampleRateFromMime(mimeType?: string): number {
    if (!mimeType) return 24000;
    const match = mimeType.match(/rate=(\d+)/i);
    if (match) {
      const rate = parseInt(match[1], 10);
      if (Number.isFinite(rate) && rate >= 8000 && rate <= 96000) return rate;
    }
    return 24000;
  }

  function wrapPcmAsWav(pcm: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
    const bytesPerSample = bitsPerSample / 8;
    const byteRate = sampleRate * numChannels * bytesPerSample;
    const blockAlign = numChannels * bytesPerSample;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
  }

  function ensureWavBuffer(buf: Buffer, mimeType?: string): Buffer {
    if (
      buf.length >= 44 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WAVE'
    ) {
      return buf;
    }
    const sampleRate = parseSampleRateFromMime(mimeType);
    return wrapPcmAsWav(buf, sampleRate, 1, 16);
  }

  function wsolaTimeStretchPcm16(pcm: Buffer, stretch: number): Buffer {
    const len = Math.floor(pcm.length / 2);
    if (len < 4096 || Math.abs(stretch - 1) < 0.01) return pcm;

    const input = new Float32Array(len);
    for (let i = 0; i < len; i++) input[i] = pcm.readInt16LE(i * 2);

    const overlap = 512;
    const winSize = 1024;
    const hopOut = 512;
    const searchRadius = 128;
    const stretchLen = Math.max(winSize, Math.round(len * stretch));
    const stretched = new Float32Array(stretchLen + winSize);

    for (let j = 0; j < winSize && j < len; j++) stretched[j] = input[j];

    for (let outPos = hopOut; outPos + winSize <= stretchLen; outPos += hopOut) {
      const idealIn = Math.round(outPos / stretch);
      const minIn = Math.max(0, idealIn - searchRadius);
      const maxIn = Math.min(len - winSize, idealIn + searchRadius);
      let bestIn = Math.max(0, Math.min(len - winSize, idealIn));
      let bestScore = -Infinity;

      for (let cand = minIn; cand <= maxIn; cand += 4) {
        let dot = 0;
        let energy = 1e-6;
        for (let j = 0; j < overlap; j += 4) {
          const a = stretched[outPos + j];
          const b = input[cand + j];
          dot += a * b;
          energy += b * b;
        }
        const score = dot / Math.sqrt(energy);
        if (score > bestScore) {
          bestScore = score;
          bestIn = cand;
        }
      }

      for (let j = 0; j < overlap; j++) {
        const alpha = j / overlap;
        stretched[outPos + j] = stretched[outPos + j] * (1 - alpha) + input[bestIn + j] * alpha;
      }
      for (let j = overlap; j < winSize; j++) {
        stretched[outPos + j] = input[bestIn + j];
      }
    }

    const out = Buffer.alloc(stretchLen * 2);
    for (let i = 0; i < stretchLen; i++) {
      const clamped = Math.max(-32768, Math.min(32767, Math.round(stretched[i])));
      out.writeInt16LE(clamped, i * 2);
    }
    return out;
  }

  function matchWavDuration(
    wavBuffer: Buffer,
    targetDurationSec: number
  ): { wavBuffer: Buffer; durationSec: number } {
    const { pcm, sampleRate, numChannels, bitsPerSample } = extractPcmFromWav(wavBuffer);
    const bytesPerSec = sampleRate * numChannels * (bitsPerSample / 8);
    if (bitsPerSample !== 16 || numChannels !== 1 || bytesPerSec <= 0 || targetDurationSec <= 0.5) {
      return { wavBuffer, durationSec: bytesPerSec > 0 ? pcm.length / bytesPerSec : 0 };
    }

    const currentSec = pcm.length / bytesPerSec;
    if (Math.abs(targetDurationSec - currentSec) < 0.35) {
      return { wavBuffer, durationSec: currentSec };
    }

    // Clamp WSOLA stretch to [0.78, 1.28] so speech remains completely natural without robotic artifacts
    const rawRatio = targetDurationSec / currentSec;
    const safeRatio = Math.max(0.78, Math.min(1.28, rawRatio));
    let adjustedPcm = wsolaTimeStretchPcm16(pcm, safeRatio);

    // If still slightly shorter than targetDurationSec after safe stretch, pad gentle trailing silence
    const targetBytes = Math.round(targetDurationSec * bytesPerSec) & ~1;
    if (adjustedPcm.length < targetBytes && targetBytes - adjustedPcm.length <= bytesPerSec * 12) {
      const pad = Buffer.alloc(targetBytes - adjustedPcm.length);
      adjustedPcm = Buffer.concat([adjustedPcm, pad]);
    }

    const finalWav = wrapPcmAsWav(adjustedPcm, sampleRate, numChannels, bitsPerSample);
    return {
      wavBuffer: finalWav,
      durationSec: adjustedPcm.length / bytesPerSec,
    };
  }

  function pitchShiftPcm16(pcm: Buffer, pitchFactor = 1.18): Buffer {
    const len = Math.floor(pcm.length / 2);
    if (len < 4096 || Math.abs(pitchFactor - 1) < 0.01) return pcm;

    const stretchedBuf = wsolaTimeStretchPcm16(pcm, pitchFactor);
    const stretchLen = Math.floor(stretchedBuf.length / 2);

    const out = Buffer.alloc(len * 2);
    for (let i = 0; i < len; i++) {
      const srcIdx = i * pitchFactor;
      const idx0 = Math.min(stretchLen - 1, Math.floor(srcIdx));
      const idx1 = Math.min(stretchLen - 1, idx0 + 1);
      const frac = srcIdx - idx0;
      const s0 = stretchedBuf.readInt16LE(idx0 * 2);
      const s1 = stretchedBuf.readInt16LE(idx1 * 2);
      const val = s0 * (1 - frac) + s1 * frac;
      const clamped = Math.max(-32768, Math.min(32767, Math.round(val)));
      out.writeInt16LE(clamped, i * 2);
    }
    return out;
  }

  function applyPeakingBiquad(
    samples: Float32Array,
    sampleRate: number,
    freq: number,
    q: number,
    gainDb: number
  ): void {
    const a = Math.pow(10, gainDb / 40);
    const omega = (2 * Math.PI * freq) / sampleRate;
    const sinW = Math.sin(omega);
    const cosW = Math.cos(omega);
    const alpha = sinW / (2 * q);

    const b0 = 1 + alpha * a;
    const b1 = -2 * cosW;
    const b2 = 1 - alpha * a;
    const a0 = 1 + alpha / a;
    const a1 = -2 * cosW;
    const a2 = 1 - alpha / a;

    const nb0 = b0 / a0;
    const nb1 = b1 / a0;
    const nb2 = b2 / a0;
    const na1 = a1 / a0;
    const na2 = a2 / a0;

    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;

    for (let i = 0; i < samples.length; i++) {
      const x0 = samples[i];
      const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
      samples[i] = y0;
    }
  }

  function applyDubbingCompressor(samples: Float32Array, sampleRate: number): void {
    const threshold = Math.pow(10, -18 / 20);
    const ratio = 3;
    const attackCoeff = Math.exp(-1 / (0.01 * sampleRate));
    const releaseCoeff = Math.exp(-1 / (0.08 * sampleRate));
    let env = 0;

    for (let i = 0; i < samples.length; i++) {
      const absVal = Math.abs(samples[i]);
      env = absVal > env
        ? attackCoeff * env + (1 - attackCoeff) * absVal
        : releaseCoeff * env + (1 - releaseCoeff) * absVal;

      let gain = 1;
      if (env > threshold) {
        const compressed = threshold + (env - threshold) / ratio;
        gain = compressed / env;
      }
      // Subtle makeup gain for punchy cartoon dubbing presence
      samples[i] = samples[i] * gain * 1.18;
    }
  }

  function applyOggyVoiceEffect(wavBuffer: Buffer): Buffer {
    const { pcm, sampleRate, numChannels, bitsPerSample } = extractPcmFromWav(wavBuffer);
    if (bitsPerSample !== 16 || numChannels !== 1 || pcm.length < 8192) {
      return wavBuffer;
    }

    // Warm baritone shift + pure-TS cartoon dubbing booth EQ & compression
    const warmPcm = pitchShiftPcm16(pcm, 0.96);
    const count = Math.floor(warmPcm.length / 2);
    const floatBuf = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      floatBuf[i] = warmPcm.readInt16LE(i * 2) / 32768;
    }

    applyPeakingBiquad(floatBuf, sampleRate, 170, 1.0, 3.5);
    applyPeakingBiquad(floatBuf, sampleRate, 950, 1.1, 4.0);
    applyPeakingBiquad(floatBuf, sampleRate, 2400, 1.1, 2.0);
    applyDubbingCompressor(floatBuf, sampleRate);

    const outPcm = Buffer.alloc(count * 2);
    for (let i = 0; i < count; i++) {
      const s = Math.max(-1, Math.min(1, floatBuf[i]));
      outPcm.writeInt16LE(Math.round(s * 32767), i * 2);
    }
    return wrapPcmAsWav(outPcm, sampleRate, numChannels, bitsPerSample);
  }

  function applyBabyGirlVoiceEffect(wavBuffer: Buffer, pitchFactor = 1.12): Buffer {
    const { pcm, sampleRate, numChannels, bitsPerSample } = extractPcmFromWav(wavBuffer);
    if (bitsPerSample !== 16 || numChannels !== 1 || pcm.length < 8192) {
      return wavBuffer;
    }

    // Gentle sweet toddler-girl lift + silky warm EQ (keeps natural baby acting real, never metallic/robotic)
    const cutePcm = pitchFactor > 1.01 ? pitchShiftPcm16(pcm, pitchFactor) : pcm;
    const count = Math.floor(cutePcm.length / 2);
    const floatBuf = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      floatBuf[i] = cutePcm.readInt16LE(i * 2) / 32768;
    }

    applyPeakingBiquad(floatBuf, sampleRate, 320, 0.9, 2.2);
    applyPeakingBiquad(floatBuf, sampleRate, 1650, 1.0, 1.8);
    applyPeakingBiquad(floatBuf, sampleRate, 5000, 0.9, -4.2);
    applyDubbingCompressor(floatBuf, sampleRate);

    // Smooth peak normalization so delicate baby-girl syllables never hard-clip
    let peak = 0;
    for (let i = 0; i < count; i++) {
      const a = Math.abs(floatBuf[i]);
      if (a > peak) peak = a;
    }
    const normScale = peak > 0.9 ? 0.9 / peak : 1;

    const outPcm = Buffer.alloc(count * 2);
    for (let i = 0; i < count; i++) {
      const s = Math.max(-1, Math.min(1, floatBuf[i] * normScale));
      outPcm.writeInt16LE(Math.round(s * 32767), i * 2);
    }
    return wrapPcmAsWav(outPcm, sampleRate, numChannels, bitsPerSample);
  }

  function applyThanosVoiceEffect(wavBuffer: Buffer, pitchFactor = 0.80): Buffer {
    const { pcm, sampleRate, numChannels, bitsPerSample } = extractPcmFromWav(wavBuffer);
    if (bitsPerSample !== 16 || numChannels !== 1 || pcm.length < 8192) {
      return wavBuffer;
    }

    // Massive cosmic titan pitch drop + booming sub-bass chest resonance + dark cinematic cavern echo
    const deepPcm = pitchShiftPcm16(pcm, pitchFactor);
    const count = Math.floor(deepPcm.length / 2);
    const floatBuf = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      floatBuf[i] = deepPcm.readInt16LE(i * 2) / 32768;
    }

    // Sub-bass boom + scooped low-mid dread + menacing gravelly presence
    applyPeakingBiquad(floatBuf, sampleRate, 95, 0.85, 6.5);
    applyPeakingBiquad(floatBuf, sampleRate, 185, 1.0, 4.2);
    applyPeakingBiquad(floatBuf, sampleRate, 560, 1.1, -3.2);
    applyPeakingBiquad(floatBuf, sampleRate, 2600, 1.1, 3.2);

    // Subtle dark ominous theater cavern echo (low-passed multi-tap delay)
    const tap1 = Math.round(sampleRate * 0.058);
    const tap2 = Math.round(sampleRate * 0.125);
    const tap3 = Math.round(sampleRate * 0.215);
    const wetBuf = new Float32Array(count);
    let lpState = 0;
    const lpAlpha = 0.28; // dark low-pass on echo tail so it sounds deep & spooky, not metallic
    for (let i = 0; i < count; i++) {
      const e1 = i >= tap1 ? floatBuf[i - tap1] * 0.22 : 0;
      const e2 = i >= tap2 ? floatBuf[i - tap2] * 0.14 : 0;
      const e3 = i >= tap3 ? floatBuf[i - tap3] * 0.08 : 0;
      const rawEcho = e1 + e2 + e3;
      lpState = lpState + lpAlpha * (rawEcho - lpState);
      wetBuf[i] = floatBuf[i] * 0.92 + lpState;
    }

    applyDubbingCompressor(wetBuf, sampleRate);

    // Soft tanh saturation for monstrous cinematic growl & loudness without harsh clipping
    const outPcm = Buffer.alloc(count * 2);
    for (let i = 0; i < count; i++) {
      const driven = Math.tanh(wetBuf[i] * 1.25);
      const clamped = Math.max(-1, Math.min(1, driven));
      outPcm.writeInt16LE(Math.round(clamped * 32767), i * 2);
    }
    return wrapPcmAsWav(outPcm, sampleRate, numChannels, bitsPerSample);
  }

  function normalizeFloatBuffer(samples: Float32Array, targetPeak = 0.90): void {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const a = Math.abs(samples[i]);
      if (a > peak) peak = a;
    }
    if (peak > targetPeak && peak > 0.0001) {
      const scale = targetPeak / peak;
      for (let i = 0; i < samples.length; i++) {
        samples[i] *= scale;
      }
    }
  }

  function applyHorrorGhostVoiceEffect(wavBuffer: Buffer): Buffer {
    const { pcm, sampleRate, numChannels, bitsPerSample } = extractPcmFromWav(wavBuffer);
    if (bitsPerSample !== 16 || numChannels !== 1 || pcm.length < 8192) return wavBuffer;

    const eeriePcm = pitchShiftPcm16(pcm, 0.91);
    const count = Math.floor(eeriePcm.length / 2);
    const floatBuf = new Float32Array(count);
    for (let i = 0; i < count; i++) floatBuf[i] = eeriePcm.readInt16LE(i * 2) / 32768;

    // Hollow cold whisper EQ + ghostly breathy air
    applyPeakingBiquad(floatBuf, sampleRate, 160, 0.8, -5.0);
    applyPeakingBiquad(floatBuf, sampleRate, 1400, 1.2, 2.8);
    applyPeakingBiquad(floatBuf, sampleRate, 4600, 1.0, 3.8);

    // Multi-tap haunted spectral reverb with dark decay
    const taps = [
      { delay: Math.round(sampleRate * 0.068), gain: 0.30 },
      { delay: Math.round(sampleRate * 0.145), gain: 0.22 },
      { delay: Math.round(sampleRate * 0.245), gain: 0.15 },
      { delay: Math.round(sampleRate * 0.370), gain: 0.09 },
    ];
    const wetBuf = new Float32Array(count);
    let lp = 0;
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (const t of taps) {
        if (i >= t.delay) sum += floatBuf[i - t.delay] * t.gain;
      }
      lp = lp + 0.32 * (sum - lp);
      wetBuf[i] = floatBuf[i] * 0.84 + lp;
    }
    applyDubbingCompressor(wetBuf, sampleRate);
    normalizeFloatBuffer(wetBuf, 0.90);

    const outPcm = Buffer.alloc(count * 2);
    for (let i = 0; i < count; i++) {
      outPcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, wetBuf[i])) * 32767), i * 2);
    }
    return wrapPcmAsWav(outPcm, sampleRate, numChannels, bitsPerSample);
  }

  function applyGrandfatherVoiceEffect(wavBuffer: Buffer): Buffer {
    const { pcm, sampleRate, numChannels, bitsPerSample } = extractPcmFromWav(wavBuffer);
    if (bitsPerSample !== 16 || numChannels !== 1 || pcm.length < 8192) return wavBuffer;

    const warmPcm = pitchShiftPcm16(pcm, 0.95);
    const count = Math.floor(warmPcm.length / 2);
    const floatBuf = new Float32Array(count);
    for (let i = 0; i < count; i++) floatBuf[i] = warmPcm.readInt16LE(i * 2) / 32768;

    // Warm fireplace chest body + gentle soft aged high-frequency rolloff
    applyPeakingBiquad(floatBuf, sampleRate, 165, 0.9, 3.2);
    applyPeakingBiquad(floatBuf, sampleRate, 780, 1.0, 1.5);
    applyPeakingBiquad(floatBuf, sampleRate, 4400, 0.85, -4.0);
    applyDubbingCompressor(floatBuf, sampleRate);
    normalizeFloatBuffer(floatBuf, 0.90);

    const outPcm = Buffer.alloc(count * 2);
    for (let i = 0; i < count; i++) {
      outPcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, floatBuf[i])) * 32767), i * 2);
    }
    return wrapPcmAsWav(outPcm, sampleRate, numChannels, bitsPerSample);
  }

  function applySciFiRobotVoiceEffect(wavBuffer: Buffer): Buffer {
    const { pcm, sampleRate, numChannels, bitsPerSample } = extractPcmFromWav(wavBuffer);
    if (bitsPerSample !== 16 || numChannels !== 1 || pcm.length < 8192) return wavBuffer;

    const count = Math.floor(pcm.length / 2);
    const floatBuf = new Float32Array(count);
    for (let i = 0; i < count; i++) floatBuf[i] = pcm.readInt16LE(i * 2) / 32768;

    // Metallic android comb-resonator + subtle 38Hz ring modulation blend
    const combDelay = Math.max(24, Math.round(sampleRate * 0.0046)); // ~217Hz metallic resonance
    const combBuf = new Float32Array(count);
    const twoPiF = (2 * Math.PI * 38) / sampleRate;
    for (let i = 0; i < count; i++) {
      const fb = i >= combDelay ? combBuf[i - combDelay] * 0.42 : 0;
      const combSample = floatBuf[i] * 0.72 + fb;
      combBuf[i] = Math.max(-1.2, Math.min(1.2, combSample));
      const ring = combBuf[i] * (0.72 + 0.28 * Math.sin(twoPiF * i));
      floatBuf[i] = floatBuf[i] * 0.35 + ring * 0.75;
    }

    applyPeakingBiquad(floatBuf, sampleRate, 2600, 1.1, 3.8);
    applyPeakingBiquad(floatBuf, sampleRate, 180, 0.9, -2.5);
    applyDubbingCompressor(floatBuf, sampleRate);
    normalizeFloatBuffer(floatBuf, 0.90);

    const outPcm = Buffer.alloc(count * 2);
    for (let i = 0; i < count; i++) {
      outPcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, floatBuf[i])) * 32767), i * 2);
    }
    return wrapPcmAsWav(outPcm, sampleRate, numChannels, bitsPerSample);
  }

  function applyCommentatorVoiceEffect(wavBuffer: Buffer): Buffer {
    const { pcm, sampleRate, numChannels, bitsPerSample } = extractPcmFromWav(wavBuffer);
    if (bitsPerSample !== 16 || numChannels !== 1 || pcm.length < 8192) return wavBuffer;

    const count = Math.floor(pcm.length / 2);
    const floatBuf = new Float32Array(count);
    for (let i = 0; i < count; i++) floatBuf[i] = pcm.readInt16LE(i * 2) / 32768;

    // Punchy broadcast stadium booth EQ
    applyPeakingBiquad(floatBuf, sampleRate, 220, 1.0, 2.5);
    applyPeakingBiquad(floatBuf, sampleRate, 2800, 1.0, 3.8);
    applyDubbingCompressor(floatBuf, sampleRate);
    normalizeFloatBuffer(floatBuf, 0.92);

    const outPcm = Buffer.alloc(count * 2);
    for (let i = 0; i < count; i++) {
      outPcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, floatBuf[i])) * 32767), i * 2);
    }
    return wrapPcmAsWav(outPcm, sampleRate, numChannels, bitsPerSample);
  }

  interface ServerVoiceControls {
    pitch?: number; // semitones: -6..+6
    speed?: number; // 0.75..1.35
    echo?: number; // 0..100
    emotion?: string;
  }

  function applyCustomVoiceControls(wavBuffer: Buffer, controls?: ServerVoiceControls): Buffer {
    if (!controls) return wavBuffer;
    const pitchSemis = typeof controls.pitch === 'number' ? Math.max(-6, Math.min(6, controls.pitch)) : 0;
    const speed = typeof controls.speed === 'number' ? Math.max(0.75, Math.min(1.35, controls.speed)) : 1.0;
    const echoPct = typeof controls.echo === 'number' ? Math.max(0, Math.min(100, controls.echo)) : 0;

    if (Math.abs(pitchSemis) < 0.05 && Math.abs(speed - 1.0) < 0.01 && echoPct < 1) {
      return wavBuffer;
    }

    const { pcm, sampleRate, numChannels, bitsPerSample } = extractPcmFromWav(wavBuffer);
    if (bitsPerSample !== 16 || numChannels !== 1 || pcm.length < 4096) return wavBuffer;

    let workingPcm = pcm;
    if (Math.abs(pitchSemis) >= 0.05) {
      const pitchFactor = Math.pow(2, pitchSemis / 12);
      workingPcm = pitchShiftPcm16(workingPcm, pitchFactor);
    }
    if (Math.abs(speed - 1.0) >= 0.01) {
      workingPcm = wsolaTimeStretchPcm16(workingPcm, speed);
    }

    if (echoPct >= 1) {
      const wetMix = (echoPct / 100) * 0.55;
      const tailSamples = Math.round(sampleRate * 0.35);
      const baseCount = Math.floor(workingPcm.length / 2);
      const totalCount = baseCount + tailSamples;
      const dry = new Float32Array(totalCount);
      for (let i = 0; i < baseCount; i++) {
        dry[i] = workingPcm.readInt16LE(i * 2) / 32768;
      }

      const tap1 = Math.round(sampleRate * 0.055);
      const tap2 = Math.round(sampleRate * 0.125);
      const tap3 = Math.round(sampleRate * 0.215);
      const tap4 = Math.round(sampleRate * 0.320);
      const outF = new Float32Array(totalCount);
      let lp = 0;
      for (let i = 0; i < totalCount; i++) {
        const e =
          (i >= tap1 ? dry[i - tap1] * 0.45 : 0) +
          (i >= tap2 ? dry[i - tap2] * 0.30 : 0) +
          (i >= tap3 ? dry[i - tap3] * 0.18 : 0) +
          (i >= tap4 ? dry[i - tap4] * 0.10 : 0);
        lp = lp + 0.36 * (e - lp);
        outF[i] = dry[i] * (1 - wetMix * 0.2) + lp * wetMix;
      }
      normalizeFloatBuffer(outF, 0.92);
      const outPcm = Buffer.alloc(totalCount * 2);
      for (let i = 0; i < totalCount; i++) {
        outPcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, outF[i])) * 32767), i * 2);
      }
      workingPcm = outPcm;
    }

    return wrapPcmAsWav(workingPcm, sampleRate, numChannels, bitsPerSample);
  }

  function emotionToStylePhrase(emotion?: string): string {
    switch (emotion) {
      case 'happy':
        return 'Speak with bright, joyful, smiling, cheerful warmth and happy energy.';
      case 'sad':
        return 'Speak with deeply emotional, gentle, tearful, heartbroken sadness and soft slow pauses.';
      case 'angry':
        return 'Speak with fierce, intense, furious anger, sharp emphasis and dramatic force.';
      case 'whisper':
        return 'Speak in an eerie, soft, intimate, breathy hushed whisper very close to the ear.';
      case 'scary':
        return 'Speak with spine-chilling, menacing, dark ominous dread that frightens the listener.';
      case 'excited':
        return 'Speak with thrilling, high-energy, super excited enthusiasm and lively pace.';
      default:
        return '';
    }
  }

  async function convertMp3BufferToWav24k(mp3Buf: Buffer): Promise<Buffer> {
    const decoder = new MPEGDecoder();
    await decoder.ready;
    try {
      const { channelData, samplesDecoded, sampleRate } = decoder.decode(new Uint8Array(mp3Buf));
      if (!channelData || channelData.length === 0 || samplesDecoded === 0) {
        throw new Error('MP3 decoder returned no audio samples.');
      }

      // Mix down to mono
      const mono = new Float32Array(samplesDecoded);
      if (channelData.length === 1) {
        mono.set(channelData[0].subarray(0, samplesDecoded));
      } else {
        const chCount = channelData.length;
        for (let i = 0; i < samplesDecoded; i++) {
          let sum = 0;
          for (let c = 0; c < chCount; c++) {
            sum += channelData[c][i];
          }
          mono[i] = sum / chCount;
        }
      }

      // Resample to 24000Hz if needed
      const targetRate = 24000;
      let resampled = mono;
      if (sampleRate !== targetRate && sampleRate > 0) {
        const outLen = Math.max(1, Math.round((samplesDecoded * targetRate) / sampleRate));
        resampled = new Float32Array(outLen);
        const ratio = sampleRate / targetRate;
        for (let i = 0; i < outLen; i++) {
          const pos = i * ratio;
          const idx0 = Math.min(samplesDecoded - 1, Math.floor(pos));
          const idx1 = Math.min(samplesDecoded - 1, idx0 + 1);
          const frac = pos - idx0;
          resampled[i] = mono[idx0] * (1 - frac) + mono[idx1] * frac;
        }
      }

      const pcm = Buffer.alloc(resampled.length * 2);
      for (let i = 0; i < resampled.length; i++) {
        const clamped = Math.max(-1, Math.min(1, resampled[i]));
        pcm.writeInt16LE(Math.round(clamped * 32767), i * 2);
      }

      return wrapPcmAsWav(pcm, targetRate, 1, 16);
    } finally {
      decoder.free();
    }
  }

  function detectScriptLanguage(text: string): 'bn' | 'hi' | 'en' {
    const bnCount = (text.match(/[\u0980-\u09FF]/g) || []).length;
    const hiCount = (text.match(/[\u0900-\u097F]/g) || []).length;
    const enCount = (text.match(/[A-Za-z]/g) || []).length;
    if (bnCount >= hiCount && bnCount >= enCount && bnCount > 0) return 'bn';
    if (hiCount > bnCount && hiCount >= enCount) return 'hi';
    if (enCount > bnCount && enCount > hiCount) return 'en';
    return 'bn';
  }

  async function synthesizeWithFreeNeuralBn(
    text: string,
    voiceName: string
  ): Promise<{ wavBuffer: Buffer; modelUsed: string }> {
    const lang = detectScriptLanguage(text);
    const bnVoiceMap: Record<string, { edgeVoice: string; rate?: string; pitch?: string }> = {
      Fenrir: { edgeVoice: 'bn-BD-PradeepNeural', rate: '-6%', pitch: '-6Hz' },
      Charon: { edgeVoice: 'bn-IN-BashkarNeural', rate: '-8%', pitch: '-8Hz' },
      Kore: { edgeVoice: 'bn-BD-NabanitaNeural', rate: '-3%', pitch: '0Hz' },
      Puck: { edgeVoice: 'bn-BD-PradeepNeural', rate: '+4%', pitch: '+6Hz' },
      Zephyr: { edgeVoice: 'bn-IN-TanishaaNeural', rate: '-2%', pitch: '+2Hz' },
      Mishti: { edgeVoice: 'bn-IN-TanishaaNeural', rate: '-3%', pitch: '+10Hz' },
      BabyGirl: { edgeVoice: 'bn-IN-TanishaaNeural', rate: '-5%', pitch: '+24Hz' },
      Thanos: { edgeVoice: 'bn-IN-BashkarNeural', rate: '-14%', pitch: '-16Hz' },
      Oggy: { edgeVoice: 'bn-IN-BashkarNeural', rate: '+1%', pitch: '-4Hz' },
      HorrorGhost: { edgeVoice: 'bn-IN-BashkarNeural', rate: '-18%', pitch: '-10Hz' },
      Grandfather: { edgeVoice: 'bn-IN-BashkarNeural', rate: '-12%', pitch: '-6Hz' },
      SciFiRobot: { edgeVoice: 'bn-BD-PradeepNeural', rate: '+2%', pitch: '0Hz' },
      Commentator: { edgeVoice: 'bn-BD-PradeepNeural', rate: '+12%', pitch: '+6Hz' },
    };
    const hiVoiceMap: Record<string, { edgeVoice: string; rate?: string; pitch?: string }> = {
      Fenrir: { edgeVoice: 'hi-IN-MadhurNeural', rate: '-5%', pitch: '-6Hz' },
      Charon: { edgeVoice: 'hi-IN-MadhurNeural', rate: '-8%', pitch: '-8Hz' },
      Kore: { edgeVoice: 'hi-IN-SwaraNeural', rate: '-2%', pitch: '0Hz' },
      Puck: { edgeVoice: 'hi-IN-MadhurNeural', rate: '+4%', pitch: '+6Hz' },
      Zephyr: { edgeVoice: 'hi-IN-SwaraNeural', rate: '-2%', pitch: '+2Hz' },
      Mishti: { edgeVoice: 'hi-IN-SwaraNeural', rate: '-3%', pitch: '+10Hz' },
      BabyGirl: { edgeVoice: 'hi-IN-SwaraNeural', rate: '-5%', pitch: '+24Hz' },
      Thanos: { edgeVoice: 'hi-IN-MadhurNeural', rate: '-14%', pitch: '-16Hz' },
      Oggy: { edgeVoice: 'hi-IN-MadhurNeural', rate: '+1%', pitch: '-4Hz' },
      HorrorGhost: { edgeVoice: 'hi-IN-MadhurNeural', rate: '-18%', pitch: '-10Hz' },
      Grandfather: { edgeVoice: 'hi-IN-MadhurNeural', rate: '-12%', pitch: '-6Hz' },
      SciFiRobot: { edgeVoice: 'hi-IN-MadhurNeural', rate: '+2%', pitch: '0Hz' },
      Commentator: { edgeVoice: 'hi-IN-MadhurNeural', rate: '+12%', pitch: '+6Hz' },
    };
    const enVoiceMap: Record<string, { edgeVoice: string; rate?: string; pitch?: string }> = {
      Fenrir: { edgeVoice: 'en-US-AndrewNeural', rate: '-5%', pitch: '-6Hz' },
      Charon: { edgeVoice: 'en-US-ChristopherNeural', rate: '-6%', pitch: '-6Hz' },
      Kore: { edgeVoice: 'en-US-AvaNeural', rate: '-2%', pitch: '0Hz' },
      Puck: { edgeVoice: 'en-US-BrianNeural', rate: '+4%', pitch: '+6Hz' },
      Zephyr: { edgeVoice: 'en-US-EmmaNeural', rate: '-2%', pitch: '+2Hz' },
      Mishti: { edgeVoice: 'en-US-JennyNeural', rate: '-2%', pitch: '+8Hz' },
      BabyGirl: { edgeVoice: 'en-US-AnaNeural', rate: '-4%', pitch: '+14Hz' },
      Thanos: { edgeVoice: 'en-US-ChristopherNeural', rate: '-14%', pitch: '-16Hz' },
      Oggy: { edgeVoice: 'en-US-AndrewNeural', rate: '+2%', pitch: '-4Hz' },
      HorrorGhost: { edgeVoice: 'en-US-ChristopherNeural', rate: '-18%', pitch: '-10Hz' },
      Grandfather: { edgeVoice: 'en-US-ChristopherNeural', rate: '-12%', pitch: '-6Hz' },
      SciFiRobot: { edgeVoice: 'en-US-BrianNeural', rate: '+2%', pitch: '0Hz' },
      Commentator: { edgeVoice: 'en-US-BrianNeural', rate: '+12%', pitch: '+6Hz' },
    };
    const activeMap = lang === 'hi' ? hiVoiceMap : lang === 'en' ? enVoiceMap : bnVoiceMap;
    const cfg = activeMap[voiceName] || activeMap.Fenrir;

    const tts = new MsEdgeTTS();
    await tts.setMetadata(cfg.edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text.trim(), {
      rate: cfg.rate,
      pitch: cfg.pitch,
    });

    const mp3Chunks: Buffer[] = [];
    await Promise.race([
      (async () => {
        for await (const chunk of audioStream) {
          mp3Chunks.push(Buffer.from(chunk));
        }
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Bangla Neural TTS stream timed out')), 45000)),
    ]);

    const mp3Buf = Buffer.concat(mp3Chunks);
    if (mp3Buf.length < 256) {
      throw new Error('Bangla Neural TTS returned empty audio stream.');
    }

    let wavBuffer = await convertMp3BufferToWav24k(mp3Buf);
    if (voiceName === 'Oggy') {
      wavBuffer = applyOggyVoiceEffect(wavBuffer);
    } else if (voiceName === 'BabyGirl') {
      wavBuffer = applyBabyGirlVoiceEffect(wavBuffer, lang === 'en' ? 1.08 : 1.15);
    } else if (voiceName === 'Thanos') {
      wavBuffer = applyThanosVoiceEffect(wavBuffer, 0.85);
    } else if (voiceName === 'HorrorGhost') {
      wavBuffer = applyHorrorGhostVoiceEffect(wavBuffer);
    } else if (voiceName === 'Grandfather') {
      wavBuffer = applyGrandfatherVoiceEffect(wavBuffer);
    } else if (voiceName === 'SciFiRobot') {
      wavBuffer = applySciFiRobotVoiceEffect(wavBuffer);
    } else if (voiceName === 'Commentator') {
      wavBuffer = applyCommentatorVoiceEffect(wavBuffer);
    }

    return { wavBuffer, modelUsed: 'free-neural-bn' };
  }

  async function synthesizeSingleChunk(
    ai: GoogleGenAI,
    text: string,
    voiceName: string,
    voiceControls?: ServerVoiceControls
  ): Promise<{ wavBuffer: Buffer; modelUsed: string }> {
    const isOggyVoice = voiceName === 'Oggy';
    const isBabyGirlVoice = voiceName === 'BabyGirl';
    const isThanosVoice = voiceName === 'Thanos';
    const isHorrorGhost = voiceName === 'HorrorGhost';
    const isGrandfather = voiceName === 'Grandfather';
    const isSciFiRobot = voiceName === 'SciFiRobot';
    const isCommentator = voiceName === 'Commentator';

    const prebuiltVoice = isOggyVoice
      ? 'Fenrir'
      : isThanosVoice || isHorrorGhost || isGrandfather
      ? 'Charon'
      : isSciFiRobot || isCommentator
      ? 'Puck'
      : voiceName === 'Mishti' || isBabyGirlVoice
      ? 'Leda'
      : voiceName || 'Fenrir';

    // Native Gemini 3.8 Voice Design / expressive acting direction per character persona
    const basePersonaStyle = isBabyGirlVoice
      ? 'Irresistibly cute, tiny, innocent 2-year-old baby girl voice — soft, sweet, high-pitched toddler tone, adorable playful wonder, gentle heartwarming giggling warmth, crystal clear and super lovely to listen to'
      : isThanosVoice
      ? 'Terrifying, extremely deep, dark, slow, rumbling, menacing cosmic villain voice like a gigantic unstoppable titan (Thanos) — heavy gravelly bass voice, cold intimidating pauses, ominous booming dread that scares the listener'
      : isHorrorGhost
      ? 'Chilling haunted horror ghost voice — eerie hushed breathy whisper, cold creepy pauses, unsettling supernatural suspense that gives goosebumps'
      : isGrandfather
      ? 'Warm, loving, gentle 75-year-old wise Bengali grandfather storytelling voice — slow affectionate cadence, tender aged warmth, nostalgic bedtime storyteller'
      : isSciFiRobot
      ? 'Futuristic calm intelligent sci-fi AI android voice — crisp, precise, steady synthetic rhythm with subtle futuristic authority'
      : isCommentator
      ? 'Electrifying, high-energy live stadium cricket and football sports commentator — thrilling rapid excitement, dramatic rising energy, broadcast enthusiasm'
      : voiceName === 'Mishti'
      ? 'Very sweet, gentle, soft, melodious young Bengali girl voice with warm affection and smooth storytelling flow'
      : isOggyVoice
      ? 'Playful, theatrical, witty cartoon dubbing baritone voice with fun dramatic pauses and expressive comedic energy'
      : '';

    const emotionPhrase = emotionToStylePhrase(voiceControls?.emotion);
    const personaStyle = [basePersonaStyle, emotionPhrase].filter(Boolean).join(' ').trim() || undefined;

    const allModels = [
      'gemini-3.8-flash-tts',
      'gemini-3.8-flash-lite-tts',
      'gemini-2.5-flash-preview-tts',
      'gemini-2.5-pro-preview-tts',
    ];
    const now = Date.now();
    const candidateModels = allModels.filter((m) => now > (modelCooldowns[m] || 0));

    const callModel = async (model: string) => {
      const supportsSpeechMetadata = model.startsWith('gemini-3.8-') && Boolean(personaStyle);
      const buildRequest = (useMetadata: boolean) => ({
        model,
        contents: useMetadata
          ? [
              {
                role: 'user',
                parts: [
                  {
                    text: text.trim(),
                    speechMetadata: {
                      style: personaStyle,
                    },
                  },
                ],
              },
            ]
          : text.trim(),
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: prebuiltVoice,
              },
            },
          },
        },
      });

      let usedVoiceDesign = false;
      let response: any;
      if (supportsSpeechMetadata) {
        try {
          response = await ai.models.generateContent(buildRequest(true) as any);
          usedVoiceDesign = true;
        } catch (metaErr: any) {
          if (metaErr?.status === 400) {
            console.warn(`Model ${model} rejected speechMetadata, retrying plain text:`, metaErr?.message?.slice(0, 180));
            response = await ai.models.generateContent(buildRequest(false) as any);
          } else {
            throw metaErr;
          }
        }
      } else {
        response = await ai.models.generateContent(buildRequest(false) as any);
      }

      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inlineData?.data;
      if (!base64Audio) {
        throw new Error(`Model ${model} did not return audio data.`);
      }
      const rawBuffer = Buffer.from(base64Audio, 'base64');
      let wavBuffer = ensureWavBuffer(rawBuffer, inlineData?.mimeType);
      if (isOggyVoice) {
        wavBuffer = applyOggyVoiceEffect(wavBuffer);
      } else if (isBabyGirlVoice) {
        // When Gemini 3.8 acts natively as a baby girl, apply only subtle sweet lift (1.10x) so it sounds 100% real & adorable!
        wavBuffer = applyBabyGirlVoiceEffect(wavBuffer, usedVoiceDesign ? 1.10 : 1.24);
      } else if (isThanosVoice) {
        wavBuffer = applyThanosVoiceEffect(wavBuffer, usedVoiceDesign ? 0.82 : 0.78);
      } else if (isHorrorGhost) {
        wavBuffer = applyHorrorGhostVoiceEffect(wavBuffer);
      } else if (isGrandfather) {
        wavBuffer = applyGrandfatherVoiceEffect(wavBuffer);
      } else if (isSciFiRobot) {
        wavBuffer = applySciFiRobotVoiceEffect(wavBuffer);
      } else if (isCommentator) {
        wavBuffer = applyCommentatorVoiceEffect(wavBuffer);
      }
      wavBuffer = applyCustomVoiceControls(wavBuffer, voiceControls);
      return {
        wavBuffer,
        modelUsed: model,
      };
    };

    let lastErr: any = null;
    for (const model of candidateModels) {
      try {
        const resChunk = await callModel(model);
        recordModelRequestSuccess(model);
        return resChunk;
      } catch (err: any) {
        lastErr = err;
        console.warn(`TTS model ${model} failed:`, err?.status, err?.message?.slice(0, 350));
        if (isQuotaError(err)) {
          const delaySec = parseRetryDelaySeconds(err);
          const msg = String(err?.message || '');
          const isDailyLimit = msg.includes('PerDay') || msg.includes('RequestsPerDay');
          if (isDailyLimit) {
            modelCooldowns[model] = Date.now() + 5 * 60 * 1000;
            recordModelQuotaExhausted(model, msg.slice(0, 220));
          } else if (delaySec !== null && delaySec <= 15) {
            await new Promise((r) => setTimeout(r, (delaySec + 0.5) * 1000));
            try {
              const retryRes = await callModel(model);
              recordModelRequestSuccess(model);
              return retryRes;
            } catch (retryErr: any) {
              lastErr = retryErr;
              console.warn(`TTS model ${model} retry failed:`, retryErr?.message?.slice(0, 300));
              recordModelQuotaExhausted(model, String(retryErr?.message || '').slice(0, 220));
            }
          } else {
            recordModelQuotaExhausted(model, msg.slice(0, 220));
          }
        } else if (err?.status === 404) {
          modelCooldowns[model] = Date.now() + 30 * 60 * 1000;
          recordModelQuotaExhausted(model, String(err?.message || '').slice(0, 220));
        } else {
          recordModelQuotaExhausted(model, String(err?.message || '').slice(0, 220));
        }
      }
    }

    // All Gemini TTS models exhausted or unavailable -> seamlessly fall back to Free Unlimited Bangla Neural TTS
    try {
      const fallbackRes = await synthesizeWithFreeNeuralBn(text, voiceName);
      fallbackRes.wavBuffer = applyCustomVoiceControls(fallbackRes.wavBuffer, voiceControls);
      recordModelRequestSuccess('free-neural-bn');
      return fallbackRes;
    } catch (neuralErr: any) {
      console.error('Free Bangla Neural TTS fallback also failed:', neuralErr?.message);
      throw lastErr || neuralErr || new Error('All TTS models failed.');
    }
  }

  function stripInlineCueTagsForTts(raw: string): string {
    return raw
      .replace(
        /\[\s*(বজ্রপাত|হার্টবিট|ভুতুড়ে হুশ|হুশ|ড্রাম বুম|বুম|স্পার্কেল|ম্যাজিক|হরর স্টিং|স্টিং|thunder|heartbeat|whoosh|boom|sparkle|sting|বিরতি[^\]]*|pause[^\]]*)\s*\]/gi,
        ' '
      )
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function parsePauseTaggedSegments(raw: string): Array<{ text: string; pauseAfterMs: number }> {
    const pauseRegex = /\[\s*(?:বিরতি|pause)\s*([০-৯0-9]+(?:\.[০-৯0-9]+)?)?[^\]]*\]/gi;
    const bnDigits: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    };
    const segments: Array<{ text: string; pauseAfterMs: number }> = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    while ((match = pauseRegex.exec(raw)) !== null) {
      const textPart = stripInlineCueTagsForTts(raw.slice(lastIdx, match.index));
      const numRaw = (match[1] || '2').replace(/[০-৯]/g, (d) => bnDigits[d] || d);
      const sec = Math.max(0.5, Math.min(5, parseFloat(numRaw) || 2));
      if (textPart) {
        segments.push({ text: textPart, pauseAfterMs: Math.round(sec * 1000) });
      }
      lastIdx = pauseRegex.lastIndex;
    }
    const tail = stripInlineCueTagsForTts(raw.slice(lastIdx));
    if (tail) {
      segments.push({ text: tail, pauseAfterMs: 0 });
    }
    return segments;
  }

  function splitTextIntoChunks(text: string, maxChunkChars = 2500): string[] {
    const cleanText = stripInlineCueTagsForTts(text);
    if (!cleanText) return [];
    if (cleanText.length <= maxChunkChars) {
      return [cleanText];
    }

    const rawParagraphs = cleanText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const units: string[] = [];
    for (const para of rawParagraphs) {
      if (para.length <= maxChunkChars) {
        units.push(para);
      } else {
        const sentences = para.match(/[^।!?\.]+[।!?\.]*/g) || [para];
        for (const s of sentences) {
          const trimmed = s.trim();
          if (trimmed) units.push(trimmed);
        }
      }
    }

    // Greedily pack units up to maxChunkChars so we minimize total API calls
    const packed: string[] = [];
    let current = '';
    for (const unit of units) {
      if (current && current.length + unit.length + 2 > maxChunkChars) {
        packed.push(current);
        current = unit;
      } else {
        current = current ? `${current}\n\n${unit}` : unit;
      }
    }
    if (current) packed.push(current);

    return packed.length > 0 ? packed : [cleanText];
  }

  function extractPcmFromWav(wavBuffer: Buffer): {
    pcm: Buffer;
    sampleRate: number;
    numChannels: number;
    bitsPerSample: number;
  } {
    let sampleRate = 24000;
    let numChannels = 1;
    let bitsPerSample = 16;

    if (
      wavBuffer.length >= 44 &&
      wavBuffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      wavBuffer.subarray(8, 12).toString('ascii') === 'WAVE'
    ) {
      let offset = 12;
      while (offset + 8 <= wavBuffer.length) {
        const chunkId = wavBuffer.subarray(offset, offset + 4).toString('ascii');
        const chunkSize = wavBuffer.readUInt32LE(offset + 4);
        const chunkDataStart = offset + 8;

        if (chunkId === 'fmt ' && chunkSize >= 16 && chunkDataStart + 16 <= wavBuffer.length) {
          numChannels = wavBuffer.readUInt16LE(chunkDataStart + 2);
          sampleRate = wavBuffer.readUInt32LE(chunkDataStart + 4);
          bitsPerSample = wavBuffer.readUInt16LE(chunkDataStart + 14);
        } else if (chunkId === 'data') {
          const dataEnd = Math.min(chunkDataStart + chunkSize, wavBuffer.length);
          return {
            pcm: wavBuffer.subarray(chunkDataStart, dataEnd),
            sampleRate,
            numChannels,
            bitsPerSample,
          };
        }

        offset = chunkDataStart + chunkSize + (chunkSize % 2);
      }
      return {
        pcm: wavBuffer.subarray(44),
        sampleRate,
        numChannels,
        bitsPerSample,
      };
    }

    return { pcm: wavBuffer, sampleRate, numChannels, bitsPerSample };
  }

  function buildCombinedWav(
    wavBuffers: Buffer[],
    pauseMs: number | number[] = 320
  ): { wavBuffer: Buffer; durationSec: number } {
    if (wavBuffers.length === 1) {
      const safeWav = ensureWavBuffer(wavBuffers[0]);
      const { pcm, sampleRate, numChannels, bitsPerSample } = extractPcmFromWav(safeWav);
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      return {
        wavBuffer: safeWav,
        durationSec: byteRate > 0 ? pcm.length / byteRate : 10,
      };
    }

    const extracted = wavBuffers.map(extractPcmFromWav);
    const { sampleRate, numChannels, bitsPerSample } = extracted[0];
    const bytesPerSample = bitsPerSample / 8;
    const byteRate = sampleRate * numChannels * bytesPerSample;
    const blockAlign = numChannels * bytesPerSample;

    const parts: Buffer[] = [];
    let totalPcmBytes = 0;

    extracted.forEach((item, idx) => {
      parts.push(item.pcm);
      totalPcmBytes += item.pcm.length;
      if (idx < extracted.length - 1) {
        const gapMs = Array.isArray(pauseMs) ? (pauseMs[idx] ?? 320) : pauseMs;
        const pauseBytes = Math.floor(sampleRate * (Math.max(0, gapMs) / 1000) * blockAlign);
        if (pauseBytes > 0) {
          const silenceBuffer = Buffer.alloc(pauseBytes);
          parts.push(silenceBuffer);
          totalPcmBytes += silenceBuffer.length;
        }
      }
    });

    const header = Buffer.alloc(44);
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(36 + totalPcmBytes, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16); // PCM chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(totalPcmBytes, 40);

    return {
      wavBuffer: Buffer.concat([header, ...parts]),
      durationSec: byteRate > 0 ? totalPcmBytes / byteRate : 10,
    };
  }

  // Standard Unary TTS Generation Endpoint (fast single scene or full script)
  app.post('/api/tts/generate', async (req, res) => {
    try {
      const { text, voiceName = 'Fenrir', voiceControls } = req.body;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Text prompt is required for TTS generation.' });
      }

      const ai = getAiClient();
      if (!ai) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please attach an API key in the Secrets panel.',
        });
      }

      const { wavBuffer, modelUsed } = await synthesizeSingleChunk(ai, text.trim(), voiceName, voiceControls);
      const { durationSec } = extractPcmFromWav(wavBuffer).pcm.length
        ? (() => {
            const info = extractPcmFromWav(wavBuffer);
            const byteRate = info.sampleRate * info.numChannels * (info.bitsPerSample / 8);
            return { durationSec: byteRate > 0 ? info.pcm.length / byteRate : 10 };
          })()
        : { durationSec: 10 };
      recordVoiceoverCompleted(durationSec, text.trim().length);

      return res.json({
        success: true,
        mimeType: 'audio/wav',
        audioBase64: wavBuffer.toString('base64'),
        voiceUsed: voiceName,
        modelUsed,
        usage: buildUsagePayload(),
      });
    } catch (err: any) {
      console.error('Error generating TTS:', err);
      const isQuota = isQuotaError(err);
      const errorMsg = isQuota
        ? 'গুগল জেমিনাই ফ্রি টিয়ার রিকোয়েস্ট কোটা (Free Tier Limit) পূর্ণ হয়েছে। আনলিমিটেড ভয়েস জেনারেট করতে Settings > Secrets প্যানেল থেকে বিলিং যুক্ত API কী নির্বাচন করুন, অথবা কিছুক্ষণ পর পুনরায় চেষ্টা করুন।'
        : (err?.message || 'ভয়েস তৈরিতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');

      return res.status(isQuota ? 429 : 500).json({
        error: errorMsg,
        isQuotaExceeded: isQuota,
      });
    }
  });

  // Streaming Progress + Parallel Chunked TTS Endpoint for Fast Full-Length Voiceover
  app.post('/api/tts/generate-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, any>) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    try {
      const { text, voiceName = 'Fenrir', targetDurationSec, voiceControls } = req.body;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        sendEvent({ type: 'error', error: 'ভয়েসওভার টেক্সট খালি রাখা যাবে না।' });
        return res.end();
      }

      const ai = getAiClient();
      if (!ai) {
        sendEvent({
          type: 'error',
          error: 'GEMINI_API_KEY সেট করা নেই। অনুগ্রহ করে Settings > Secrets প্যানেলে API কী যুক্ত করুন।',
        });
        return res.end();
      }

      // Honor explicit inline [বিরতি X সে.] pause tags with real PCM silence gaps,
      // while keeping standard scripts in a SINGLE API request to preserve quota.
      const pauseSegments = parsePauseTaggedSegments(text.trim());
      const chunks: string[] = [];
      const customPauseMs: number[] = [];
      for (const seg of pauseSegments) {
        const subChunks = splitTextIntoChunks(seg.text, 2500);
        subChunks.forEach((sc, sIdx) => {
          chunks.push(sc);
          customPauseMs.push(sIdx === subChunks.length - 1 ? (seg.pauseAfterMs || 320) : 320);
        });
      }
      if (chunks.length === 0) {
        sendEvent({ type: 'error', error: 'স্ক্রিপ্টে বলার মতো কোনো লেখা নেই।' });
        return res.end();
      }
      const total = chunks.length;
      const results: Buffer[] = new Array(total);
      let completed = 0;
      let modelUsed = 'gemini-3.8-flash-tts';

      sendEvent({
        type: 'progress',
        completed: 0,
        total,
        percent: 8,
        message: total > 1 ? `স্ক্রিপ্ট ${total}টি অংশে প্রসেস শুরু হয়েছে...` : 'সম্পূর্ণ ভয়েসওভার তৈরি হচ্ছে...',
      });

      // Emit gentle progress heartbeats while waiting on Gemini TTS so the UI stays responsive
      // and reverse proxies keep the SSE connection alive.
      let simulatedPercent = 12;
      const heartbeatStages = [
        'জেমিনাই TTS ইঞ্জিনে স্ক্রিপ্ট পাঠানো হচ্ছে...',
        'বাংলা উচ্চারণ ও স্বরভঙ্গি বিশ্লেষণ চলছে...',
        'সম্পূর্ণ ভয়েসওভার অডিও রেন্ডারিং চলছে...',
        'হাই-কোয়ালিটি WAV ফাইল প্রস্তুত হচ্ছে...',
      ];
      let heartbeatCount = 0;
      const heartbeatTimer = setInterval(() => {
        if (completed >= total || res.writableEnded) return;
        heartbeatCount++;
        if (total === 1) {
          simulatedPercent = Math.min(86, simulatedPercent + (simulatedPercent < 50 ? 9 : 4));
          const stageMsg = heartbeatStages[Math.min(heartbeatCount - 1, heartbeatStages.length - 1)];
          sendEvent({
            type: 'progress',
            completed: 0,
            total: 1,
            percent: simulatedPercent,
            message: stageMsg,
          });
        }
      }, 1500);

      try {
        // Sequential execution prevents concurrent RPM burst 429s
        for (let idx = 0; idx < total; idx++) {
          const resChunk = await synthesizeSingleChunk(ai, chunks[idx], voiceName, voiceControls);
          results[idx] = resChunk.wavBuffer;
          modelUsed = resChunk.modelUsed;
          completed++;
          const percent = Math.min(92, Math.round((completed / total) * 84) + 8);
          sendEvent({
            type: 'progress',
            completed,
            total,
            percent,
            message:
              total > 1
                ? `অংশ ${completed}/${total} সম্পন্ন হয়েছে...`
                : 'ভয়েস ডেটা প্রস্তুত হয়েছে...',
          });
        }
      } finally {
        clearInterval(heartbeatTimer);
      }

      sendEvent({
        type: 'progress',
        completed: total,
        total,
        percent: 96,
        message: 'ফাইনাল WAV অডিও প্রস্তুত হচ্ছে...',
      });

      let { wavBuffer, durationSec } = buildCombinedWav(results, customPauseMs);

      if (typeof targetDurationSec === 'number' && targetDurationSec >= 1 && targetDurationSec <= 600) {
        sendEvent({
          type: 'progress',
          completed: total,
          total,
          percent: 98,
          message: `মূল দৈর্ঘ্যের (${Math.round(targetDurationSec)} সেকেন্ড) সাথে সিঙ্ক করা হচ্ছে...`,
        });
        const matched = matchWavDuration(wavBuffer, targetDurationSec);
        wavBuffer = matched.wavBuffer;
        durationSec = matched.durationSec;
      }

      recordVoiceoverCompleted(durationSec, text.trim().length);

      sendEvent({
        type: 'done',
        mimeType: 'audio/wav',
        audioBase64: wavBuffer.toString('base64'),
        durationSec: Math.round(durationSec),
        voiceUsed: voiceName,
        modelUsed,
        usage: buildUsagePayload(),
      });
      res.end();
    } catch (err: any) {
      console.error('Error in /api/tts/generate-stream:', err);
      const isQuota = isQuotaError(err);
      const errorMsg = isQuota
        ? 'গুগল জেমিনাই ফ্রি টিয়ার কোটা পূর্ণ হয়েছে। আনলিমিটেড ব্যবহারের জন্য Settings > Secrets থেকে বিলিং যুক্ত API কী দিন, অথবা কিছুক্ষণ পর চেষ্টা করুন।'
        : (err?.message || 'ভয়েস তৈরিতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');

      sendEvent({
        type: 'error',
        error: errorMsg,
        isQuotaExceeded: isQuota,
      });
      res.end();
    }
  });

  // 2-Speaker Multi-Character Dialogue Studio Streaming Endpoint
  app.post('/api/tts/dialogue-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const sendEvent = (payload: Record<string, any>) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    try {
      const { speaker1, speaker2, lines, pauseMs = 280 } = req.body || {};

      if (!Array.isArray(lines) || lines.length === 0) {
        sendEvent({ type: 'error', error: 'অন্তত একটি সংলাপের লাইন লিখুন।' });
        return res.end();
      }

      const cleanLines = lines
        .filter((l: any) => l && typeof l.text === 'string' && l.text.trim().length > 0)
        .slice(0, 24);

      if (cleanLines.length === 0) {
        sendEvent({ type: 'error', error: 'সংলাপের লাইন খালি রাখা যাবে না।' });
        return res.end();
      }

      const ai = getAiClient();
      if (!ai) {
        sendEvent({ type: 'error', error: 'GEMINI_API_KEY সেট করা নেই।' });
        return res.end();
      }

      const s1Name = String(speaker1?.name || 'চরিত্র ১').trim();
      const s1Voice = String(speaker1?.voiceName || 'BabyGirl');
      const s2Name = String(speaker2?.name || 'চরিত্র ২').trim();
      const s2Voice = String(speaker2?.voiceName || 'Thanos');
      const gapMs = Math.max(100, Math.min(1200, Number(pauseMs) || 280));

      const total = cleanLines.length;
      const wavParts: Buffer[] = [];
      const timeline: Array<{
        id: string;
        speaker: 1 | 2;
        speakerName: string;
        voiceName: string;
        text: string;
        startSec: number;
        endSec: number;
      }> = [];
      let cursorSec = 0;
      let lastModelUsed = 'gemini-3.8-flash-tts';
      let totalChars = 0;

      sendEvent({
        type: 'progress',
        completed: 0,
        total,
        percent: 6,
        message: `${total}টি সংলাপ লাইন তৈরি শুরু হচ্ছে...`,
      });

      for (let i = 0; i < total; i++) {
        const item = cleanLines[i];
        const spk: 1 | 2 = item.speaker === 2 ? 2 : 1;
        const spkName = spk === 1 ? s1Name : s2Name;
        const voiceName = spk === 1 ? s1Voice : s2Voice;
        const rawLineText = item.text.trim();
        const spokenLineText = stripInlineCueTagsForTts(rawLineText);
        if (!spokenLineText) continue;
        totalChars += spokenLineText.length;

        sendEvent({
          type: 'progress',
          completed: i,
          total,
          percent: Math.min(90, Math.round((i / total) * 82) + 8),
          message: `লাইন ${i + 1}/${total} (${spkName} · ${voiceName}) রেকর্ড হচ্ছে...`,
        });

        const { wavBuffer, modelUsed } = await synthesizeSingleChunk(ai, spokenLineText, voiceName, {
          emotion: item.emotion || 'auto',
        });
        lastModelUsed = modelUsed;
        wavParts.push(wavBuffer);

        const info = extractPcmFromWav(wavBuffer);
        const byteRate = info.sampleRate * info.numChannels * (info.bitsPerSample / 8);
        const lineDur = byteRate > 0 ? info.pcm.length / byteRate : 2;
        const startSec = cursorSec;
        const endSec = startSec + lineDur;
        timeline.push({
          id: String(item.id || `line-${i + 1}`),
          speaker: spk,
          speakerName: spkName,
          voiceName,
          text: rawLineText,
          startSec: Number(startSec.toFixed(2)),
          endSec: Number(endSec.toFixed(2)),
        });
        cursorSec = endSec + (i < total - 1 ? gapMs / 1000 : 0);
      }

      sendEvent({
        type: 'progress',
        completed: total,
        total,
        percent: 95,
        message: 'দুটি চরিত্রের সংলাপ একসাথে মিক্স করা হচ্ছে...',
      });

      const { wavBuffer, durationSec } = buildCombinedWav(wavParts, gapMs);
      recordVoiceoverCompleted(durationSec, totalChars);

      sendEvent({
        type: 'done',
        mimeType: 'audio/wav',
        audioBase64: wavBuffer.toString('base64'),
        durationSec: Number(durationSec.toFixed(2)),
        timeline,
        modelUsed: lastModelUsed,
        usage: buildUsagePayload(),
      });
      res.end();
    } catch (err: any) {
      console.error('Error in /api/tts/dialogue-stream:', err);
      sendEvent({
        type: 'error',
        error: err?.message || 'সংলাপ অডিও তৈরিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
      });
      res.end();
    }
  });

  async function translateTranscriptStrict(
    ai: GoogleGenAI,
    sourceText: string,
    targetLanguage: 'bn' | 'hi' | 'en'
  ): Promise<{ translatedText: string; modelUsed: string }> {
    const langInstruction =
      targetLanguage === 'bn'
        ? 'natural, expressive spoken Bengali written STRICTLY in Bengali script (বাংলা লিপি)'
        : targetLanguage === 'hi'
        ? 'natural, expressive spoken Hindi written STRICTLY in Hindi Devanagari script (हिन्दी देवनागरी लिपि, NEVER Bengali or Roman Hinglish)'
        : 'natural, clear spoken English written STRICTLY in English';

    const translatePrompt = `You are a professional video dubbing translator.
Translate and adapt the following spoken script into ${langInstruction} so it matches the original length, emotion, and natural spoken rhythm.
CRITICAL RULES:
- Output ONLY the translated spoken text in the target language script.
- Do NOT keep any sentences in the original language.
- Do NOT include quotes, notes, labels, or markdown.

Original script:
${sourceText}`;

    const attempts: Array<{ model: string; timeoutMs: number }> = [
      { model: 'gemini-3.1-flash-lite', timeoutMs: 18000 },
      { model: 'gemini-3.1-flash-lite', timeoutMs: 22000 },
      { model: 'gemini-4-hydrogen', timeoutMs: 28000 },
    ];

    let lastErr: any = null;
    for (let i = 0; i < attempts.length; i++) {
      const { model, timeoutMs } = attempts[i];
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 700));
      }
      try {
        const config =
          model === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : undefined;

        const tResp: any = await Promise.race([
          ai.models.generateContent({
            model,
            contents: translatePrompt,
            ...(config ? { config } : {}),
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Translate model ${model} timed out`)), timeoutMs)
          ),
        ]);
        const cleaned = (tResp?.text || '').replace(/^["'`]+|["'`]+$/g, '').trim();
        if (cleaned && detectScriptLanguage(cleaned) === targetLanguage) {
          return { translatedText: cleaned, modelUsed: model };
        }
        lastErr = new Error(
          `Translation model ${model} returned script "${detectScriptLanguage(cleaned)}" instead of "${targetLanguage}".`
        );
      } catch (tErr: any) {
        lastErr = tErr;
        console.warn(`Voice-to-Voice translate attempt ${i + 1} (${model}) failed:`, tErr?.message?.slice(0, 220));
      }
    }

    throw lastErr || new Error('নির্বাচিত ভাষায় অনুবাদ সম্পন্ন করা যায়নি।');
  }

  // Voice-to-Voice Transcription & Dubbing Script Extraction Endpoint
  app.post('/api/voice-to-voice/transcribe', async (req, res) => {
    try {
      const {
        mediaBase64,
        mimeType = 'audio/wav',
        targetLanguage = 'original',
      } = req.body || {};

      if (!mediaBase64 || typeof mediaBase64 !== 'string' || mediaBase64.length < 100) {
        return res.status(400).json({
          error: 'অডিও বা ভিডিও ডেটা পাওয়া যায়নি। দয়া করে একটি সঠিক ফাইল আপলোড করুন।',
        });
      }

      if (mediaBase64.length > 26 * 1024 * 1024) {
        return res.status(413).json({
          error: 'ফাইলটি অনেক বড়। দয়া করে তুলনামূলক ছোট ক্লিপ (৩-৪ মিনিটের মধ্যে) আপলোড করুন।',
        });
      }

      const rawMime =
        typeof mimeType === 'string' ? mimeType.split(';')[0].trim().toLowerCase() : '';
      const safeMime = /^(audio|video)\/[a-zA-Z0-9.+-]+$/.test(rawMime)
        ? rawMime
        : 'audio/wav';

      const ai = getAiClient();
      if (!ai) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY সেট করা নেই। অনুগ্রহ করে Settings > Secrets প্যানেলে API কী যুক্ত করুন।',
        });
      }

      const mediaPart = {
        inlineData: {
          mimeType: safeMime,
          data: mediaBase64,
        },
      };

      const isAudioOnly = safeMime.startsWith('audio/');
      const transcribePrompt =
        'Listen carefully to ALL human speech in this media (ignore background music or sound effects) and transcribe every spoken word accurately in the exact language spoken. Return ONLY the clean spoken text with natural punctuation—no timestamps, no speaker labels, no markdown, and no commentary.';

      // Stage A: Speech transcription using gemini-3.5-transcribe first for audio, with reliable fallbacks
      const transcribeModels = isAudioOnly
        ? ['gemini-3.5-transcribe', 'gemini-3.1-flash-lite', 'gemini-4-hydrogen']
        : ['gemini-3.1-flash-lite', 'gemini-4-hydrogen', 'gemini-3.5-transcribe'];

      let rawTranscript = '';
      let modelUsed = transcribeModels[0];
      let lastErr: any = null;

      for (const model of transcribeModels) {
        try {
          const config =
            model === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : undefined;

          const response: any = await Promise.race([
            ai.models.generateContent({
              model,
              contents: {
                parts: [mediaPart, { text: transcribePrompt }],
              },
              ...(config ? { config } : {}),
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Model ${model} timed out`)), 30000)
            ),
          ]);
          const textOut = (response?.text || '').trim();
          if (textOut) {
            rawTranscript = textOut.replace(/^["'`]+|["'`]+$/g, '').trim();
            modelUsed = model;
            break;
          }
        } catch (err: any) {
          lastErr = err;
          console.warn(`Voice-to-Voice transcribe model ${model} failed:`, err?.status, err?.message?.slice(0, 260));
        }
      }

      if (!rawTranscript) {
        const isQuota = isQuotaError(lastErr);
        return res.status(isQuota ? 429 : 500).json({
          error: isQuota
            ? 'ট্রান্সক্রিপশন API কোটা পূর্ণ হয়েছে। কিছুক্ষণ পর চেষ্টা করুন অথবা নিচের বক্সে কথাগুলো লিখে সরাসরি ভয়েস তৈরি করুন।'
            : (lastErr?.message || 'ভিডিও/অডিওতে স্পষ্ট কোনো কথা পাওয়া যায়নি। স্পষ্ট ভয়েস আছে এমন ভিডিও বা অডিও দিন।'),
        });
      }

      // Stage B: Strictly translate to target language when different from spoken language (never silently return wrong language)
      let finalTranscript = rawTranscript;
      const sourceLang = detectScriptLanguage(rawTranscript);

      if (
        targetLanguage !== 'original' &&
        (targetLanguage === 'bn' || targetLanguage === 'hi' || targetLanguage === 'en') &&
        sourceLang !== targetLanguage
      ) {
        try {
          const tRes = await translateTranscriptStrict(ai, rawTranscript, targetLanguage);
          finalTranscript = tRes.translatedText;
          modelUsed = `${modelUsed} + ${tRes.modelUsed}`;
        } catch (tErr: any) {
          const targetName =
            targetLanguage === 'hi' ? 'হিন্দি' : targetLanguage === 'en' ? 'ইংরেজি' : 'বাংলা';
          return res.status(502).json({
            error: `কথাগুলো শনাক্ত হয়েছে, কিন্তু ${targetName} ভাষায় অনুবাদে সাময়িক সমস্যা হয়েছে। দয়া করে আরেকবার চেষ্টা করুন।`,
            originalTranscript: rawTranscript,
            detail: String(tErr?.message || '').slice(0, 180),
          });
        }
      }

      const detectedLanguage = detectScriptLanguage(finalTranscript);
      return res.json({
        success: true,
        transcript: finalTranscript,
        originalTranscript: rawTranscript,
        detectedLanguage,
        modelUsed,
      });
    } catch (err: any) {
      console.error('Error in /api/voice-to-voice/transcribe:', err);
      return res.status(500).json({
        error: err?.message || 'ভিডিও বিশ্লেষণে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।',
      });
    }
  });

  // Standalone Script Translation Endpoint (when user switches dubbing language without re-uploading media)
  app.post('/api/voice-to-voice/translate', async (req, res) => {
    try {
      const { text, targetLanguage } = req.body || {};
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'অনুবাদ করার জন্য স্ক্রিপ্ট খালি।' });
      }
      if (targetLanguage !== 'bn' && targetLanguage !== 'hi' && targetLanguage !== 'en') {
        return res.json({
          success: true,
          transcript: text.trim(),
          detectedLanguage: detectScriptLanguage(text.trim()),
        });
      }

      const sourceLang = detectScriptLanguage(text.trim());
      if (sourceLang === targetLanguage) {
        return res.json({
          success: true,
          transcript: text.trim(),
          detectedLanguage: sourceLang,
        });
      }

      const ai = getAiClient();
      if (!ai) {
        return res.status(500).json({ error: 'GEMINI_API_KEY সেট করা নেই।' });
      }

      const tRes = await translateTranscriptStrict(ai, text.trim(), targetLanguage);
      return res.json({
        success: true,
        transcript: tRes.translatedText,
        detectedLanguage: detectScriptLanguage(tRes.translatedText),
        modelUsed: tRes.modelUsed,
      });
    } catch (err: any) {
      console.error('Error in /api/voice-to-voice/translate:', err);
      return res.status(502).json({
        error: err?.message || 'ভাষা অনুবাদে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।',
      });
    }
  });

  // Episode Generation Endpoint with gemini-3.8-flash
  app.post('/api/episodes/generate', async (req, res) => {
    try {
      const { prophetName = 'হযরত ইদরিস (আ.)', episodeNumber = 2, customInstructions = '' } = req.body;

      const ai = getAiClient();
      if (!ai) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please attach an API key in the Secrets panel.',
        });
      }

      const prompt = `Write a cinematic 1-minute 20-second (80 seconds total) Islamic documentary video script in Bengali for the prophetic history series.
Target Prophet / Topic: ${prophetName}
Episode Number: ${episodeNumber}
Tone: গভীর, ভাবগম্ভীর ও সিনেম্যাটিক (Deep, solemn and cinematic)
BGM: মৃদু ও রহস্যময় অ্যাম্বিয়েন্ট সুর, যা ধীরে ধীরে মহিমান্বিত রূপ নেয়
${customInstructions ? `Additional Instructions: ${customInstructions}` : ''}

Structure requirement: Exactly 5 chronological scenes matching the 1m 20s timeline:
1. [00:00 – 00:15] আকর্ষণীয় সূচনা (হুক / Hook)
2. [00:15 – 00:35] নবুওয়াত, পরিচয় বা বিশিষ্ট অবদান (Prophethood / Key significance)
3. [00:35 – 00:55] প্রধান ঘটনা, সাধনা বা জাতির প্রতি বার্তা (Key trial, calling, or teachings)
4. [00:55 – 01:10] তাওহীদের দাওয়াত ও শিক্ষা (Message of Tawhid & lasting lessons)
5. [01:10 – 01:20] আউটরো ও পরবর্তী পর্বের টিজার (Outro teasing next prophet in the series)

Ensure high-quality, authentic, reverent Bengali language.`;

      let response: any = null;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              systemInstruction: 'You are an acclaimed Islamic history documentarian and scriptwriter specializing in authentic Quranic narratives (কাসাসুল আম্বিয়া) in dignified Bengali. Respond with valid JSON matching the requested fields.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Title of the episode in Bengali' },
                  prophetName: { type: Type.STRING, description: 'Name of the Prophet with honorific' },
                  episodeNumber: { type: Type.INTEGER },
                  duration: { type: Type.STRING, description: 'Duration label e.g. ১ মিনিট ২০ সেকেন্ড' },
                  durationSeconds: { type: Type.INTEGER, description: 'Total seconds e.g. 80' },
                  tone: { type: Type.STRING, description: 'Tone in Bengali' },
                  bgmDescription: { type: Type.STRING, description: 'BGM notes in Bengali' },
                  outroTeaser: { type: Type.STRING, description: 'Text for teasing next episode' },
                  scenes: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        startSec: { type: Type.INTEGER },
                        endSec: { type: Type.INTEGER },
                        timestampLabel: { type: Type.STRING, description: 'e.g. 00:00 – 00:15' },
                        title: { type: Type.STRING, description: 'Scene title in Bengali' },
                        visualPrompt: { type: Type.STRING, description: 'Visual direction and camera cues in Bengali' },
                        voiceoverText: { type: Type.STRING, description: 'Bengali voiceover narration text' },
                      },
                      required: ['id', 'startSec', 'endSec', 'timestampLabel', 'title', 'visualPrompt', 'voiceoverText'],
                    },
                  },
                },
                required: ['title', 'prophetName', 'episodeNumber', 'duration', 'durationSeconds', 'tone', 'bgmDescription', 'scenes'],
              },
            },
          });
          if (response?.text) break;
        } catch (e: any) {
          lastErr = e;
          console.warn(`Attempt ${attempt} failed:`, e?.message);
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
          }
        }
      }

      if (!response?.text) {
        throw lastErr || new Error('Failed to generate episode after retries.');
      }

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, episode: parsed });
    } catch (err: any) {
      console.error('Error generating episode script:', err);
      return res.status(500).json({
        error: err?.message || 'Failed to generate episode script.',
      });
    }
  });

  // 1-Click AI Viral Script & 2-Character Dialogue Writer (gemini-4-hydrogen)
  app.post('/api/script/generate', async (req, res) => {
    try {
      const {
        mode = 'monologue',
        topic = '',
        genre = 'হরর ও ভৌতিক',
        language = 'bn',
        durationPreset = '60s',
        speaker1Name = 'চরিত্র ১',
        speaker2Name = 'চরিত্র ২',
        lineCount = 6,
      } = req.body || {};

      const cleanTopic = String(topic || '').trim();
      if (!cleanTopic) {
        return res.status(400).json({ error: 'অনুগ্রহ করে একটি গল্প বা ভিডিওর বিষয় লিখুন।' });
      }

      const ai = getAiClient();
      if (!ai) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server.',
        });
      }

      const langLabel =
        language === 'hi'
          ? 'natural conversational Hindi (Devanagari script)'
          : language === 'en'
          ? 'natural engaging English'
          : 'natural, vivid, engaging Bengali (বাংলা লিপি)';

      const callScriptModel = async (
        prompt: string,
        systemInstruction: string,
        responseSchema: any
      ): Promise<{ text: string; modelUsed: string }> => {
        const attempts: Array<{ model: string; timeoutMs: number }> = [
          { model: 'gemini-3.1-flash-lite', timeoutMs: 12000 },
          { model: 'gemini-4-hydrogen', timeoutMs: 18000 },
        ];
        let lastErr: any = null;
        for (let i = 0; i < attempts.length; i++) {
          const { model, timeoutMs } = attempts[i];
          try {
            const resp: any = await Promise.race([
              ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                  ...(model === 'gemini-4-hydrogen'
                    ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                    : {}),
                  systemInstruction,
                  responseMimeType: 'application/json',
                  responseSchema,
                },
              }),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Script model ${model} timed out`)), timeoutMs)
              ),
            ]);
            if (resp?.text) {
              return { text: resp.text, modelUsed: model };
            }
          } catch (e: any) {
            lastErr = e;
            console.warn(`Script generator attempt ${i + 1} (${model}) failed:`, e?.message?.slice(0, 220));
          }
        }
        throw lastErr || new Error('AI স্ক্রিপ্ট তৈরি করতে পারেনি।');
      };

      if (mode === 'dialogue') {
        const clampedLines = Math.max(4, Math.min(12, Number(lineCount) || 6));
        const prompt = `Write a catchy, viral short-form 2-character dialogue script in ${langLabel}.
Topic: ${cleanTopic}
Genre / Mood: ${genre}
Character 1 Name: ${speaker1Name}
Character 2 Name: ${speaker2Name}
Number of dialogue turns: ${clampedLines}

Rules:
- Start with an immediate hook in line 1 so viewers keep watching Reels/Shorts.
- Alternate naturally between speaker 1 and speaker 2 with crisp, punchy spoken lines (1-2 sentences per turn).
- Choose an accurate emotion for each line from: auto, happy, angry, scary, sad, whisper, excited.
- Return ONLY clean JSON matching the schema.`;

        const { text, modelUsed } = await callScriptModel(
          prompt,
          'You are a top viral Reels, YouTube Shorts, and animated drama scriptwriter. Always produce vivid, speakable, zero-filler dialogue strictly matching the requested JSON schema.',
          {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Catchy short video title (max 8 words) in the requested language' },
              lines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: { type: Type.INTEGER, description: '1 or 2' },
                    text: { type: Type.STRING, description: 'Spoken dialogue line without speaker prefix' },
                    emotion: { type: Type.STRING, description: 'One of: auto, happy, angry, scary, sad, whisper, excited' },
                  },
                  required: ['speaker', 'text', 'emotion'],
                },
              },
            },
            required: ['title', 'lines'],
          }
        );

        const parsed = JSON.parse(text);
        const validEmotions = new Set(['auto', 'happy', 'angry', 'scary', 'sad', 'whisper', 'excited']);
        const normalizedLines = Array.isArray(parsed.lines)
          ? parsed.lines
              .filter((l: any) => typeof l?.text === 'string' && l.text.trim())
              .map((l: any, i: number) => ({
                id: `ai-dl-${Date.now()}-${i}`,
                speaker: Number(l.speaker) === 2 ? 2 : 1,
                text: String(l.text).trim(),
                emotion: validEmotions.has(l.emotion) ? l.emotion : 'auto',
              }))
          : [];

        return res.json({
          success: true,
          mode: 'dialogue',
          title: String(parsed.title || cleanTopic).trim(),
          lines: normalizedLines,
          modelUsed,
        });
      }

      // Monologue mode (Full Voiceover Studio)
      const wordTarget =
        durationPreset === '30s'
          ? '55 to 75 words (~30 seconds)'
          : durationPreset === '90s'
          ? '165 to 210 words (~90 seconds)'
          : '110 to 145 words (~60 seconds)';

      const prompt = `Write a high-retention viral Reels / YouTube Shorts voiceover script in ${langLabel}.
Topic: ${cleanTopic}
Genre / Mood: ${genre}
Target Length: ${wordTarget}

Rules:
- Open immediately with an irresistible hook in the very first sentence.
- Write pure speakable narration in natural paragraphs (NO stage directions, NO brackets like [pause] or [music], NO speaker labels, NO markdown formatting).
- End with a punchy twist, emotional takeaway, or curiosity cliffhanger.
- Return clean JSON matching the schema.`;

      const { text, modelUsed } = await callScriptModel(
        prompt,
        'You are an elite short-form viral storyteller and voiceover scriptwriter. Output pure, natural, spoken narration ready for TTS with zero markdown or bracketed stage cues.',
        {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Catchy short video title (max 8 words) in the requested language' },
            script: { type: Type.STRING, description: 'Complete speakable voiceover narration paragraphs without stage directions' },
          },
          required: ['title', 'script'],
        }
      );

      const parsed = JSON.parse(text);
      return res.json({
        success: true,
        mode: 'monologue',
        title: String(parsed.title || cleanTopic).trim(),
        script: String(parsed.script || '').trim(),
        modelUsed,
      });
    } catch (err: any) {
      console.error('Error in /api/script/generate:', err);
      return res.status(500).json({
        error: err?.message || 'AI স্ক্রিপ্ট তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
      });
    }
  });

  // Free AI Auto-Storyboard Scene Planner (maps script beats to chronological HD artwork scenes + particle + BGM + 3s hook)
  app.post('/api/storyboard/plan', async (req, res) => {
    try {
      const { scriptText = '', title = '', voiceName = '' } = req.body || {};
      const cleanScript = String(scriptText).trim();
      if (!cleanScript) {
        return res.status(400).json({ error: 'স্টোরিবোর্ড বানাতে আগে একটি স্ক্রিপ্ট লিখুন।' });
      }

      const ai = getAiClient();
      if (!ai) {
        return res.status(500).json({ error: 'GEMINI_API_KEY সেট করা নেই।' });
      }

      const catalog = [
        { id: 'horror-1', desc: 'Dark haunted misty midnight forest with twisted trees and eerie moonlight' },
        { id: 'horror-2', desc: 'Old abandoned haunted mansion in thunderstorm at night' },
        { id: 'horror-3', desc: 'Creepy dimly lit dark corridor with shadows and mystery' },
        { id: 'fantasy-1', desc: 'Magical bright fairytale meadow with glowing flowers and sunshine' },
        { id: 'fantasy-2', desc: 'Cute whimsical cartoon treehouse village in warm colorful sunlight' },
        { id: 'fantasy-3', desc: 'Dreamy rainbow clouds in bright pastel sky for kids and magic' },
        { id: 'scifi-1', desc: 'Epic shattered-moon alien planet battlefield (Thanos / Titan cosmic scale)' },
        { id: 'scifi-2', desc: 'Deep glowing purple-gold cosmic space nebula and stars' },
        { id: 'scifi-3', desc: 'Futuristic neon cyberpunk metropolis city at night' },
        { id: 'nature-1', desc: 'Golden dawn meadow with soft morning dew and rising light' },
        { id: 'nature-2', desc: 'Lush heavenly green paradise garden with flowing streams' },
        { id: 'nature-3', desc: 'Majestic ancient celestial tree overlooking valleys and clouds' },
        { id: 'nature-4', desc: 'Ancient historical civilization, warm torchlight and heritage' },
        { id: 'nature-5', desc: 'Vast peaceful starlit night cosmos sky with glowing stars' },
      ];
      const validIds = new Set(catalog.map((c) => c.id));
      const validParticles = new Set(['none', 'rain', 'embers', 'fog', 'snow', 'sparkles']);
      const validBgms = new Set(['none', 'horror', 'islamic', 'epic', 'cute', 'sad']);

      const prompt = `Analyze this voiceover script and direct a 3 to 5 scene chronological visual storyboard for a viral Reels / YouTube video.

Title: ${title || 'Untitled'}
Voice Persona: ${voiceName || 'Narrator'}
Script:
${cleanScript.slice(0, 2600)}

Available HD Scene Artworks (pick ONLY from these exact IDs, in chronological narrative order):
${catalog.map((c) => `- ${c.id}: ${c.desc}`).join('\n')}

Choose:
1. 3 to 5 scenes (distinct photoIds when possible) matching beginning -> climax -> ending of the script.
2. recommendedParticle: one of none, rain, embers, fog, snow, sparkles.
3. recommendedBgm: one of none, horror, islamic, epic, cute, sad.
4. suggestedHook: a short 3 to 5 word viral Bengali hook banner (e.g. "সতর্কতা: একা দেখবেন না!" or "শেষ পর্যন্ত দেখুন!").
5. slideDurationSec: one of 0 (auto even split), 3, 5, or 8.

Return ONLY valid JSON matching the schema.`;

      const attempts = [
        { model: 'gemini-3.1-flash-lite', timeoutMs: 12000 },
        { model: 'gemini-4-hydrogen', timeoutMs: 18000 },
      ];

      let parsed: any = null;
      let modelUsed = 'gemini-3.1-flash-lite';
      let lastErr: any = null;

      for (const { model, timeoutMs } of attempts) {
        try {
          const response = await Promise.race([
            ai.models.generateContent({
              model,
              contents: prompt,
              config: {
                systemInstruction:
                  'You are a cinematic video director for viral Bengali Reels & YouTube Shorts. Always return strict JSON matching the schema.',
                responseMimeType: 'application/json',
                ...(model === 'gemini-4-hydrogen'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    scenes: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          photoId: { type: Type.STRING },
                          sceneTitle: { type: Type.STRING, description: 'Short 2-5 word Bengali label for this scene' },
                          reason: { type: Type.STRING, description: 'Brief Bengali reason why this visual matches' },
                        },
                        required: ['photoId', 'sceneTitle'],
                      },
                    },
                    recommendedParticle: { type: Type.STRING },
                    recommendedBgm: { type: Type.STRING },
                    suggestedHook: { type: Type.STRING },
                    slideDurationSec: { type: Type.INTEGER },
                  },
                  required: ['scenes', 'recommendedParticle', 'recommendedBgm', 'suggestedHook'],
                },
              },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
            ),
          ]);
          const txt = (response.text || '').trim();
          if (txt) {
            parsed = JSON.parse(txt);
            modelUsed = model;
            break;
          }
        } catch (err: any) {
          lastErr = err;
          console.warn(`Storyboard plan attempt (${model}) failed:`, err?.message?.slice(0, 180));
        }
      }

      if (!parsed) {
        throw lastErr || new Error('স্টোরিবোর্ড তৈরি করা যায়নি।');
      }

      const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
      const cleanScenes = rawScenes
        .filter((s: any) => s && validIds.has(String(s.photoId)))
        .slice(0, 5)
        .map((s: any) => ({
          photoId: String(s.photoId),
          sceneTitle: String(s.sceneTitle || 'দৃশ্য').trim(),
          reason: String(s.reason || '').trim(),
        }));

      if (cleanScenes.length === 0) {
        cleanScenes.push(
          { photoId: 'nature-1', sceneTitle: 'সূচনা দৃশ্য', reason: 'গল্পের শুরু' },
          { photoId: 'nature-3', sceneTitle: 'মূল দৃশ্য', reason: 'গল্পের মধ্যভাগ' },
          { photoId: 'nature-5', sceneTitle: 'সমাপ্তি দৃশ্য', reason: 'গল্পের শেষ' }
        );
      }

      const rawDur = Number(parsed.slideDurationSec);
      const slideDurationSec = [0, 3, 5, 8].includes(rawDur) ? rawDur : 0;

      return res.json({
        success: true,
        scenes: cleanScenes,
        recommendedParticle: validParticles.has(parsed.recommendedParticle)
          ? parsed.recommendedParticle
          : 'none',
        recommendedBgm: validBgms.has(parsed.recommendedBgm) ? parsed.recommendedBgm : 'none',
        suggestedHook: String(parsed.suggestedHook || 'শেষ পর্যন্ত দেখুন!').trim().slice(0, 50),
        slideDurationSec,
        modelUsed,
      });
    } catch (err: any) {
      console.error('Error in /api/storyboard/plan:', err);
      return res.status(500).json({
        error: err?.message || 'AI স্টোরিবোর্ড তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
      });
    }
  });

  // Real universal H.264 + AAC MP4 conversion endpoint (never mislabel WebM as MP4)
  app.post(
    '/api/video/convert-mp4',
    express.raw({ type: ['video/*', 'application/octet-stream'], limit: '150mb' }),
    async (req, res) => {
      const rawBuf = req.body;
      if (!Buffer.isBuffer(rawBuf) || rawBuf.length < 512) {
        return res.status(400).json({ error: 'সঠিক ভিডিও ফাইল পাওয়া যায়নি।' });
      }

      const rawFps = Number(req.query.fps);
      const safeFps = rawFps === 60 ? 60 : 30;
      const uid = crypto.randomUUID();
      const inPath = path.join(os.tmpdir(), `nasrullah_in_${uid}.webm`);
      const outPath = path.join(os.tmpdir(), `nasrullah_out_${uid}.mp4`);

      try {
        await fs.promises.writeFile(inPath, rawBuf);

        await new Promise<void>((resolve, reject) => {
          const args = [
            '-y',
            '-i',
            inPath,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '20',
            '-pix_fmt',
            'yuv420p',
            '-r',
            String(safeFps),
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-ar',
            '48000',
            '-movflags',
            '+faststart',
            outPath,
          ];
          execFile('ffmpeg', args, { timeout: 180_000, maxBuffer: 8 * 1024 * 1024 }, (err, _stdout, stderr) => {
            if (err) {
              console.error('FFmpeg convert-mp4 error:', err.message, stderr?.slice(-400));
              reject(new Error('MP4 কনভার্ট করতে সমস্যা হয়েছে।'));
              return;
            }
            resolve();
          });
        });

        const mp4Buf = await fs.promises.readFile(outPath);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Length', String(mp4Buf.length));
        return res.send(mp4Buf);
      } catch (err: any) {
        console.error('Error in /api/video/convert-mp4:', err);
        return res.status(500).json({ error: err?.message || 'MP4 কনভার্শন ব্যর্থ হয়েছে।' });
      } finally {
        fs.promises.unlink(inPath).catch(() => {});
        fs.promises.unlink(outPath).catch(() => {});
      }
    }
  );

  // AI Auto-Synced Lyrics & Subtitle Generator for Music / Songs / Nasheed (short or long)
  app.post(
    '/api/music/transcribe-lyrics',
    express.raw({ type: ['audio/*', 'video/*', 'application/octet-stream'], limit: '50mb' }),
    async (req, res) => {
      const ai = getAiClient();
      if (!ai) {
        return res.status(503).json({
          error: 'সার্ভারে AI API কী সেট করা নেই। অনুগ্রহ করে Settings > Secrets থেকে চেক করুন।',
        });
      }

      const rawBuf = req.body;
      if (!Buffer.isBuffer(rawBuf) || rawBuf.length < 256) {
        return res.status(400).json({ error: 'সঠিক অডিও বা গানের ফাইল আপলোড করুন।' });
      }

      const startSec = Math.max(0, Number(req.query.startSec) || 0);
      const rawEndSec = Number(req.query.endSec) || 0;
      const totalDurHint = Math.max(1, Number(req.query.durationSec) || 30);
      const effectiveDuration =
        rawEndSec > startSec + 0.5 ? Math.min(rawEndSec - startSec, 480) : Math.min(totalDurHint, 480);

      const languageHint = String(req.query.language || 'auto').slice(0, 24);
      const includeTranslation = req.query.includeTranslation === 'true';
      const userLyricsHint = typeof req.headers['x-lyrics-hint'] === 'string'
        ? decodeURIComponent(req.headers['x-lyrics-hint']).slice(0, 4000)
        : '';

      const uid = crypto.randomUUID();
      const inPath = path.join(os.tmpdir(), `nasrullah_music_in_${uid}.bin`);
      const mp3Path = path.join(os.tmpdir(), `nasrullah_music_out_${uid}.mp3`);

      try {
        await fs.promises.writeFile(inPath, rawBuf);

        // Compress & optionally trim audio to lightweight 64kbps mono MP3 via FFmpeg so long songs upload fast to Gemini
        await new Promise<void>((resolve, reject) => {
          const ffArgs: string[] = ['-y'];
          if (startSec > 0.05) {
            ffArgs.push('-ss', startSec.toFixed(2));
          }
          ffArgs.push('-i', inPath);
          if (rawEndSec > startSec + 0.5) {
            ffArgs.push('-t', (rawEndSec - startSec).toFixed(2));
          } else {
            ffArgs.push('-t', '480');
          }
          ffArgs.push('-vn', '-ac', '1', '-ar', '22050', '-b:a', '64k', '-f', 'mp3', mp3Path);

          execFile('ffmpeg', ffArgs, { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 }, (err, _stdout, stderr) => {
            if (err) {
              console.error('FFmpeg music prep error:', err.message, stderr?.slice(-300));
              reject(new Error('অডিও ফাইলটি প্রসেস করা যায়নি। সঠিক MP3/WAV/M4A/MP4 ফাইল দিন।'));
              return;
            }
            resolve();
          });
        });

        const mp3Buf = await fs.promises.readFile(mp3Path);
        if (mp3Buf.length < 128) {
          throw new Error('অডিও ট্র্যাকটি খালি বা নষ্ট হয়ে গেছে।');
        }

        const audioPart = {
          inlineData: {
            mimeType: 'audio/mp3',
            data: mp3Buf.toString('base64'),
          },
        };

        const langInstruction =
          languageHint === 'bn'
            ? 'The song/audio is primarily in Bengali (বাংলা). Transcribe lyrics cleanly in natural Bengali Unicode script.'
            : languageHint === 'hi'
            ? 'The song/audio is primarily in Hindi/Urdu. Transcribe cleanly in Devanagari or natural romanized Hindi/Bengali as appropriate.'
            : languageHint === 'ar'
            ? 'The song/nasheed is primarily in Arabic. Transcribe cleanly in Arabic script.'
            : languageHint === 'en'
            ? 'The song/audio is primarily in English. Transcribe cleanly in English.'
            : 'Detect the exact sung/spoken language automatically (Bengali, Hindi, Urdu, Arabic, English, etc.) and write each lyric line in its native script.';

        const translationInstruction = includeTranslation
          ? 'For EVERY lyric line, ALSO provide a concise, poetic, natural Bengali (বাংলা) meaning/translation in the "subText" field (if the song is already in Bengali, provide a short poetic English sub-line in "subText").'
          : 'Leave "subText" empty string "" unless there is a chorus echo.';

        const hintSection = userLyricsHint.trim()
          ? `\nThe user provided these reference lyrics — align the EXACT startSec and endSec timestamps to match when each line is actually sung in the audio:\n${userLyricsHint.trim()}\n`
          : '';

        const prompt = `Listen carefully to this entire ${effectiveDuration.toFixed(1)}-second music/song audio track from 0.0s to ${effectiveDuration.toFixed(1)}s.
Your job is to create aesthetic, beat-synced subtitle lyrics for a viral YouTube Shorts / Reels music video.

Rules:
1. ${langInstruction}
2. ${translationInstruction}
3. Break lyrics into short, emotional, visually balanced lines (3 to 8 words per line) that look gorgeous centered on a vertical or horizontal music video.
4. Timestamps (startSec and endSec in seconds, decimal precision like 1.4, 4.8) MUST match the exact moments each lyric line is sung in the audio! Skip pure instrumental intros/outros or silence.
5. Ensure startSec < endSec, lines are in chronological order, and all timestamps are within [0, ${effectiveDuration.toFixed(1)}].
6. If the audio is purely instrumental with zero singing/vocals, return 3-5 short poetic mood captions spaced gently across the track and set isInstrumental: true.
${hintSection}
Return ONLY valid JSON matching the schema.`;

        const attempts = [
          { model: 'gemini-4-hydrogen', timeoutMs: 45000 },
          { model: 'gemini-3.1-flash-lite', timeoutMs: 35000 },
        ];

        let parsed: any = null;
        let modelUsed = 'gemini-4-hydrogen';
        let lastErr: any = null;

        for (const { model, timeoutMs } of attempts) {
          try {
            const response = await Promise.race([
              ai.models.generateContent({
                model,
                contents: { parts: [audioPart, { text: prompt }] },
                config: {
                  systemInstruction:
                    'You are a precision music lyric transcription & subtitle timing specialist. Output strict JSON matching the schema with accurate audio-aligned timestamps.',
                  responseMimeType: 'application/json',
                  ...(model === 'gemini-4-hydrogen'
                    ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                    : {}),
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      detectedLanguage: { type: Type.STRING },
                      suggestedTitle: { type: Type.STRING },
                      isInstrumental: { type: Type.BOOLEAN },
                      lines: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            startSec: { type: Type.NUMBER },
                            endSec: { type: Type.NUMBER },
                            text: { type: Type.STRING },
                            subText: { type: Type.STRING },
                          },
                          required: ['startSec', 'endSec', 'text'],
                        },
                      },
                    },
                    required: ['lines'],
                  },
                },
              }),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
              ),
            ]);

            const txt = (response.text || '').trim();
            if (txt) {
              parsed = JSON.parse(txt);
              modelUsed = model;
              break;
            }
          } catch (err: any) {
            lastErr = err;
            console.warn(`Music lyrics attempt (${model}) failed:`, err?.message?.slice(0, 220));
          }
        }

        // Fallback to dedicated gemini-3.5-transcribe if structured JSON multimodal attempts fail
        if (!parsed) {
          try {
            const trResp = await ai.models.generateContent({
              model: 'gemini-3.5-transcribe',
              contents: { parts: [audioPart, { text: 'Transcribe the lyrics or speech in this audio clearly line by line.' }] },
            });
            const plain = (trResp.text || '').trim();
            if (plain) {
              const rawLines = plain
                .split(/\n+/)
                .map((l) => l.trim())
                .filter(Boolean);
              const perLine = effectiveDuration / Math.max(1, rawLines.length);
              parsed = {
                detectedLanguage: languageHint,
                suggestedTitle: rawLines[0]?.slice(0, 48) || '',
                isInstrumental: false,
                lines: rawLines.map((line, i) => ({
                  startSec: Number((i * perLine).toFixed(2)),
                  endSec: Number(Math.min(effectiveDuration, (i + 1) * perLine).toFixed(2)),
                  text: line,
                  subText: '',
                })),
              };
              modelUsed = 'gemini-3.5-transcribe';
            }
          } catch (trErr: any) {
            lastErr = trErr;
          }
        }

        if (!parsed || !Array.isArray(parsed.lines)) {
          throw lastErr || new Error('গান থেকে লিরিক্স বের করা যায়নি। আবার চেষ্টা করুন।');
        }

        const cleanLines = parsed.lines
          .filter((l: any) => l && typeof l.text === 'string' && l.text.trim().length > 0)
          .map((l: any, idx: number) => {
            const s = Math.max(0, Math.min(effectiveDuration - 0.1, Number(l.startSec) || 0));
            const e = Math.max(s + 0.35, Math.min(effectiveDuration, Number(l.endSec) || s + 3));
            return {
              id: `lyr_${idx + 1}_${Date.now()}`,
              startSec: Number(s.toFixed(2)),
              endSec: Number(e.toFixed(2)),
              text: String(l.text).trim(),
              subText: typeof l.subText === 'string' ? l.subText.trim() : '',
            };
          })
          .sort((a: any, b: any) => a.startSec - b.startSec);

        return res.json({
          success: true,
          detectedLanguage: String(parsed.detectedLanguage || languageHint),
          suggestedTitle: String(parsed.suggestedTitle || '').trim(),
          isInstrumental: Boolean(parsed.isInstrumental),
          lines: cleanLines,
          modelUsed,
        });
      } catch (err: any) {
        console.error('Error in /api/music/transcribe-lyrics:', err);
        return res.status(500).json({
          error: err?.message || 'অডিও থেকে অটো লিরিক্স তৈরি করতে সমস্যা হয়েছে।',
        });
      } finally {
        fs.promises.unlink(inPath).catch(() => {});
        fs.promises.unlink(mp3Path).catch(() => {});
      }
    }
  );

  // Vite middleware in dev or static serving in prod
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Prophet Stories Script & Voice Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
