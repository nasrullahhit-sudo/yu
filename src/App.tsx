/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Episode, SavedStudioProject, Scene, ViewMode } from './types.ts';
import { INITIAL_EPISODES } from './data/episodes.ts';
import { ambientSound } from './services/ambientAudio.ts';
import { auth, signInWithGoogle, signOutUser } from './firebase.ts';
import {
  SaveProjectInput,
  saveStudioProject,
  subscribeUserProjects,
} from './services/projectLibraryService.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { Navbar } from './components/Navbar.tsx';
import { FullVoiceoverStudio } from './components/FullVoiceoverStudio.tsx';
import { MusicVideoStudio } from './components/MusicVideoStudio.tsx';
import { VoiceToVoiceStudio } from './components/VoiceToVoiceStudio.tsx';
import { DialogueStudio } from './components/DialogueStudio.tsx';
import { ProjectLibraryView } from './components/ProjectLibraryView.tsx';
import { CinematicPlayer } from './components/CinematicPlayer.tsx';
import { ScriptStudio } from './components/ScriptStudio.tsx';
import { TeleprompterView } from './components/TeleprompterView.tsx';
import { GenerateEpisodeModal } from './components/GenerateEpisodeModal.tsx';

function NasrullahStudioApp() {
  const [episodes, setEpisodes] = useState<Episode[]>(INITIAL_EPISODES);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>(INITIAL_EPISODES[0].id);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [currentView, setCurrentView] = useState<ViewMode>('full-audio');
  const [isAmbientPlaying, setIsAmbientPlaying] = useState<boolean>(false);
  const [ambientVolume, setAmbientVolume] = useState<number>(0.35);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('nasrullah_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('nasrullah_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Firebase Auth & Cloud Project Library state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [savedProjects, setSavedProjects] = useState<SavedStudioProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [loadedProject, setLoadedProject] = useState<SavedStudioProject | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Attach Firestore snapshot listener ONLY when auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !user) {
      setSavedProjects([]);
      setLoadingProjects(false);
      setLibraryError(null);
      return;
    }

    setLoadingProjects(true);
    setLibraryError(null);
    const unsubscribe = subscribeUserProjects(
      user.uid,
      (projects) => {
        setSavedProjects(projects);
        setLoadingProjects(false);
      },
      (err) => {
        setLoadingProjects(false);
        const msg = err?.message || '';
        if (msg.includes('Quota exceeded')) {
          setLibraryError('আজকের ফ্রি ক্লাউড ডেটাবেজ কোটা পূর্ণ হয়েছে। আগামীকাল আবার রিসেট হবে।');
        } else {
          setLibraryError('সেভ করা প্রজেক্ট লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
        }
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  const handleSignIn = async () => {
    try {
      setLibraryError(null);
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setLibraryError('গুগল লগইন সম্পন্ন হয়নি। পপআপ ব্লকার বন্ধ রেখে আবার চেষ্টা করুন।');
      }
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
  };

  const handleSaveProjectToCloud = async (input: SaveProjectInput): Promise<boolean> => {
    let activeUser = auth.currentUser;
    if (!activeUser) {
      try {
        const cred = await signInWithGoogle();
        activeUser = cred.user;
      } catch {
        return false;
      }
    }
    if (!activeUser) return false;
    await saveStudioProject(activeUser.uid, input);
    return true;
  };

  const handleOpenSavedProject = (project: SavedStudioProject) => {
    setLoadedProject({ ...project });
    setProjectTitle(project.title || '');
    if (project.projectType === 'dialogue') {
      setCurrentView('dialogue');
    } else if (project.projectType === 'dubbing') {
      setCurrentView('voice-to-voice');
    } else {
      setCurrentView('full-audio');
    }
  };

  const activeEpisode =
    episodes.find((ep) => ep.id === activeEpisodeId) || episodes[0];

  // Ambient sound controls
  const handleToggleAmbient = () => {
    if (isAmbientPlaying) {
      ambientSound.stop();
      setIsAmbientPlaying(false);
    } else {
      ambientSound.setVolume(ambientVolume);
      ambientSound.start();
      setIsAmbientPlaying(true);
    }
  };

  const handleChangeAmbientVolume = (vol: number) => {
    setAmbientVolume(vol);
    ambientSound.setVolume(vol);
  };

  const handleUpdateEpisodeScene = (sceneId: string, updates: Partial<Scene>) => {
    setEpisodes((prev) =>
      prev.map((ep) => {
        if (ep.id !== activeEpisodeId) return ep;
        return {
          ...ep,
          scenes: ep.scenes.map((sc) =>
            sc.id === sceneId ? { ...sc, ...updates } : sc
          ),
        };
      })
    );
  };

  const handleUpdateActiveEpisode = (updates: Partial<Episode>) => {
    setEpisodes((prev) =>
      prev.map((ep) => (ep.id === activeEpisodeId ? { ...ep, ...updates } : ep))
    );
  };

  const handleSelectEpisode = (id: string) => {
    setActiveEpisodeId(id);
    setActiveSceneIndex(0);
  };

  const handleSwitchToPlayerScene = (index: number) => {
    setActiveSceneIndex(index);
    setCurrentView('player');
  };

  const handleEpisodeCreated = (newEpisode: Episode) => {
    setEpisodes((prev) => [...prev, newEpisode]);
    setActiveEpisodeId(newEpisode.id);
    setActiveSceneIndex(0);
    setProjectTitle(newEpisode.title);
    setCurrentView('full-audio');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-900 dark:selection:text-amber-200 transition-colors duration-200">
      <Navbar
        currentView={currentView}
        onSelectView={setCurrentView}
        isAmbientPlaying={isAmbientPlaying}
        onToggleAmbient={handleToggleAmbient}
        ambientVolume={ambientVolume}
        onChangeAmbientVolume={handleChangeAmbientVolume}
        projectTitle={projectTitle}
        onChangeProjectTitle={setProjectTitle}
        onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
        user={user}
        savedProjectCount={savedProjects.length}
        onSignIn={handleSignIn}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="flex-1 px-4 md:px-8 py-6 max-w-7xl mx-auto w-full">
        {currentView === 'full-audio' && (
          <FullVoiceoverStudio
            episode={activeEpisode}
            projectTitle={projectTitle}
            onChangeProjectTitle={setProjectTitle}
            isAmbientPlaying={isAmbientPlaying}
            onToggleAmbient={handleToggleAmbient}
            onUpdateEpisode={handleUpdateActiveEpisode}
            onSaveProject={handleSaveProjectToCloud}
            loadedProject={loadedProject?.projectType === 'voiceover' ? loadedProject : null}
            ownerId={user?.uid || 'local'}
            onOpenLibrary={() => setCurrentView('library')}
          />
        )}

        {currentView === 'music-video' && (
          <MusicVideoStudio
            projectTitle={projectTitle}
            onChangeProjectTitle={setProjectTitle}
            ownerId={user?.uid || 'local'}
            onOpenLibrary={() => setCurrentView('library')}
          />
        )}

        {currentView === 'voice-to-voice' && (
          <VoiceToVoiceStudio
            projectTitle={projectTitle}
            onChangeProjectTitle={setProjectTitle}
            onSaveProject={handleSaveProjectToCloud}
            loadedProject={loadedProject?.projectType === 'dubbing' ? loadedProject : null}
            ownerId={user?.uid || 'local'}
            onOpenLibrary={() => setCurrentView('library')}
          />
        )}

        {currentView === 'dialogue' && (
          <DialogueStudio
            projectTitle={projectTitle}
            onChangeProjectTitle={setProjectTitle}
            onSaveProject={handleSaveProjectToCloud}
            loadedProject={loadedProject?.projectType === 'dialogue' ? loadedProject : null}
            ownerId={user?.uid || 'local'}
            onOpenLibrary={() => setCurrentView('library')}
          />
        )}

        {currentView === 'library' && (
          <ProjectLibraryView
            user={user}
            authReady={authReady}
            projects={savedProjects}
            loadingProjects={loadingProjects}
            libraryError={libraryError}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onOpenProject={handleOpenSavedProject}
          />
        )}

        {currentView === 'player' && (
          <CinematicPlayer
            episode={activeEpisode}
            activeSceneIndex={activeSceneIndex}
            onSelectSceneIndex={setActiveSceneIndex}
            isAmbientPlaying={isAmbientPlaying}
            onToggleAmbient={handleToggleAmbient}
            onUpdateEpisodeScene={handleUpdateEpisodeScene}
          />
        )}

        {currentView === 'studio' && (
          <ScriptStudio
            episode={activeEpisode}
            onUpdateEpisodeScene={handleUpdateEpisodeScene}
            onSwitchToPlayerScene={handleSwitchToPlayerScene}
          />
        )}

        {currentView === 'teleprompter' && (
          <TeleprompterView
            episode={activeEpisode}
            isAmbientPlaying={isAmbientPlaying}
            onToggleAmbient={handleToggleAmbient}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-[#070A11] px-4 md:px-8 py-5 text-xs text-slate-500 mt-auto transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-400">Nasrullah Studio</span>
            <span aria-hidden="true">·</span>
            <span>AI ভয়েসওভার, লিরিক মিউজিক ভিডিও, ভয়েস ডাবিং, সংলাপ, Google Drive ভল্ট ও 1080p ভিডিও স্টুডিও</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>1080p Full HD · 60 FPS</span>
            <span aria-hidden="true">·</span>
            <span>লাইব্রেরি সক্রিয়</span>
          </div>
        </div>
      </footer>

      <GenerateEpisodeModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        onEpisodeCreated={handleEpisodeCreated}
        nextEpisodeNumber={episodes.length + 1}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <NasrullahStudioApp />
    </ErrorBoundary>
  );
}
