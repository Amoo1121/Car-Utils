import { Droplets, PackagePlus, Plus, X } from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";
import { calculateWashProductInventory } from "../../domain/analytics/washAnalytics";
import { getWashProductPreset } from "../../domain/wash/washProductCatalog";
import { productCategoryOptions, shopServiceOptions, washStepOptions, washTypeOptions } from "../../domain/wash/washOptions";
import { addWashProductToStore, buildWashProductFromUsageDraft } from "../../domain/wash/washProductService";
import {
  addWashRecordToStore,
  buildWashRecord,
  changeWashDraftType,
  createEmptyWashDraft,
  createEmptyWashProductUsageDraft,
  createWashDraft,
  getDefaultWashStepForProductCategory,
  getSuggestedWashUsageUnit,
  resolveWashCost,
  resolveWashProductUsageCost,
  updateWashRecordInStore,
  type WashProductUsageDraft,
  type WashRecordDraft,
} from "../../domain/wash/washService";
import { addDays, filterActive, type WashProduct, type WashProductUsage, type WashRecord, type WashType } from "../../shared/carData";
import { useWorkspace } from "../../app/workspace";
import { ChipGroup, Field, NumberField, SelectField, StarRating, TextField } from "../../ui/fields";
import { money, moneySmart, num } from "../../ui/format";
import { Sheet } from "../../ui/Sheet";
import { WashProductPresetImage } from "../wash/WashProductPresetPicker";
import { EditorFooter, submitOnModEnter } from "./EditorFooter";

