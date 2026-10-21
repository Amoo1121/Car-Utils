import { BellRing, Receipt } from "lucide-react";
import { useId, useMemo, useState, type FormEvent } from "react";
import {
  addExpenseRecordToStore,
  buildExpenseRecord,
  createEmptyExpenseDraft,
  createExpenseDraft,
  expenseCategories,
  expenseCategoryMeta,
  paymentMethods,
  updateExpenseRecordInStore,
  validateExpenseDraft,
  type ExpenseDraft,
} from "../../domain/expense/expenseService";
import { estimateOdometer } from "../../domain/vehicle/odometer";
import { addDays, type ExpenseCategory, type ExpenseRecord } from "../../shared/carData";
import { useWorkspace } from "../../app/workspace";
import { ChipGroup, Field, NumberField, SelectField, TextField } from "../../ui/fields";
import { km, money, parseNumber } from "../../ui/format";
import { Sheet } from "../../ui/Sheet";
import { EditorFooter, submitOnModEnter } from "./EditorFooter";

function addMonths(date: string, months: number) {
  const value = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1 + months, Number(date.slice(8, 10)));
  return addDays(`${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`, 0);
}

export function ExpenseEditor({
  recordId,
  category,
  renewFromId,
  onClose,
}: {
  recordId?: string;
  category?: ExpenseCategory;
  renewFromId?: string;
  onClose: () => void;
}) {
  const { vehicle, expenseRecords, allFuelRecords, washRecords, mutate, remove } = useWorkspace();
  const formId = useId();
  const existing = recordId ? expenseRecords.find((record) => record.id === recordId) : undefined;
  const renewFrom = renewFromId ? expenseRecords.find((record) => record.id === renewFromId) : undefined;
  const estimate = useMemo(
    () => (vehicle ? estimateOdometer(vehicle, [...allFuelRecords, ...washRecords, ...expenseRecords]) : undefined),
    [allFuelRecords, expenseRecords, vehicle, washRecords],
  );

  const [initial] = useState<ExpenseDraft>(() => {
    if (existing) return createExpenseDraft(existing);
    if (renewFrom) {
      // Renewing a reminder: same item, today, new due point.
      const base = createExpenseDraft(renewFrom);
      return { ...createEmptyExpenseDraft(renewFrom.category), title: base.title, vendor: base.vendor, amount: base.amount, paymentMethod: base.paymentMethod };
    }
    return createEmptyExpenseDraft(category ?? "maintenance");
  });
  const [draft, setDraft] = useState(initial);
  const [touched, setTouched] = useState(false);
  const errors = validateExpenseDraft(draft);
  const meta = expenseCategoryMeta(draft.category);
  const [showDue, setShowDue] = useState(() => Boolean(initial.nextDueDate || initial.nextDueOdometer) || meta.recurring);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  // Vendors used before for this category, for one-tap fill.
  const vendorSuggestions = useMemo(
    () => [...new Set(expenseRecords.filter((record) => record.category === draft.category && record.vendor).map((record) => record.vendor!))].slice(0, 4),
    [draft.category, expenseRecords],
  );

  if (!vehicle) return null;

  function update(changes: Partial<ExpenseDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function changeCategory(next: ExpenseCategory) {
    update({ category: next });
    if (expenseCategoryMeta(next).recurring) setShowDue(true);
  }

  const baseKm = parseNumber(draft.odometer) ?? (estimate?.estimatedToday ? Math.round(estimate.estimatedToday) : undefined);

  function save(keepOpen: boolean) {
    setTouched(true);
    if (!vehicle || Object.keys(errors).length > 0) return;
    const input = buildExpenseRecord(vehicle.id, showDue ? draft : { ...draft, nextDueDate: "", nextDueOdometer: "" });
    const ok = existing
      ? mutate((store, user) => updateExpenseRecordInStore(store, user, existing.id, { ...stripEntity(existing), ...input }), "费用已更新")
      : mutate((store, user) => addExpenseRecordToStore(store, user, input), `已记录${input.title} ${money(input.amount)}`);
    if (!ok) return;
    if (keepOpen) {
      setDraft(createEmptyExpenseDraft(draft.category));
      setTouched(false);
    } else onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save(false);
  }

  const show = (key: keyof ExpenseDraft) => (touched ? errors[key] : undefined);

  return (
    <Sheet
      dirty={dirty}
      footer={
        <EditorFooter
          formId={formId}
          isEdit={Boolean(existing)}
          onDelete={existing ? () => { remove("expense", existing.id, existing.title); onClose(); } : undefined}
          onSaveAndNew={existing ? undefined : () => save(true)}
        />
      }
      icon={<Receipt size={20} />}
      open
      subtitle={renewFrom ? `续期：${renewFrom.title}` : vehicle.nickname}
      title={existing ? "编辑费用" : renewFrom ? "记录续期" : "记录费用"}
      tone="expense"
      onClose={onClose}
    >
      <form className="editor-form" id={formId} noValidate onKeyDown={submitOnModEnter} onSubmit={submit}>
        <Field label="类别">
          <ChipGroup
            label="类别"
            options={expenseCategories.map((item) => ({ value: item.id, label: item.label }))}
            value={draft.category}
            onChange={changeCategory}
          />
        </Field>

        <section className="editor-hero">
          <NumberField data-autofocus error={show("amount")} fieldClassName="field-hero" label="金额" prefix="¥" value={draft.amount} onChange={(value) => update({ amount: value })} />
        </section>

        <TextField label="项目名称" placeholder={meta.label} value={draft.title} onChange={(value) => update({ title: value })} />

        <div className="editor-row">
          <TextField error={show("date")} label="日期" type="date" value={draft.date} onChange={(value) => update({ date: value })} />
          <NumberField
            hint={estimate?.estimatedToday && !existing ? `估计现在约 ${km(Math.round(estimate.estimatedToday))}` : undefined}
            label="里程"
            suffix="km"
            value={draft.odometer}
            onChange={(value) => update({ odometer: value })}
          />
        </div>

        <div className="editor-row">
          <TextField label="商家 / 门店" list={`${formId}-vendors`} placeholder="可选" value={draft.vendor} onChange={(value) => update({ vendor: value })} />
          <SelectField
            label="支付方式"
            options={[{ value: "", label: "未记录" }, ...paymentMethods.map((item) => ({ value: item.id, label: item.label }))]}
            value={draft.paymentMethod}
            onChange={(value) => update({ paymentMethod: value as ExpenseDraft["paymentMethod"] })}
          />
        </div>
        <datalist id={`${formId}-vendors`}>
          {vendorSuggestions.map((vendor) => (
            <option key={vendor} value={vendor} />
          ))}
        </datalist>

        {showDue ? (
          <section className="editor-section">
            <header className="editor-section-head">
              <div>
                <strong>
                  <BellRing size={15} /> 下次提醒
                </strong>
                <small>到期前 30 天或 1000 km 会出现在首页</small>
              </div>
              <button className="link-button" type="button" onClick={() => { setShowDue(false); update({ nextDueDate: "", nextDueOdometer: "" }); }}>
                不需要提醒
              </button>
            </header>
            <div className="editor-row">
              <TextField error={show("nextDueDate")} label="到期日期" type="date" value={draft.nextDueDate} onChange={(value) => update({ nextDueDate: value })} />
              <NumberField error={show("nextDueOdometer")} label="到期里程" suffix="km" value={draft.nextDueOdometer} onChange={(value) => update({ nextDueOdometer: value })} />
            </div>
            <div className="quick-dates">
              {[6, 12, 24].map((months) => (
                <button className="chip" key={months} type="button" onClick={() => update({ nextDueDate: addMonths(draft.date, months) })}>
                  {months === 24 ? "2 年后" : months === 12 ? "1 年后" : "半年后"}
                </button>
              ))}
              {baseKm != null &&
                [5000, 10000].map((distance) => (
                  <button className="chip" key={distance} type="button" onClick={() => update({ nextDueOdometer: String(baseKm + distance) })}>
                    +{distance / 1000}k km
                  </button>
                ))}
              {(meta.suggestedMonths || meta.suggestedKm) && (
                <button
                  className="chip chip-accent"
                  type="button"
                  onClick={() =>
                    update({
                      nextDueDate: meta.suggestedMonths ? addMonths(draft.date, meta.suggestedMonths) : draft.nextDueDate,
                      nextDueOdometer: meta.suggestedKm && baseKm != null ? String(baseKm + meta.suggestedKm) : draft.nextDueOdometer,
                    })
                  }
                >
                  按{meta.label}常规周期
                </button>
              )}
            </div>
          </section>
        ) : (
          <button className="link-button" type="button" onClick={() => setShowDue(true)}>
            + 设置下次到期提醒
          </button>
        )}

        <TextField label="备注" placeholder="例如 更换了机油和机滤" value={draft.note} onChange={(value) => update({ note: value })} />
      </form>
    </Sheet>
  );
}

function stripEntity(record: ExpenseRecord) {
  const { id: _id, userId: _userId, ...rest } = record;
  return rest;
}
