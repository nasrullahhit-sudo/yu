import React, { useState } from 'react';
import { Sparkles, Loader2, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { DialogueLine } from '../types.ts';

const GENRE_OPTIONS = [
  'হরর ও ভৌতিক',
  'থানোস / এপিক অ্যাকশন',
  'কিউট / কার্টুন মজার গল্প',
  'রহস্য ও অজানা ফ্যাক্টস',
  'মোটিভেশনাল ও জীবনমুখী',
  'ইতিহাস ও ইসলামিক গল্প',
];

interface AiScriptWriterPanelProps {
  mode: 'monologue' | 'dialogue';
  speaker1Name?: string;
  speaker2Name?: string;
  onGeneratedMonologue?: (data: { title: string; script: string }) => void;
  onGeneratedDialogue?: (data: { title: string; lines: DialogueLine[] }) => void;
}

export const AiScriptWriterPanel: React.FC<AiScriptWriterPanelProps> = ({
  mode,
  speaker1Name = 'চরিত্র ১',
  speaker2Name = 'চরিত্র ২',
  onGeneratedMonologue,
  onGeneratedDialogue,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [topic, setTopic] = useState<string>('');
  const [genre, setGenre] = useState<string>(GENRE_OPTIONS[0]);
  const [language, setLanguage] = useState<'bn' | 'hi' | 'en'>('bn');
  const [durationPreset, setDurationPreset] = useState<'30s' | '60s' | '90s'>('60s');
  const [lineCount, setLineCount] = useState<number>(6);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const quickIdeas =
    mode === 'dialogue'
      ? [
          `${speaker1Name} ও ${speaker2Name}-এর মজার ঝগড়া`,
          'গভীর রাতে ভৌতিক বাড়িতে দুই বন্ধুর আলাপ',
          'ভবিষ্যতের রোবট ও মানুষের তর্ক',
        ]
      : [
          'গভীর রাতে খালি ট্রেনে ভৌতিক অভিজ্ঞতা',
          'মহাবিশ্বের সবচেয়ে ভয়ংকর ব্ল্যাক হোলের রহস্য',
          'ছোট্ট পরীর জাদুর বনের মজার গল্প',
        ];

  const handleGenerate = async () => {
    const clean = topic.trim();
    if (!clean) {
      setErrorMsg('অনুগ্রহ করে ভিডিও বা গল্পের বিষয় লিখুন।');
      return;
    }

    setErrorMsg(null);
    setIsGenerating(true);
    try {
      const resp = await fetch('/api/script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          topic: clean,
          genre,
          language,
          durationPreset,
          speaker1Name,
          speaker2Name,
          lineCount,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'স্ক্রিপ্ট তৈরি করতে সমস্যা হয়েছে।');
      }

      if (mode === 'dialogue' && onGeneratedDialogue && Array.isArray(data.lines)) {
        onGeneratedDialogue({
          title: data.title || clean,
          lines: data.lines,
        });
      } else if (mode === 'monologue' && onGeneratedMonologue && data.script) {
        onGeneratedMonologue({
          title: data.title || clean,
          script: data.script,
        });
      }
      setIsOpen(false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'AI স্ক্রিপ্ট তৈরি করা যায়নি।');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/40 dark:border-amber-500/30 bg-gradient-to-r from-amber-50 via-white to-amber-50/50 dark:from-amber-500/10 dark:via-[#0D1322] dark:to-[#0B101D] overflow-hidden transition-colors">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer hover:bg-amber-500/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
            <Wand2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <span>
                {mode === 'dialogue'
                  ? '১-ক্লিকে AI ২-চরিত্রের সংলাপ লেখক'
                  : '১-ক্লিকে AI ভাইরাল গল্প ও স্ক্রিপ্ট লেখক'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              শুধু আইডিয়া লিখুন — সাথে সাথে টাইটেল ও হুকসহ পূর্ণাঙ্গ বাংলা/হিন্দি স্ক্রিপ্ট লিখে দেবে।
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 shrink-0">
          <span>{isOpen ? 'বন্ধ করুন' : 'খুলুন'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-amber-200/70 dark:border-slate-800/80 space-y-3">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700/60 text-xs text-rose-700 dark:text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Topic Input */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isGenerating) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder={
                mode === 'dialogue'
                  ? 'কী নিয়ে সংলাপ হবে? (যেমন: গভীর রাতে ভূতের সাথে মজার কথা...)'
                  : 'কী নিয়ে ভিডিও বানাবেন? (যেমন: রাতের খালি বাসে ভৌতিক ঘটনা...)'
              }
              className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm cursor-pointer disabled:opacity-60 shrink-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>লিখছে...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>AI স্ক্রিপ্ট লিখুন</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Idea Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-600 dark:text-slate-400">দ্রুত আইডিয়া:</span>
            {quickIdeas.map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setTopic(idea)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-200 cursor-pointer transition-colors"
              >
                {idea}
              </button>
            ))}
          </div>

          {/* Genre + Language + Duration Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">ধরন / মুড</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-amber-500"
              >
                {GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">ভাষা</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                {[
                  { id: 'bn' as const, label: 'বাংলা' },
                  { id: 'hi' as const, label: 'হিন্দি' },
                  { id: 'en' as const, label: 'English' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLanguage(opt.id)}
                    className={`py-1 rounded-md font-bold text-[11px] cursor-pointer ${
                      language === opt.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'monologue' ? (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">সময়সীমা</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                  {[
                    { id: '30s' as const, label: '৩০ সে.' },
                    { id: '60s' as const, label: '৬০ সে.' },
                    { id: '90s' as const, label: '৯০ সে.' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDurationPreset(opt.id)}
                      className={`py-1 rounded-md font-bold text-[11px] cursor-pointer ${
                        durationPreset === opt.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">মোট সংলাপ লাইন</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                  {[4, 6, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLineCount(n)}
                      className={`py-1 rounded-md font-bold text-[11px] cursor-pointer ${
                        lineCount === n
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {n} লাইন
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
