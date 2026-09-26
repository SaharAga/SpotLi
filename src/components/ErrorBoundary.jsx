import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { reportCrash } from '../services/crashReportService';
import { isAppStorageKey } from '../constants/storageKeys';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SpotLi Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });

    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      /Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
        error?.message || ''
      );

    if (isChunkError && typeof window !== 'undefined') {
      try {
        const reloadKey = 'spotli_chunk_reload_attempted';
        if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, 'true');
          window.location.reload();
          return;
        }
      } catch {
        // Ignore storage or reload failures
      }
    }

    reportCrash(error, { componentName: this.props.componentName });
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof this.props.onReset === 'function') {
      this.props.onReset();
    }
  };

  handleHardReset = () => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (isAppStorageKey(key)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      console.error('Failed to clear SpotLi localStorage data during hard reset:', e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
          : this.props.fallback;
      }

      if (this.props.compact) {
        return (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-rose-400 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>{this.props.componentName || 'Component'} failed to render</span>
            </div>
            <p className="text-xs text-slate-400">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={this.handleReset}
              className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-medium"
            >
              Try again
            </button>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <h2 className="text-lg font-bold text-slate-100">
              Something went wrong
            </h2>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred while rendering SpotLi.'}
            </p>

            <div className="p-3 bg-slate-950 rounded-xl text-xs font-mono text-rose-700 dark:text-rose-300 text-start overflow-x-auto max-h-32 border border-slate-800">
              {this.state.error?.stack || String(this.state.error)}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleHardReset}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Local Data</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

