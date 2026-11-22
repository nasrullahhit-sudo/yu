/**
 * Procedural Studio BGM & Sound Effects (SFX) Engine built on WebAudio API.
 * Works both for instant live preview AND mixes directly into exported video MediaStreamDestination
 * with zero external audio network failures or CORS issues.
 */

export type BgmMoodId = 'none' | 'horror' | 'epic' | 'fantasy' | 'sad' | 'islamic' | 'custom';

export type SfxId =
  | 'thunder'
  | 'heartbeat'
  | 'ghost_whoosh'
  | 'epic_boom'
  | 'sparkle'
  | 'suspense_sting';

export interface BgmMixConfig {
  mood: BgmMoodId;
  volume: number; // 0.0 to 0.8 (default 0.24)
  customBgmUrl?: string | null;
  customBgmName?: string | null;
  sfxList: SfxId[]; // Selected SFX cues to weave into exported video
}

export const DEFAULT_BGM_CONFIG: BgmMixConfig = {
  mood: 'none',
  volume: 0.25,
  customBgmUrl: null,
  customBgmName: null,
  sfxList: [],
};

export const BGM_MOOD_OPTIONS: Array<{
  id: BgmMoodId;
  label: string;
  desc: string;
}> = [
  { id: 'none', label: 'মিউজিক বন্ধ', desc: 'শুধু ভয়েস' },
  { id: 'horror', label: 'হরর সাসপেন্স', desc: 'ভুতুড়ে ও গা ছমছমে' },
  { id: 'epic', label: 'এপিক অ্যাকশন', desc: 'থানোস ও গভীর ড্রাম' },
  { id: 'fantasy', label: 'কিউট ফ্যান্টাসি', desc: 'মিষ্টি ম্যাজিকাল সুর' },
  { id: 'sad', label: 'আবেগী / স্যাড', desc: 'নরম মেলোডি কর্ড' },
  { id: 'islamic', label: 'শান্ত অ্যাম্বিয়েন্ট', desc: 'গভীর ও ভাবগম্ভীর' },
];

export const SFX_OPTIONS: Array<{
  id: SfxId;
  label: string;
}> = [
  { id: 'thunder', label: 'বজ্রপাত' },
  { id: 'heartbeat', label: 'হার্টবিট' },
  { id: 'ghost_whoosh', label: 'ভুতুড়ে হুশ' },
  { id: 'epic_boom', label: 'ড্রাম বুম' },
  { id: 'sparkle', label: 'ম্যাজিক স্পার্কেল' },
  { id: 'suspense_sting', label: 'হরর স্টিং' },
];

function createNoiseBuffer(ctx: AudioContext, durationSec = 2): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Fires a one-shot studio SFX into any target AudioNode at `when` (AudioContext time).
 */
