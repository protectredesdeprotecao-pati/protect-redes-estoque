import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  widthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const SlideOver: React.FC<SlideOverProps> = ({
  open,
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-lg',
  children,
  footer,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 flex h-full w-full ${widthClass} flex-col border-l border-[#E2E8F0] bg-white shadow-2xl dark:border-[#1E293B] dark:bg-[#111820]`}
      >
        <div className="flex items-start justify-between border-b border-[#E2E8F0] bg-[#0D151A] px-6 py-4 text-white dark:border-[#1E293B] dark:bg-[#090E12]">
          <div className="min-w-0 pr-4">
            <h3 className="font-display text-base font-semibold tracking-tight text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-[#94A3B8]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
            aria-label="Fechar painel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 text-[#0F172A] dark:text-[#F1F5F9]">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-3.5 dark:border-[#1E293B] dark:bg-[#0D151A]">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
};
