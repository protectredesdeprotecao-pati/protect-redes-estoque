import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const ToastStack: React.FC = () => {
  const { toasts, dismissToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-5 bottom-20 z-50 flex w-full max-w-sm flex-col gap-2.5 md:bottom-5"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const tone =
          toast.type === 'sucesso'
            ? 'border-[#16A34A]/30 bg-[#0B3A2C] text-white'
            : toast.type === 'erro'
              ? 'border-[#DC2626]/40 bg-[#991B1B] text-white'
              : toast.type === 'aviso'
                ? 'border-[#D97706]/40 bg-[#78350F] text-white'
                : 'border-[#2FA36E]/30 bg-[#14221B] text-white';

        const Icon =
          toast.type === 'sucesso'
            ? CheckCircle2
            : toast.type === 'erro'
              ? XCircle
              : toast.type === 'aviso'
                ? AlertTriangle
                : Info;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg transition-all duration-150 ${tone}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-snug">{toast.title}</div>
              {toast.description && (
                <div className="mt-0.5 text-xs text-white/80 leading-relaxed">{toast.description}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Dispensar notificação"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
