import React from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

/**
 * Global Error Boundary
 * Catches unhandled React runtime rendering errors and displays an informative recovery screen
 * instead of leaving a blank screen.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[UNSAID CRITICAL RUNTIME ERROR]', error);
    console.error('[UNSAID COMPONENT STACK]', errorInfo?.componentStack);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || String(this.state.error);
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#0b0f19] text-white selection:bg-indigo-500 font-sans">
          <div className="w-full max-w-2xl p-6 sm:p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-red-400 font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>UNSAID · Runtime Error Caught</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Application failed to render
                </h1>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              A runtime exception prevented the React component tree from rendering. Below is the diagnostic report.
            </p>

            {/* Error Message Box */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Error Message:
              </span>
              <div className="p-3.5 rounded-2xl bg-black/40 border border-red-500/30 text-red-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap select-all">
                {errorMsg}
              </div>
            </div>

            {/* Component Stack Box if available */}
            {componentStack && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Component Stack:
                </span>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-slate-400 font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap select-all">
                  {componentStack}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold border border-white/10 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Clear Cache & Return to Gateway</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
