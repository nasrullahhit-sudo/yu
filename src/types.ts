export interface Scene {
  id: string;
  startSec: number;
  endSec: number;
  timestampLabel: string;
  title: string;
  visualPrompt: string;
  imageUrl?: string;
  voiceoverText: string;
  audioBase64?: string;
  audioBlobUrl?: string;
  isGeneratingAudio?: boolean;
}

export interface Episode {
  id: string;
  episodeNumber: number;
  title: string;
  prophetName: string;
  duration: string;
  durationSeconds: number;
  tone: string;
  bgmDescription: string;
  outroTeaser: string;
  scenes: Scene[];
  fullAudioBase64?: string;
  fullAudioBlobUrl?: string;
  isGeneratingFullAudio?: boolean;
}

export type ViewMode = 'full-audio' | 'music-video' | 'voice-to-voice' | 'dialogue' | 'library' | 'player' | 'studio' | 'teleprompter';

export type StudioProjectType = 'voiceover' | 'dialogue' | 'dubbing';

export interface SavedStudioProject {
  id: string;
  ownerId: string;
  projectType: StudioProjectType;
  title: string;
  voiceName: VoicePersona;
  secondaryVoiceName: string;
  speaker1Name: string;
  speaker2Name: string;
  scriptText: string;
  dialogueLines: DialogueLine[];
  voicePitch: number;
  voiceSpeed: number;
  voiceEcho: number;
  voiceEmotion: VoiceEmotion;
  language: 'bn' | 'hi' | 'en' | 'original';
  durationSec: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export type VoicePersona =
  | 'Fenrir'
  | 'Charon'
  | 'Kore'
  | 'Puck'
  | 'Zephyr'
  | 'Mishti'
  | 'BabyGirl'
  | 'Thanos'
  | 'Oggy'
  | 'HorrorGhost'
  | 'Grandfather'
  | 'SciFiRobot'
  | 'Commentator';

export interface VoiceOption {
  id: VoicePersona;
  name: string;
  banglaLabel: string;
  description: string;
  gender: 'male' | 'female';
}

export type VoiceEmotion = 'auto' | 'happy' | 'sad' | 'angry' | 'whisper' | 'scary' | 'excited';

export interface VoiceControls {
  pitch: number; // semitones: -6 to +6
  speed: number; // 0.75 to 1.35
  echo: number; // 0 to 100%
  emotion: VoiceEmotion;
}

export const DEFAULT_VOICE_CONTROLS: VoiceControls = {
  pitch: 0,
  speed: 1.0,
  echo: 0,
  emotion: 'auto',
};

export interface DialogueLine {
  id: string;
  speaker: 1 | 2;
  text: string;
  emotion: VoiceEmotion;
}

export interface DialogueTimelineItem {
  id: string;
  speaker: 1 | 2;
  speakerName: string;
  voiceName: VoicePersona;
  text: string;
  startSec: number;
  endSec: number;
}

export interface SubtitleCue {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  speaker?: string;
}
