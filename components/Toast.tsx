
import React from 'react';
import { ToastMessage } from '../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
}

const TOAST_STYLES: Record<ToastMessage['type'], { border: string; icon: string; text: string }> = {
  success: { border: 'border-l-4 border-l-hyper-green', icon: '✓', text: 'text-hyper-green' },
  warning: { border: 'border-l-4 border-l-solar-orange', icon: '⚠', text: 'text-solar-orange' },
  info:    { border: 'border-l-4 border-l-galaxy-cyan', icon: 'ℹ', text: 'text-galaxy-cyan' },
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts }) => {
  return (
    <div className="fixed bottom-20 sm:bottom-24 left-2 right-2 sm:left-auto sm:right-4 z-50 space-y-2 flex flex-col items-center sm:items-end" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {toasts.map(toast => {
        const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
        return (
          <div
            key={toast.id}
            className={`glass-panel p-3 animate-slide-in-up max-w-sm w-full sm:w-auto flex items-center gap-2 ${style.border}`}
            role="alert"
          >
            <span className={`font-bold text-base flex-shrink-0 ${style.text}`} aria-hidden="true">{style.icon}</span>
            <p className="text-sm text-white text-center sm:text-left">{toast.message}</p>
          </div>
        );
      })}
    </div>
  );
};
