import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyError = () => {
    const errorText = `Conflux Circuit Error Report\n${new Date().toISOString()}\n\n${this.state.error?.toString()}\n\n${this.state.error?.stack || 'No stack trace'}`;
    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-cosmic-blue flex items-center justify-center p-3 sm:p-6 font-sans text-white" role="alert" aria-live="assertive">
          <div className="glass-panel p-5 sm:p-8 max-w-md w-full border-2 border-nebula-pink text-center shadow-[0_0_50px_rgba(214,79,138,0.2)]">
            <div className="text-5xl sm:text-6xl mb-4" aria-hidden="true">⚠️</div>
            <h1 className="text-2xl sm:text-3xl font-black text-nebula-pink mb-2 tracking-tighter">SYSTEM FAILURE</h1>
            <p className="text-gray-300 mb-6 font-mono text-xs sm:text-sm">
              A critical error has occurred in the simulation matrix.
            </p>
            <div className="bg-black/50 p-3 sm:p-4 rounded mb-6 text-left overflow-auto mobile-scroll max-h-32 border border-white/10 relative group">
              <code className="text-[10px] sm:text-xs text-red-400 font-mono break-all leading-relaxed">
                {this.state.error?.toString()}
              </code>
              <button
                onClick={this.handleCopyError}
                className="absolute top-2 right-2 text-[10px] px-2 py-1 bg-white/10 rounded text-gray-400 active:text-white sm:hover:text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Copy error details to clipboard"
              >
                {this.state.copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={this.handleCopyError}
                className="flex-1 py-4 sm:py-3 bg-white/10 border border-white/20 rounded font-bold uppercase tracking-widest text-sm active:bg-white/20 sm:hover:bg-white/20 transition-colors"
                aria-label="Copy error report"
              >
                {this.state.copied ? '✓ Copied' : 'Copy Report'}
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-4 sm:py-3 bg-gradient-to-r from-nebula-pink to-purple-700 rounded font-bold uppercase tracking-widest active:opacity-80 sm:hover:opacity-90 transition-opacity"
                aria-label="Reload application"
              >
                Reboot System
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
