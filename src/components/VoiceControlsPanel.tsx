import React, { useState } from 'react';
import { Sliders, RotateCcw, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { DEFAULT_VOICE_CONTROLS, VoiceControls, VoiceEmotion } from '../types.ts';

interface VoiceControlsPanelProps {
  value: VoiceControls;
  onChange: (next: VoiceControls) => void;
  compact?: boolean;
}

const EMOTION_OPTIONS: Array<{ id: VoiceEmotion; label: string }> = [
  { id: 'auto', label: 'স্বাভাবিক' },
  { id: 'happy', label: 'হাসিখুশি' },
  { id: 'sad', label: 'আবেগী / দুঃখী' },
  { id: 'angry', label: 'রাগান্বিত' },
  { id: 'whisper', label: 'ফিসফিসানি' },
  { id: 'scary', label: 'ভয়ংকর' },
  { id: 'excited', label: 'উত্তেজিত' },
];

export const VoiceControlsPanel: React.FC<VoiceControlsPanelProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(!compact);

  const isModified =
    value.pitch !== DEFAULT_VOICE_CONTROLS.pitch ||
    value.speed !== DEFAULT_VOICE_CONTROLS.speed ||
    value.echo !== DEFAULT_VOICE_CONTROLS.echo ||
    value.emotion !== DEFAULT_VOICE_CONTROLS.emotion;

  const handleReset = () => {
    onChange({ ...DEFAULT_VOICE_CONTROLS });
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs transition-colors">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/90 dark:bg-slate-950/60">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>ভয়েস কন্ট্রোল স্লাইডার (Pitch · Speed · Echo · Emotion)</span>
          {isModified && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
              কাস্টম চালু
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          )}
        </button>

        {isModified && (
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
            title="সব কন্ট্রোল রিসেট করুন"
          >
            <RotateCcw className="w-3 h-3" />
            <span>রিসেট</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="p-3.5 space-y-4 border-t border-slate-200 dark:border-slate-800/80">
          {/* 3 DSP Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pitch */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300 font-medium">কণ্ঠের পিচ (Pitch)</span>
                <span className="font-mono text-amber-700 dark:text-amber-300 font-bold">
                  {value.pitch > 0 ? `+${value.pitch}` : value.pitch} st
                </span>
              </div>
              <input
                type="range"
                min={-6}
                max={6}
                step={0.5}
                value={value.pitch}
                onChange={(e) => onChange({ ...value, pitch: parseFloat(e.target.value) })}
                className="w-full h-1.5 accent-amber-500 dark:accent-amber-400 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>অনেক ভারী (-6)</span>
                <span>স্বাভাবিক</span>
                <span>চিকন (+6)</span>
              </div>
            </div>

            {/* Speed */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300 font-medium">কথার গতি (Speed)</span>
                <span className="font-mono text-amber-700 dark:text-amber-300 font-bold">{value.speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.35}
                step={0.05}
                value={value.speed}
                onChange={(e) => onChange({ ...value, speed: parseFloat(e.target.value) })}
                className="w-full h-1.5 accent-amber-500 dark:accent-amber-400 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>ধীরে (0.75x)</span>
                <span>স্বাভাবিক (1.0x)</span>
                <span>দ্রুত (1.35x)</span>
              </div>
            </div>

            {/* Echo / Reverb */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300 font-medium">ইকো / রিভার্ব (Echo)</span>
                <span className="font-mono text-amber-700 dark:text-amber-300 font-bold">{value.echo}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={value.echo}
                onChange={(e) => onChange({ ...value, echo: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 accent-amber-500 dark:accent-amber-400 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>বন্ধ (0%)</span>
                <span>হলরুম (50%)</span>
                <span>গভীর গুহা (100%)</span>
              </div>
            </div>
          </div>

          {/* Emotion Selector */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>আবেগ ও ভঙ্গি (Emotion):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EMOTION_OPTIONS.map((em) => {
                const active = value.emotion === em.id;
                return (
                  <button
                    key={em.id}
                    type="button"
                    onClick={() => onChange({ ...value, emotion: em.id })}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-200'
                        : 'bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {em.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
