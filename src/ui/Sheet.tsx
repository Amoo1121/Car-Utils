import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type SheetProps = {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  tone?: "fuel" | "wash" | "expense" | "accent";
  /** When true, closing asks for confirmation so typed data is not lost by accident. */
  dirty?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal sheet: a right-hand drawer on desktop and a bottom sheet on phones.
 * Handles Escape, focus trapping, focus restore and background scroll lock.
 */
export function Sheet({ open, title, subtitle, icon, tone = "accent", dirty, onClose, children, footer, size = "md" }: SheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const dirtyRef = useRef(dirty);
  const onCloseRef = useRef(onClose);
  dirtyRef.current = dirty;
  onCloseRef.current = onClose;

  function requestClose() {
    if (dirtyRef.current && !window.confirm("放弃尚未保存的内容？")) return;
    onCloseRef.current();
  }

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstField = panel?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), select, textarea");
    (firstField ?? panel)?.focus({ preventScroll: true });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="sheet-layer" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`sheet sheet-${size} tone-${tone}`}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="sheet-header">
          <span className="sheet-grabber" aria-hidden="true" />
          {icon && <span className="sheet-icon">{icon}</span>}
          <div className="sheet-heading">
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button aria-label="关闭" className="icon-button" type="button" onClick={requestClose}>
            <X size={18} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
