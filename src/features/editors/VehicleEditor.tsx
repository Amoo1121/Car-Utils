import { Archive, ArchiveRestore, Car } from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";
import { calculateConsumption, type ConsumptionSummary } from "../../domain/analytics/consumption";
import {
  addVehicleToStore,
  archiveVehicleInStore,
  unarchiveVehicleInStore,
  updateVehicleInStore,
  type VehicleInput,
} from "../../domain/vehicle/vehicleService";
import { filterActive, vehiclePresets, type EnergyType, type Vehicle } from "../../shared/carData";
import { useWorkspace } from "../../app/workspace";
import { ChipGroup, Field, NumberField, TextField } from "../../ui/fields";
import { num } from "../../ui/format";
import { Sheet } from "../../ui/Sheet";
import { EditorFooter, submitOnModEnter } from "./EditorFooter";

type Draft = {
  nickname: string;
  brand: string;
  model: string;
  year: string;
  plate: string;
  energyType: EnergyType;
  tankSize: string;
  batterySize: string;
  vin: string;
  currentOdometer: string;
  note: string;
};

const energyTypes: EnergyType[] = ["汽油", "柴油", "混动", "增程", "纯电"];

function toDraft(vehicle?: Vehicle): Draft {
  return {
    nickname: vehicle?.nickname ?? "",
    brand: vehicle?.brand ?? "",
    model: vehicle?.model ?? "",
    year: vehicle?.year ?? "",
    plate: vehicle?.plate ?? "",
    energyType: vehicle?.energyType ?? "汽油",
    tankSize: vehicle?.tankSize != null ? String(vehicle.tankSize) : "",
    batterySize: vehicle?.batterySize != null ? String(vehicle.batterySize) : "",
    vin: vehicle?.vin ?? "",
    currentOdometer: vehicle?.currentOdometer != null ? String(vehicle.currentOdometer) : "",
    note: vehicle?.note ?? "",
  };
}

function fromDraft(draft: Draft, existing?: Vehicle): VehicleInput {
  const optional = (value: string) => (value.trim() ? Number(value) : undefined);
  const { id: _id, userId: _userId, ...rest } = existing ?? ({} as Vehicle);
  return {
    ...rest,
    type: "vehicle",
    nickname: draft.nickname.trim() || draft.model.trim() || "我的车",
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    year: draft.year.trim(),
    plate: draft.plate.trim().toUpperCase(),
    energyType: draft.energyType,
    tankSize: draft.energyType === "纯电" ? undefined : optional(draft.tankSize),
    batterySize: ["纯电", "混动", "增程"].includes(draft.energyType) ? optional(draft.batterySize) : undefined,
    vin: draft.vin.trim().toUpperCase() || undefined,
    currentOdometer: optional(draft.currentOdometer),
    note: draft.note.trim() || undefined,
  };
}

