import { Droplets, Fuel, Receipt, RotateCcw, Zap } from "lucide-react";
import type { TimelineEntry } from "../../domain/timeline/timeline";
import { useWorkspace } from "../../app/workspace";
import { dateLabel, km, money } from "../../ui/format";

export function TimelineRow({ entry, unit = "L" }: { entry: TimelineEntry; unit?: "L" | "kWh" }) {
  const { openEditor, restore } = useWorkspace();
  const icon =
    entry.kind === "fuel" ? unit === "kWh" ? <Zap size={18} /> : <Fuel size={18} /> : entry.kind === "wash" ? <Droplets size={18} /> : <Receipt size={18} />;
  const title = unit === "kWh" && entry.kind === "fuel" ? entry.title.replace("加油", "充电") : entry.title;
  const subtitle = unit === "kWh" && entry.kind === "fuel" ? entry.subtitle.replaceAll(" L", " kWh").replaceAll("/L", "/kWh") : entry.subtitle;

  const content = (
    <>
      <span className={`timeline-icon tone-${entry.kind}`} aria-hidden="true">
        {icon}
      </span>
      <span className="timeline-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <span className="timeline-meta">
        <strong>{money(entry.amount, entry.amount < 100)}</strong>
        <small>
          {dateLabel(entry.date)}
          {entry.odometer ? ` · ${km(entry.odometer)}` : ""}
        </small>
      </span>
    </>
  );

  if (entry.deleted) {
    return (
      <li className="timeline-row deleted">
        <div className="timeline-row-inner">{content}</div>
        <button className="button button-soft button-sm" type="button" onClick={() => restore(entry.kind, entry.id)}>
          <RotateCcw size={14} />
          恢复
        </button>
      </li>
    );
  }

  return (
    <li className="timeline-row">
      <button className="timeline-row-inner" type="button" onClick={() => openEditor({ kind: entry.kind, recordId: entry.id })}>
        {content}
      </button>
    </li>
  );
}
