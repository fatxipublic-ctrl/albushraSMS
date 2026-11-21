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
      message: error.message || 'An unexpected database or application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendlyDetails = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed.error && parsed.operationType) {
          friendlyDetails = `Database ${parsed.operationType} error on "${parsed.path ?? 'unknown'}": ${parsed.error}`;
        }
      } catch {
        // Use raw message if not JSON
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
          <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-[#DC2626]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-[17px] font-bold text-[#0F172A]">
                  Al-Bushra Management System — Sync Recovery
                </h1>
                <p className="text-[12px] text-slate-500">
                  A cloud database validation or permission issue interrupted this view.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5 font-mono text-[11.5px] text-slate-700 break-words">
              {friendlyDetails}
            </div>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1E3A8A] px-4 text-[12.5px] font-semibold text-white hover:bg-[#172E6E] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reload System</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