export function VehicleEditor({ vehicleId, onClose }: { vehicleId?: string; onClose: () => void }) {
  const { allVehicles, allFuelRecords, mutate, remove, selectVehicle } = useWorkspace();
  const formId = useId();
  const existing = vehicleId ? allVehicles.find((vehicle) => vehicle.id === vehicleId) : undefined;
  const [initial] = useState(() => toDraft(existing));
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const needsName = !draft.nickname.trim() && !draft.model.trim();
  const usesFuel = draft.energyType !== "纯电";
  const usesBattery = ["纯电", "混动", "增程"].includes(draft.energyType);

  // Live preview: consumption depends on tank / battery size, so show how this edit changes it.
  const vehicleFuel = useMemo(
    () => (existing ? filterActive(allFuelRecords).filter((record) => record.vehicleId === existing.id) : []),
    [allFuelRecords, existing],
  );
  const before = useMemo(() => (existing ? calculateConsumption(existing, vehicleFuel) : null), [existing, vehicleFuel]);
  const after = useMemo(() => {
    if (!existing) return null;
    return calculateConsumption({ ...existing, ...fromDraft(draft, existing), id: existing.id, userId: existing.userId }, vehicleFuel);
  }, [draft, existing, vehicleFuel]);
  const capacityChanged =
    Boolean(existing) && (draft.tankSize !== initial.tankSize || draft.batterySize !== initial.batterySize || draft.energyType !== initial.energyType);

  function update(changes: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (needsName) return;
    const input = fromDraft(draft, existing);
    if (existing) {
      const message = capacityChanged && before && after ? `车辆已更新 · ${describeChange(before, after)}` : "车辆信息已更新";
      if (mutate((store, user) => updateVehicleInStore(store, user, existing.id, input), message)) onClose();
      return;
    }
    let createdId = "";
    const ok = mutate((store, user) => {
      const result = addVehicleToStore(store, user, input);
      if (!result) return null;
      createdId = result.vehicle.id;
      return result.store;
    }, `已添加 ${input.nickname}`);
    if (ok) {
      selectVehicle(createdId);
      onClose();
    }
  }

  return (
    <Sheet
      dirty={dirty}
      footer={
        <EditorFooter
          formId={formId}
          isEdit={Boolean(existing)}
          saveLabel={existing ? "保存" : "添加车辆"}
          onDelete={existing ? () => { remove("vehicle", existing.id, existing.nickname); onClose(); } : undefined}
        />
      }
      icon={<Car size={20} />}
      open
      subtitle={existing ? `${existing.brand} ${existing.model}`.trim() : "所有记录都会按车辆独立统计"}
      title={existing ? `编辑 ${existing.nickname}` : "添加车辆"}
      onClose={onClose}
    >
      <form className="editor-form" id={formId} noValidate onKeyDown={submitOnModEnter} onSubmit={submit}>
        {!existing && (
          <Field hint="选一个可以自动带入能源类型和容量" label="快速选择">
            <div className="chip-group">
              {vehiclePresets.map((preset) => (
                <button
                  className={draft.brand === preset.brand && draft.model === preset.model ? "chip active" : "chip"}
                  key={`${preset.brand}-${preset.model}`}
                  type="button"
                  onClick={() =>
                    update({
                      brand: preset.brand,
                      model: preset.model,
                      energyType: preset.energyType,
                      tankSize: preset.tankSize != null ? String(preset.tankSize) : "",
                      batterySize: preset.batterySize != null ? String(preset.batterySize) : "",
                    })
                  }
                >
                  {preset.brand} {preset.model}
                </button>
              ))}
            </div>
          </Field>
        )}

        <TextField
          data-autofocus
          error={touched && needsName ? "给车起个名字，或至少填写型号" : undefined}
          label="昵称"
          placeholder={draft.model || "例如 小白、通勤车"}
          value={draft.nickname}
          onChange={(value) => update({ nickname: value })}
        />
        <div className="editor-row">
          <TextField label="品牌" placeholder="例如 Toyota" value={draft.brand} onChange={(value) => update({ brand: value })} />
          <TextField label="型号" placeholder="例如 Camry" value={draft.model} onChange={(value) => update({ model: value })} />
        </div>
        <div className="editor-row">
          <TextField label="车牌" placeholder="例如 粤B·12345" value={draft.plate} onChange={(value) => update({ plate: value })} />
          <TextField inputMode="numeric" label="年款" maxLength={4} placeholder="2024" value={draft.year} onChange={(value) => update({ year: value })} />
        </div>

        <Field label="能源类型">
          <ChipGroup label="能源类型" options={energyTypes.map((item) => ({ value: item, label: item }))} value={draft.energyType} onChange={(value) => update({ energyType: value })} />
        </Field>

        <div className="editor-row">
          {usesFuel && <NumberField hint="用于根据油表刻度计算油耗" label="油箱容量" suffix="L" value={draft.tankSize} onChange={(value) => update({ tankSize: value })} />}
          {usesBattery && <NumberField hint={draft.energyType === "纯电" ? "用于根据电量计算电耗" : undefined} label="电池容量" suffix="kWh" value={draft.batterySize} onChange={(value) => update({ batterySize: value })} />}
        </div>

        {existing && vehicleFuel.length > 0 && after && (
          <div className="editor-insight" aria-live="polite">
            <strong>
              {after.intervals.length > 0
                ? `实际${after.unit === "kWh" ? "电" : "油"}耗 ${num(after.average, 1)} ${after.unit}/100km`
                : "暂时无法计算实际油耗"}
              {capacityChanged && before && before.intervals.length > 0 && after.intervals.length > 0 && Math.abs(before.average - after.average) >= 0.05
                ? `（原 ${num(before.average, 1)}）`
                : ""}
            </strong>
            <span>{after.intervals.length > 0 ? `基于 ${after.intervals.length} 个区间 · 保存后首页与洞察会立即按新容量重算` : after.hint}</span>
          </div>
        )}

        <details className="editor-more" open={Boolean(existing?.vin || existing?.currentOdometer || existing?.note)}>
          <summary>更多信息（里程、VIN、备注）</summary>
          <NumberField hint="没有加油记录时，用于估算保养里程" label="当前里程" suffix="km" value={draft.currentOdometer} onChange={(value) => update({ currentOdometer: value })} />
          <TextField label="车架号 VIN" maxLength={17} value={draft.vin} onChange={(value) => update({ vin: value })} />
          <TextField label="备注" value={draft.note} onChange={(value) => update({ note: value })} />
        </details>

        {existing && (
          <button
            className="button button-ghost"
            type="button"
            onClick={() => {
              const archived = existing.isArchived;
              mutate(
                (store, user) => (archived ? unarchiveVehicleInStore(store, user, existing.id) : archiveVehicleInStore(store, user, existing.id)),
                archived ? "已取消归档" : "已归档，历史记录仍会保留",
              );
              onClose();
            }}
          >
            {existing.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            {existing.isArchived ? "取消归档" : "归档（已卖出或不再使用）"}
          </button>
        )}
      </form>
    </Sheet>
  );
}

function describeChange(before: ConsumptionSummary, after: ConsumptionSummary) {
  const label = after.unit === "kWh" ? "电耗" : "油耗";
  if (after.intervals.length === 0) return `${label}暂时无法计算`;
  if (before.intervals.length === 0) return `已可计算${label}：${num(after.average, 1)} ${after.unit}/100km`;
  if (Math.abs(before.average - after.average) < 0.05) return `${label}不变（${num(after.average, 1)}）`;
  return `${label}已重算 ${num(before.average, 1)} → ${num(after.average, 1)} ${after.unit}/100km`;
}
