import { VoicePersona } from '../types.ts';

// In-memory cache for generated base64 audio clips: key = `${voiceName}-${hash(text)}`
const audioCache: Map<string, { base64: string; blobUrl: string; duration: number }> = new Map();

const DB_NAME = 'kasasul_audio_db';
const STORE_NAME = 'clips';

function openAudioDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readFromIdb(key: string): Promise<{ base64: string; duration: number; voiceName?: string; updatedAt?: number } | null> {
  const db = await openAudioDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeToIdb(record: { key: string; base64: string; duration: number; voiceName?: string; updatedAt: number }): Promise<void> {
  const db = await openAudioDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function saveEpisodeFullAudio(
  episodeId: string,
  data: { base64: string; duration: number; voiceName: string }
): Promise<void> {
  await writeToIdb({
    key: `episode_full_${episodeId}`,
    base64: data.base64,
    duration: data.duration,
    voiceName: data.voiceName,
    updatedAt: Date.now(),
  });
}

export async function loadEpisodeFullAudio(
  episodeId: string
): Promise<{ base64: string; blobUrl: string; duration: number; voiceName?: string } | null> {
  const saved = await readFromIdb(`episode_full_${episodeId}`);
  if (!saved?.base64) return null;
  const blobUrl = base64ToBlobUrl(saved.base64, 'audio/wav');
  return {
    base64: saved.base64,
    blobUrl,
    duration: saved.duration,
    voiceName: saved.voiceName,
  };
}

function getCacheKey(text: string, voiceName: string, style = ''): string {
  const input = `${voiceName}|${style}|${text}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `${voiceName}-${hash}`;
}

export function base64ToBlobUrl(base64: string, mimeType = 'audio/wav'): string {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export async function measureAudioDuration(blobUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = blobUrl;
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration || 10);
    });
    audio.addEventListener('error', () => {
      resolve(10);
    });
  });
}

export interface TtsProgress {
  completed: number;
  total: number;
  percent: number;
  message: string;
}

export interface TtsModelUsage {
  id: string;
  label: string;
  requestsToday: number;
  freeDailyLimit: number | null;
  exhaustedToday: boolean;
  lastSuccessAt?: string;
}

export interface TtsUsageSummary {
  date: string;
  totalVoiceovers: number;
  totalAudioSeconds: number;
  totalCharacters: number;
  lastModelUsed?: string;
  lastUpdatedAt?: string;
  models: TtsModelUsage[];
}

export async function fetchTtsUsage(): Promise<TtsUsageSummary | null> {
  try {
    const res = await fetch('/api/tts/usage');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateSpeechWithProgress({
  text,
  voiceName = 'Fenrir',
  style,
  voiceControls,
  forceRefresh = false,
  targetDurationSec,
  onProgress,
}: {
  text: string;
  voiceName?: VoicePersona;
  style?: string;
  voiceControls?: import('../types.ts').VoiceControls;
  forceRefresh?: boolean;
  targetDurationSec?: number;
  onProgress?: (progress: TtsProgress) => void;
}): Promise<{ base64: string; blobUrl: string; duration: number; modelUsed?: string; usage?: TtsUsageSummary }> {
  const durTag = targetDurationSec ? `|dur:${Math.round(targetDurationSec)}` : '';
  const ctrlTag = voiceControls
    ? `|p:${voiceControls.pitch}|s:${voiceControls.speed}|e:${voiceControls.echo}|em:${voiceControls.emotion}`
    : '';
  const cacheKey = getCacheKey(text, voiceName, `${style || ''}${durTag}${ctrlTag}`);
  if (!forceRefresh) {
    if (audioCache.has(cacheKey)) {
      onProgress?.({ completed: 1, total: 1, percent: 100, message: 'ক্যাশ থেকে প্রস্তুত' });
      return audioCache.get(cacheKey)!;
    }
    const idbHit = await readFromIdb(cacheKey);
    if (idbHit?.base64) {
      const blobUrl = base64ToBlobUrl(idbHit.base64, 'audio/wav');
      const restored = { base64: idbHit.base64, blobUrl, duration: idbHit.duration };
      audioCache.set(cacheKey, restored);
      onProgress?.({ completed: 1, total: 1, percent: 100, message: 'সংরক্ষিত স্টোরেজ থেকে প্রস্তুত (কোটা খরচ হয়নি)' });
      return restored;
    }
  }

  const response = await fetch('/api/tts/generate-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceName,
      style: style || 'Solemn, cinematic, respectful, deep Bengali documentary narrator with dignified cadence',
      ...(voiceControls ? { voiceControls } : {}),
      ...(targetDurationSec && targetDurationSec >= 1 ? { targetDurationSec } : {}),
    }),
  });

  if (!response.ok || !response.body) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `TTS generation failed with HTTP status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  type SpeechResult = {
    base64: string;
    blobUrl: string;
    duration: number;
    modelUsed?: string;
    usage?: TtsUsageSummary;
  };
  let finalResult: SpeechResult | null = null;

  const processLine = async (line: string): Promise<SpeechResult | null> => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return null;
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr) return null;

    const event = JSON.parse(jsonStr);
    if (event.type === 'progress') {
      onProgress?.({
        completed: event.completed ?? 0,
        total: event.total ?? 1,
        percent: event.percent ?? 10,
        message: event.message || 'ভয়েস তৈরি হচ্ছে...',
      });
      return null;
    } else if (event.type === 'error') {
      throw new Error(event.error || 'ভয়েস তৈরিতে সমস্যা হয়েছে।');
    } else if (event.type === 'done') {
      if (!event.audioBase64) {
        throw new Error('সার্ভার থেকে অডিও ডেটা পাওয়া যায়নি।');
      }
      const blobUrl = base64ToBlobUrl(event.audioBase64, event.mimeType || 'audio/wav');
      const duration = event.durationSec || (await measureAudioDuration(blobUrl));
      return {
        base64: event.audioBase64,
        blobUrl,
        duration,
        modelUsed: event.modelUsed,
        usage: event.usage,
      };
    }
    return null;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const parsed = await processLine(line);
      if (parsed) finalResult = parsed;
      newlineIndex = buffer.indexOf('\n');
    }
  }

  if (buffer.trim()) {
    const parsed = await processLine(buffer);
    if (parsed) finalResult = parsed;
  }

  if (!finalResult) {
    throw new Error('অডিও জেনারেশন সম্পূর্ণ হওয়ার আগেই সংযোগ বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।');
  }

  const completedAudio: SpeechResult = finalResult;
  audioCache.set(cacheKey, completedAudio);
  writeToIdb({
    key: cacheKey,
    base64: completedAudio.base64,
    duration: completedAudio.duration,
    voiceName,
    updatedAt: Date.now(),
  }).catch(() => {});
  return completedAudio;
}

