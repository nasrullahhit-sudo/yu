export type DubbingTargetLanguage = 'bn' | 'original' | 'hi' | 'en';

export interface ExtractedMediaAudio {
  base64: string;
  mimeType: string;
  durationSec: number;
}

export interface TranscribeResult {
  transcript: string;
  detectedLanguage: 'bn' | 'hi' | 'en';
  modelUsed: string;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x4000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(''));
}

function encodeAudioBufferToWav(audioBuffer: AudioBuffer, maxSeconds = 300): {
  wavBytes: Uint8Array;
  durationSec: number;
} {
  const srcRate = audioBuffer.sampleRate;
  const totalSrcSamples = Math.min(audioBuffer.length, Math.floor(srcRate * maxSeconds));
  const numChannels = audioBuffer.numberOfChannels;
  const durationSec = totalSrcSamples / srcRate;

  // Mix down to mono
  const mono = new Float32Array(totalSrcSamples);
  if (numChannels === 1) {
    mono.set(audioBuffer.getChannelData(0).subarray(0, totalSrcSamples));
  } else {
    for (let ch = 0; ch < numChannels; ch++) {
      const chData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < totalSrcSamples; i++) {
        mono[i] += chData[i] / numChannels;
      }
    }
  }

  // Use 16kHz for <= 2 min clips and 12kHz for 2–5 min clips so payload stays fast and well below proxy limits
  const targetRate = durationSec > 120 ? 12000 : 16000;
  const outLen = Math.max(1, Math.round((totalSrcSamples * targetRate) / srcRate));
  const ratio = srcRate / targetRate;
  const pcmByteLen = outLen * 2;
  const wavBuffer = new ArrayBuffer(44 + pcmByteLen);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcmByteLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeStr(36, 'data');
  view.setUint32(40, pcmByteLen, true);

  let offset = 44;
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const idx0 = Math.min(totalSrcSamples - 1, Math.floor(pos));
    const idx1 = Math.min(totalSrcSamples - 1, idx0 + 1);
    const frac = pos - idx0;
    const sample = mono[idx0] * (1 - frac) + mono[idx1] * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, Math.round(clamped * 32767), true);
    offset += 2;
  }

  return {
    wavBytes: new Uint8Array(wavBuffer),
    durationSec,
  };
}

/**
 * Extracts a compact Mono WAV track from any uploaded video or audio file right in the browser.
 * Falls back to raw file base64 if Web Audio cannot decode the container directly.
 */
export async function extractAudioForTranscription(file: File): Promise<ExtractedMediaAudio> {
  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (AudioCtx) {
    const ctx = new AudioCtx();
    try {
      const arrayBuffer = await file.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      const { wavBytes, durationSec } = encodeAudioBufferToWav(decoded, 300);
      return {
        base64: uint8ToBase64(wavBytes),
        mimeType: 'audio/wav',
        durationSec,
      };
    } catch (decodeErr) {
      console.warn('Browser decodeAudioData failed, falling back to direct media upload:', decodeErr);
    } finally {
      ctx.close().catch(() => {});
    }
  }

  // Fallback for video/audio codecs not decoded by Web Audio (re-read fresh bytes only if <= 18MB)
  if (file.size > 18 * 1024 * 1024) {
    throw new Error(
      'এই ভিডিও ফাইলটির অডিও ট্র্যাক ব্রাউজার ডিকোড করতে পারেনি এবং ফাইলটি ১৮ এমবি-র বড়। অনুগ্রহ করে ছোট MP4, WebM বা MP3 ফাইল আপলোড করুন।'
    );
  }
  const rawBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(rawBuffer);
  const cleanMime = (file.type || '').split(';')[0].trim().toLowerCase();
  const fallbackMime =
    cleanMime ||
    (file.name.toLowerCase().endsWith('.mp4')
      ? 'video/mp4'
      : file.name.toLowerCase().endsWith('.webm')
      ? 'audio/webm'
      : file.name.toLowerCase().endsWith('.wav')
      ? 'audio/wav'
      : 'audio/mpeg');

  return {
    base64: uint8ToBase64(bytes),
    mimeType: fallbackMime,
    durationSec: 0,
  };
}

