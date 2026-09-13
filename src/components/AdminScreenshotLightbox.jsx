import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, AlertCircle } from 'lucide-react';

export function AdminScreenshotLightbox({
  isOpen,
  imageSrc,
  alt = 'Screenshot',
  onClose,
  language = 'he'
}) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setZoomLevel(1);
      setHasError(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageSrc) return null;

  const toggleZoom = () => {
    setZoomLevel(prev => (prev >= 2 ? 1 : prev + 0.5));
  };

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = `spotli_screenshot_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.warn('[AdminScreenshotLightbox] Download failed:', e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="screenshot-lightbox-title"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[90vh] w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-3 sm:p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
            <span id="screenshot-lightbox-title">{language === 'he' ? 'צילום מסך מצורף' : 'Attached Screenshot'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
              {zoomLevel}x
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleZoom}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
              title={language === 'he' ? 'שנה תקריב' : 'Toggle zoom'}
              aria-label="Toggle zoom"
            >
              {zoomLevel > 1 ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>

            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
              title={language === 'he' ? 'הורד תמונה' : 'Download image'}
              aria-label="Download image"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
              title={language === 'he' ? 'סגור' : 'Close'}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image viewport */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/60 min-h-[300px]">
          {hasError ? (
            <div className="text-center py-12 space-y-2 text-slate-400">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-xs font-semibold">
                {language === 'he' ? 'שגיאה בטעינת התמונה' : 'Failed to display image'}
              </p>
            </div>
          ) : (
            <img
              src={imageSrc}
              alt={alt}
              onError={() => setHasError(true)}
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-in-out'
              }}
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-lg select-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
