import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  FolderHeart,
  LogIn,
  LogOut,
  Search,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  FileAudio,
  Users,
  AudioLines,
  Clock,
  Loader2,
  Upload,
  Film,
  Image as ImageIcon,
  FileText,
  Music,
  File,
  Download,
  Eye,
  HardDrive,
  RefreshCw,
  Cloud,
  CloudUpload,
  AlertTriangle,
} from 'lucide-react';
import { SavedStudioProject, StudioProjectType } from '../types.ts';
import { deleteStudioProject } from '../services/projectLibraryService.ts';
import {
  deleteVaultFile,
  formatFileSize,
  getStorageQuotaInfo,
  getVaultFileBlob,
  listVaultFiles,
  saveFileToVault,
  StorageQuotaInfo,
  VaultFileCategory,
  VaultFileMeta,
} from '../services/mediaVaultService.ts';
import {
  deleteGoogleDriveFile,
  DriveStorageQuotaInfo,
  DriveVaultFileMeta,
  fetchGoogleDriveFileBlob,
  getGoogleDriveStorageQuota,
  listGoogleDriveStudioFiles,
  uploadBlobToGoogleDrive,
} from '../services/googleDriveVaultService.ts';
import {
  connectGoogleDrive,
  subscribeGoogleDriveToken,
} from '../firebase.ts';
import { triggerBlobDownload } from '../services/subtitleAndVideoService.ts';
import { MediaVaultViewerModal, ViewableVaultFile } from './MediaVaultViewerModal.tsx';

interface ProjectLibraryViewProps {
  user: User | null;
  authReady: boolean;
  projects: SavedStudioProject[];
  loadingProjects: boolean;
  libraryError: string | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenProject: (project: SavedStudioProject) => void;
}

type LibrarySection = 'drive' | 'vault' | 'projects';

const GoogleLogoSvg: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className={className}>
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
    <path fill="none" d="M0 0h48v48H0z" />
  </svg>
);

