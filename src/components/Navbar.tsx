import React from 'react';
import { User } from 'firebase/auth';
import { ViewMode } from '../types.ts';
import {
  Sparkles,
  Volume2,
  VolumeX,
  Film,
  FileText,
  Tv,
  FileAudio,
  AudioLines,
  Users,
  FolderHeart,
  LogIn,
  PenLine,
  X,
  Sun,
  Moon,
  Music,
} from 'lucide-react';

interface NavbarProps {
  currentView: ViewMode;
  onSelectView: (mode: ViewMode) => void;
  isAmbientPlaying: boolean;
  onToggleAmbient: () => void;
  ambientVolume: number;
  onChangeAmbientVolume: (vol: number) => void;
  projectTitle: string;
  onChangeProjectTitle: (title: string) => void;
  onOpenGenerateModal: () => void;
  user: User | null;
  savedProjectCount: number;
  onSignIn: () => Promise<void>;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onSelectView,
  isAmbientPlaying,
  onToggleAmbient,
  ambientVolume,
  onChangeAmbientVolume,
  projectTitle,
  onChangeProjectTitle,
  onOpenGenerateModal,
  user,
  savedProjectCount,
  onSignIn,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#090D16]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 md:px-8 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 xl:gap-6">
        {/* Zone 1: Brand Wordmark + Editable Custom Video/Audio Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('full-audio');
            }}
            className="group flex items-baseline gap-2 text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            <span className="font-display text-lg xl:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 group-hover:text-amber-500 dark:group-hover:text-amber-300 transition-colors">
              Nasrullah Studio
            </span>
          </a>

          {/* Editable Custom Video/Audio Title Input */}
          <div className="relative flex items-center ml-1">
            <PenLine className="w-3.5 h-3.5 text-amber-600/80 dark:text-amber-400/80 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => onChangeProjectTitle(e.target.value)}
              maxLength={120}
              placeholder="ভিডিও / অডিওর নাম লিখুন..."
              title="এখানে যে নাম লিখবেন, সেটাই আপনার তৈরি ভিডিওর উপরে দেখাবে"
              className="w-[140px] sm:w-[175px] xl:w-[205px] bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/80 focus:border-amber-500 text-slate-900 dark:text-amber-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs rounded-lg pl-7 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500/60 transition-colors"
            />
            {projectTitle && (
              <button
                type="button"
                onClick={() => onChangeProjectTitle('')}
                title="শিরোনাম মুছুন"
                className="absolute right-2 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-3 xl:gap-4 text-xs xl:text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            onClick={() => onSelectView('full-audio')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              currentView === 'full-audio'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400 font-bold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileAudio className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>ফুল ভয়েস</span>
          </button>

          <button
            onClick={() => onSelectView('music-video')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              currentView === 'music-video'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400 font-bold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Music className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>মিউজিক ভিডিও</span>
          </button>

          <button
            onClick={() => onSelectView('voice-to-voice')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              currentView === 'voice-to-voice'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400 font-bold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <AudioLines className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>ভয়েস-টু-ভয়েস</span>
          </button>

          <button
            onClick={() => onSelectView('dialogue')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              currentView === 'dialogue'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400 font-bold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>সংলাপ</span>
          </button>

          <button
            onClick={() => onSelectView('library')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              currentView === 'library'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400 font-bold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FolderHeart className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>লাইব্রেরি{savedProjectCount > 0 ? ` (${savedProjectCount})` : ''}</span>
          </button>

          <button
            onClick={() => onSelectView('player')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              currentView === 'player'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>প্লেয়ার</span>
          </button>

          <button
            onClick={() => onSelectView('studio')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              currentView === 'studio'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>স্ক্রিপ্ট</span>
          </button>

          <button
            onClick={() => onSelectView('teleprompter')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors py-1 cursor-pointer ${
              currentView === 'teleprompter'
                ? 'text-amber-600 dark:text-amber-400 border-b-2 border-amber-500 dark:border-amber-400 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>টেলিপম্পটার</span>
          </button>
        </nav>

        {/* Zone 3: Theme Switch + Ambient + Auth + Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন'}
            className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-amber-300 transition-colors cursor-pointer shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Ambient BGM Toggle */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-1 px-2">
            <button
              onClick={onToggleAmbient}
              title={isAmbientPlaying ? 'অ্যাম্বিয়েন্ট মিউজিক থামান' : 'অ্যাম্বিয়েন্ট মিউজিক চালু করুন'}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isAmbientPlaying
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-950/40'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {isAmbientPlaying ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 hidden sm:inline whitespace-nowrap">
              {isAmbientPlaying ? 'সুর চালু' : 'অ্যাম্বিয়েন্ট'}
            </span>
            {isAmbientPlaying && (
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={ambientVolume}
                onChange={(e) => onChangeAmbientVolume(parseFloat(e.target.value))}
                className="w-12 h-1 accent-amber-500 dark:accent-amber-400 cursor-pointer hidden md:block"
                title="অ্যাম্বিয়েন্ট ভলিউম"
              />
            )}
          </div>

          {/* Cloud Account / Sign-in shortcut */}
          {user ? (
            <button
              type="button"
              onClick={() => onSelectView('library')}
              title={`${user.displayName || 'অ্যাকাউন্ট'} — প্রজেক্ট লাইব্রেরি দেখুন`}
              className="flex items-center gap-1.5 p-1 pr-2 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80 hover:border-amber-500/50 transition-colors cursor-pointer shrink-0"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-6 h-6 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center text-[11px] font-bold">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="hidden xl:inline text-[11px] text-slate-700 dark:text-slate-300 max-w-[70px] truncate">
                {user.displayName?.split(' ')[0] || 'সেভড'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSignIn()}
              title="প্রজেক্ট সেভ করতে Google লগইন করুন"
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 bg-slate-100 dark:bg-slate-900/90 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:border-amber-500/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">লগইন</span>
            </button>
          )}

          {/* Primary Action Button */}
          <button
            onClick={onOpenGenerateModal}
            className="flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-sm shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span className="hidden sm:inline">নতুন পর্ব (AI)</span>
            <span className="sm:hidden">নতুন</span>
          </button>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="flex lg:hidden items-center justify-around gap-1.5 pt-2.5 mt-2.5 border-t border-slate-200 dark:border-slate-800/60 text-xs overflow-x-auto">
        <button
          onClick={() => onSelectView('full-audio')}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md whitespace-nowrap shrink-0 ${
            currentView === 'full-audio'
              ? 'text-amber-700 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-950/40 font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <FileAudio className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>ফুল অডিও</span>
        </button>
        <button
          onClick={() => onSelectView('music-video')}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md whitespace-nowrap shrink-0 ${
            currentView === 'music-video'
              ? 'text-amber-700 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-950/40 font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Music className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>মিউজিক ভিডিও</span>
        </button>
        <button
          onClick={() => onSelectView('voice-to-voice')}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md whitespace-nowrap shrink-0 ${
            currentView === 'voice-to-voice'
              ? 'text-amber-700 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-950/40 font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <AudioLines className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>ভয়েস-টু-ভয়েস</span>
        </button>
        <button
          onClick={() => onSelectView('dialogue')}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md whitespace-nowrap shrink-0 ${
            currentView === 'dialogue'
              ? 'text-amber-700 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-950/40 font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>সংলাপ</span>
        </button>
        <button
          onClick={() => onSelectView('library')}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md whitespace-nowrap shrink-0 ${
            currentView === 'library'
              ? 'text-amber-700 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-950/40 font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <FolderHeart className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>লাইব্রেরি</span>
        </button>
        <button
          onClick={() => onSelectView('player')}
          className={`flex items-center gap-1.5 py-1 px-2 rounded-md whitespace-nowrap shrink-0 ${
            currentView === 'player'
              ? 'text-amber-700 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-950/30 font-medium'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>প্লেয়ার</span>
        </button>
        <button
          onClick={() => onSelectView('studio')}
          className={`flex items-center gap-1.5 py-1 px-2 rounded-md whitespace-nowrap shrink-0 ${
            currentView === 'studio'
              ? 'text-amber-700 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-950/30 font-medium'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>স্ক্রিপ্ট</span>
        </button>
        <button
          onClick={() => onSelectView('teleprompter')}
          className={`flex items-center gap-1.5 py-1 px-2 rounded-md whitespace-nowrap shrink-0 ${
            currentView === 'teleprompter'
              ? 'text-amber-700 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-950/30 font-medium'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Tv className="w-3.5 h-3.5" />
          <span>টেলিপম্পটার</span>
        </button>
      </div>
    </header>
  );
};
