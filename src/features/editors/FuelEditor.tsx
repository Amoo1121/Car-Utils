import { AlertTriangle, Fuel, Zap } from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";
import { calculateConsumption } from "../../domain/analytics/consumption";
import {
  addFuelRecordToStore,
  buildFuelRecord,
  createEmptyFuelDraft,
  createFuelDraft,
  updateFuelRecordInStore,
  validateFuelDraft,
  type FuelRecordDraft,
} from "../../domain/fuel/fuelService";
import { estimateOdometer, previousOdometer } from "../../domain/vehicle/odometer";
import { estimateFuelOdometer } from "../../domain/fuel/estimateFuelOdometer";
import { fuelDiscount, paymentAfterDiscount, updateFuelFullTank, updateFuelLevelAfter, updateFuelPricing, type FuelPricingMode } from "../../domain/fuel/fuelDraft";
import { filterActive, fuelGrades, type FuelRecord } from "../../shared/carData";
import { useWorkspace } from "../../app/workspace";
import { ChipGroup, Field, GaugeField, NumberField, TextField, Toggle } from "../../ui/fields";
import { km, money, num, parseNumber, trimNumber } from "../../ui/format";
import { Sheet } from "../../ui/Sheet";
import { FuelStationField } from "../fuel/FuelStationField";
import { EditorFooter, submitOnModEnter } from "./EditorFooter";

type MoneyField = "volume" | "pricePerUnit" | "paidAmount";

