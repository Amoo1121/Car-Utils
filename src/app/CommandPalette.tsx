import { Car, Droplets, Fuel, Receipt, Search, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { buildTimeline } from "../domain/timeline/timeline";
import { fuzzyMatch } from "../shared/carData";
import { dateLabel, moneySmart } from "../ui/format";
import { pageMeta } from "./Shell";
import type { Page } from "./router";
import { useWorkspace, type EditorRequest } from "./workspace";

type Command = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspace = useWorkspace();
  const { openEditor, navigate, vehicles, selectVehicle, vehicle } = workspace;
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const edit = (request: EditorRequest) => () => openEditor(request);
    const list: Command[] = [];
    if (vehicle) {
      list.push(
        { id: "add-fuel", group: "快速记录", label: "记录加油 / 充电", hint: "F", icon: <Fuel size={16} />, keywords: "jiayou fuel 加油 充电", run: edit({ kind: "fuel" }) },
        { id: "add-wash", group: "快速记录", label: "记录洗车", hint: "W", icon: <Droplets size={16} />, keywords: "xiche wash 洗车", run: edit({ kind: "wash" }) },
        { id: "add-maint", group: "快速记录", label: "记录保养", icon: <Wrench size={16} />, keywords: "baoyang 保养 机油", run: edit({ kind: "expense", category: "maintenance" }) },
        { id: "add-expense", group: "快速记录", label: "记录其他费用", hint: "E", icon: <Receipt size={16} />, keywords: "feiyong 费用 保险 年检 停车 维修", run: edit({ kind: "expense" }) },
      );
    }
    list.push({ id: "add-vehicle", group: "快速记录", label: "添加车辆", icon: <Car size={16} />, keywords: "cheliang vehicle", run: edit({ kind: "vehicle" }) });

    (Object.keys(pageMeta) as Page[]).forEach((page) => {
      list.push({ id: `go-${page}`, group: "跳转", label: `前往${pageMeta[page].label}`, icon: pageMeta[page].icon, keywords: page, run: () => navigate(page) });
    });
    list.push({ id: "go-supplies", group: "跳转", label: "洗车耗材仓库", icon: <Droplets size={16} />, keywords: "haocai warehouse 耗材 仓库", run: () => navigate("garage", "supplies") });
    list.push({ id: "go-trash", group: "跳转", label: "回收站", icon: <Search size={16} />, keywords: "huishouzhan trash deleted 删除 恢复", run: () => navigate("timeline", undefined, { view: "trash" }) });

    vehicles
      .filter((item) => item.id !== vehicle?.id)
      .forEach((item) =>
        list.push({ id: `switch-${item.id}`, group: "切换车辆", label: item.nickname, hint: item.plate, icon: <Car size={16} />, keywords: `${item.brand} ${item.model}`, run: () => selectVehicle(item.id) }),
      );
    return list;
  }, [navigate, openEditor, selectVehicle, vehicle, vehicles]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    const matched = trimmed ? commands.filter((command) => fuzzyMatch(`${command.label} ${command.keywords ?? ""}`, trimmed)) : commands;
    const records: Command[] =
      trimmed.length >= 1
        ? buildTimeline(
            { fuelRecords: workspace.fuelRecords, washRecords: workspace.washRecords, expenseRecords: workspace.expenseRecords },
            { query: trimmed },
          )
            .slice(0, 8)
            .map((entry) => ({
              id: `record-${entry.id}`,
              group: "记录",
              label: entry.title,
              hint: `${dateLabel(entry.date)} · ${moneySmart(entry.amount)}`,
              icon: entry.kind === "fuel" ? <Fuel size={16} /> : entry.kind === "wash" ? <Droplets size={16} /> : <Receipt size={16} />,
              run: () => openEditor({ kind: entry.kind, recordId: entry.id }),
            }))
        : [];
    return [...matched, ...records];
  }, [commands, openEditor, query, workspace.expenseRecords, workspace.fuelRecords, workspace.washRecords]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  function run(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  let lastGroup = "";
  return createPortal(
    <div className="palette-layer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div aria-label="命令面板" aria-modal="true" className="palette" role="dialog">
        <div className="palette-search">
          <Search size={18} />
          <input
            aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
            aria-controls="palette-list"
            aria-expanded="true"
            aria-label="搜索"
            placeholder="搜索记录、加油站、耗材，或输入操作…"
            ref={inputRef}
            role="combobox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((value) => Math.min(value + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(results[active]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" id="palette-list" role="listbox">
          {results.length === 0 && <p className="palette-empty">没有匹配的结果</p>}
          {results.map((command, index) => {
            const header = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <div key={command.id}>
                {header && <p className="palette-group">{header}</p>}
                <button
                  aria-selected={index === active}
                  className={index === active ? "palette-item active" : "palette-item"}
                  id={`palette-${command.id}`}
                  role="option"
                  type="button"
                  onClick={() => run(command)}
                  onMouseMove={() => setActive(index)}
                >
                  <span className="palette-icon">{command.icon}</span>
                  <span className="palette-label">{command.label}</span>
                  {command.hint && <small>{command.hint}</small>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
