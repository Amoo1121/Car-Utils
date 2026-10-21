import { Download, ListOrdered, Search, Trash2, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { buildTimeline, groupTimelineByMonth, timelineToCsv, type TimelineKind } from "../../domain/timeline/timeline";
import { energyUnit } from "../../domain/analytics/consumption";
import { today } from "../../shared/carData";
import { useWorkspace } from "../../app/workspace";
import { EmptyState } from "../../ui/EmptyState";
import { downloadFile, money, monthLabel } from "../../ui/format";
import { TimelineRow } from "./TimelineRow";

const kindOptions: { value: TimelineKind; label: string }[] = [
  { value: "fuel", label: "加油" },
  { value: "wash", label: "洗车" },
  { value: "expense", label: "费用" },
];

export function TimelinePage({ params }: { params: URLSearchParams }) {
  const { vehicle, fuelRecords, washRecords, expenseRecords, navigate, openEditor } = useWorkspace();
  const trash = params.get("view") === "trash";
  const kinds = (params.get("kind")?.split(",").filter(Boolean) ?? []) as TimelineKind[];
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const unit = vehicle ? energyUnit(vehicle) : "L";

  const entries = useMemo(
    () => buildTimeline({ fuelRecords, washRecords, expenseRecords }, { kinds, query: deferredQuery, deleted: trash }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fuelRecords, washRecords, expenseRecords, params.get("kind"), deferredQuery, trash],
  );
  const groups = useMemo(() => groupTimelineByMonth(entries), [entries]);
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const deletedCount = useMemo(
    () => buildTimeline({ fuelRecords, washRecords, expenseRecords }, { deleted: true }).length,
    [expenseRecords, fuelRecords, washRecords],
  );

  if (!vehicle) {
    return <EmptyState icon={<ListOrdered size={36} />} title="还没有车辆">先在车库里添加一台车。</EmptyState>;
  }

  function toggleKind(kind: TimelineKind) {
    const next = kinds.includes(kind) ? kinds.filter((item) => item !== kind) : [...kinds, kind];
    navigate("timeline", undefined, { kind: next.join(","), view: trash ? "trash" : undefined });
  }

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <h1>{trash ? "回收站" : "记录"}</h1>
          <p>
            {trash
              ? "删除的记录会保留在这里，可以随时恢复"
              : `${vehicle.nickname} · ${entries.length} 条 · 合计 ${money(total)}`}
          </p>
        </div>
        <div className="page-head-actions">
          {!trash && entries.length > 0 && (
            <button
              className="button button-ghost button-sm"
              type="button"
              onClick={() => downloadFile(`car-utils-${vehicle.nickname}-${today()}.csv`, "﻿" + timelineToCsv(entries), "text/csv;charset=utf-8")}
            >
              <Download size={15} />
              导出 CSV
            </button>
          )}
          <button
            aria-pressed={trash}
            className={trash ? "button button-soft button-sm" : "button button-ghost button-sm"}
            type="button"
            onClick={() => navigate("timeline", undefined, { view: trash ? undefined : "trash" })}
          >
            {trash ? <X size={15} /> : <Trash2 size={15} />}
            {trash ? "退出回收站" : `回收站${deletedCount ? ` ${deletedCount}` : ""}`}
          </button>
        </div>
      </header>

      <div className="filter-bar">
        <label className="search-field">
          <Search size={16} />
          <input aria-label="搜索记录" placeholder="搜索加油站、耗材、备注、金额…" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="chip-group" role="group" aria-label="记录类型">
          {kindOptions.map((option) => (
            <button aria-pressed={kinds.includes(option.value)} className={kinds.includes(option.value) ? "chip active" : "chip"} key={option.value} type="button" onClick={() => toggleKind(option.value)}>
              {option.value === "fuel" && unit === "kWh" ? "充电" : option.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card card-empty">
          <p>{trash ? "回收站是空的。" : query || kinds.length ? "没有符合条件的记录。" : "还没有记录。"}</p>
          {!trash && !query && kinds.length === 0 && (
            <button className="button button-primary button-sm" type="button" onClick={() => openEditor({ kind: "quick" })}>
              记一笔
            </button>
          )}
        </div>
      ) : (
        groups.map((group) => (
          <section className="month-group" key={group.month}>
            <header className="month-head">
              <h2>{monthLabel(group.month)}</h2>
              <span>
                {group.entries.length} 条 · {money(group.total)}
              </span>
            </header>
            <ul className="timeline-list card">
              {group.entries.map((entry) => (
                <TimelineRow entry={entry} key={`${entry.kind}-${entry.id}`} unit={unit} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