export function triggerSfxAt(
  ctx: AudioContext,
  destination: AudioNode,
  sfx: SfxId,
  when = ctx.currentTime,
  gainLevel = 0.55
): void {
  const master = ctx.createGain();
  master.gain.setValueAtTime(gainLevel, when);
  master.connect(destination);

  if (sfx === 'thunder') {
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, 2.8);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, when);
    filter.frequency.exponentialRampToValueAtTime(85, when + 2.4);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.01, when);
    env.gain.linearRampToValueAtTime(1.0, when + 0.06);
    env.gain.exponentialRampToValueAtTime(0.35, when + 0.55);
    env.gain.exponentialRampToValueAtTime(0.001, when + 2.7);

    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start(when);
    src.stop(when + 2.75);
    return;
  }

  if (sfx === 'heartbeat') {
    const beats = [0, 0.24, 0.95, 1.19];
    for (const offset of beats) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(92, when + offset);
      osc.frequency.exponentialRampToValueAtTime(38, when + offset + 0.16);
      env.gain.setValueAtTime(0.001, when + offset);
      env.gain.linearRampToValueAtTime(0.95, when + offset + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, when + offset + 0.2);
      osc.connect(env);
      env.connect(master);
      osc.start(when + offset);
      osc.stop(when + offset + 0.22);
    }
    return;
  }

  if (sfx === 'ghost_whoosh') {
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, 1.8);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(5.5, when);
    filter.frequency.setValueAtTime(220, when);
    filter.frequency.exponentialRampToValueAtTime(1150, when + 0.7);
    filter.frequency.exponentialRampToValueAtTime(180, when + 1.7);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, when);
    env.gain.linearRampToValueAtTime(0.75, when + 0.65);
    env.gain.exponentialRampToValueAtTime(0.001, when + 1.75);

    src.connect(filter);
    filter.connect(env);
    env.connect(master);
    src.start(when);
    src.stop(when + 1.8);
    return;
  }

  if (sfx === 'epic_boom') {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(125, when);
    osc.frequency.exponentialRampToValueAtTime(32, when + 1.3);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, when);
    env.gain.linearRampToValueAtTime(1.1, when + 0.015);
    env.gain.exponentialRampToValueAtTime(0.001, when + 1.5);

    osc.connect(env);
    env.connect(master);
    osc.start(when);
    osc.stop(when + 1.55);

    // Metallic cinematic slam layer
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.6);
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(520, when);
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.55, when);
    nEnv.gain.exponentialRampToValueAtTime(0.001, when + 0.55);
    noise.connect(hp);
    hp.connect(nEnv);
    nEnv.connect(master);
    noise.start(when);
    noise.stop(when + 0.6);
    return;
  }

  if (sfx === 'sparkle') {
    const notes = [880, 1174.66, 1396.91, 1760, 2093, 2637];
    notes.forEach((freq, i) => {
      const t0 = when + i * 0.085;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      env.gain.setValueAtTime(0.001, t0);
      env.gain.linearRampToValueAtTime(0.32, t0 + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
      osc.connect(env);
      env.connect(master);
      osc.start(t0);
      osc.stop(t0 + 0.48);
    });
    return;
  }

  if (sfx === 'suspense_sting') {
    // Classic eerie dissonant horror violin cluster
    const freqs = [311.13, 329.63, 466.16, 622.25];
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, when);
      osc.frequency.linearRampToValueAtTime(f * 1.04, when + 1.4);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, when);
      env.gain.setValueAtTime(0.001, when);
      env.gain.linearRampToValueAtTime(0.2, when + 0.04);
      env.gain.exponentialRampToValueAtTime(0.001, when + 1.5);
      osc.connect(filter);
      filter.connect(env);
      env.connect(master);
      osc.start(when);
      osc.stop(when + 1.55);
    });
  }
}

export interface ActiveBgmHandle {
  stop: () => void;
}

/**
 * Starts a continuous procedural studio BGM (or custom uploaded audio file loop) routed into `destination`.
 * Returns a clean `stop()` handle.
 */
