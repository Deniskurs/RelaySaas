import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// Simple toast context and provider
const ToastContext = React.createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);

  const addToast = React.useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = { id, ...toast };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after duration
    const duration = toast.duration || 3000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = React.useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = React.useMemo(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

// Toast container component
function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Individual toast component
function Toast({ toast, onRemove }) {
  const variantStyles = {
    default: "bg-white/10 border-white/20 text-foreground",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    error: "bg-rose-500/10 border-rose-500/30 text-rose-400",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    loading: "bg-white/10 border-white/20 text-foreground",
  };

  return (
    <div
      className={cn(
        "pointer-events-auto min-w-[300px] max-w-[420px] rounded-none border backdrop-blur-sm",
        "shadow-[0_8px_16px_rgba(0,0,0,0.3)]",
        "animate-in slide-in-from-right-full duration-300",
        "p-4 flex items-start gap-3",
        variantStyles[toast.variant || "default"]
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      {toast.icon && (
        <div className="shrink-0 mt-0.5">
          {typeof toast.icon === "string" ? (
            <span className="text-lg">{toast.icon}</span>
          ) : (
            <toast.icon className={cn(
              "w-5 h-5",
              toast.variant === "loading" && "animate-spin"
            )} />
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="font-medium text-sm mb-1">{toast.title}</div>
        )}
        {toast.description && (
          <div className="text-xs opacity-90 leading-relaxed">
            {toast.description}
          </div>
        )}
      </div>

      {/* Close button */}
      {!toast.loading && (
        <button
          onClick={() => onRemove(toast.id)}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// Helper function to create toast
export function toast(options) {
  // This will be replaced by the hook version
  console.warn("Toast called outside of ToastProvider context");
}