export function FuelEditor({ recordId, onClose }: { recordId?: string; onClose: () => void }) {
  const { vehicle, fuelRecords, allFuelRecords, washRecords, expenseRecords, mutate, remove } = useWorkspace();
  const formId = useId();
  const existing = recordId ? fuelRecords.find((record) => record.id === recordId) : undefined;
  const isEv = vehicle?.energyType === "纯电";
  const unit = isEv ? "kWh" : "L";

  const activeFuel = useMemo(() => filterActive(fuelRecords), [fuelRecords]);
  // Grades sorted by how often this vehicle used them; the most used one is the default.
  const gradeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    activeFuel.forEach((record) => record.fuelGrade && counts.set(record.fuelGrade, (counts.get(record.fuelGrade) ?? 0) + 1));
    const known = isEv ? ["快充", "慢充", "家充"] : fuelGrades.filter((grade) => grade !== "其他" && !grade.includes("柴油"));
    const diesel = vehicle?.energyType === "柴油" ? ["0#柴油"] : [];
    const all = [...new Set([...counts.keys(), ...diesel, ...known])].filter((grade) => grade !== "其他");
    return all.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).slice(0, 6);
  }, [activeFuel, isEv, vehicle?.energyType]);

  const [initial] = useState<FuelRecordDraft>(() => {
    if (existing) {
      const draft = createFuelDraft(existing, [...gradeOptions, "其他"]);
      return draft;
    }
    const last = activeFuel[0];
    return {
      ...createEmptyFuelDraft(gradeOptions[0] ?? (isEv ? "快充" : "95#")),
      // Unit price rarely changes between refuels; prefill it as a starting point.
      pricePerUnit: last ? String(last.pricePerUnit) : "",
    };
  });
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [pricingMode, setPricingMode] = useState<FuelPricingMode>("paid");
  const [discountInput, setDiscountInput] = useState("");
  const [showGauge, setShowGauge] = useState(
    () => Boolean(existing?.fuelLevelBefore != null || existing?.fuelLevelAfter != null) ||
      activeFuel.slice(0, 5).some((record) => record.fuelLevelBefore != null || record.fuelLevelAfter != null),
  );
  const errors = validateFuelDraft(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || (pricingMode === "discount" && discountInput.trim() !== "");

  const sources = useMemo(() => [...allFuelRecords, ...washRecords, ...expenseRecords], [allFuelRecords, washRecords, expenseRecords]);
  const estimate = useMemo(() => (vehicle ? estimateFuelOdometer(vehicle, activeFuel, draft.date, parseNumber(draft.fuelLevelBefore), existing?.id) : undefined), [vehicle, activeFuel, draft.date, draft.fuelLevelBefore, existing?.id]);
  const dailyEstimate = useMemo(() => vehicle ? estimateOdometer(
    { ...vehicle, currentOdometer: undefined },
    sources.filter((item) => item.id !== existing?.id && item.date < draft.date),
    draft.date,
  ) : undefined, [vehicle, sources, draft.date, existing?.id]);
  const suggestedKm = estimate?.odometer ?? (dailyEstimate?.dailyDistance ? dailyEstimate.estimatedToday : undefined);
  const lastKm = vehicle ? previousOdometer(vehicle, sources.filter((item) => item.id !== existing?.id), draft.date) : undefined;
  const odometer = parseNumber(draft.odometer);
  const odometerWarning =
    odometer != null && lastKm != null && odometer < lastKm
      ? `比 ${draft.date} 之前的最高里程 ${km(lastKm)} 还低，请确认`
      : odometer != null && lastKm != null && odometer - lastKm > 3000
        ? `距上次记录多了 ${km(odometer - lastKm)}，请确认`
        : undefined;

  function update(changes: Partial<FuelRecordDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function updateMoney(field: MoneyField, value: string) {
    if (field === "paidAmount") setPricingMode("paid");
    setDraft((current) => updateFuelPricing(current, field, value, pricingMode, discountInput));
  }

  const volume = parseNumber(draft.volume) ?? 0;
  const price = parseNumber(draft.pricePerUnit) ?? 0;
  const listTotal = volume * price;
  const paid = parseNumber(draft.paidAmount) ?? listTotal;
  const discount = listTotal - paid;
  const discountError = pricingMode === "discount" && discountInput.trim()
    ? !Number.isFinite(Number(discountInput)) || Number(discountInput) < 0
      ? "优惠金额不能为负数"
      : Number(discountInput) > listTotal ? "优惠不能超过挂牌总价" : undefined
    : undefined;

  // Live consumption preview: what this refuel would add to the history.
  const preview = useMemo(() => {
    if (!vehicle || Object.keys(errors).length > 0 || !odometer) return undefined;
    const candidate: FuelRecord = {
      ...(existing ?? { id: "__preview__", userId: "", createdAt: Date.now() }),
      ...buildFuelRecord(vehicle.id, draft),
      id: existing?.id ?? "__preview__",
      userId: existing?.userId ?? "",
    } as FuelRecord;
    const others = activeFuel.filter((record) => record.id !== candidate.id);
    const summary = calculateConsumption(vehicle, [...others, candidate]);
    return summary.intervals.find((interval) => interval.toRecordId === candidate.id);
  }, [activeFuel, draft, errors, existing, odometer, vehicle]);

  if (!vehicle) return null;

  function save(keepOpen: boolean) {
    setTouched(true);
    if (!vehicle || Object.keys(errors).length > 0 || discountError) return;
    const input = buildFuelRecord(vehicle.id, draft);
    const ok = existing
      ? mutate((store, user) => updateFuelRecordInStore(store, user, existing.id, { ...stripEntity(existing), ...input }), "加油记录已更新")
      : mutate((store, user) => addFuelRecordToStore(store, user, input), `已记录 ${money(paid, true)}`);
    if (!ok) return;
    if (keepOpen) {
      setDraft({ ...createEmptyFuelDraft(draft.fuelGrade), pricePerUnit: draft.pricePerUnit, date: draft.date });
      setPricingMode("paid");
      setDiscountInput("");
      setTouched(false);
    } else {
      onClose();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save(false);
  }

  const show = (key: keyof FuelRecordDraft) => (touched ? errors[key] : undefined);
  const customGrade = draft.fuelGrade === "其他" || !gradeOptions.includes(draft.fuelGrade);

  return (
    <Sheet
      dirty={dirty}
      footer={
        <EditorFooter
          formId={formId}
          isEdit={Boolean(existing)}
          onDelete={existing ? () => { remove("fuel", existing.id, `${existing.date} 加油`); onClose(); } : undefined}
          onSaveAndNew={existing ? undefined : () => save(true)}
        />
      }
      icon={isEv ? <Zap size={20} /> : <Fuel size={20} />}
      open
      subtitle={vehicle.nickname}
      title={existing ? (isEv ? "编辑充电记录" : "编辑加油记录") : isEv ? "记录充电" : "记录加油"}
      tone="fuel"
      onClose={onClose}
    >
      <form className="editor-form" id={formId} noValidate onKeyDown={submitOnModEnter} onSubmit={submit}>
        <section className="editor-hero">
          <NumberField
            data-autofocus
            error={show("paidAmount")}
            fieldClassName="field-hero"
            label="实付金额"
            placeholder={listTotal > 0 ? trimNumber(listTotal, 2) : "0"}
            prefix="¥"
            value={draft.paidAmount}
            onChange={(value) => updateMoney("paidAmount", value)}
          />
          <div className="editor-row">
            <NumberField error={show("volume")} label={isEv ? "充电量" : "加油量"} suffix={unit} value={draft.volume} onChange={(value) => updateMoney("volume", value)} />
            <NumberField error={show("pricePerUnit")} label="挂牌单价" suffix={`元/${unit}`} value={draft.pricePerUnit} onChange={(value) => updateMoney("pricePerUnit", value)} />
          </div>
          <NumberField
            error={touched ? discountError : undefined}
            label="优惠金额"
            placeholder="0"
            prefix="¥"
            value={pricingMode === "discount" ? discountInput : fuelDiscount(draft)}
            onChange={(value) => {
              setPricingMode("discount");
              setDiscountInput(value);
              update({ paidAmount: paymentAfterDiscount(draft, value) });
            }}
          />
          {listTotal > 0 && (
            <p className="editor-calc" aria-live="polite">
              {volume > 0 && `实付单价 ${money(paid / volume, true)}/${unit}`}
              {discount > 0.009 && <span className="positive"> · 优惠 {money(discount, true)}</span>}
              {discount < -0.009 && <span className="warn"> · 比挂牌价多付 {money(-discount, true)}</span>}
            </p>
          )}
        </section>

        <TextField error={show("date")} label="日期" type="date" value={draft.date} onChange={(value) => update({ date: value })} />

        <Field label={isEv ? "充电方式" : "油品"}>
          <ChipGroup
            label={isEv ? "充电方式" : "油品"}
            options={[...gradeOptions.map((grade) => ({ value: grade, label: grade })), { value: "其他", label: "其他" }]}
            value={customGrade ? "其他" : draft.fuelGrade}
            onChange={(value) => update({ fuelGrade: value, customFuelGrade: value === "其他" ? draft.customFuelGrade : "" })}
          />
        </Field>
        {customGrade && (
          <TextField
            label="自定义名称"
            placeholder={isEv ? "例如 超充桩" : "例如 101#"}
            value={draft.fuelGrade === "其他" ? draft.customFuelGrade : draft.fuelGrade}
            onChange={(value) => update({ fuelGrade: "其他", customFuelGrade: value })}
          />
        )}

        <FuelStationField
          fuelRecords={allFuelRecords}
          label={isEv ? "充电站" : "加油站"}
          value={draft.station}
          vehicleId={vehicle.id}
          onChange={(value) => update({ station: value })}
        />

        <Toggle
          checked={draft.fullTank}
          description={isEv ? "充到 100%，用于计算真实电耗" : "跳枪加满。连续两次加满即可计算真实油耗"}
          label={isEv ? "充满" : "加满"}
          onChange={(checked) => setDraft((current) => updateFuelFullTank(current, checked))}
        />

        {showGauge ? (
          <div className="editor-row">
            <GaugeField error={show("fuelLevelBefore")} label={isEv ? "充电前电量" : "加油前油表"} value={draft.fuelLevelBefore} onChange={(value) => update({ fuelLevelBefore: value })} />
            <GaugeField error={show("fuelLevelAfter")} label={isEv ? "充电后电量" : "加油后油表"} value={draft.fuelLevelAfter} onChange={(value) => setDraft((current) => updateFuelLevelAfter(current, value))} />
          </div>
        ) : (
          <button className="link-button" type="button" onClick={() => setShowGauge(true)}>
            + 记录{isEv ? "电量" : "油表"}刻度（没有加满时也能算油耗）
          </button>
        )}

        <NumberField
          hint={lastKm != null ? `上次 ${km(lastKm)} · 选填，以仪表盘读数为准` : "选填，记录加注前仪表盘显示的总里程"}
          label="当前里程"
          placeholder={suggestedKm != null ? String(Math.round(suggestedKm)) : "选填"}
          suffix="km"
          value={draft.odometer}
          onChange={(value) => update({ odometer: value })}
        />
        {suggestedKm != null && (
          <p className="editor-calc" aria-live="polite">
            {estimate
              ? `按加注前${isEv ? "电量" : "油位"}和近期${isEv ? "能耗" : "油耗"} ${num(estimate.per100km, 1)} ${unit}/100km，估计约 ${km(suggestedKm)}`
              : `按历史日均里程估计约 ${km(suggestedKm)}`}
            <span> · 仅供核对，不自动写入记录</span>
          </p>
        )}
        {odometerWarning && (
          <p className="inline-warning">
            <AlertTriangle size={14} />
            {odometerWarning}
          </p>
        )}

        {preview && (
          <div className="editor-insight">
            <strong>
              本次区间 {num(preview.per100km, 1)} {unit}/100km
            </strong>
            <span>
              {km(preview.distance)} · 约 {money(preview.costPerKm, true)}/km
            </span>
          </div>
        )}

        <TextField label="备注" placeholder="可选" value={draft.note ?? ""} onChange={(value) => update({ note: value })} />
      </form>
    </Sheet>
  );
}

/** Keeps fields the form does not edit (payment method, receipts…) when updating. */
function stripEntity(record: FuelRecord) {
  const { id: _id, userId: _userId, ...rest } = record;
  return rest;
}