export function startBgmInContext(
  ctx: AudioContext,
  destination: AudioNode,
  config: BgmMixConfig
): ActiveBgmHandle {
  if (config.mood === 'none' || config.volume <= 0.005) {
    return { stop: () => {} };
  }

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(Math.min(0.8, config.volume), ctx.currentTime + 0.6);
  masterGain.connect(destination);

  const stoppers: Array<() => void> = [];
  let intervalId: number | null = null;

  // Custom MP3/WAV BGM
  if (config.mood === 'custom' && config.customBgmUrl) {
    const audioEl = document.createElement('audio');
    audioEl.src = config.customBgmUrl;
    audioEl.loop = true;
    audioEl.crossOrigin = 'anonymous';
    const src = ctx.createMediaElementSource(audioEl);
    src.connect(masterGain);
    audioEl.play().catch(() => {});
    return {
      stop: () => {
        try {
          audioEl.pause();
          src.disconnect();
          masterGain.disconnect();
        } catch {}
      },
    };
  }

  // Built-in Procedural BGM Moods
  const startDrone = (freq: number, type: OscillatorType, gainVal: number, filterHz = 600) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterHz, ctx.currentTime);
    g.gain.setValueAtTime(gainVal, ctx.currentTime);
    osc.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    osc.start();
    stoppers.push(() => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
  };

  if (config.mood === 'horror') {
    startDrone(55, 'sawtooth', 0.28, 170);
    startDrone(58.27, 'triangle', 0.22, 220); // creepy minor-second beat
    startDrone(110, 'sine', 0.16, 300);

    // Filtered eerie wind bed
    const wind = ctx.createBufferSource();
    wind.buffer = createNoiseBuffer(ctx, 4);
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(340, ctx.currentTime);
    bp.Q.setValueAtTime(4.5, ctx.currentTime);
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0.14, ctx.currentTime);
    wind.connect(bp);
    bp.connect(wg);
    wg.connect(masterGain);
    wind.start();
    stoppers.push(() => {
      try {
        wind.stop();
      } catch {}
    });

    // Occasional distant low pulse
    intervalId = window.setInterval(() => {
      if (ctx.state === 'closed') return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(75, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.65);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.35, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.75);
    }, 2200);
  } else if (config.mood === 'epic') {
    startDrone(65.41, 'sawtooth', 0.26, 260); // C2
    startDrone(98.0, 'sawtooth', 0.2, 340); // G2 fifth
    startDrone(130.81, 'triangle', 0.16, 480); // C3

    let step = 0;
    intervalId = window.setInterval(() => {
      if (ctx.state === 'closed') return;
      const now = ctx.currentTime;
      const accent = step % 4 === 0 ? 0.55 : 0.3;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(step % 4 === 0 ? 108 : 84, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.26);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(accent, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.35);
      step++;
    }, 620);
  } else if (config.mood === 'fantasy') {
    startDrone(261.63, 'sine', 0.12, 700); // C4 warm pad
    startDrone(329.63, 'sine', 0.1, 700); // E4
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 783.99, 659.25];
    let idx = 0;
    intervalId = window.setInterval(() => {
      if (ctx.state === 'closed') return;
      const now = ctx.currentTime;
      const freq = scale[idx % scale.length];
      idx++;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.24, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.75);
    }, 480);
  } else if (config.mood === 'sad') {
    startDrone(110, 'sine', 0.18, 420); // A2
    startDrone(164.81, 'triangle', 0.12, 480); // E3
    const chords = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [130.81, 196.0, 261.63], // C
      [196.0, 246.94, 293.66], // G
    ];
    let cIdx = 0;
    const playChord = () => {
      if (ctx.state === 'closed') return;
      const now = ctx.currentTime;
      const chord = chords[cIdx % chords.length];
      cIdx++;
      chord.forEach((f) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.11, now + 0.35);
        g.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 2.7);
      });
    };
    playChord();
    intervalId = window.setInterval(playChord, 2800);
  } else if (config.mood === 'islamic') {
    startDrone(73.42, 'sine', 0.25, 320); // D2
    startDrone(110.0, 'sine', 0.18, 360); // A2
    startDrone(146.83, 'triangle', 0.12, 420); // D3
    startDrone(220.0, 'sine', 0.08, 480); // A3
  }

  return {
    stop: () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      stoppers.forEach((fn) => fn());
      try {
        masterGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
      } catch {}
    },
  };
}

// Standalone preview singleton so user can audition BGM/SFX with 1 click
let previewAudioCtx: AudioContext | null = null;
let previewBgmHandle: ActiveBgmHandle | null = null;

function getPreviewCtx(): AudioContext {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!previewAudioCtx || previewAudioCtx.state === 'closed') {
    previewAudioCtx = new AudioCtx();
  }
  if (previewAudioCtx.state === 'suspended') {
    previewAudioCtx.resume().catch(() => {});
  }
  return previewAudioCtx;
}

export function previewSfxOnce(sfx: SfxId): void {
  const ctx = getPreviewCtx();
  triggerSfxAt(ctx, ctx.destination, sfx, ctx.currentTime + 0.02, 0.65);
}

export function startBgmPreview(config: BgmMixConfig): void {
  stopBgmPreview();
  if (config.mood === 'none') return;
  const ctx = getPreviewCtx();
  previewBgmHandle = startBgmInContext(ctx, ctx.destination, config);
}

export function stopBgmPreview(): void {
  if (previewBgmHandle) {
    previewBgmHandle.stop();
    previewBgmHandle = null;
  }
}
