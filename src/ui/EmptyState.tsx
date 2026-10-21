import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  children,
  action,
  secondary,
}: {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <span className="empty-state-icon">{icon}</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {(action || secondary) && (
        <div className="empty-state-actions">
          {action}
          {secondary}
        </div>
      )}
    </section>
  );
}
