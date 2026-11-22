import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'অ্যাপ্লিকেশনে অপ্রত্যাশিত সমস্যা হয়েছে।',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const isPermission = this.state.message.includes('Missing or insufficient permissions');
      return (
        <div className="min-h-screen bg-[#090D16] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0D121F] border border-rose-800/60 rounded-2xl p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">কিছু একটা সমস্যা হয়েছে</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isPermission
                ? 'ক্লাউড ডেটাবেজে প্রবেশের অনুমতি পাওয়া যায়নি। দয়া করে আবার গুগল অ্যাকাউন্টে লগইন করে চেষ্টা করুন।'
                : 'দয়া করে পেজটি রিলোড করে আবার চেষ্টা করুন।'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>পেজ রিলোড করুন</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
