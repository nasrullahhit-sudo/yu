import { SfxId } from './bgmAndSfxService.ts';

export interface ScriptCueTagDefinition {
  tag: string;
  label: string;
  type: 'sfx' | 'pause';
  sfxId?: SfxId;
  pauseSec?: number;
}

export const SCRIPT_CUE_TAGS: ScriptCueTagDefinition[] = [
  { tag: '[বজ্রপাত]', label: 'বজ্রপাত', type: 'sfx', sfxId: 'thunder' },
  { tag: '[হার্টবিট]', label: 'হার্টবিট', type: 'sfx', sfxId: 'heartbeat' },
  { tag: '[ভুতুড়ে হুশ]', label: 'ভুতুড়ে হুশ', type: 'sfx', sfxId: 'ghost_whoosh' },
  { tag: '[ড্রাম বুম]', label: 'ড্রাম বুম', type: 'sfx', sfxId: 'epic_boom' },
  { tag: '[স্পার্কেল]', label: 'স্পার্কেল', type: 'sfx', sfxId: 'sparkle' },
  { tag: '[হরর স্টিং]', label: 'হরর স্টিং', type: 'sfx', sfxId: 'suspense_sting' },
  { tag: '[বিরতি ২ সে.]', label: '২ সে. বিরতি', type: 'pause', pauseSec: 2.0 },
];

const SFX_TAG_LOOKUP: Record<string, SfxId> = {
  'বজ্রপাত': 'thunder',
  'thunder': 'thunder',
  'হার্টবিট': 'heartbeat',
  'heartbeat': 'heartbeat',
  'ভুতুড়ে হুশ': 'ghost_whoosh',
  'হুশ': 'ghost_whoosh',
  'whoosh': 'ghost_whoosh',
  'ড্রাম বুম': 'epic_boom',
  'বুম': 'epic_boom',
  'boom': 'epic_boom',
  'স্পার্কেল': 'sparkle',
  'ম্যাজিক': 'sparkle',
  'sparkle': 'sparkle',
  'হরর স্টিং': 'suspense_sting',
  'স্টিং': 'suspense_sting',
  'sting': 'suspense_sting',
};

const ANY_CUE_TAG_REGEX =
  /\[\s*(বজ্রপাত|হার্টবিট|ভুতুড়ে হুশ|হুশ|ড্রাম বুম|বুম|স্পার্কেল|ম্যাজিক|হরর স্টিং|স্টিং|thunder|heartbeat|whoosh|boom|sparkle|sting|বিরতি[^\]]*|pause[^\]]*)\s*\]/gi;

/**
 * Removes all inline [SFX] and [বিরতি ...] tags so subtitles and TTS only contain clean spoken text.
 */
export function stripScriptCueTags(text: string): string {
  return text
    .replace(ANY_CUE_TAG_REGEX, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

export interface TimedSfxCue {
  sfxId: SfxId;
  timeSec: number;
  tagLabel: string;
}

/**
 * Extracts exact proportional timestamps (in seconds) for every inline [SFX] cue in a script.
 */
export function extractTimedSfxCuesFromScript(
  scriptText: string,
  totalDurationSec: number
): TimedSfxCue[] {
  if (!scriptText || totalDurationSec <= 0) return [];

  const cleanTotalChars = Math.max(1, stripScriptCueTags(scriptText).length);
  const cues: TimedSfxCue[] = [];

  let spokenCharsSoFar = 0;
  let lastIndex = 0;
  const regex = new RegExp(ANY_CUE_TAG_REGEX.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(scriptText)) !== null) {
    const segmentBefore = scriptText.slice(lastIndex, match.index);
    spokenCharsSoFar += segmentBefore.replace(/\s+/g, ' ').trim().length;
    lastIndex = regex.lastIndex;

    const inner = (match[1] || '').trim().toLowerCase();
    const sfxId = SFX_TAG_LOOKUP[inner];
    if (sfxId) {
      const ratio = Math.max(0, Math.min(0.96, spokenCharsSoFar / cleanTotalChars));
      cues.push({
        sfxId,
        timeSec: Math.max(0.15, Number((ratio * totalDurationSec).toFixed(2))),
        tagLabel: match[0],
      });
    }
  }

  return cues;
}
