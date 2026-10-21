import { PackagePlus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { productCategoryOptions } from "../../domain/wash/washOptions";
import {
  addWashProductPurchaseToStore,
  addWashProductToStore,
  applyWashProductPresetToDraft,
  buildWashProductSubmission,
  createEmptyWashProductWarehouseDraft,
  createWashProductDraftFromProduct,
  createWashProductReplenishDraftFromProduct,
  updateWashProductInStore,
  type WashProductDraft,
} from "../../domain/wash/washProductService";
import { today, type WashProductPurchase } from "../../shared/carData";
import { useWorkspace } from "../../app/workspace";
import { NumberField, SelectField, TextField } from "../../ui/fields";
import { Sheet } from "../../ui/Sheet";
import { WashProductMetadataLookup } from "../wash/WashProductMetadataLookup";
import { WashProductPresetImage, WashProductPresetPicker } from "../wash/WashProductPresetPicker";
import { EditorFooter, submitOnModEnter } from "./EditorFooter";

export function ProductEditor({
  productId,
  mode = productId ? "edit" : "add",
  onClose,
}: {
  productId?: string;
  mode?: "add" | "edit" | "replenish";
  onClose: () => void;
}) {
  const { washProducts, mutate, remove } = useWorkspace();
  const formId = useId();
  const product = productId ? washProducts.find((item) => item.id === productId) : undefined;
  const effectiveMode = product ? mode : "add";
  const [initial] = useState<WashProductDraft>(() =>
    product
      ? effectiveMode === "replenish"
        ? createWashProductReplenishDraftFromProduct(product, today())
        : createWashProductDraftFromProduct(product, today())
      : createEmptyWashProductWarehouseDraft(),
  );
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const replenish = effectiveMode === "replenish";

  function update(changes: Partial<WashProductDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  /** Editing name/brand by hand detaches the preset image and description. */
  function updateIdentity(changes: Partial<WashProductDraft>) {
    setDraft((current) => ({
      ...current,
      ...changes,
      presetId: "",
      ...(current.presetId ? { imageUrl: "", description: "", sourceUrl: "" } : {}),
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    const submission = buildWashProductSubmission({ mode: effectiveMode, productId: product?.id ?? "" }, draft, product);
    if (!submission) return;
    let ok = false;
    if (submission.type === "add") {
      ok = mutate((store, user) => addWashProductToStore(store, user, submission.product)?.store, `已加入仓库：${submission.product.name}`);
    } else if (submission.type === "update") {
      ok = mutate((store, user) => updateWashProductInStore(store, user, submission.productId, submission.product), "耗材已更新");
    } else {
      ok = mutate((store, user) => addWashProductPurchaseToStore(store, user, submission.productId, submission.purchase), "已记录补货");
    }
    if (ok) onClose();
  }

  const image = draft.imageUrl;
  const nameError = touched && !draft.name.trim() ? "请输入名称" : undefined;
  const replenishError =
    touched && replenish && !draft.purchasePrice && !draft.capacity && !draft.note.trim() ? "请至少填写价格或容量" : undefined;

  return (
    <Sheet
      dirty={dirty}
      footer={
        <EditorFooter
          formId={formId}
          isEdit={effectiveMode === "edit"}
          saveLabel={replenish ? "记录补货" : effectiveMode === "edit" ? "保存" : "加入仓库"}
          onDelete={product && effectiveMode === "edit" ? () => { remove("product", product.id, product.name); onClose(); } : undefined}
        />
      }
      icon={<PackagePlus size={20} />}
      open
      size="lg"
      subtitle={replenish ? product?.name : "洗车药剂、毛巾、工具"}
      title={replenish ? "补货" : effectiveMode === "edit" ? "编辑耗材" : "添加耗材"}
      tone="wash"
      onClose={onClose}
    >
      <form className="editor-form" id={formId} noValidate onKeyDown={submitOnModEnter} onSubmit={submit}>
        {effectiveMode === "add" && (
          <WashProductPresetPicker selectedPresetId={draft.presetId} onSelect={(preset) => setDraft((current) => applyWashProductPresetToDraft(current, preset))} />
        )}

        {!replenish && (
          <>
            {image && (
              <div className="product-preview">
                <WashProductPresetImage alt={draft.name} src={image} />
                <div>
                  <strong>{draft.name}</strong>
                  <small>{draft.description || draft.brand}</small>
                </div>
              </div>
            )}
            <div className="editor-row">
              <TextField data-autofocus error={nameError} label="名称" value={draft.name} onChange={(value) => updateIdentity({ name: value })} />
              <TextField label="品牌" value={draft.brand} onChange={(value) => updateIdentity({ brand: value })} />
            </div>
            <SelectField
              label="类型"
              options={[...new Set([...productCategoryOptions, draft.category])].map((item) => ({ value: item, label: item }))}
              value={draft.category}
              onChange={(value) => update({ category: value })}
            />
            <WashProductMetadataLookup
              query={`${draft.brand} ${draft.name}`}
              onApply={(candidate) =>
                setDraft((current) => ({
                  ...current,
                  presetId: "",
                  imageUrl: candidate.imageUrl ?? current.imageUrl,
                  description: candidate.description || current.description,
                  sourceUrl: candidate.sourceUrl,
                  category: candidate.category ?? current.category,
                  capacity: candidate.capacity != null ? String(candidate.capacity) : current.capacity,
                  capacityUnit: candidate.capacityUnit ?? current.capacityUnit,
                }))
              }
            />
          </>
        )}

        <section className="editor-section">
          <header className="editor-section-head">
            <div>
              <strong>{replenish ? "本次购买" : effectiveMode === "edit" ? "最近一次购买" : "购买信息"}</strong>
              <small>填写价格和容量后，每次洗车会自动估算耗材成本和剩余库存</small>
            </div>
          </header>
          <div className="editor-row">
            <TextField label="购买日期" type="date" value={draft.purchaseDate} onChange={(value) => update({ purchaseDate: value })} />
            <NumberField error={replenishError} label="价格" prefix="¥" value={draft.purchasePrice} onChange={(value) => update({ purchasePrice: value })} />
          </div>
          <div className="editor-row">
            <NumberField label="容量" value={draft.capacity} onChange={(value) => update({ capacity: value })} />
            <SelectField
              label="单位"
              options={(["ml", "L", "g", "kg", "pcs"] as const).map((item) => ({ value: item, label: item }))}
              value={draft.capacityUnit ?? "ml"}
              onChange={(value) => update({ capacityUnit: value as WashProductPurchase["capacityUnit"] })}
            />
          </div>
        </section>

        {!replenish && (
          <details className="editor-more">
            <summary>图片、说明与来源</summary>
            <TextField label="图片地址" placeholder="https://" type="url" value={draft.imageUrl} onChange={(value) => update({ presetId: "", imageUrl: value })} />
            <TextField label="说明" value={draft.description} onChange={(value) => update({ presetId: "", description: value })} />
            <TextField label="资料来源" placeholder="https://" type="url" value={draft.sourceUrl} onChange={(value) => update({ presetId: "", sourceUrl: value })} />
          </details>
        )}
        <TextField label="备注" value={draft.note} onChange={(value) => update({ note: value })} />
      </form>
    </Sheet>
  );
}
