import { Car, Check, Droplets, ExternalLink, PackagePlus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { calculateWashProductInventory } from "../../domain/analytics/washAnalytics";
import { getWashProductPreset } from "../../domain/wash/washProductCatalog";
import { filterActive, filterDeleted, recordCost } from "../../shared/carData";
import { useWorkspace } from "../../app/workspace";
import { Meter } from "../../ui/charts";
import { Segmented } from "../../ui/fields";
import { money, num } from "../../ui/format";
import { WashProductPresetImage } from "../wash/WashProductPresetPicker";

export function GaragePage({ sub }: { sub?: string }) {
  const { navigate } = useWorkspace();
  const tab = sub === "supplies" ? "supplies" : "vehicles";
  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <h1>车库</h1>
          <p>{tab === "vehicles" ? "管理车辆、归档已卖出的车" : "洗车药剂与工具库存"}</p>
        </div>
        <Segmented
          label="车库分区"
          options={[
            { value: "vehicles", label: "车辆", icon: <Car size={15} /> },
            { value: "supplies", label: "耗材仓库", icon: <Droplets size={15} /> },
          ]}
          value={tab}
          onChange={(value) => navigate("garage", value === "supplies" ? "supplies" : undefined)}
        />
      </header>
      {tab === "vehicles" ? <Vehicles /> : <Supplies />}
    </div>
  );
}