export async function generateSpeech({
  text,
  voiceName = 'Fenrir',
  style,
  forceRefresh = false,
}: {
  text: string;
  voiceName?: VoicePersona;
  style?: string;
  forceRefresh?: boolean;
}): Promise<{ base64: string; blobUrl: string; duration: number }> {
  const cacheKey = getCacheKey(text, voiceName, style || '');
  if (!forceRefresh) {
    if (audioCache.has(cacheKey)) {
      return audioCache.get(cacheKey)!;
    }
    const idbHit = await readFromIdb(cacheKey);
    if (idbHit?.base64) {
      const blobUrl = base64ToBlobUrl(idbHit.base64, 'audio/wav');
      const restored = { base64: idbHit.base64, blobUrl, duration: idbHit.duration };
      audioCache.set(cacheKey, restored);
      return restored;
    }
  }

  const response = await fetch('/api/tts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceName,
      style: style || 'Solemn, cinematic, respectful, deep Bengali documentary narrator with dignified cadence',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `TTS generation failed with HTTP status ${response.status}`);
  }

  const data = await response.json();
  if (!data.audioBase64) {
    throw new Error('Server returned empty audio data from gemini-3.8-flash-tts');
  }

  const blobUrl = base64ToBlobUrl(data.audioBase64, data.mimeType || 'audio/wav');
  const duration = await measureAudioDuration(blobUrl);

  const result = {
    base64: data.audioBase64,
    blobUrl,
    duration,
  };

  audioCache.set(cacheKey, result);
  writeToIdb({
    key: cacheKey,
    base64: result.base64,
    duration: result.duration,
    voiceName,
    updatedAt: Date.now(),
  }).catch(() => {});
  return result;
}

export function downloadWav(base64: string, filename: string) {
  const blobUrl = base64ToBlobUrl(base64);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename.endsWith('.wav') ? filename : `${filename}.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

export async function generateDialogueWithProgress({
  speaker1,
  speaker2,
  lines,
  pauseMs = 280,
  onProgress,
}: {
  speaker1: { name: string; voiceName: VoicePersona };
  speaker2: { name: string; voiceName: VoicePersona };
  lines: Array<{ id: string; speaker: 1 | 2; text: string; emotion?: import('../types.ts').VoiceEmotion }>;
  pauseMs?: number;
  onProgress?: (progress: TtsProgress) => void;
}): Promise<{
  base64: string;
  blobUrl: string;
  duration: number;
  timeline: import('../types.ts').DialogueTimelineItem[];
  modelUsed?: string;
  usage?: TtsUsageSummary;
}> {
  const response = await fetch('/api/tts/dialogue-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speaker1, speaker2, lines, pauseMs }),
  });

  if (!response.ok || !response.body) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Dialogue generation failed (HTTP ${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalResult: {
    base64: string;
    blobUrl: string;
    duration: number;
    timeline: import('../types.ts').DialogueTimelineItem[];
    modelUsed?: string;
    usage?: TtsUsageSummary;
  } | null = null;

  const processLine = async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr) return;
    const event = JSON.parse(jsonStr);
    if (event.type === 'progress') {
      onProgress?.({
        completed: event.completed ?? 0,
        total: event.total ?? lines.length,
        percent: event.percent ?? 10,
        message: event.message || 'সংলাপ তৈরি হচ্ছে...',
      });
    } else if (event.type === 'error') {
      throw new Error(event.error || 'সংলাপ অডিও তৈরিতে সমস্যা হয়েছে।');
    } else if (event.type === 'done') {
      const blobUrl = base64ToBlobUrl(event.audioBase64, event.mimeType || 'audio/wav');
      const duration = event.durationSec || (await measureAudioDuration(blobUrl));
      finalResult = {
        base64: event.audioBase64,
        blobUrl,
        duration,
        timeline: event.timeline || [],
        modelUsed: event.modelUsed,
        usage: event.usage,
      };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf('\n');
    while (nl !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      await processLine(line);
      nl = buffer.indexOf('\n');
    }
  }
  if (buffer.trim()) await processLine(buffer);

  if (!finalResult) {
    throw new Error('সংলাপ অডিও সম্পন্ন হওয়ার আগেই সংযোগ বিচ্ছিন্ন হয়েছে।');
  }
  return finalResult;
}