export const ProjectLibraryView: React.FC<ProjectLibraryViewProps> = ({
  user,
  authReady,
  projects,
  loadingProjects,
  libraryError,
  onSignIn,
  onSignOut,
  onOpenProject,
}) => {
  const [section, setSection] = useState<LibrarySection>('drive');

  // Cloud projects state
  const [filterType, setFilterType] = useState<'all' | StudioProjectType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Google Drive Cross-Device Cloud Vault state (strictly in-memory OAuth token)
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [connectingDrive, setConnectingDrive] = useState<boolean>(false);
  const [driveFiles, setDriveFiles] = useState<DriveVaultFileMeta[]>([]);
  const [loadingDrive, setLoadingDrive] = useState<boolean>(false);
  const [driveQuota, setDriveQuota] = useState<DriveStorageQuotaInfo | null>(null);
  const [driveCategory, setDriveCategory] = useState<'all' | VaultFileCategory>('all');
  const [driveSearch, setDriveSearch] = useState<string>('');
  const [isUploadingDrive, setIsUploadingDrive] = useState<boolean>(false);
  const [driveUploadLabel, setDriveUploadLabel] = useState<string>('');
  const [driveUploadPct, setDriveUploadPct] = useState<number>(0);
  const [isDriveDragOver, setIsDriveDragOver] = useState<boolean>(false);
  const [driveNotice, setDriveNotice] = useState<string | null>(null);
  const [downloadingDriveId, setDownloadingDriveId] = useState<string | null>(null);
  const [confirmDeleteDriveFile, setConfirmDeleteDriveFile] = useState<DriveVaultFileMeta | null>(null);
  const [isDeletingDriveFile, setIsDeletingDriveFile] = useState<boolean>(false);
  const [backingUpLocalId, setBackingUpLocalId] = useState<string | null>(null);

  // Local Device Original-Quality Vault state
  const [vaultFiles, setVaultFiles] = useState<VaultFileMeta[]>([]);
  const [loadingVault, setLoadingVault] = useState<boolean>(true);
  const [isUploadingVault, setIsUploadingVault] = useState<boolean>(false);
  const [vaultCategory, setVaultCategory] = useState<'all' | VaultFileCategory>('all');
  const [vaultSearch, setVaultSearch] = useState<string>('');
  const [viewingFile, setViewingFile] = useState<ViewableVaultFile | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageQuotaInfo | null>(null);
  const [refreshingStorage, setRefreshingStorage] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const driveFileInputRef = useRef<HTMLInputElement | null>(null);
  const ownerId = user?.uid || 'local';

  const refreshStorageEstimate = async (vaultBytes: number) => {
    setRefreshingStorage(true);
    try {
      const info = await getStorageQuotaInfo(vaultBytes);
      setStorageInfo(info);
    } finally {
      setRefreshingStorage(false);
    }
  };

  // Load Vault files from IndexedDB
  useEffect(() => {
    let cancelled = false;
    setLoadingVault(true);
    listVaultFiles(ownerId)
      .then((files) => {
        if (!cancelled) {
          setVaultFiles(files);
          setLoadingVault(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingVault(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const totalVaultBytes = vaultFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

  useEffect(() => {
    refreshStorageEstimate(totalVaultBytes);
  }, [totalVaultBytes]);

  const handleUploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsUploadingVault(true);
    setActionError(null);
    setVaultNotice(null);

    try {
      const saved: VaultFileMeta[] = [];
      for (const f of files) {
        const meta = await saveFileToVault(f, ownerId);
        saved.push(meta);
      }
      setVaultFiles((prev) => [...saved.reverse(), ...prev]);
      setVaultNotice(
        `${saved.length}টি ফাইল হুবহু অরিজিনাল কোয়ালিটি ও অনুপাতে লাইব্রেরিতে সংরক্ষিত হয়েছে!`
      );
    } catch (err: any) {
      setActionError(err?.message || 'ফাইল আপলোড করতে সমস্যা হয়েছে।');
    } finally {
      setIsUploadingVault(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleDownloadVaultFile = async (meta: VaultFileMeta) => {
    try {
      const res = await getVaultFileBlob(meta.id);
      if (!res) {
        setActionError('ফাইলটি পাওয়া যায়নি।');
        return;
      }
      triggerBlobDownload(res.blob, meta.name);
    } catch {
      setActionError('ফাইল ডাউনলোড করতে সমস্যা হয়েছে।');
    }
  };

  // Subscribe to strictly in-memory Google Drive OAuth access token
  useEffect(() => {
    return subscribeGoogleDriveToken((token) => {
      setDriveToken(token);
      if (!token) {
        setDriveFiles([]);
        setDriveQuota(null);
      }
    });
  }, []);

  const loadDriveLibrary = async (token: string) => {
    setLoadingDrive(true);
    setActionError(null);
    try {
      const [files, quota] = await Promise.all([
        listGoogleDriveStudioFiles(token, ownerId),
        getGoogleDriveStorageQuota(token),
      ]);
      setDriveFiles(files);
      setDriveQuota(quota);
    } catch (err: any) {
      setActionError(err?.message || 'Google Drive লাইব্রেরি লোড করতে সমস্যা হয়েছে।');
    } finally {
      setLoadingDrive(false);
    }
  };

  useEffect(() => {
    if (driveToken) {
      loadDriveLibrary(driveToken);
    }
  }, [driveToken, ownerId]);

  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    setActionError(null);
    try {
      await connectGoogleDrive();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setActionError(err?.message || 'Google Drive কানেক্ট করা যায়নি। পপআপ ব্লকার বন্ধ রেখে আবার চেষ্টা করুন।');
      }
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleUploadFilesToDrive = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsUploadingDrive(true);
    setActionError(null);
    setDriveNotice(null);
    setDriveUploadPct(0);

    try {
      const token = driveToken || (await connectGoogleDrive());
      const uploaded: DriveVaultFileMeta[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setDriveUploadLabel(`${f.name} (${i + 1}/${files.length})`);
        setDriveUploadPct(0);
        const meta = await uploadBlobToGoogleDrive(token, f, f.name, ownerId, (pct) =>
          setDriveUploadPct(pct)
        );
        uploaded.push(meta);
      }
      setDriveFiles((prev) => [...uploaded.reverse(), ...prev]);
      getGoogleDriveStorageQuota(token).then(setDriveQuota).catch(() => {});
      setDriveNotice(
        `${uploaded.length}টি ফাইল হুবহু অরিজিনাল কোয়ালিটিতে আপনার Google Drive-এ সেভ হয়েছে! একই Gmail দিয়ে অন্য যেকোনো ডিভাইসে পাবেন।`
      );
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setActionError(err?.message || 'Google Drive-এ আপলোড করতে সমস্যা হয়েছে।');
      }
    } finally {
      setIsUploadingDrive(false);
      setDriveUploadLabel('');
      setDriveUploadPct(0);
    }
  };

  const handleDriveFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFilesToDrive(e.target.files);
    }
    e.target.value = '';
  };

  const handleDriveDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDriveDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFilesToDrive(e.dataTransfer.files);
    }
  };

  const handleDownloadDriveFile = async (meta: DriveVaultFileMeta) => {
    if (!driveToken) {
      setActionError('ডাউনলোড করতে Google Drive কানেক্ট করুন।');
      return;
    }
    setDownloadingDriveId(meta.id);
    setActionError(null);
    try {
      const blob = await fetchGoogleDriveFileBlob(driveToken, meta.driveFileId);
      triggerBlobDownload(blob, meta.name);
    } catch (err: any) {
      setActionError(err?.message || 'Google Drive থেকে ফাইল ডাউনলোড করা যায়নি।');
    } finally {
      setDownloadingDriveId(null);
    }
  };

  const handleConfirmDeleteDriveFile = async () => {
    if (!confirmDeleteDriveFile || !driveToken) return;
    setIsDeletingDriveFile(true);
    setActionError(null);
    try {
      await deleteGoogleDriveFile(driveToken, confirmDeleteDriveFile.driveFileId);
      setDriveFiles((prev) => prev.filter((f) => f.id !== confirmDeleteDriveFile.id));
      if (viewingFile?.id === confirmDeleteDriveFile.id) setViewingFile(null);
      setDriveNotice(`"${confirmDeleteDriveFile.name}" আপনার Google Drive থেকে মুছে ফেলা হয়েছে।`);
      getGoogleDriveStorageQuota(driveToken).then(setDriveQuota).catch(() => {});
      setConfirmDeleteDriveFile(null);
    } catch (err: any) {
      setActionError(err?.message || 'Google Drive থেকে ফাইল মুছতে সমস্যা হয়েছে।');
    } finally {
      setIsDeletingDriveFile(false);
    }
  };

  const handleBackupLocalToDrive = async (meta: VaultFileMeta) => {
    setBackingUpLocalId(meta.id);
    setActionError(null);
    setVaultNotice(null);
    try {
      const token = driveToken || (await connectGoogleDrive());
      const res = await getVaultFileBlob(meta.id);
      if (!res) {
        setActionError('লোকাল ফাইলটি পাওয়া যায়নি।');
        return;
      }
      const uploaded = await uploadBlobToGoogleDrive(token, res.blob, meta.name, ownerId);
      setDriveFiles((prev) => [uploaded, ...prev]);
      getGoogleDriveStorageQuota(token).then(setDriveQuota).catch(() => {});
      setVaultNotice(
        `"${meta.name}" সফলভাবে আপনার Google Drive-এ ব্যাকআপ হয়েছে! এখন যেকোনো ডিভাইস থেকে দেখতে পারবেন।`
      );
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setActionError(err?.message || 'Google Drive-এ ব্যাকআপ করতে সমস্যা হয়েছে।');
      }
    } finally {
      setBackingUpLocalId(null);
    }
  };

  const handleDeleteVaultFile = async (id: string) => {
    try {
      await deleteVaultFile(id);
      setVaultFiles((prev) => prev.filter((f) => f.id !== id));
      if (viewingFile?.id === id) setViewingFile(null);
    } catch {
      setActionError('ফাইল মুছতে সমস্যা হয়েছে।');
    }
  };

  const filteredDrive = driveFiles.filter((f) => {
    if (driveCategory !== 'all' && f.category !== driveCategory) return false;
    if (driveSearch.trim()) {
      const q = driveSearch.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        (f.aspectRatioLabel || '').toLowerCase().includes(q) ||
        (f.resolutionLabel || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredVault = vaultFiles.filter((f) => {
    if (vaultCategory !== 'all' && f.category !== vaultCategory) return false;
    if (vaultSearch.trim()) {
      const q = vaultSearch.toLowerCase();
      return (
        f.name.toLowerCase().includes(q) ||
        (f.aspectRatioLabel || '').toLowerCase().includes(q) ||
        (f.resolutionLabel || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredProjects = projects.filter((p) => {
    if (filterType !== 'all' && p.projectType !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.scriptText.toLowerCase().includes(q) ||
        p.voiceName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCopy = (p: SavedStudioProject) => {
    navigator.clipboard.writeText(p.scriptText).then(() => {
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1800);
    });
  };

  const handleDeleteProject = async (projectId: string) => {
    setActionError(null);
    setDeletingId(projectId);
    try {
      await deleteStudioProject(projectId);
    } catch (err: any) {
      setActionError('প্রজেক্ট মুছতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (ms: number) => {
    try {
      return new Date(ms).toLocaleString('bn-BD', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return new Date(ms).toLocaleDateString();
    }
  };

  const formatDuration = (sec?: number) => {
    if (!sec || !isFinite(sec)) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const typeMeta = (type: StudioProjectType) => {
    if (type === 'dialogue') {
      return {
        label: '২ চরিত্রের সংলাপ',
        icon: <Users className="w-3.5 h-3.5" />,
        cls: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30',
      };
    }
    if (type === 'dubbing') {
      return {
        label: 'ভয়েস-টু-ভয়েস',
        icon: <AudioLines className="w-3.5 h-3.5" />,
        cls: 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/30',
      };
    }
    return {
      label: 'ফুল ভয়েসওভার',
      icon: <FileAudio className="w-3.5 h-3.5" />,
      cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    };
  };

  const vaultCategoryBadge = (cat: VaultFileCategory) => {
    if (cat === 'video') {
      return {
        label: 'ভিডিও',
        icon: <Film className="w-3.5 h-3.5 text-amber-500" />,
      };
    }
    if (cat === 'image') {
      return {
        label: 'ছবি',
        icon: <ImageIcon className="w-3.5 h-3.5 text-cyan-500" />,
      };
    }
    if (cat === 'pdf') {
      return {
        label: 'PDF',
        icon: <FileText className="w-3.5 h-3.5 text-rose-500" />,
      };
    }
    if (cat === 'audio') {
      return {
        label: 'অডিও',
        icon: <Music className="w-3.5 h-3.5 text-emerald-500" />,
      };
    }
    return {
      label: 'ফাইল',
      icon: <File className="w-3.5 h-3.5 text-slate-400" />,
    };
  };

  const categoryBytes = {
    video: vaultFiles.filter((f) => f.category === 'video').reduce((a, f) => a + f.sizeBytes, 0),
    image: vaultFiles.filter((f) => f.category === 'image').reduce((a, f) => a + f.sizeBytes, 0),
    pdf: vaultFiles.filter((f) => f.category === 'pdf').reduce((a, f) => a + f.sizeBytes, 0),
    audio: vaultFiles.filter((f) => f.category === 'audio').reduce((a, f) => a + f.sizeBytes, 0),
    other: vaultFiles.filter((f) => f.category === 'other').reduce((a, f) => a + f.sizeBytes, 0),
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-gradient-to-b dark:from-[#111726] dark:to-[#0A0E17] border border-slate-200 dark:border-amber-900/30 rounded-2xl p-6 md:p-7 space-y-5 shadow-sm dark:shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs md:text-sm text-amber-600 dark:text-amber-400 font-semibold">
              <FolderHeart className="w-4 h-4" />
              <span>মিডিয়া ও ফাইল ভল্ট · ক্লাউড প্রজেক্ট লাইব্রেরি</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              আপনার ব্যক্তিগত স্টুডিও লাইব্রেরি
            </h1>
            <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
              ডিভাইসের যেকোনো 16:9 / 9:16 4K ভিডিও, ছবি, PDF বা ডকুমেন্ট হুবহু অরিজিনাল কোয়ালিটিতে আপলোড করুন, ওয়েবের ভেতরেই দেখুন এবং যেকোনো সময় অরিজিনাল ডাউনলোড করুন।
            </p>
          </div>

          {authReady && user && (
            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 self-start sm:self-center shrink-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-amber-500/40"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="text-xs">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {user.displayName || 'স্টুডিও ব্যবহারকারী'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {vaultFiles.length} ফাইল · {projects.length} প্রজেক্ট
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                title="লগআউট"
                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Section Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => setSection('drive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              section === 'drive'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Google Drive ({driveFiles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSection('vault')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              section === 'vault'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>লোকাল ভল্ট ({vaultFiles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSection('projects')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
              section === 'projects'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
            }`}
          >
            <FolderHeart className="w-4 h-4" />
            <span>ক্লাউড স্ক্রিপ্ট ও প্রজেক্ট ({projects.length})</span>
          </button>
        </div>
      </div>

      {(libraryError || actionError) && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl">
          {actionError || libraryError}
        </div>
      )}

      {driveNotice && section === 'drive' && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700/60 text-blue-800 dark:text-blue-200 text-xs rounded-xl flex items-center justify-between gap-2">
          <span>{driveNotice}</span>
          <button
            type="button"
            onClick={() => setDriveNotice(null)}
            className="text-blue-600 dark:text-blue-300 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {vaultNotice && section === 'vault' && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center justify-between gap-2">
          <span>{vaultNotice}</span>
          <button
            type="button"
            onClick={() => setVaultNotice(null)}
            className="text-emerald-600 dark:text-emerald-300 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION 0: GOOGLE DRIVE CROSS-DEVICE ORIGINAL-QUALITY CLOUD LIBRARY */}
      {section === 'drive' && (
        <div className="space-y-5">
          {!driveToken ? (
            <div className="bg-white dark:bg-[#0B0F19] border border-blue-500/35 rounded-2xl p-8 md:p-12 text-center space-y-5 shadow-sm dark:shadow-xl">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Cloud className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-lg mx-auto">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Google Drive কানেক্ট করুন — সব ডিভাইসে এক লাইব্রেরি!
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  আপনার নিজস্ব Google Drive-এর <span className="font-semibold text-slate-800 dark:text-slate-200">Nasrullah Studio Library</span> ফোল্ডারে সব 16:9 / 9:16 ভিডিও, ছবি ও PDF ১০০% অরিজিনাল কোয়ালিটিতে সেভ হবে। একই Gmail দিয়ে অন্য যেকোনো ফোন বা কম্পিউটারে সাইন-ইন করলেই সব ফাইল হুবহু অরিজিনাল অবস্থায় দেখতে ও ডাউনলোড করতে পারবেন।
                </p>
              </div>
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={handleConnectDrive}
                  disabled={connectingDrive}
                  className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-md font-semibold text-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  {connectingDrive ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  ) : (
                    <GoogleLogoSvg className="w-5 h-5 shrink-0" />
                  )}
                  <span>
                    {connectingDrive ? 'Google Drive কানেক্ট হচ্ছে...' : 'Sign in with Google'}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                নিরাপদ অনুমতি: অ্যাপটি শুধু নিজের তৈরি করা লাইব্রেরি ফাইলগুলোই অ্যাক্সেস করতে পারবে—আপনার ড্রাইভের অন্যান্য ব্যক্তিগত ফাইলে হাত দেবে না।
              </p>
            </div>
          ) : (
            <>
              {/* Live Google Drive Storage Meter */}
              <div className="bg-white dark:bg-[#0B0F19] border border-blue-500/30 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        Google Drive ক্লাউড স্টোরেজ (সব ডিভাইসে সিঙ্কড)
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {driveQuota?.email || user?.email || 'আপনার Google অ্যাকাউন্ট'} · ফোল্ডার: Nasrullah Studio Library
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => loadDriveLibrary(driveToken)}
                    disabled={loadingDrive}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingDrive ? 'animate-spin' : ''}`} />
                    <span>সিঙ্ক রিফ্রেশ</span>
                  </button>
                </div>

                {driveQuota && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">ড্রাইভে খালি জায়গা</div>
                        <div className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                          {formatFileSize(driveQuota.availableBytes)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">মোট ব্যবহৃত</div>
                        <div className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-400 font-mono tabular-nums mt-0.5">
                          {formatFileSize(driveQuota.usageBytes)}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">মোট Drive স্পেস</div>
                        <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                          {driveQuota.limitBytes > 0 ? formatFileSize(driveQuota.limitBytes) : 'আনলিমিটেড'}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80">
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">ব্যবহারের হার</div>
                        <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                          {driveQuota.usedPercent.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                        style={{ width: `${Math.max(1, Math.min(100, driveQuota.usedPercent))}%` }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Direct Upload to Google Drive Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDriveDragOver(true);
                }}
                onDragLeave={() => setIsDriveDragOver(false)}
                onDrop={handleDriveDrop}
                className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
                  isDriveDragOver
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                    : 'border-slate-300 dark:border-slate-700/80 bg-white dark:bg-[#0B0F19]'
                }`}
              >
                <input
                  ref={driveFileInputRef}
                  type="file"
                  multiple
                  accept="*/*"
                  onChange={handleDriveFileInputChange}
                  className="hidden"
                />
                <div className="max-w-xl mx-auto space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    {isUploadingDrive ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <CloudUpload className="w-6 h-6" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      সরাসরি Google Drive-এ আপলোড করুন (সব ডিভাইসে পাবেন)
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      যেকোনো 16:9 / 9:16 4K ভিডিও, ছবি, PDF বা ডকুমেন্ট ১০০% অরিজিনাল কোয়ালিটিতে আপনার Google Drive-এ জমা হবে। অন্য ফোন বা পিসিতে সাইন-ইন করলেই দেখতে ও ডাউনলোড করতে পারবেন।
                    </p>
                  </div>

                  {isUploadingDrive && (
                    <div className="max-w-sm mx-auto space-y-1.5">
                      <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 truncate">
                        আপলোড হচ্ছে: {driveUploadLabel} ({driveUploadPct}%)
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-150"
                          style={{ width: `${driveUploadPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => driveFileInputRef.current?.click()}
                      disabled={isUploadingDrive}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-60"
                    >
                      <CloudUpload className="w-4 h-4" />
                      <span>
                        {isUploadingDrive
                          ? `Drive-এ আপলোড হচ্ছে (${driveUploadPct}%)...`
                          : 'Google Drive-এ ফাইল আপলোড করুন'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Drive Filter & Search */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {(
                    [
                      { id: 'all', label: `সব (${driveFiles.length})` },
                      { id: 'video', label: 'ভিডিও' },
                      { id: 'image', label: 'ছবি' },
                      { id: 'pdf', label: 'PDF' },
                      { id: 'audio', label: 'অডিও' },
                      { id: 'other', label: 'অন্যান্য ফাইল' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDriveCategory(tab.id)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        driveCategory === tab.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative md:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={driveSearch}
                    onChange={(e) => setDriveSearch(e.target.value)}
                    placeholder="Drive ফাইল খুঁজুন..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Drive Files Grid */}
              {loadingDrive ? (
                <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    আপনার Google Drive লাইব্রেরি লোড হচ্ছে...
                  </p>
                </div>
              ) : filteredDrive.length === 0 ? (
                <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Google Drive লাইব্রেরিতে এখনো কোনো ফাইল নেই
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    উপরের বাটনে ক্লিক করে ভিডিও, ছবি বা PDF আপলোড করুন, অথবা ভিডিও বানানোর পর &ldquo;Google Drive-এ সেভ&rdquo; বাটনে চাপুন!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDrive.map((item) => {
                    const badge = vaultCategoryBadge(item.category);
                    const dur = formatDuration(item.durationSec);
                    return (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm dark:shadow-lg transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => setViewingFile(item)}
                          className="relative w-full h-48 bg-slate-100 dark:bg-[#060911] flex items-center justify-center overflow-hidden group cursor-pointer border-b border-slate-200 dark:border-slate-800/80"
                          title="ক্লিক করে অরিজিনাল অনুপাতে দেখুন"
                        >
                          {item.thumbnailLink ? (
                            <img
                              src={item.thumbnailLink}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                              <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                {item.category === 'pdf' ? (
                                  <FileText className="w-6 h-6 text-rose-500" />
                                ) : item.category === 'audio' ? (
                                  <Music className="w-6 h-6 text-emerald-500" />
                                ) : item.category === 'video' ? (
                                  <Film className="w-6 h-6 text-amber-500" />
                                ) : (
                                  <File className="w-6 h-6 text-slate-400" />
                                )}
                              </div>
                              <span className="text-[11px] font-semibold uppercase tracking-wide">
                                {badge.label}
                              </span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/45 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 text-white text-xs font-bold shadow-lg">
                              <Eye className="w-3.5 h-3.5 text-blue-400" />
                              <span>অরিজিনাল ভিউ</span>
                            </span>
                          </div>

                          <div className="absolute top-2 left-2 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-blue-600/90 text-white text-[10px] font-bold">
                              Drive
                            </span>
                            {item.aspectRatioLabel && (
                              <span className="px-2 py-0.5 rounded bg-slate-950/85 text-amber-300 text-[10px] font-bold tabular-nums">
                                {item.aspectRatioLabel}
                              </span>
                            )}
                            {item.resolutionLabel && (
                              <span className="px-2 py-0.5 rounded bg-slate-950/85 text-cyan-300 text-[10px] font-bold tabular-nums">
                                {item.resolutionLabel}
                              </span>
                            )}
                          </div>
                          {dur && (
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-slate-950/85 text-white text-[10px] font-mono tabular-nums">
                              {dur}
                            </span>
                          )}
                        </button>

                        <div className="p-4 space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                                {badge.icon}
                                <span>{badge.label}</span>
                              </span>
                              <span className="tabular-nums">{formatFileSize(item.sizeBytes)}</span>
                            </div>
                            <h3
                              className="text-sm font-bold text-slate-900 dark:text-white truncate"
                              title={item.name}
                            >
                              {item.name}
                            </h3>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                              {item.width && item.height && (
                                <>
                                  <span>
                                    {item.width}×{item.height}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                </>
                              )}
                              <span>{formatDate(item.createdAtMs)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <button
                              type="button"
                              onClick={() => setViewingFile(item)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>দেখুন</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadDriveFile(item)}
                              disabled={downloadingDriveId === item.id}
                              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer disabled:opacity-60"
                              title="১০০% অরিজিনাল ফাইল ডাউনলোড করুন"
                            >
                              {downloadingDriveId === item.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              <span>ডাউনলোড</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfirmDeleteDriveFile(item)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
                              title="Google Drive থেকে মুছে ফেলুন"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* SECTION 1: LOCAL DEVICE ORIGINAL-QUALITY MEDIA & DOCUMENT VAULT */}
      {section === 'vault' && (
        <div className="space-y-5">
          {/* Live Storage Capacity & Breakdown Panel */}
          <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    লাইব্রেরি স্টোরেজ ও জায়গার হিসাব
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ডিভাইসের ব্রাউজার স্টোরেজ কোটা অনুযায়ী আপনার আসল ফাইলগুলো নিরাপদে জমা থাকে
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => refreshStorageEstimate(totalVaultBytes)}
                disabled={refreshingStorage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingStorage ? 'animate-spin' : ''}`} />
                <span>রিফ্রেশ</span>
              </button>
            </div>

            {/* Key Storage Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">খালি জায়গা (বাকি)</div>
                <div className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                  {storageInfo?.supported
                    ? formatFileSize(storageInfo.availableBytes)
                    : 'ডিভাইস অনুযায়ী'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">ভল্টে ব্যবহৃত</div>
                <div className="text-base sm:text-lg font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums mt-0.5">
                  {formatFileSize(totalVaultBytes)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">মোট বরাদ্দকৃত কোটা</div>
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                  {storageInfo?.supported ? formatFileSize(storageInfo.quotaBytes) : 'সাপোর্টেড'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">ব্যবহারের হার</div>
                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                  {storageInfo?.supported
                    ? `${storageInfo.usedPercent < 0.1 && storageInfo.usageBytes > 0 ? '< 0.1' : storageInfo.usedPercent.toFixed(1)}%`
                    : `${vaultFiles.length} ফাইল`}
                </div>
              </div>
            </div>

            {/* Visual Multi-Category Progress Bar */}
            <div className="space-y-2">
              <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden flex">
                {(() => {
                  const denom =
                    storageInfo?.supported && storageInfo.quotaBytes > 0
                      ? storageInfo.quotaBytes
                      : Math.max(1, totalVaultBytes);
                  const segs = [
                    { key: 'video', bytes: categoryBytes.video, color: 'bg-amber-500' },
                    { key: 'image', bytes: categoryBytes.image, color: 'bg-cyan-500' },
                    { key: 'pdf', bytes: categoryBytes.pdf, color: 'bg-rose-500' },
                    { key: 'audio', bytes: categoryBytes.audio, color: 'bg-emerald-500' },
                    { key: 'other', bytes: categoryBytes.other, color: 'bg-slate-500' },
                  ];
                  return segs.map((s) => {
                    if (s.bytes <= 0) return null;
                    const pct = Math.max(0.8, (s.bytes / denom) * 100);
                    return (
                      <div
                        key={s.key}
                        className={`${s.color} h-full transition-all duration-300`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    );
                  });
                })()}
              </div>

              {/* Clean Category Breakdown Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-amber-500" />
                    <span>ভিডিও: {formatFileSize(categoryBytes.video)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-cyan-500" />
                    <span>ছবি: {formatFileSize(categoryBytes.image)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-rose-500" />
                    <span>PDF: {formatFileSize(categoryBytes.pdf)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-emerald-500" />
                    <span>অডিও: {formatFileSize(categoryBytes.audio)}</span>
                  </span>
                  {categoryBytes.other > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm bg-slate-500" />
                      <span>অন্যান্য: {formatFileSize(categoryBytes.other)}</span>
                    </span>
                  )}
                </div>

                <span className="text-slate-500 dark:text-slate-400">
                  মোট ফাইল: {vaultFiles.length}টি · ক্লাউড স্ক্রিপ্ট: {projects.length}টি
                </span>
              </div>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors ${
              isDragOver
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                : 'border-slate-300 dark:border-slate-700/80 bg-white dark:bg-[#0B0F19]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="*/*"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="max-w-xl mx-auto space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                {isUploadingVault ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  যেকোনো ভিডিও (16:9 / 9:16 / 4K), ছবি, PDF বা ফাইল আপলোড করুন
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  কোনো কম্প্রেশন বা ক্রপিং ছাড়াই আপনার ফাইল ১০০% আসল কোয়ালিটি ও আসল অনুপাতে সংরক্ষিত থাকবে। ক্লিক করলেই ওয়েবের ভেতরেই প্লে/ভিউ করতে ও অরিজিনাল ডাউনলোড করতে পারবেন।
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingVault}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-60"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploadingVault ? 'সংরক্ষণ হচ্ছে...' : 'ডিভাইস থেকে ফাইল বেছে নিন'}</span>
                </button>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                সাপোর্টেড: MP4, WebM, MOV (4K/1080p), PNG, JPG, WebP, PDF, MP3, WAV, SRT, DOCX, ZIP ইত্যাদি · মোট জমা:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatFileSize(totalVaultBytes)}
                </span>
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'all', label: `সব (${vaultFiles.length})` },
                  { id: 'video', label: 'ভিডিও' },
                  { id: 'image', label: 'ছবি' },
                  { id: 'pdf', label: 'PDF' },
                  { id: 'audio', label: 'অডিও' },
                  { id: 'other', label: 'অন্যান্য ফাইল' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVaultCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                    vaultCategory === tab.id
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={vaultSearch}
                onChange={(e) => setVaultSearch(e.target.value)}
                placeholder="ফাইলের নাম, 16:9, 9:16, PDF..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Vault Grid */}
          {loadingVault ? (
            <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                আপনার ফাইল ভল্ট লোড হচ্ছে...
              </p>
            </div>
          ) : filteredVault.length === 0 ? (
            <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                এখনো কোনো ফাইল আপলোড করা হয়নি
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                উপরের বাটনে ক্লিক করে আপনার 16:9 বা 9:16 ভিডিও, ছবি বা PDF ফাইল রাখুন—একদম অরিজিনাল অবস্থাতেই দেখতে ও ডাউনলোড করতে পারবেন।
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVault.map((item) => {
                const badge = vaultCategoryBadge(item.category);
                const dur = formatDuration(item.durationSec);
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 hover:border-amber-500/60 rounded-2xl overflow-hidden flex flex-col justify-between shadow-sm dark:shadow-lg transition-colors"
                  >
                    {/* Aspect-Preserving Preview Area (click to open native viewer!) */}
                    <button
                      type="button"
                      onClick={() => setViewingFile(item)}
                      className="relative w-full h-48 bg-slate-100 dark:bg-[#060911] flex items-center justify-center overflow-hidden group cursor-pointer border-b border-slate-200 dark:border-slate-800/80"
                      title="ক্লিক করে অরিজিনাল অনুপাতে দেখুন"
                    >
                      {item.thumbDataUrl ? (
                        <img
                          src={item.thumbDataUrl}
                          alt={item.name}
                          className="max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                            {item.category === 'pdf' ? (
                              <FileText className="w-6 h-6 text-rose-500" />
                            ) : item.category === 'audio' ? (
                              <Music className="w-6 h-6 text-emerald-500" />
                            ) : item.category === 'video' ? (
                              <Film className="w-6 h-6 text-amber-500" />
                            ) : (
                              <File className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                          <span className="text-[11px] font-semibold uppercase tracking-wide">
                            {badge.label}
                          </span>
                        </div>
                      )}

                      {/* Hover Overlay Hint */}
                      <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/45 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 text-white text-xs font-bold shadow-lg">
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>অরিজিনাল ভিউ</span>
                        </span>
                      </div>

                      {/* Exact Ratio & Duration Metadata Overlay */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        {item.aspectRatioLabel && (
                          <span className="px-2 py-0.5 rounded bg-slate-950/85 text-amber-300 text-[10px] font-bold tabular-nums">
                            {item.aspectRatioLabel}
                          </span>
                        )}
                        {item.resolutionLabel && (
                          <span className="px-2 py-0.5 rounded bg-slate-950/85 text-cyan-300 text-[10px] font-bold tabular-nums">
                            {item.resolutionLabel}
                          </span>
                        )}
                      </div>
                      {dur && (
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-slate-950/85 text-white text-[10px] font-mono tabular-nums">
                          {dur}
                        </span>
                      )}
                    </button>

                    {/* Details + Actions */}
                    <div className="p-4 space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                          <span className="tabular-nums">{formatFileSize(item.sizeBytes)}</span>
                        </div>
                        <h3
                          className="text-sm font-bold text-slate-900 dark:text-white truncate"
                          title={item.name}
                        >
                          {item.name}
                        </h3>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                          {item.width && item.height && (
                            <>
                              <span>
                                {item.width}×{item.height}
                              </span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span>{formatDate(item.createdAtMs)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => setViewingFile({ ...item, source: 'local' })}
                          className="flex-1 flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>দেখুন</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleBackupLocalToDrive(item)}
                          disabled={backingUpLocalId === item.id}
                          className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-blue-600/15 dark:bg-blue-500/20 hover:bg-blue-600/25 border border-blue-500/40 text-blue-700 dark:text-blue-300 font-bold text-xs cursor-pointer disabled:opacity-60"
                          title="Google Drive-এ ব্যাকআপ করুন (অন্য ডিভাইসে পাওয়ার জন্য)"
                        >
                          {backingUpLocalId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CloudUpload className="w-3.5 h-3.5" />
                          )}
                          <span>Drive</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadVaultFile(item)}
                          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                          title="১০০% অরিজিনাল ফাইল ডাউনলোড করুন"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteVaultFile(item.id)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: CLOUD SAVED PROJECTS & SCRIPTS (FIREBASE) */}
      {section === 'projects' && (
        <>
          {!authReady ? (
            <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-amber-500 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                আপনার অ্যাকাউন্ট যাচাই হচ্ছে...
              </p>
            </div>
          ) : !user ? (
            <div className="bg-white dark:bg-[#0B0F19] border border-amber-500/40 rounded-2xl p-8 md:p-12 text-center space-y-4 shadow-sm dark:shadow-xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <FolderHeart className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                গুগল অ্যাকাউন্ট দিয়ে লগইন করুন
              </h2>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                আপনার ভয়েসওভার স্ক্রিপ্ট, ২ চরিত্রের সংলাপ ও ভয়েস সেটিংস নিরাপদে ক্লাউড লাইব্রেরিতে সেভ রাখতে ১-ক্লিকে গুগল সাইন-ইন করুন।
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Google দিয়ে সাইন-ইন করুন</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {(
                    [
                      { id: 'all', label: `সব (${projects.length})` },
                      { id: 'voiceover', label: 'ফুল ভয়েস' },
                      { id: 'dialogue', label: '২ চরিত্রের সংলাপ' },
                      { id: 'dubbing', label: 'ভয়েস-টু-ভয়েস' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterType(tab.id)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        filterType === tab.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative md:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="প্রজেক্ট খুঁজুন..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Project List */}
              {loadingProjects ? (
                <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    আপনার সেভ করা প্রজেক্ট লোড হচ্ছে...
                  </p>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    এখনো কোনো প্রজেক্ট সেভ করা হয়নি
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ফুল ভয়েস, ভয়েস-টু-ভয়েস অথবা ২ চরিত্রের সংলাপ ট্যাব থেকে &ldquo;লাইব্রেরিতে সেভ&rdquo; বাটনে চাপলেই এখানে জমা হবে!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredProjects.map((project) => {
                    const badge = typeMeta(project.projectType);
                    return (
                      <div
                        key={project.id}
                        className="bg-white dark:bg-[#0D121F] border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors shadow-sm dark:shadow-lg"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${badge.cls}`}
                            >
                              {badge.icon}
                              <span>{badge.label}</span>
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(project.updatedAtMs)}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1">
                            {project.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-amber-700 dark:text-amber-300">
                              কণ্ঠ: {project.voiceName}
                              {project.secondaryVoiceName ? ` + ${project.secondaryVoiceName}` : ''}
                            </span>
                            {project.voiceEmotion !== 'auto' && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>আবেগ: {project.voiceEmotion}</span>
                              </>
                            )}
                            {project.durationSec > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {project.durationSec}s
                                </span>
                              </>
                            )}
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3">
                            {project.scriptText}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
                          <button
                            type="button"
                            onClick={() => onOpenProject(project)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>স্টুডিওতে খুলুন</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopy(project)}
                              className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs cursor-pointer"
                              title="স্ক্রিপ্ট কপি করুন"
                            >
                              {copiedId === project.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>কপি</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteProject(project.id)}
                              disabled={deletingId === project.id}
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-rose-100 dark:hover:bg-rose-950/60 border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-700 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors cursor-pointer disabled:opacity-50"
                              title="প্রজেক্ট মুছুন"
                            >
                              {deletingId === project.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Mandatory Explicit Confirmation Dialog for Deleting a Google Drive File */}
      {confirmDeleteDriveFile && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!isDeletingDriveFile) setConfirmDeleteDriveFile(null);
          }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#0D1321] border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Google Drive থেকে ফাইল মুছে ফেলবেন?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  আপনি কি নিশ্চিতভাবে{' '}
                  <span className="font-bold text-slate-900 dark:text-white break-all">
                    &ldquo;{confirmDeleteDriveFile.name}&rdquo;
                  </span>{' '}
                  ({formatFileSize(confirmDeleteDriveFile.sizeBytes)}) আপনার Google Drive থেকে স্থায়ীভাবে মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingDriveFile}
                onClick={() => setConfirmDeleteDriveFile(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer disabled:opacity-50"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={isDeletingDriveFile}
                onClick={handleConfirmDeleteDriveFile}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {isDeletingDriveFile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>মুছে ফেলা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>হ্যাঁ, স্থায়ীভাবে মুছুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Native Aspect-Preserving Media & PDF Lightbox Viewer */}
      <MediaVaultViewerModal
        file={viewingFile}
        driveAccessToken={driveToken}
        onClose={() => setViewingFile(null)}
      />
    </div>
  );
};