function Vehicles() {
  const { store, user, allVehicles, vehicle, selectVehicle, openEditor, restore } = useWorkspace();
  const deleted = filterDeleted(store.vehicles).filter((item) => item.userId === user.id);
  const active = allVehicles.filter((item) => !item.isArchived);
  const archived = allVehicles.filter((item) => item.isArchived);

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    const add = (vehicleId: string, amount: number) => {
      const current = map.get(vehicleId) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += amount;
      map.set(vehicleId, current);
    };
    filterActive(store.fuelRecords).forEach((record) => add(record.vehicleId, recordCost(record)));
    filterActive(store.washRecords).forEach((record) => add(record.vehicleId, record.cost || 0));
    filterActive(store.expenseRecords).forEach((record) => add(record.vehicleId, record.amount || 0));
    return map;
  }, [store.expenseRecords, store.fuelRecords, store.washRecords]);

  const card = (item: (typeof allVehicles)[number]) => {
    const stat = stats.get(item.id);
    const current = item.id === vehicle?.id;
    return (
      <article className={current ? "vehicle-card current" : "vehicle-card"} key={item.id}>
        <div className="vehicle-card-head">
          <span className="vehicle-card-icon"><Car size={22} /></span>
          <div>
            <h3>{item.nickname}</h3>
            <p>{[`${item.brand} ${item.model}`.trim(), item.year, item.energyType].filter(Boolean).join(" · ")}</p>
          </div>
          {item.plate && <span className="plate">{item.plate}</span>}
        </div>
        <dl className="vehicle-card-stats">
          <div><dt>记录</dt><dd>{stat?.count ?? 0} 条</dd></div>
          <div><dt>累计花费</dt><dd>{money(stat?.total ?? 0)}</dd></div>
          <div>
            <dt>{item.energyType === "纯电" ? "电池" : "油箱"}</dt>
            <dd>{item.energyType === "纯电" ? (item.batterySize ? `${item.batterySize} kWh` : "未填写") : item.tankSize ? `${item.tankSize} L` : "未填写"}</dd>
          </div>
        </dl>
        <div className="vehicle-card-actions">
          {current ? (
            <span className="badge badge-accent"><Check size={13} /> 当前车辆</span>
          ) : (
            <button className="button button-soft button-sm" type="button" onClick={() => selectVehicle(item.id)}>设为当前</button>
          )}
          <button className="button button-ghost button-sm" type="button" onClick={() => openEditor({ kind: "vehicle", vehicleId: item.id })}>编辑</button>
        </div>
      </article>
    );
  };

  return (
    <>
      <div className="card-grid">
        {active.map(card)}
        <button className="vehicle-card add" type="button" onClick={() => openEditor({ kind: "vehicle" })}>
          <Plus size={24} />
          <span>添加车辆</span>
        </button>
      </div>
      {archived.length > 0 && (
        <section>
          <h2 className="section-label">已归档</h2>
          <div className="card-grid muted">{archived.map(card)}</div>
        </section>
      )}
      {deleted.length > 0 && (
        <section>
          <h2 className="section-label">已删除</h2>
          <ul className="card simple-list">
            {deleted.map((item) => (
              <li key={item.id}>
                <span>{item.nickname} <small>{item.brand} {item.model}</small></span>
                <button className="button button-soft button-sm" type="button" onClick={() => restore("vehicle", item.id)}>
                  <RotateCcw size={14} /> 恢复
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Supplies() {
  const { store, user, washProducts, openEditor, restore } = useWorkspace();
  const [category, setCategory] = useState("all");
  const products = filterActive(washProducts);
  const deleted = filterDeleted(washProducts);
  const userWash = useMemo(() => store.washRecords.filter((record) => record.userId === user.id), [store.washRecords, user.id]);
  const categories = [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const visible = category === "all" ? products : products.filter((product) => product.category === category);

  return (
    <>
      <div className="filter-bar">
        <div className="chip-group" role="radiogroup" aria-label="耗材类型">
          {["all", ...categories].map((item) => (
            <button aria-checked={category === item} className={category === item ? "chip active" : "chip"} key={item} role="radio" type="button" onClick={() => setCategory(item)}>
              {item === "all" ? `全部 ${products.length}` : item}
            </button>
          ))}
        </div>
        <button className="button button-primary button-sm" type="button" onClick={() => openEditor({ kind: "product" })}>
          <PackagePlus size={15} /> 添加耗材
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="card card-empty">
          <Droplets size={22} />
          <p>仓库还是空的。内置了 Koch-Chemie 等常用药剂资料，选一下即可带入图片、容量和稀释比例。</p>
          <button className="button button-soft button-sm" type="button" onClick={() => openEditor({ kind: "product" })}>从产品库添加</button>
        </div>
      ) : (
        <div className="card-grid supplies-grid">
          {visible.map((product) => {
            const preset = getWashProductPreset(product.presetId);
            const image = preset?.imageUrl ?? product.imageUrl;
            const stock = calculateWashProductInventory(product, userWash);
            const ratio = stock.purchased > 0 ? stock.remaining / stock.purchased : 0;
            const latest = product.purchases.at(-1);
            const source = product.sourceUrl ?? preset?.sourceUrl;
            return (
              <article className="supply-card" key={product.id}>
                <button className="supply-card-main" type="button" onClick={() => openEditor({ kind: "product", productId: product.id, mode: "edit" })}>
                  {image ? <WashProductPresetImage alt="" src={image} /> : <span className="product-tile-placeholder large"><Droplets size={24} /></span>}
                  <span className="supply-card-copy">
                    <small>{[product.brand, product.category].filter(Boolean).join(" · ")}</small>
                    <strong>{product.name}</strong>
                    {preset?.defaultDilutionRatio && <small>稀释 {preset.defaultDilutionRatio}</small>}
                  </span>
                </button>
                {stock.hasCapacity ? (
                  <div className="supply-stock">
                    <div>
                      <strong>{formatStock(stock.remaining, stock.unit)}</strong>
                      <small>/ {formatStock(stock.purchased, stock.unit)} · 剩 {Math.round(ratio * 100)}%</small>
                    </div>
                    <Meter label={`剩余 ${Math.round(ratio * 100)}%`} max={1} tone={ratio < 0.15 ? "danger" : ratio < 0.3 ? "warn" : "accent"} value={ratio} />
                  </div>
                ) : (
                  <p className="supply-stock muted">{stock.used > 0 ? `已用 ${num(stock.used, 1)} ${stock.unit}` : "未记录容量"}</p>
                )}
                <footer className="supply-card-foot">
                  <small>
                    {latest ? `${latest.date}${latest.purchasePrice != null ? ` · ${money(latest.purchasePrice, true)}` : ""}` : "无购买记录"}
                    {product.purchases.length > 1 ? ` · 共 ${product.purchases.length} 次` : ""}
                  </small>
                  <span>
                    {source && (
                      <a aria-label="产品资料" className="icon-button" href={source} rel="noreferrer" target="_blank"><ExternalLink size={14} /></a>
                    )}
                    <button className="button button-soft button-sm" type="button" onClick={() => openEditor({ kind: "product", productId: product.id, mode: "replenish" })}>补货</button>
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      )}

      {deleted.length > 0 && (
        <section>
          <h2 className="section-label">已删除</h2>
          <ul className="card simple-list">
            {deleted.map((product) => (
              <li key={product.id}>
                <span>{product.name} <small>{product.category}</small></span>
                <button className="button button-soft button-sm" type="button" onClick={() => restore("product", product.id)}>
                  <RotateCcw size={14} /> 恢复
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Shows sub-litre / sub-kilo remainders in ml / g so a nearly full 1 L bottle doesn't read "1 L". */
function formatStock(value: number, unit: string) {
  if ((unit === "L" || unit === "kg") && value < 1) return `${num(value * 1000, 0)} ${unit === "L" ? "ml" : "g"}`;
  return `${num(value, unit === "L" || unit === "kg" ? 2 : 0)} ${unit}`;
}
