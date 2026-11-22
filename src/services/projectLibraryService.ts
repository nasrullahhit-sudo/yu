import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import {
  DialogueLine,
  SavedStudioProject,
  StudioProjectType,
  VoiceControls,
  VoiceEmotion,
  VoicePersona,
} from '../types.ts';

const VALID_EMOTIONS: VoiceEmotion[] = ['auto', 'happy', 'sad', 'angry', 'whisper', 'scary', 'excited'];
const VALID_LANGS: Array<'bn' | 'hi' | 'en' | 'original'> = ['bn', 'hi', 'en', 'original'];

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : `proj_${Date.now()}`;
}

function clamp(val: number, min: number, max: number): number {
  if (typeof val !== 'number' || Number.isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function toMillis(ts: unknown): number {
  if (ts instanceof Timestamp) return ts.toMillis();
  if (ts && typeof ts === 'object' && 'seconds' in ts && typeof (ts as any).seconds === 'number') {
    return (ts as any).seconds * 1000;
  }
  return Date.now();
}

export interface SaveProjectInput {
  projectType: StudioProjectType;
  title: string;
  voiceName: VoicePersona;
  secondaryVoiceName?: string;
  speaker1Name?: string;
  speaker2Name?: string;
  scriptText: string;
  dialogueLines?: DialogueLine[];
  voiceControls?: VoiceControls;
  language?: 'bn' | 'hi' | 'en' | 'original';
  durationSec?: number;
}

export async function saveStudioProject(userId: string, input: SaveProjectInput): Promise<string> {
  const safeOwnerId = sanitizeId(userId);
  const projectId = sanitizeId(`proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const docPath = `projects/${projectId}`;

  const safeTitle = (input.title || 'শিরোনামহীন প্রজেক্ট').trim().slice(0, 180) || 'শিরোনামহীন প্রজেক্ট';
  const safeScript = (input.scriptText || safeTitle).trim().slice(0, 12000) || safeTitle;
  const safeVoice = (input.voiceName || 'Fenrir').trim().slice(0, 40);
  const safeSecondaryVoice = (input.secondaryVoiceName || '').trim().slice(0, 40);
  const safeSpk1 = (input.speaker1Name || '').trim().slice(0, 60);
  const safeSpk2 = (input.speaker2Name || '').trim().slice(0, 60);

  const safeLines = (input.dialogueLines || [])
    .filter((l) => l && typeof l.text === 'string' && l.text.trim().length > 0)
    .slice(0, 24)
    .map((l, idx) => ({
      id: sanitizeId(l.id || `dl_${idx + 1}`).slice(0, 64),
      speaker: l.speaker === 2 ? 2 : 1,
      text: l.text.trim().slice(0, 1500),
      emotion: VALID_EMOTIONS.includes(l.emotion) ? l.emotion : 'auto',
    }));

  const safeEmotion: VoiceEmotion =
    input.voiceControls?.emotion && VALID_EMOTIONS.includes(input.voiceControls.emotion)
      ? input.voiceControls.emotion
      : 'auto';
  const safeLanguage = input.language && VALID_LANGS.includes(input.language) ? input.language : 'bn';

  const payload = {
    id: projectId,
    ownerId: safeOwnerId,
    projectType: input.projectType,
    title: safeTitle,
    voiceName: safeVoice,
    secondaryVoiceName: safeSecondaryVoice,
    speaker1Name: safeSpk1,
    speaker2Name: safeSpk2,
    scriptText: safeScript,
    dialogueLines: safeLines,
    voicePitch: clamp(input.voiceControls?.pitch ?? 0, -6, 6),
    voiceSpeed: clamp(input.voiceControls?.speed ?? 1.0, 0.75, 1.35),
    voiceEcho: Math.round(clamp(input.voiceControls?.echo ?? 0, 0, 100)),
    voiceEmotion: safeEmotion,
    language: safeLanguage,
    durationSec: Math.round(clamp(input.durationSec ?? 0, 0, 3600)),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'projects', projectId), payload);
    return projectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteStudioProject(projectId: string): Promise<void> {
  const safeId = sanitizeId(projectId);
  const docPath = `projects/${safeId}`;
  try {
    await deleteDoc(doc(db, 'projects', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function subscribeUserProjects(
  userId: string,
  onProjects: (projects: SavedStudioProject[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'projects';
  const q = query(collection(db, path), where('ownerId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedStudioProject[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          ownerId: String(data.ownerId || userId),
          projectType: (data.projectType as StudioProjectType) || 'voiceover',
          title: String(data.title || 'প্রজেক্ট'),
          voiceName: (data.voiceName as VoicePersona) || 'Fenrir',
          secondaryVoiceName: String(data.secondaryVoiceName || ''),
          speaker1Name: String(data.speaker1Name || ''),
          speaker2Name: String(data.speaker2Name || ''),
          scriptText: String(data.scriptText || ''),
          dialogueLines: Array.isArray(data.dialogueLines) ? (data.dialogueLines as DialogueLine[]) : [],
          voicePitch: typeof data.voicePitch === 'number' ? data.voicePitch : 0,
          voiceSpeed: typeof data.voiceSpeed === 'number' ? data.voiceSpeed : 1.0,
          voiceEcho: typeof data.voiceEcho === 'number' ? data.voiceEcho : 0,
          voiceEmotion: (data.voiceEmotion as VoiceEmotion) || 'auto',
          language: (data.language as 'bn' | 'hi' | 'en' | 'original') || 'bn',
          durationSec: typeof data.durationSec === 'number' ? data.durationSec : 0,
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onProjects(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}
