import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastOptions = {
  message: string;
  tone?: "success" | "error" | "info";
  action?: { label: string; onClick: () => void };
  duration?: number;
};

type ToastItem = ToastOptions & { id: number };

const ToastContext = createContext<(options: ToastOptions | string) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (input: ToastOptions | string) => {
      const options = typeof input === "string" ? { message: input } : input;
      const id = nextId.current++;
      setItems((current) => [...current.slice(-2), { tone: "success", ...options, id }]);
      window.setTimeout(() => dismiss(id), options.duration ?? (options.action ? 6000 : 3200));
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" role="status">
        {items.map((item) => (
          <div className={`toast toast-${item.tone}`} key={item.id}>
            {item.tone === "error" ? <CircleAlert size={18} /> : item.tone === "info" ? <Info size={18} /> : <CheckCircle2 size={18} />}
            <span>{item.message}</span>
            {item.action && (
              <button
                className="toast-action"
                type="button"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            )}
            <button aria-label="关闭提示" className="toast-close" type="button" onClick={() => dismiss(item.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
