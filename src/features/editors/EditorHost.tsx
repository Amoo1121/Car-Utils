import { Droplets, Fuel, Plus, Receipt, ShieldCheck, Wrench, Zap, ParkingSquare } from "lucide-react";
import type { ReactNode } from "react";
import { useWorkspace, type EditorRequest } from "../../app/workspace";
import { Sheet } from "../../ui/Sheet";
import { ExpenseEditor } from "./ExpenseEditor";
import { FuelEditor } from "./FuelEditor";
import { ProductEditor } from "./ProductEditor";
import { VehicleEditor } from "./VehicleEditor";
import { WashEditor } from "./WashEditor";

/** Renders whichever editor is requested through the workspace. */
export function EditorHost() {
  const { editor, closeEditor } = useWorkspace();
  if (!editor) return null;
  // `key` remounts the editor when switching between requests so drafts never leak across records.
  const key = JSON.stringify(editor);
  switch (editor.kind) {
    case "quick":
      return <QuickAdd key={key} />;
    case "fuel":
      return <FuelEditor key={key} recordId={editor.recordId} onClose={closeEditor} />;
    case "wash":
      return <WashEditor key={key} recordId={editor.recordId} washType={editor.washType} onClose={closeEditor} />;
    case "expense":
      return <ExpenseEditor category={editor.category} key={key} recordId={editor.recordId} renewFromId={editor.renewFromId} onClose={closeEditor} />;
    case "vehicle":
      return <VehicleEditor key={key} vehicleId={editor.vehicleId} onClose={closeEditor} />;
    case "product":
      return <ProductEditor key={key} mode={editor.mode} productId={editor.productId} onClose={closeEditor} />;
  }
}

function QuickAdd() {
  const { vehicle, openEditor, closeEditor } = useWorkspace();
  const isEv = vehicle?.energyType === "纯电";
  const actions: { label: string; hint: string; icon: ReactNode; tone: string; request: EditorRequest; key?: string }[] = [
    { label: isEv ? "充电" : "加油", hint: isEv ? "电量、电价、充电站" : "金额、油量、加油站", icon: isEv ? <Zap size={22} /> : <Fuel size={22} />, tone: "fuel", request: { kind: "fuel" }, key: "F" },
    { label: "洗车", hint: "DIY 或店内，耗材自动记成本", icon: <Droplets size={22} />, tone: "wash", request: { kind: "wash" }, key: "W" },
    { label: "保养", hint: "机油、滤芯，设置下次提醒", icon: <Wrench size={22} />, tone: "expense", request: { kind: "expense", category: "maintenance" } },
    { label: "保险 / 年检", hint: "到期前自动提醒", icon: <ShieldCheck size={22} />, tone: "expense", request: { kind: "expense", category: "insurance" } },
    { label: "停车 / 通行", hint: "停车费、高速费", icon: <ParkingSquare size={22} />, tone: "expense", request: { kind: "expense", category: "parking" } },
    { label: "其他费用", hint: "维修、配件、罚款…", icon: <Receipt size={22} />, tone: "expense", request: { kind: "expense", category: "other" }, key: "E" },
  ];

  return (
    <Sheet icon={<Plus size={20} />} open subtitle={vehicle?.nickname} title="记一笔" onClose={closeEditor}>
      <div className="quick-grid">
        {actions.map((action, index) => (
          <button
            className={`quick-action tone-${action.tone}`}
            data-autofocus={index === 0 ? true : undefined}
            key={action.label}
            type="button"
            onClick={() => openEditor(action.request)}
          >
            <span className="quick-action-icon">{action.icon}</span>
            <span className="quick-action-copy">
              <strong>{action.label}</strong>
              <small>{action.hint}</small>
            </span>
            {action.key && <kbd>{action.key}</kbd>}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
