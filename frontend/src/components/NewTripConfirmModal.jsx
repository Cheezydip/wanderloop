import { useEffect } from 'react';
import { Compass, AlertTriangle, X } from 'lucide-react';

export default function NewTripConfirmModal({ isOpen, onClose, onConfirm }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md p-6 rounded-3xl shadow-2xl border transition-all duration-300 scale-100 overflow-hidden"
        style={{
          background: 'var(--surface, #12151c)',
          borderColor: 'var(--border, rgba(255, 255, 255, 0.12))',
          color: 'var(--text)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Background glow gradient */}
        <div
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full pointer-events-none blur-3xl opacity-30"
          style={{ background: 'var(--accent, #2dd4bf)' }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-muted hover:text-text hover:bg-white/10 transition-all cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner shrink-0"
            style={{
              background: 'rgba(244, 63, 94, 0.12)',
              borderColor: 'rgba(244, 63, 94, 0.3)',
              color: '#f43f5e',
            }}
          >
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 id="modal-title" className="text-lg font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Start a New Trip?
            </h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Current progress will be cleared unless saved.
            </p>
          </div>
        </div>

        {/* Description Body */}
        <div
          className="p-3.5 rounded-2xl mb-6 text-xs leading-relaxed border"
          style={{
            background: 'var(--surface-2, rgba(255, 255, 255, 0.03))',
            borderColor: 'var(--border, rgba(255, 255, 255, 0.06))',
            color: 'var(--fg-soft, #a0a7b5)',
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Are you sure you want to exit your current itinerary? Any unsaved changes to your route, activities, or budget will be reset.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all hover:bg-white/5"
            style={{
              background: 'transparent',
              borderColor: 'var(--border, rgba(255, 255, 255, 0.12))',
              color: 'var(--text)',
            }}
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg hover:shadow-rose-500/25 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
              color: '#ffffff',
              border: 'none',
            }}
          >
            Start New Trip
          </button>
        </div>
      </div>
    </div>
  );
}