export async function transcribeMediaForVoiceToVoice(params: {
  mediaBase64: string;
  mimeType: string;
  targetLanguage: DubbingTargetLanguage;
}): Promise<TranscribeResult> {
  const response = await fetch('/api/voice-to-voice/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 413) {
      throw new Error('ফাইলটি অনেক বড় হয়ে গেছে (413)। অনুগ্রহ করে ৩ মিনিটের কম দৈর্ঘ্যের ভিডিও/অডিও দিন।');
    }
    if (response.status === 502 || response.status === 504) {
      throw new Error('সার্ভার রেসপন্স করতে বেশি সময় নিয়েছে (Timeout)। একটু ছোট ক্লিপ দিয়ে আবার চেষ্টা করুন।');
    }
    throw new Error(
      data.error || `ভিডিও/অডিও থেকে কথা শনাক্ত করতে সমস্যা হয়েছে (HTTP ${response.status})।`
    );
  }

  return {
    transcript: data.transcript || '',
    detectedLanguage: data.detectedLanguage || 'bn',
    modelUsed: data.modelUsed || 'gemini-3.5-transcribe',
  };
}

export async function translateTranscriptForVoiceToVoice(params: {
  text: string;
  targetLanguage: DubbingTargetLanguage;
}): Promise<{ transcript: string; detectedLanguage: 'bn' | 'hi' | 'en'; modelUsed?: string }> {
  const response = await fetch('/api/voice-to-voice/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `ভাষা অনুবাদে সমস্যা হয়েছে (HTTP ${response.status})।`);
  }
  return {
    transcript: data.transcript || params.text,
    detectedLanguage: data.detectedLanguage || 'bn',
    modelUsed: data.modelUsed,
  };
}

/**
 * Muxes the uploaded video visuals with the newly generated AI model voice right inside the browser
 * into a downloadable .webm video file (zero server ffmpeg required).
 */
export async function exportVideoWithNewVoice(params: {
  videoUrl: string;
  audioBlobUrl: string;
  originalAudioVolume: number; // 0 to 1
  onProgress?: (percent: number) => void;
}): Promise<Blob> {
  const { videoUrl, audioBlobUrl, originalAudioVolume, onProgress } = params;

  const video = document.createElement('video');
  video.src = videoUrl;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.muted = originalAudioVolume <= 0.01;
  video.volume = Math.max(0, Math.min(1, originalAudioVolume));

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('ভিডিও লোড করা যায়নি।'));
  });

  const maxEdge = 1280;
  let width = video.videoWidth || 1280;
  let height = video.videoHeight || 720;
  if (Math.max(width, height) > maxEdge) {
    const scale = maxEdge / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  // Ensure even dimensions for video codecs
  width = width % 2 === 0 ? width : width + 1;
  height = height % 2 === 0 ? height : height + 1;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx2d = canvas.getContext('2d');
  if (!ctx2d) {
    throw new Error('ক্যানভাস রেন্ডারিং শুরু করা যায়নি।');
  }

  const AudioCtx =
    window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const audioResp = await fetch(audioBlobUrl);
  const audioBuf = await audioCtx.decodeAudioData(await audioResp.arrayBuffer());

  const dest = audioCtx.createMediaStreamDestination();
  const aiSource = audioCtx.createBufferSource();
  aiSource.buffer = audioBuf;
  const aiGain = audioCtx.createGain();
  aiGain.gain.value = 1.0;
  aiSource.connect(aiGain);
  aiGain.connect(dest);

  if (originalAudioVolume > 0.01) {
    try {
      const origSource = audioCtx.createMediaElementSource(video);
      const origGain = audioCtx.createGain();
      origGain.gain.value = originalAudioVolume;
      origSource.connect(origGain);
      origGain.connect(dest);
    } catch {
      // Ignore if video has no audio track
    }
  }

  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
    ? 'video/webm;codecs=vp8,opus'
    : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: preferredMime,
    videoBitsPerSecond: 3_000_000,
    audioBitsPerSecond: 128_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const recordingFinished = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: preferredMime }));
    };
    recorder.onerror = () => reject(new Error('ভিডিও এক্সপোর্ট করতে সমস্যা হয়েছে।'));
  });

  const totalDuration = Math.max(video.duration || 1, 0.5);
  let rafId = 0;
  let stopped = false;

  const drawFrame = () => {
    if (stopped) return;
    ctx2d.drawImage(video, 0, 0, width, height);
    if (onProgress && video.duration > 0) {
      const pct = Math.min(99, Math.round((video.currentTime / totalDuration) * 100));
      onProgress(pct);
    }
    rafId = requestAnimationFrame(drawFrame);
  };

  recorder.start(250);
  video.currentTime = 0;
  aiSource.start(0);
  await video.play();
  drawFrame();

  await new Promise<void>((resolve) => {
    const finish = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(rafId);
      try {
        aiSource.stop();
      } catch {
        // already ended
      }
      video.pause();
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      resolve();
    };
    video.onended = finish;
  });

  const blob = await recordingFinished;
  audioCtx.close().catch(() => {});
  combinedStream.getTracks().forEach((t) => t.stop());
  onProgress?.(100);
  return blob;
}
