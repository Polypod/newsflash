import { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NewsflashContext } from '../../context/NewsflashContext';

const AUTO_DISMISS_MS = 8000;

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast._toastId), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast._toastId, onDismiss]);

  return (
    <div className="flex items-start gap-3 bg-gray-900 text-white rounded-lg shadow-xl p-4 w-80 border-l-4 border-red-500">
      <span className="text-xl flex-shrink-0">⚡</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-red-400 uppercase tracking-wide">Newsflash</span>
          <span className="text-xs bg-red-500 text-white rounded px-1 font-mono">
            {toast.criticality_score}
          </span>
        </div>
        <p className="text-sm font-medium leading-snug line-clamp-2">{toast.title}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{toast.source}</span>
          <Link to="/news" className="text-xs text-blue-400 hover:text-blue-300">→ News</Link>
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast._toastId)}
        aria-label="close"
        className="text-gray-400 hover:text-white flex-shrink-0 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

export default function NewsflashToast() {
  const { toasts, dismiss } = useContext(NewsflashContext);
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
      {toasts.map((t) => (
        <Toast key={t._toastId} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