export function WashEditor({ recordId, washType, onClose }: { recordId?: string; washType?: WashType; onClose: () => void }) {
  const { vehicle, washRecords, store, washProducts, mutate, remove, user } = useWorkspace();
  const formId = useId();
  const existing = recordId ? washRecords.find((record) => record.id === recordId) : undefined;
  const activeWash = filterActive(washRecords);
  const [initial] = useState<WashRecordDraft>(() => {
    if (existing) return createWashDraft(existing);
    // Default to how this car is usually washed.
    const preferred = washType ?? activeWash[0]?.washType ?? "diy";
    return createEmptyWashDraft(preferred);
  });
  const [draft, setDraft] = useState(initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const isDiy = draft.washType === "diy";
  const total = resolveWashCost(draft);
  const products = useMemo(() => filterActive(washProducts), [washProducts]);
  const userWashRecords = useMemo(() => store.washRecords.filter((record) => record.userId === user.id), [store.washRecords, user.id]);

  // Products used most in recent washes come first in the picker.
  const usage = useMemo(() => {
    const counts = new Map<string, number>();
    userWashRecords.forEach((record) => record.products?.forEach((item) => item.productId && counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1)));
    return counts;
  }, [userWashRecords]);
  const pickerProducts = [...products].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name, "zh-CN"));

  if (!vehicle) return null;

  function update(changes: Partial<WashRecordDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function updateProduct(rowId: string, changes: Partial<WashProductUsageDraft>) {
    setDraft((current) => ({
      ...current,
      materialCost: "",
      products: current.products.map((item) => (item.id === rowId ? { ...item, ...changes } : item)),
    }));
  }

  function addWarehouseProduct(product: WashProduct) {
    const purchase = product.purchases.at(-1);
    const capacityUnit = purchase?.capacityUnit ?? "ml";
    // Reuse the amount used last time as a starting point.
    const lastUsage = [...userWashRecords]
      .sort((a, b) => b.date.localeCompare(a.date))
      .flatMap((record) => record.products ?? [])
      .find((item) => item.productId === product.id);
    const row: WashProductUsageDraft = {
      ...createEmptyWashProductUsageDraft(),
      productId: product.id,
      name: product.name,
      category: product.category,
      step: lastUsage?.step ?? getDefaultWashStepForProductCategory(product.category),
      purchasePrice: purchase?.purchasePrice != null ? String(purchase.purchasePrice) : "",
      capacity: purchase?.capacity != null ? String(purchase.capacity) : "",
      capacityUnit,
      usedAmount: lastUsage?.usedAmount != null ? String(lastUsage.usedAmount) : "",
      usedUnit: lastUsage?.usedUnit ?? getSuggestedWashUsageUnit(capacityUnit),
      dilutionRatio: lastUsage?.dilutionRatio ?? getWashProductPreset(product.presetId)?.defaultDilutionRatio ?? "",
    };
    setDraft((current) => ({ ...current, materialCost: "", products: [...current.products, row] }));
  }

  function addManualProduct() {
    setDraft((current) => ({ ...current, materialCost: "", products: [...current.products, createEmptyWashProductUsageDraft()] }));
    setPickerOpen(false);
  }

  function toggleItem(item: string) {
    const items = draft.items.split(",").map((value) => value.trim()).filter(Boolean);
    const next = items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
    update({ items: next.join(", ") });
  }

  function save(keepOpen: boolean) {
    if (!vehicle) return;
    // Ad-hoc products marked "加入仓库" are created first so the usage links to them.
    const ok = mutate((current, currentUser) => {
      let next = current;
      const nextDraft = { ...draft, products: draft.products.map((item) => ({ ...item })) };
      for (const row of nextDraft.products) {
        if (row.productId || !row.name.trim() || !(row as SaveableRow).saveToWarehouse) continue;
        const input = buildWashProductFromUsageDraft(row, draft.date);
        const result = input ? addWashProductToStore(next, currentUser, input) : null;
        if (result) {
          next = result.store;
          row.productId = result.product.id;
        }
      }
      const input = buildWashRecord(vehicle.id, nextDraft);
      return existing
        ? updateWashRecordInStore(next, currentUser, existing.id, { ...stripEntity(existing), ...input })
        : addWashRecordToStore(next, currentUser, input);
    }, existing ? "洗车记录已更新" : total > 0 ? `已记录洗车 ${moneySmart(total)}` : "已记录洗车");
    if (!ok) return;
    if (keepOpen) setDraft(createEmptyWashDraft(draft.washType));
    else onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save(false);
  }

  const selectedItems = draft.items.split(",").map((value) => value.trim()).filter(Boolean);

  return (
    <Sheet
      dirty={dirty}
      footer={
        <EditorFooter
          formId={formId}
          isEdit={Boolean(existing)}
          saveLabel={existing ? undefined : total > 0 ? `保存 · ${moneySmart(total)}` : "保存"}
          onDelete={existing ? () => { remove("wash", existing.id, `${existing.date} 洗车`); onClose(); } : undefined}
        />
      }
      icon={<Droplets size={20} />}
      open
      size="lg"
      subtitle={vehicle.nickname}
      title={existing ? "编辑洗车记录" : "记录洗车"}
      tone="wash"
      onClose={onClose}
    >
      <form className="editor-form" id={formId} noValidate onKeyDown={submitOnModEnter} onSubmit={submit}>
        <Field label="洗车方式">
          <ChipGroup
            label="洗车方式"
            options={washTypeOptions.map((option) => ({ value: option.id, label: option.label }))}
            value={draft.washType}
            onChange={(value) => setDraft((current) => changeWashDraftType(current, value))}
          />
        </Field>

        <div className="editor-row">
          <TextField label="日期" type="date" value={draft.date} onChange={(value) => update({ date: value })} />
          {isDiy ? (
            <NumberField
              hint="自助洗车机、场地或水电费"
              label="场地 / 水电"
              prefix="¥"
              value={draft.waterElectricityCost}
              onChange={(value) => update({ waterElectricityCost: value })}
            />
          ) : (
            <NumberField data-autofocus label="实付金额" prefix="¥" value={draft.cost} onChange={(value) => update({ cost: value })} />
          )}
        </div>

        {!isDiy && (
          <>
            <TextField label="店铺" placeholder="例如 某某汽车美容" value={draft.shopName} onChange={(value) => update({ shopName: value })} />
            <Field label="服务项目">
              <ChipGroup
                label="服务项目"
                multiple
                options={[...new Set([...shopServiceOptions, ...selectedItems])].map((item) => ({ value: item, label: item }))}
                value={selectedItems}
                onChange={toggleItem}
              />
            </Field>
          </>
        )}

        {isDiy && (
          <section className="editor-section">
            <header className="editor-section-head">
              <div>
                <strong>本次用到的耗材</strong>
                <small>选填。记录用量后会自动估算成本、扣减库存</small>
              </div>
              <button className="button button-soft button-sm" type="button" onClick={() => setPickerOpen((value) => !value)}>
                <Plus size={15} />
                {pickerOpen ? "收起" : "添加耗材"}
              </button>
            </header>

            {pickerOpen && (
              <div className="product-picker">
                {pickerProducts.map((product) => {
                  const added = draft.products.some((row) => row.productId === product.id);
                  const stock = calculateWashProductInventory(product, userWashRecords);
                  const image = getWashProductPreset(product.presetId)?.imageUrl ?? product.imageUrl;
                  return (
                    <button
                      aria-pressed={added}
                      className={added ? "product-tile added" : "product-tile"}
                      disabled={added}
                      key={product.id}
                      type="button"
                      onClick={() => addWarehouseProduct(product)}
                    >
                      {image ? <WashProductPresetImage alt="" src={image} /> : <span className="product-tile-placeholder"><Droplets size={18} /></span>}
                      <span className="product-tile-copy">
                        <strong>{product.name}</strong>
                        <small>
                          {product.category}
                          {stock.hasCapacity ? ` · 余 ${num(stock.remaining, 1)}${stock.unit}` : ""}
                        </small>
                      </span>
                    </button>
                  );
                })}
                <button className="product-tile manual" type="button" onClick={addManualProduct}>
                  <span className="product-tile-placeholder"><PackagePlus size={18} /></span>
                  <span className="product-tile-copy">
                    <strong>仓库里没有</strong>
                    <small>手动填写</small>
                  </span>
                </button>
              </div>
            )}

            {draft.products.length > 0 && (
              <ul className="usage-list">
                {draft.products.map((row) => (
                  <UsageRow
                    key={row.id}
                    product={products.find((item) => item.id === row.productId)}
                    row={row}
                    onChange={(changes) => updateProduct(row.id, changes)}
                    onRemove={() => setDraft((current) => ({ ...current, materialCost: "", products: current.products.filter((item) => item.id !== row.id) }))}
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="editor-total" aria-live="polite">
          <span>本次花费</span>
          <strong>{total > 0 ? money(total, true) : "—"}</strong>
        </div>

        <Field label="效果">
          <StarRating value={Number(draft.effectRating || 0)} onChange={(value) => update({ effectRating: value ? String(value) : "" })} />
        </Field>

        <Field hint={draft.nextSuggestedDate ? `将在首页提醒` : "设置后首页会提醒你"} label="下次洗车">
          <div className="quick-dates">
            {[7, 14, 21, 30].map((days) => {
              const date = addDays(draft.date, days);
              return (
                <button
                  className={draft.nextSuggestedDate === date ? "chip active" : "chip"}
                  key={days}
                  type="button"
                  onClick={() => update({ nextSuggestedDate: draft.nextSuggestedDate === date ? "" : date })}
                >
                  {days === 7 ? "1 周后" : days === 14 ? "2 周后" : days === 21 ? "3 周后" : "1 个月后"}
                </button>
              );
            })}
            <input aria-label="自定义下次洗车日期" className="quick-date-input" type="date" value={draft.nextSuggestedDate} onChange={(event) => update({ nextSuggestedDate: event.target.value })} />
          </div>
        </Field>

        <details className="editor-more">
          <summary>更多信息（里程、用时、地点、备注）</summary>
          <div className="editor-row">
            <NumberField label="里程" suffix="km" value={draft.odometer === "0" ? "" : draft.odometer} onChange={(value) => update({ odometer: value })} />
            <NumberField label="用时" suffix="分钟" value={draft.minutes} onChange={(value) => update({ minutes: value })} />
          </div>
          {isDiy ? (
            <Field label="步骤">
              <ChipGroup
                label="步骤"
                multiple
                options={[...new Set([...washStepOptions.filter((step) => step !== "其他"), ...selectedItems])].map((item) => ({ value: item, label: item }))}
                value={selectedItems}
                onChange={toggleItem}
              />
            </Field>
          ) : (
            <TextField label="地点" value={draft.location} onChange={(value) => update({ location: value })} />
          )}
          <TextField label="备注" placeholder="天气、施工感受…" value={draft.notes} onChange={(value) => update({ notes: value })} />
        </details>
      </form>
    </Sheet>
  );
}

type SaveableRow = WashProductUsageDraft & { saveToWarehouse?: boolean };

function UsageRow({
  row,
  product,
  onChange,
  onRemove,
}: {
  row: SaveableRow;
  product?: WashProduct;
  onChange: (changes: Partial<SaveableRow>) => void;
  onRemove: () => void;
}) {
  const cost = resolveWashProductUsageCost(row);
  const linked = Boolean(row.productId);
  return (
    <li className="usage-row">
      <div className="usage-row-head">
        {linked ? (
          <div className="usage-row-title">
            <strong>{row.name}</strong>
            <small>{[product?.brand, row.category, row.dilutionRatio].filter(Boolean).join(" · ")}</small>
          </div>
        ) : (
          <div className="editor-row usage-manual">
            <TextField label="名称" placeholder="例如 PA 预洗液" value={row.name} onChange={(value) => onChange({ name: value })} />
            <SelectField
              label="类型"
              options={productCategoryOptions.map((item) => ({ value: item, label: item }))}
              value={row.category}
              onChange={(value) => onChange({ category: value, step: getDefaultWashStepForProductCategory(value) })}
            />
          </div>
        )}
        <button aria-label={`移除 ${row.name || "耗材"}`} className="icon-button" type="button" onClick={onRemove}>
          <X size={16} />
        </button>
      </div>
      <div className="usage-row-fields">
        <SelectField label="步骤" options={washStepOptions.map((item) => ({ value: item, label: item }))} value={row.step} onChange={(value) => onChange({ step: value })} />
        <NumberField label="用量" placeholder="可选" value={row.usedAmount} onChange={(value) => onChange({ usedAmount: value })} />
        <SelectField
          label="单位"
          options={(["ml", "L", "g", "pcs"] as const).map((item) => ({ value: item, label: item }))}
          value={row.usedUnit ?? "ml"}
          onChange={(value) => onChange({ usedUnit: value as WashProductUsage["usedUnit"] })}
        />
      </div>
      {!linked && (
        <div className="usage-row-fields">
          <NumberField label="购买价" prefix="¥" value={row.purchasePrice} onChange={(value) => onChange({ purchasePrice: value })} />
          <NumberField label="容量" value={row.capacity} onChange={(value) => onChange({ capacity: value })} />
          <SelectField
            label="容量单位"
            options={(["ml", "L", "g", "kg", "pcs"] as const).map((item) => ({ value: item, label: item }))}
            value={row.capacityUnit ?? "ml"}
            onChange={(value) => onChange({ capacityUnit: value as WashProductUsage["capacityUnit"], usedUnit: getSuggestedWashUsageUnit(value as WashProductUsage["capacityUnit"]) })}
          />
        </div>
      )}
      <div className="usage-row-foot">
        <span>
          {cost > 0
            ? `约 ${money(cost, true)}`
            : row.usedAmount
              ? "缺少购买价或容量，无法估算成本"
              : "填写用量后自动估算成本"}
        </span>
        {!linked && row.name.trim() && (
          <label className="inline-check">
            <input checked={Boolean(row.saveToWarehouse)} type="checkbox" onChange={(event) => onChange({ saveToWarehouse: event.target.checked })} />
            同时加入仓库
          </label>
        )}
      </div>
    </li>
  );
}

function stripEntity(record: WashRecord) {
  const { id: _id, userId: _userId, ...rest } = record;
  return rest;
}
